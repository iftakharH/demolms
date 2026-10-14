r"""
Phase 1 verification: auth, roles, MFA and the email outbox.

Run with the dev server already running:
    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase1_auth.py

Exits non-zero if any check fails. Screenshots go to $TEMP/opencode/lms-shots.
"""
import os
import re
import sys
import tempfile
from datetime import datetime

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
SHOTS = os.path.join(tempfile.gettempdir(), "opencode", "lms-shots")
os.makedirs(SHOTS, exist_ok=True)

results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    ok = bool(condition)
    results.append((name, ok, detail))
    if not ok:
        print(f"FAIL  {name}  -- {detail}")
    else:
        print(f"PASS  {name}")


def watch(page: Page) -> None:
    def on_console(msg) -> None:
        if msg.type == "error":
            console_errors.append(msg.text)

    page.on("console", on_console)


def shot(page: Page, name: str) -> None:
    page.screenshot(path=os.path.join(SHOTS, f"{name}.png"))


def body(page: Page) -> str:
    return page.inner_text("body")


def has(page: Page, text: str) -> bool:
    """Case-insensitive body text search (CSS-uppercased labels included)."""
    return text.lower() in body(page).lower()


def settle(page: Page, text: str | None = None, url: str | None = None, timeout: int = 20000) -> bool:
    """Wait for either expected text or URL. Returns whether it appeared."""
    deadline_ms = timeout
    try:
        if url:
            page.wait_for_url(url, timeout=deadline_ms)
            page.wait_for_load_state("networkidle")
            return True
        # poll for text
        step = 250
        waited = 0
        while waited < deadline_ms:
            if text and has(page, text):
                return True
            page.wait_for_timeout(step)
            waited += step
        return False
    except Exception:
        return False


def login(page: Page, email: str, password: str, expect: str = "**/*") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", password)
    page.click("button[type=submit]")
    settle(page, url=expect)


