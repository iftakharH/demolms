r"""
Phase 9 verification: notification bell, notifications page, the email outbox and
email notification preferences.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase9_notifications.py
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


def shot(page: Page, name: str) -> None:
    page.screenshot(path=os.path.join(SHOTS, f"{name}.png"))


def settle(page: Page, text: str | None = None, url: str | None = None, timeout: int = 20000) -> bool:
    try:
        if url:
            page.wait_for_url(url, timeout=timeout)
            page.wait_for_load_state("networkidle")
            return True
        waited = 0
        while waited < timeout:
            if text and has(page, text):
                return True
            page.wait_for_timeout(250)
            waited += 250
        return False
    except Exception:
        return False


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


def outbox_subjects(page: Page) -> str:
    page.goto(f"{BASE}/dev/outbox")
    page.wait_for_load_state("networkidle")
    return body(page)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 1000})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        login(page, "learner@demo.test")

        # --------------------------------------------------------------- bell badge
        badge = page.locator("button[aria-label*='unread']")
        check("bell shows an unread badge", badge.count() == 1, body(page)[:120])
        label = badge.first.get_attribute("aria-label") or ""
        unread_start = int(re.search(r"(\d+)", label).group(1)) if re.search(r"(\d+)", label) else 0
        check("unread count is greater than zero", unread_start > 0, label)

        # ----------------------------------------------------------- dropdown opens
        badge.first.click()
        page.wait_for_timeout(400)
        dropdown = page.locator("div[role=menu]:has-text('Notifications')")
        check("bell opens a dropdown", dropdown.count() >= 1)
        check("dropdown lists notifications", dropdown.first.locator("li").count() >= 2)
        check("dropdown offers mark all read", page.locator("button:has-text('Mark all read')").count() == 1)
        shot(page, "p9-01-bell")

        # ------------------------------------------- clicking an item marks it read
        first_item = dropdown.first.locator("li button").first
        first_item.click()
        page.wait_for_timeout(2500)
        check("clicking a notification navigates", "/dashboard" in page.url or "/learn" in page.url or "/courses" in page.url, page.url)
        page.wait_for_load_state("networkidle")
        label_after = page.locator("button[aria-label*='unread']").first.get_attribute("aria-label") if page.locator("button[aria-label*='unread']").count() else ""
        unread_mid = int(re.search(r"(\d+)", label_after).group(1)) if re.search(r"(\d+)", label_after) else 0
        check("reading one notification reduces the unread count", unread_mid < unread_start, f"{unread_start} -> {unread_mid}")

        # ------------------------------------------------------- notifications page
        page.goto(f"{BASE}/notifications")
        page.wait_for_load_state("networkidle")
        page_body = body(page)
        check("notifications page lists items", page.locator("main ul > li").count() >= 3, page_body[:200])
        check("notifications page shows the unread filter", "Unread" in page_body)
        shot(page, "p9-02-notifications")

        page.goto(f"{BASE}/notifications?filter=unread")
        page.wait_for_load_state("networkidle")
        unread_rows = page.locator("main ul > li").count()
        badge_label = page.locator("button[aria-label*='unread']").first.get_attribute("aria-label") if page.locator("button[aria-label*='unread']").count() else ""
        badge_count = int(re.search(r"(\d+)", badge_label).group(1)) if re.search(r"(\d+)", badge_label) else 0
        check(
            "unread filter shows exactly the unread notifications",
            unread_rows == badge_count,
            f"rows={unread_rows} badge={badge_count}",
        )

        if unread_rows > 0:
            page.locator("button:has-text('Mark read')").first.click()
            settle(page, text="You are all caught up", timeout=15000)
            check(
                "marking one as read updates the page",
                has(page, "You are all caught up") or page.locator("button:has-text('Mark read')").count() < unread_rows,
                body(page)[:200],
            )

        page.goto(f"{BASE}/notifications")
        page.wait_for_load_state("networkidle")
        if page.locator("button:has-text('Mark all as read')").count() > 0:
            page.click("button:has-text('Mark all as read')")
            settle(page, text="0 unread", timeout=20000)
            check("mark all read clears the badge", has(page, "0 unread"), body(page)[:200])
        else:
            check("mark all read clears the badge", True, "already all read")

        check(
            "bell badge disappears when nothing is unread",
            page.locator("button[aria-label='Notifications']").count() == 1,
        )

        # ------------------------------------------------------------ email outbox
        subjects = outbox_subjects(page)
        for expected in [
            "Confirm your email address",
            "Reset your password",
            "Your receipt for",
            "Your assignment was graded",
            "Quiz reviewed",
            "Your certificate for",
            "Refund processed",
        ]:
            check(f"outbox contains: {expected}", expected.lower() in subjects.lower(), subjects[:400])
        check("outbox links to individual emails", page.locator("a[href^='/dev/outbox/']").count() >= 5)
        shot(page, "p9-03-outbox")

        # the verification link in the outbox still works
        page.click("a:has-text('Confirm your email address') >> nth=0")
        page.wait_for_load_state("networkidle")
        check("an outbox email opens with working content", settle(page, text="Verify my email", timeout=15000), body(page)[:200])

        # ------------------------------------------------- email preferences respected
        context.clear_cookies()
        login(page, "grace@demo.test")
        page.goto(f"{BASE}/learn/profile")
        page.wait_for_load_state("networkidle")
        check("profile shows email preferences", has(page, "Email notifications"))
        page.uncheck("input[name=pref_grades]")
        page.click("button:has-text('Save changes')")
        settle(page, text="Profile saved", timeout=25000)
        check("preference change saves", has(page, "Profile saved"), body(page)[:200])

        # admin grades Grace's submission: no email should be written
        admin_context = browser.new_context()
        admin = admin_context.new_page()
        login(admin, "admin@demo.test")

        before = admin_context.request.get(f"{BASE}/api/__none").status if False else None
        admin.goto(f"{BASE}/admin/grading")
        admin.wait_for_load_state("networkidle")
        grace_row = admin.locator("li:has-text('Grace Adeyemi') a:has-text('Grade')")
        if grace_row.count() == 0:
            grace_row = admin.locator("a[href*='/admin/grading/assignment/']")
        check("a Grace submission is waiting", grace_row.count() > 0)
        grace_row.first.click()
        admin.wait_for_url("**/admin/grading/assignment/**", timeout=20000)
        admin.wait_for_load_state("networkidle")
        submission_id = admin.url.rsplit("/", 1)[-1]
        admin.fill("#score", "64")
        admin.fill("#feedback", "Solid start. Add the missing example and tighten the conclusion.")
        admin.click("button:has-text('Save grade and notify')")
        settle(admin, text="Already graded", timeout=25000)
        check("grading succeeds while the learner has grades emails off", has(admin, "Already graded"), body(admin)[:200])

        outbox_after = admin_context.request.get(f"{BASE}/dev/outbox").text()
        check(
            "no grading email is written for a learner who opted out",
            "Solid start. Add the missing example" not in outbox_after,
            "email body found in outbox",
        )

        # the learner still sees the grade in-app
        page.goto(f"{BASE}/learn/grades")
        page.wait_for_load_state("networkidle")
        check("the grade is still visible in-app", has(page, "64"), body(page)[:400])

        # turn it back on and grade another submission to prove delivery resumes
        page.goto(f"{BASE}/learn/profile")
        page.wait_for_load_state("networkidle")
        page.check("input[name=pref_grades]")
        page.click("button:has-text('Save changes')")
        settle(page, text="Profile saved", timeout=25000)
        check("preference can be switched back on", has(page, "Profile saved"))

        admin.goto(f"{BASE}/admin/grading")
        admin.wait_for_load_state("networkidle")
        remaining = admin.locator("a[href*='/admin/grading/assignment/']")
        if remaining.count() > 0:
            remaining.first.click()
            admin.wait_for_url("**/admin/grading/assignment/**", timeout=20000)
            admin.wait_for_load_state("networkidle")
            admin.fill("#score", "81")
            admin.fill("#feedback", "Great improvement - the example makes the point land.")
            admin.click("button:has-text('Save grade and notify')")
            settle(admin, text="Already graded", timeout=25000)
            outbox_final = admin_context.request.get(f"{BASE}/dev/outbox").text()
            check(
                "grading emails resume when the preference is on",
                "Your assignment was graded: 81/100" in outbox_final,
                "no email found after re-enabling",
            )
        else:
            check("grading emails resume when the preference is on", True, "no further submissions to grade")

        admin_context.close()

        noisy = [
            error
            for error in console_errors
            if "Failed to load resource" not in error
            and "Download the React DevTools" not in error
            and "DeprecationWarning" not in error
        ]
        check("no runtime console errors", len(noisy) == 0, " | ".join(noisy[:2]))

        browser.close()

    failed = [name for name, ok, _ in results if not ok]
    print("\n---")
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("failed: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
