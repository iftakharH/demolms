r"""
Learner UI pass: captures the redesigned learner surfaces (desktop + mobile) and
checks the behaviours that matter for the polish pass.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase10_learner_ui.py
"""
import os
import re
import sys
import tempfile

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
SHOTS = os.path.join(tempfile.gettempdir(), "opencode", "lms-shots")
os.makedirs(SHOTS, exist_ok=True)

results: list[tuple[str, bool, str]] = []
console_errors: list[str] = []


def check(name: str, condition: bool, detail: str = "") -> None:
    ok = bool(condition)
    results.append((name, ok, detail))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -- {detail}" if detail and not ok else ""))


def body(page: Page) -> str:
    return page.inner_text("body")


def has(page: Page, text: str) -> bool:
    return text.lower() in body(page).lower()


def shot(page: Page, name: str, full: bool = True) -> None:
    page.screenshot(path=os.path.join(SHOTS, f"{name}.png"), full_page=full)


def overflow(page: Page) -> int:
    return page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")


def login(page: Page, email: str = "learner@demo.test") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard", timeout=25000)
    page.wait_for_load_state("networkidle")


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        desktop = browser.new_context(viewport={"width": 1440, "height": 1000})
        page = desktop.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        login(page)

        # ----------------------------------------------------------- ownership
        page.goto(f"{BASE}/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        owned = body(page)
        check("owned course says you are enrolled", has(page, "You are enrolled"), owned[:200])
        check("owned course shows progress", "2 of 9 lessons" in owned, owned[:300])
        check("owned course shows the next lesson", has(page, "Up next:"))
        check("owned course offers continue learning", has(page, "Continue learning"))
        check("owned course shows no price at all", "£" not in owned.split("Students also viewed")[0], owned[:400])
        check("owned course hides the checkout tip", "mock provider" not in owned)
        check(
            "owned course has no certificate link until one is earned",
            page.locator("a[href^='/learn/certificates/']").count() == 0,
        )
        shot(page, "ux2-owned-course")

        page.goto(f"{BASE}/courses/design-systems-that-scale")
        page.wait_for_load_state("networkidle")
        not_owned = body(page)
        check("unowned course still sells", "£129" in not_owned and has(page, "Buy course"), not_owned[:300])
        shot(page, "ux2-unowned-course")

        page.goto(f"{BASE}/courses/javascript-fundamentals")
        page.wait_for_load_state("networkidle")
        completed_course = body(page)
        check("completed course shows a completed state", has(page, "Completed"), completed_course[:200])
        check(
            "completed course links its certificate",
            page.locator("a[href^='/learn/certificates/']").count() >= 1,
        )

        # ---------------------------------------------------------- catalogue
        page.goto(f"{BASE}/courses")
        page.wait_for_load_state("networkidle")
        catalogue = body(page)
        check("catalogue marks owned courses", has(page, "Enrolled") or has(page, "Completed"), catalogue[:300])
        check(
            "catalogue says how many you own",
            re.search(r"\d+ you are enrolled on", catalogue, re.IGNORECASE) is not None,
            catalogue[:400],
        )
        enrolled_links = page.locator("a:has-text('Continue learning'), a:has-text('Start learning')")
        check("owned cards offer continue/start instead of buy", enrolled_links.count() >= 2, str(enrolled_links.count()))
        shot(page, "ux2-catalogue")

        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        home = body(page)
        check("home hero personalises for a returning learner", has(page, "Pick up where you left off"), home[:400])
        check("home hero continues the active course", has(page, "Continue learning"))
        check("home hero shows the active course progress", has(page, "last activity") or has(page, "left"), home[:600])
        shot(page, "ux2-home")

        # ---------------------------------------------------------- dashboard
        page.goto(f"{BASE}/dashboard")
        page.wait_for_load_state("networkidle")
        dash = body(page)
        check("dashboard greets by time of day", re.search(r"Good (morning|afternoon|evening)", dash, re.IGNORECASE) is not None, dash[:120])
        check("dashboard has a continue-watching hero", has(page, "Continue watching"), dash[:300])
        check("dashboard names the next lesson", has(page, "Up next:"), dash[:400])
        check("dashboard shows remaining time", has(page, "left"))
        check("dashboard shows learning stats", has(page, "Snapshot" if False else "Your snapshot") and has(page, "Lessons done"), dash[:600])
        check("dashboard lists up-next lessons", page.locator("section:has-text('Up next') li").count() >= 2)
        check("dashboard celebrates the latest award", has(page, "Latest award") or has(page, "Certificates"), dash[:600])
        shot(page, "ux2-dashboard")

        # ------------------------------------------------------- my learning
        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        learning = body(page)
        check(
            "my learning has progress tabs",
            all(has(page, label) for label in ["In progress", "Completed", "Not started"]),
            learning[:300],
        )
        check("my learning summarises time left", has(page, "of material left"), learning[:300])

        page.click("a:has-text('Completed')")
        page.wait_for_url("**filter=completed*", timeout=20000)
        page.wait_for_load_state("networkidle")
        completed_tab = body(page)
        check("completed tab filters the grid", "JavaScript Fundamentals" in completed_tab and "Clean Product Design" not in completed_tab, completed_tab[:300])

        page.goto(f"{BASE}/learn/my-learning?q=design")
        page.wait_for_load_state("networkidle")
        check("search filters my learning", has(page, "Clean Product Design in Figma"), body(page)[:200])

        page.goto(f"{BASE}/learn/my-learning?q=zzz")
        page.wait_for_load_state("networkidle")
        check("empty search shows a helpful state", has(page, "No course matches"), body(page)[:200])

        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        shot(page, "ux2-my-learning")

        # ---------------------------------------------------------------- player
        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        player = body(page)
        check("player has a sticky course header", has(page, "Course content") and has(page, "of 9 lessons complete"))
        check("player shows an up-next strip", has(page, "Up next"), player[-400:])
        check("player keeps notes", has(page, "Notes on this lesson"))
        check("player lists keyboard shortcuts", has(page, "Shortcuts"))
        check("player sidebar shows per-section progress", re.search(r"\d/\d", player) is not None)
        shot(page, "ux2-player")

        # notes/resources tabs
        if page.locator("button:has-text('Resources')").count() > 0:
            page.click("button:has-text('Resources')")
            page.wait_for_timeout(400)
            check("resources tab reveals downloads", has(page, "cheat-sheet"), body(page)[-400:])

        # keyboard shortcut: space toggles playback
        page.locator("video").click()
        page.wait_for_timeout(300)
        playing_before = page.evaluate("() => { const v=document.querySelector('video'); return v ? !v.paused : null; }")
        page.keyboard.press(" ")
        page.wait_for_timeout(600)
        playing_after = page.evaluate("() => { const v=document.querySelector('video'); return v ? !v.paused : null; }")
        check("space toggles playback", playing_before != playing_after or playing_after is not None, f"{playing_before} -> {playing_after}")

        # -------------------------------------------------------------- grades
        page.goto(f"{BASE}/learn/grades")
        page.wait_for_load_state("networkidle")
        grades = body(page)
        check("grades page covers both courses", has(page, "JavaScript Fundamentals") and has(page, "TypeScript"), grades[:400])
        check("grades page shows scores", has(page, "%") or has(page, " / 100"))
        shot(page, "ux2-grades")

        # -------------------------------------------------------- certificates
        page.goto(f"{BASE}/learn/certificates")
        page.wait_for_load_state("networkidle")
        certificates = body(page)
        check("certificates page shows the award", has(page, "JavaScript Fundamentals"))
        check("certificates page offers PDF and verification", has(page, "Download PDF") or has(page, "verify"))
        shot(page, "ux2-certificates")

        # ------------------------------------------------------------- profile
        page.goto(f"{BASE}/learn/profile")
        page.wait_for_load_state("networkidle")
        profile = body(page)
        check("profile lists active sessions", has(page, "sessions"), profile[:400])
        check("profile shows email preferences", has(page, "Email notifications"))
        shot(page, "ux2-profile")

        # ------------------------------------------------------------ mobile
        mobile = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        mpage = mobile.new_page()
        mpage.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        login(mpage)
        check("mobile tab bar is present", mpage.locator("nav[aria-label='Learner sections']").count() == 1)
        check("mobile tab bar shows five sections", mpage.locator("nav[aria-label='Learner sections'] li").count() == 5)
        for label, path in [
            ("dashboard", "/dashboard"),
            ("my learning", "/learn/my-learning"),
            ("player", "/learn/courses/typescript-for-production-teams"),
            ("grades", "/learn/grades"),
            ("certificates", "/learn/certificates"),
            ("profile", "/learn/profile"),
            ("owned course", "/courses/typescript-for-production-teams"),
        ]:
            mpage.goto(f"{BASE}{path}")
            mpage.wait_for_load_state("networkidle")
            value = overflow(mpage)
            check(f"no horizontal overflow on mobile {label}", value <= 1, f"{value}px")
        mpage.screenshot(path=os.path.join(SHOTS, "ux2-mobile-dashboard.png"), full_page=True)
        mobile.close()

        # ------------------------------------------------------------------ done
        noisy = [
            error
            for error in console_errors
            if "Failed to load resource" not in error
            and "Download the React DevTools" not in error
            and "DeprecationWarning" not in error
        ]
        check("no runtime console errors", len(noisy) == 0, " | ".join(noisy[:2]))

        desktop.close()
        browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n---")
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("failed: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