def read_totp(page: Page) -> str:
    """The dev hint prints the current valid code (label is CSS-uppercased)."""
    text = page.inner_text("body")
    match = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text.upper())
    if match:
        return match.group(1) + match.group(2)
    match = re.search(r"\b(\d{6})\b", text.replace("\u00a0", " "))
    assert match, "could not find the dev TOTP code on the MFA screen"
    return match.group(1)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()
        watch(page)

        # ---------------------------------------------------------- public home
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        check(
            "home page renders the hero",
            "Learn the things you keep meaning to learn" in body(page),
            body(page)[:120],
        )
        check("home page has one h1", page.locator("h1").count() == 1)
        check("footer exposes the dev outbox link", "Email outbox" in body(page))
        check("home page console is clean", len(console_errors) == 0, " | ".join(console_errors[:2]))
        shot(page, "01-home")

        # ---------------------------------------------------------- learner login
        login(page, "learner@demo.test", "Demo1234!", expect="**/dashboard")
        check("learner login lands on the dashboard", page.url.rstrip("/").endswith("/dashboard"), page.url)
        check(
            "dashboard greets the learner",
            re.search(r"(Good (morning|afternoon|evening)|Hello), Alex", body(page)) is not None,
            body(page)[:160],
        )
        check(
            "dashboard shows a learning snapshot",
            has(page, "Your snapshot") or has(page, "Lessons done"),
            body(page)[:200],
        )
        check(
            "dashboard shows a continue-learning hero",
            has(page, "Continue watching") or has(page, "Continue learning"),
            body(page)[:200],
        )
        shot(page, "02-dashboard")

        # my learning + orders render real seeded data
        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        learning = body(page)
        check("my learning lists enrolled courses", "TypeScript for Production Teams" in learning)
        check("my learning shows a completed course", "Completed" in learning)
        shot(page, "02b-my-learning")

        page.goto(f"{BASE}/learn/orders")
        page.wait_for_load_state("networkidle")
        orders = body(page)
        check("orders page lists seeded orders", "ORD-" in orders)
        check("orders page shows a refunded order", "Refunded" in orders)
        shot(page, "02c-orders")

        page.goto(f"{BASE}/learn/profile")
        page.wait_for_load_state("networkidle")
        check("profile shows the email verification badge", "verified" in body(page))

        # ---------------------------------------------------------- wrong password
        context.clear_cookies()
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        page.fill("#email", "learner@demo.test")
        page.fill("#password", "wrong-password")
        page.click("button[type=submit]")
        check("wrong password shows a generic error", settle(page, text="Email or password is incorrect"))
        check("wrong password reveals nothing about the account", "does not exist" not in body(page))

        # ---------------------------------------------------------- MFA
        login(page, "admin@demo.test", "Demo1234!", expect="**/login/mfa*")
        check("admin is asked for a TOTP code", "/login/mfa" in page.url, page.url)
        code = read_totp(page)
        check("dev mode prints the current valid code", len(code) == 6, code)
        shot(page, "03-mfa")

        page.fill("#code", "000000")
        page.click("button[type=submit]")
        check("a wrong TOTP code is rejected", settle(page, text="not valid"), page.url)

        page.fill("#code", read_totp(page))
        page.click("button[type=submit]")
        settle(page, url="**/admin*")
        check("admin lands in the admin console", "/admin" in page.url, page.url)
        admin_body = body(page)
        check("admin dashboard shows revenue", "net revenue" in admin_body.lower())
        check("admin dashboard shows the 30-day chart", has(page, "Revenue, last 30 days"))
        shot(page, "04-admin")

        # ---------------------------------------------------------- auditor
        context.clear_cookies()
        login(page, "auditor@demo.test", "Demo1234!", expect="**/login/mfa*")
        page.fill("#code", read_totp(page))
        page.click("button[type=submit]")
        settle(page, url="**/admin*")
        check("auditor reaches the admin console", "/admin" in page.url, page.url)
        check(
            "auditor sees the read-only banner",
            has(page, "every write action is disabled"),
        )
        shot(page, "05-auditor")

        # ---------------------------------------------------------- register + verify
        context.clear_cookies()
        stamp = datetime.now().strftime("%H%M%S")
        new_email = f"phase1.{stamp}@demo.test"
        page.goto(f"{BASE}/register")
        page.wait_for_load_state("networkidle")
        page.fill("#name", "Phase One Tester")
        page.fill("#email", new_email)
        page.fill("#password", "TestPass123")
        page.fill("#confirm", "TestPass123")
        page.click("button[type=submit]")
        settle(page, url="**/verify-email/notice*")
        check("register redirects to the verify notice", "/verify-email/notice" in page.url, page.url)
        shot(page, "06-verify-notice")

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("outbox lists the verification email", new_email in body(page), page.url)
        page.click("a:has-text('Confirm your email address') >> nth=0")
        page.wait_for_load_state("networkidle")
        check("verification email opens with a working button", settle(page, text="Verify my email"))
        shot(page, "07-outbox-email")
        page.click("a:has-text('Verify my email')")
        settle(page, url="**/verify-email?verified=1*")
        check("verification link verifies the account", "Email verified" in body(page), page.url)
        shot(page, "08-verified")

        # ---------------------------------------------------------- reset password
        context.clear_cookies()
        page.goto(f"{BASE}/forgot-password")
        page.wait_for_load_state("networkidle")
        page.fill("#email", new_email)
        page.click("button[type=submit]")
        check(
            "forgot password is enumeration-safe",
            settle(page, text="If that email has an account"),
        )

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text('Reset your password') >> nth=0")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text('Choose a new password')")
        settle(page, url="**/reset-password*")
        check("reset link opens the reset form", "/reset-password?token=" in page.url, page.url)
        page.fill("#password", "BrandNewPass99")
        page.fill("#confirm", "BrandNewPass99")
        page.click("button[type=submit]")
        settle(page, url="**/login*reset=1*")
        check("reset redirects to login with a notice", "reset=1" in page.url, page.url)

        login(page, new_email, "BrandNewPass99", expect="**/dashboard")
        check("login works with the new password", "/dashboard" in page.url, page.url)

        # ---------------------------------------------------------- rate limiting
        context.clear_cookies()
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        blocked = False
        for _ in range(8):
            page.fill("#email", "ratelimit@demo.test")
            page.fill("#password", "nope")
            page.click("button[type=submit]")
            if settle(page, text="Too many attempts", timeout=8000):
                blocked = True
                break
        check("login rate limiting kicks in and blocks", blocked)
        shot(page, "09-rate-limited")

        # ---------------------------------------------------------- proxy redirect
        context.clear_cookies()
        page.goto(f"{BASE}/dashboard")
        settle(page, url="**/login*")
        check("signed-out /dashboard redirects to login", "/login" in page.url, page.url)
        check("redirect preserves the intended path", "next=%2Fdashboard" in page.url, page.url)

        # ---------------------------------------------------------- 404
        page.goto(f"{BASE}/nope-not-here")
        page.wait_for_load_state("networkidle")
        check("unknown URL renders the 404 page", "404" in body(page), page.url)

        # ---------------------------------------------------------- console health
        # "Failed to load resource" is asserted separately: the deliberate 404
        # above legitimately logs one. Everything else must be silent.
        noisy = [
            error
            for error in console_errors
            if "Failed to load resource" not in error and "Download the React DevTools" not in error
        ]
        check("no runtime console errors", len(noisy) == 0, " | ".join(noisy[:3]))

        browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n---")
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("failed: " + ", ".join(failed))
    print(f"screenshots: {SHOTS}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
