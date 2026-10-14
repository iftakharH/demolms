/**
 * Generates the sample lesson video + poster into public/uploads/videos.
 * Needs ffmpeg on PATH. Run via `npm run assets` or automatically from
 * `npm run dev` / `npm run build` when the file is missing.
 *
 * The clip burns in a running timecode so "resume where I left off" can be
 * verified by eye.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'public', 'uploads', 'videos');
fs.mkdirSync(outDir, { recursive: true });

const mp4 = path.join(outDir, 'sample.mp4');
const poster = path.join(outDir, 'sample-poster.jpg');
const force = process.argv.includes('--force');
const duration = 24;

function hasFfmpeg() {
  const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return res.status === 0;
}

/**
 * Windows font paths contain a colon, which the filtergraph parser eats.
 * Running ffmpeg with the fonts folder as cwd lets us reference them bare.
 */
const fontsDir = 'C:/Windows/Fonts';
const hasFonts = fs.existsSync(fontsDir);

function run(args) {
  const res = spawnSync('ffmpeg', args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    cwd: hasFonts ? fontsDir : root,
  });
  if (res.status !== 0) {
    const err = res.stderr?.toString().split('\n').slice(-12).join('\n') ?? 'unknown error';
    throw new Error(`ffmpeg failed:\n${err}`);
  }
}

if (!force && fs.existsSync(mp4) && fs.existsSync(poster)) {
  console.log('[assets] sample video already present, skipping (use --force to rebuild)');
  process.exit(0);
}

if (!hasFfmpeg()) {
  console.warn(
    '[assets] ffmpeg not found on PATH. Keeping whatever exists in public/uploads/videos.\n' +
      '         Install ffmpeg, or replace public/uploads/videos/sample.mp4 by hand.',
  );
  process.exit(0);
}

const font = hasFonts ? 'segoeui.ttf' : '';
const fontBold = hasFonts ? 'segoeuib.ttf' : '';
const fontArg = (file) => (file ? `fontfile=${file}:` : '');

const vf = [
  // subtle vignette-ish top band
  `drawbox=x=0:y=0:w=iw:h=90:color=0x12102A@1:t=fill`,
  `drawtext=${fontArg(fontBold)}text='DEMOLMS - SAMPLE LESSON':fontcolor=0xB0A0FF:fontsize=26:x=40:y=32`,
  `drawtext=${fontArg(font)}text='Video lessons play here, with captions and resume':fontcolor=0xFFFFFF:fontsize=40:x=(w-text_w)/2:y=250`,
  `drawtext=${fontArg(font)}text='%{pts\\:hms}':fontcolor=0x8B72FF:fontsize=132:x=(w-text_w)/2:y=(h-text_h)/2+30`,
  `drawtext=${fontArg(font)}text='Position is saved every few seconds and restored on return':fontcolor=0x9C99B5:fontsize=26:x=(w-text_w)/2:y=520`,
  `drawbox=x=0:y=690:w=iw*t/${duration}:h=8:color=0x6C4CF1@1:t=fill`,
].join(',');

console.log('[assets] rendering sample.mp4 with ffmpeg...');
run([
  '-y',
  '-f', 'lavfi', '-i', `color=c=0x171631:s=1280x720:d=${duration}:r=25`,
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
  '-vf', vf,
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'aac', '-b:a', '48k',
  '-shortest',
  '-movflags', '+faststart',
  mp4,
]);

console.log('[assets] rendering poster...');
run(['-y', '-ss', '6', '-i', mp4, '-frames:v', '1', '-q:v', '4', poster]);

const size = (fs.statSync(mp4).size / 1024).toFixed(0);
console.log(`[assets] done: public/uploads/videos/sample.mp4 (${size} KB) + poster`);
