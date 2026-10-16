r"""
Design review capture - not a pass/fail suite.

Grabs the pages that carry the new art direction (DESIGN.md) at three widths in
both themes, so the result can be looked at rather than assumed.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\design-review.py

Writes to %TEMP%\opencode\lms-design\<theme>-<width>-<name>.png
"""
import os
import re
import sys
import tempfile

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
OUT = os.path.join(tempfile.gettempdir(), "opencode", "lms-design")
os.makedirs(OUT, exist_ok=True)

WIDTHS = {"desktop": 1280, "tablet": 768, "phone": 390}
COURSE = "typescript-for-production-teams"


def login(page: Page, email: str, totp: bool = False, expect: str = "**/dashboard") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    if totp:
        page.wait_for_url("**/login/mfa*", timeout=20000)
        text = page.inner_text("body")
        match = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text.upper())
        code = (match.group(1) + match.group(2)) if match else re.search(r"\b(\d{6})\b", text).group(1)
        page.fill("#code", code)
        page.click("button[type=submit]")
    page.wait_for_url(expect, timeout=25000)
    page.wait_for_load_state("networkidle")


def shoot(page: Page, theme: str, width_name: str, name: str, path: str, full: bool = False) -> None:
    page.goto(f"{BASE}{path}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(700)
    file = os.path.join(OUT, f"{theme}-{width_name}-{name}.png")
    page.screenshot(path=file, full_page=full)
    print(f"  {os.path.basename(file)}")


def run_theme(browser, theme: str, width_name: str) -> None:
    width = WIDTHS[width_name]
    context = browser.new_context(viewport={"width": width, "height": 900}, device_scale_factor=1)
    context.add_init_script(f"try{{localStorage.setItem('demolms-theme','{theme}')}}catch(e){{}}")
    page = context.new_page()

    print(f"[{theme} / {width_name}] public")
    shoot(page, theme, width_name, "home", "/")
    if width_name == "desktop":
        shoot(page, theme, width_name, "catalogue", "/courses", full=True)
    shoot(page, theme, width_name, "course-detail", f"/courses/{COURSE}")

    print(f"[{theme} / {width_name}] learner")
    login(page, "learner@demo.test")
    shoot(page, theme, width_name, "dashboard", "/dashboard")
    if width_name != "tablet":
        shoot(page, theme, width_name, "my-learning", "/learn/my-learning")
    if width_name == "desktop":
        shoot(page, theme, width_name, "player", f"/learn/courses/{COURSE}")
        shoot(page, theme, width_name, "grades", "/learn/grades", full=True)

    if width_name == "desktop":
        print(f"[{theme} / {width_name}] admin")
        context2 = browser.new_context(viewport={"width": width, "height": 900})
        context2.add_init_script(f"try{{localStorage.setItem('demolms-theme','{theme}')}}catch(e){{}}")
        page2 = context2.new_page()
        login(page2, "admin@demo.test", totp=True, expect="**/admin")
        shoot(page2, theme, width_name, "admin-dashboard", "/admin", full=True)
        context2.close()

    context.close()


def main() -> int:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        for theme in ("light", "dark"):
            for width_name in WIDTHS:
                run_theme(browser, theme, width_name)
        browser.close()
    print(f"\nScreenshots in {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
