r"""
Print check: receipts and certificates are meant to be printable, so emulate print
media and confirm the app chrome disappears and the document survives.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase10_print.py
"""
import os
import re
import sys
import tempfile

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
SHOTS = os.path.join(tempfile.gettempdir(), "opencode", "lms-print")
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
    page.wait_for_url("**/dashboard", timeout=20000)
    page.wait_for_load_state("networkidle")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1200, "height": 900})
        page = context.new_page()
        login(page, "learner@demo.test")

        # ----------------------------------------------------------------- receipt
        page.goto(f"{BASE}/learn/orders")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text('Receipt') >> nth=0")
        page.wait_for_url("**/learn/orders/**", timeout=20000)
        page.wait_for_load_state("networkidle")

        screen_body = body(page)
        check("receipt shows the order on screen", "Receipt" in screen_body and "ORD-" in screen_body)
        check("receipt has a print button on screen", page.locator("button:has-text('Print')").count() >= 1)

        page.emulate_media(media="print")
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SHOTS, "receipt-print.png"), full_page=True)

        header_visible = page.locator("header").first.is_visible()
        site_footer = page.locator("footer:has-text('A local demo learning platform')")
        site_footer_visible = site_footer.count() > 0 and site_footer.first.is_visible()
        button_visible = page.locator("button:has-text('Print')").first.is_visible() if page.locator("button:has-text('Print')").count() else False
        check("site header is hidden when printing", not header_visible)
        check("site footer is hidden when printing", not site_footer_visible)
        check("print button is hidden when printing", not button_visible)
        check("receipt content remains", "ORD-" in body(page))
        check("the receipt's own footer still prints", "demo receipt produced by a local mock payment provider" in body(page))
        page.emulate_media(media="screen")

        # ------------------------------------------------------------ certificate
        page.goto(f"{BASE}/learn/certificates")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text('View certificate')")
        page.wait_for_url("**/learn/certificates/DEMO-2026-*", timeout=20000)
        page.wait_for_load_state("networkidle")

        page.emulate_media(media="print")
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(SHOTS, "certificate-print.png"), full_page=True)
        print_body = body(page)
        check("certificate content remains when printing", "Alex Morgan" in print_body)
        check("certificate actions are hidden when printing", not page.locator("button:has-text('Print')").first.is_visible())
        check(
            "certificate chrome is hidden when printing",
            not page.locator("header").first.is_visible(),
        )
        page.emulate_media(media="screen")

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
