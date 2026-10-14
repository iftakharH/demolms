r"""
Phase 10a: responsive check. Drives the key pages at phone width and screenshots
them so layout problems are visible.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase10_responsive.py
"""
import os
import re
import sys
import tempfile

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
SHOTS = os.path.join(tempfile.gettempdir(), "opencode", "lms-mobile")
os.makedirs(SHOTS, exist_ok=True)

results: list[tuple[str, bool, str]] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    ok = bool(condition)
    results.append((name, ok, detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -- {detail}" if detail and not ok else ""))


def body(page: Page) -> str:
    return page.inner_text("body")


def login(page: Page, email: str) -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    if email == "admin@demo.test":
        page.wait_for_url("**/login/mfa*", timeout=20000)
        text = body(page).upper()
        code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text) or re.search(r"\b(\d{6})\b", text)
        page.fill("#code", code.group(1) + code.group(2))
        page.click("button[type=submit]")
        page.wait_for_url("**/admin*", timeout=20000)
    else:
        page.wait_for_url("**/dashboard", timeout=20000)
    page.wait_for_load_state("networkidle")


def horizontal_overflow(page: Page) -> int:
    return page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # iPhone-ish viewport
        phone = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        page = phone.new_page()

        pages = [
            ("home", "/", None),
            ("catalogue", "/courses", None),
            ("course detail", "/courses/typescript-for-production-teams", None),
            ("course preview", "/courses/typescript-for-production-teams/preview/1", None),
            ("login", "/login", None),
            ("register", "/register", None),
            ("verify notice", "/verify-email/notice", None),
            ("outbox", "/dev/outbox", None),
            ("mock checkout", "/mock-stripe/checkout?order=missing", None),
        ]

        for name, path, _ in pages:
            page.goto(f"{BASE}{path}")
            page.wait_for_load_state("networkidle")
            overflow = horizontal_overflow(page)
            check(f"no horizontal overflow on {name}", overflow <= 1, f"{overflow}px")
            page.screenshot(path=os.path.join(SHOTS, f"{name.replace(' ', '-')}.png"), full_page=True)

        # signed-in pages
        login(page, "learner@demo.test")
        for name, path in [
            ("dashboard", "/dashboard"),
            ("my learning", "/learn/my-learning"),
            ("player", "/learn/courses/typescript-for-production-teams"),
            ("quiz", "/learn/courses/typescript-for-production-teams/quiz/6"),
            ("grades", "/learn/grades"),
            ("certificates", "/learn/certificates"),
            ("orders", "/learn/orders"),
            ("profile", "/learn/profile"),
            ("notifications", "/notifications"),
        ]:
            page.goto(f"{BASE}{path}")
            page.wait_for_load_state("networkidle")
            overflow = horizontal_overflow(page)
            check(f"no horizontal overflow on {name}", overflow <= 1, f"{overflow}px")
            page.screenshot(path=os.path.join(SHOTS, f"learner-{name.replace(' ', '-')}.png"), full_page=True)

        phone.close()

        # admin at tablet width, where the sidebar collapses
        tablet = browser.new_context(viewport={"width": 820, "height": 1100})
        admin_page = tablet.new_page()
        login(admin_page, "admin@demo.test")
        for name, path in [
            ("admin dashboard", "/admin"),
            ("admin courses", "/admin/courses"),
            ("course builder", "/admin/courses/typescript-for-production-teams"),
            ("admin users", "/admin/users"),
            ("admin audit", "/admin/audit"),
        ]:
            admin_page.goto(f"{BASE}{path}")
            admin_page.wait_for_load_state("networkidle")
            overflow = horizontal_overflow(admin_page)
            check(f"no horizontal overflow on {name} (tablet)", overflow <= 1, f"{overflow}px")
            admin_page.screenshot(path=os.path.join(SHOTS, f"{name.replace(' ', '-')}.png"), full_page=True)
        tablet.close()

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
