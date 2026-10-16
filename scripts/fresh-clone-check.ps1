<#
.SYNOPSIS
  Verifies that a clean checkout works: no database, no generated assets - just the
  files git tracks.

.DESCRIPTION
  Copies the working tree (excluding node_modules, .next, data/, .git and everything
  under public/uploads) into a scratch directory, puts back only the upload files git
  actually tracks, links node_modules from this checkout, and starts a fresh server on
  port 3200. Then checks that the boot seed created the database and regenerated the
  demo assets, and that the public pages render.

  This is the local stand-in for "deploy this from a fresh clone", so it is the check to
  run when the seed, the schema or the boot path changes.

.EXAMPLE
  powershell -File scripts\fresh-clone-check.ps1
#>
[CmdletBinding()]
param(
  [int]$Port = 3200,
  [string]$Scratch = (Join-Path $env:TEMP 'opencode\lms-fresh')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failures = 0

function Check([string]$name, [bool]$condition, [string]$detail = '') {
  if ($condition) { Write-Host "PASS  $name" } else { Write-Host "FAIL  $name  -- $detail"; $script:failures++ }
}

Write-Host "scratch: $Scratch"
if (Test-Path $Scratch) { Remove-Item -Recurse -Force $Scratch }
New-Item -ItemType Directory -Path $Scratch | Out-Null

# --- a clean checkout: tracked files only, minus the ignored/generated directories ---
robocopy $root $Scratch /E /NFL /NDL /NJH /NJS /NP `
  /XD node_modules .next .git data public\uploads coverage `
  /XF *.tsbuildinfo | Out-Null

# --- put back only the upload files git tracks (the sample video and its poster/VTT) ---
New-Item -ItemType Directory -Force -Path (Join-Path $Scratch 'public\uploads\videos') | Out-Null
$trackedUploads = git -C $root ls-files public/uploads
foreach ($file in $trackedUploads) {
  $source = Join-Path $root $file
  $target = Join-Path $Scratch $file
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item $source $target -Force
}
Check "clean checkout has only the tracked upload files" ($trackedUploads.Count -le 3) "$($trackedUploads.Count) tracked uploads"

# --- dependencies are not part of a clean clone. `npm install` needs the network,
#     which this machine is not allowed to assume, so the installed tree is copied
#     instead - a junction is NOT good enough: Turbopack refuses to resolve a
#     node_modules symlink that leaves the project root. What stays unverified by
#     this script is therefore only the install step itself. ---
Write-Host "copying node_modules (this takes a minute)..."
robocopy (Join-Path $root 'node_modules') (Join-Path $Scratch 'node_modules') /E /NFL /NDL /NJH /NJS /NP /MT:16 | Out-Null
Check "node_modules copied" (Test-Path (Join-Path $Scratch 'node_modules\next\package.json'))
Check "database absent before first boot" (-not (Test-Path (Join-Path $Scratch 'data\demolms.db')))

# --- first boot: predev must create the schema, seed, and regenerate the assets ---
$log = Join-Path $Scratch 'fresh-boot.log'
$env:PORT = $Port
$server = Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $Scratch `
  -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -WindowStyle Hidden
$started = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest "http://localhost:$Port/" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) { $started = $true; break }
  } catch { }
}
Check "clean checkout boots and serves the home page" $started "no 200 from port $Port"
Check "boot created the database" (Test-Path (Join-Path $Scratch 'data\demolms.db'))

$seedLog = if (Test-Path $log) { Get-Content $log -Raw } else { '' }
Check "boot seeded the demo data" ($seedLog -match 'empty database - seeding|\[db\] ready')

# --- assets the seed is responsible for must exist again, without ffmpeg being involved ---
foreach ($asset in @('videos\sample.vtt', 'resources\dashboard-rubric.pdf', 'resources\starter-code.txt')) {
  Check "seed regenerated $asset" (Test-Path (Join-Path $Scratch "public\uploads\$asset"))
}

if ($started) {
  try {
    $courses = Invoke-WebRequest "http://localhost:$Port/courses" -UseBasicParsing -TimeoutSec 20
    Check "catalogue renders with seeded courses" ($courses.StatusCode -eq 200 -and $courses.Content -match 'lesson')
    Check "covers are drawn, not files" ($courses.Content -match 'viewBox="0 0 800 450"')
    $video = Invoke-WebRequest "http://localhost:$Port/uploads/videos/sample.mp4" -UseBasicParsing -Method Head -TimeoutSec 20
    Check "sample video is served" ($video.StatusCode -eq 200)
  } catch {
    Check "public pages respond" $false $_.Exception.Message
  }
}

# --- tear down ---
try { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue } catch { }
Get-Process node -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and $_.StartTime -gt (Get-Date).AddMinutes(-10) } |
  ForEach-Object {
    # only kill the process group started from the scratch directory
    try {
      $cmdline = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
      if ($cmdline -and $cmdline -like "*$Scratch*") { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
    } catch { }
  }

Write-Host ''
if ($failures -eq 0) { Write-Host "clean-checkout check: all checks passed" } else { Write-Host "clean-checkout check: $failures failed" }
Write-Host "scratch directory kept for inspection: $Scratch"
exit $(if ($failures -eq 0) { 0 } else { 1 })
