r"""
Runs every phase suite in order against a freshly seeded database and prints one
summary. Use it before showing the demo, or after any change.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/run_all.py

The dev server must already be running (npm run dev).
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))

SUITES = [
    ("Phase 1 · auth + roles + MFA", "phase1_auth.py"),
    ("Phase 2 · public catalogue + SEO", "phase2_catalog.py"),
    ("Phase 3 · admin course builder", "phase3_builder.py"),
    ("Phase 4 · commerce + webhooks", "phase4_payments.py"),
    ("Phase 5 · learner player", "phase5_player.py"),
    ("Phase 6 · quizzes + grading", "phase6_assessment.py"),
    ("Phase 7 · certificates", "phase7_certificates.py"),
    ("Phase 8 · admin + auditor", "phase8_admin.py"),
    ("Phase 9 · notifications + outbox", "phase9_notifications.py"),
    ("Phase 10a · responsive", "phase10_responsive.py"),
    ("Phase 10b · full walkthrough", "phase10_walkthrough.py"),
    ("Phase 10c · print styles", "phase10_print.py"),
    ("Phase 10d · learner UX", "phase10_learner_ui.py"),
    ("Phase 10e · design system", "phase10e_design.py"),
]

summary: list[tuple[str, bool, str]] = []


def run(command: list[str], label: str) -> tuple[bool, str]:
    started = time.time()
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, shell=False)
    duration = time.time() - started
    output = (result.stdout or "") + (result.stderr or "")
    tail = [line for line in output.splitlines() if "checks passed" in line or line.startswith("failed:")]
    detail = " | ".join(tail) if tail else output.strip().splitlines()[-1] if output.strip() else "no output"
    return result.returncode == 0, f"{detail} ({duration:.0f}s)"


print("Seeding a clean demo database first...\n")
seed = subprocess.run(["npm", "run", "seed"], cwd=ROOT, capture_output=True, text=True, shell=True)
if seed.returncode != 0:
    print("Seeding failed:\n" + (seed.stdout or "") + (seed.stderr or ""))
    sys.exit(1)

for label, script in SUITES:
    path = os.path.join(HERE, script)
    if not os.path.exists(path):
        summary.append((label, False, "missing suite"))
        continue
    # Seed before every suite: it resets the demo data *and* clears rate-limit
    # blocks, so suites cannot interfere with each other.
    subprocess.run(["npm", "run", "seed"], cwd=ROOT, capture_output=True, text=True, shell=True)
    print(f"running {label} ...", flush=True)
    ok, detail = run([sys.executable, path], label)
    summary.append((label, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {detail}\n", flush=True)

passed = sum(1 for _, ok, _ in summary if ok)
print("=" * 70)
for label, ok, detail in summary:
    print(f"{'PASS' if ok else 'FAIL'}  {label:38} {detail}")
print("=" * 70)
print(f"{passed}/{len(summary)} suites passed")
sys.exit(0 if passed == len(summary) else 1)
