r"""
Phase 10b: the full journey in one continuous session - the same path a real
learner takes, from registering to holding a certificate, plus the admin side of
it (grading, refund, revocation) and the audit trail that proves all of it.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase10_walkthrough.py
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
    print(("PASS  " if ok else "FAIL  ") + name + (f"  -- {detail}" if detail and not ok else ""))


def body(page: Page) -> str:
    return page.inner_text("body")


def has(page: Page, text: str) -> bool:
    return text.lower() in body(page).lower()


def shot(page: Page, name: str) -> None:
    page.screenshot(path=os.path.join(SHOTS, f"{name}.png"))


def settle(page: Page, text: str | None = None, url: str | None = None, timeout: int = 25000) -> bool:
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


def login(page: Page, email: str, password: str = "Demo1234!") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", password)
    page.click("button[type=submit]")
    if email in ("admin@demo.test", "auditor@demo.test"):
        page.wait_for_url("**/login/mfa*", timeout=20000)
        text = body(page).upper()
        code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text) or re.search(r"\b(\d{6})\b", text)
        page.fill("#code", code.group(1) + code.group(2))
        page.click("button[type=submit]")
        page.wait_for_url("**/admin*", timeout=20000)
    else:
        page.wait_for_url("**/dashboard", timeout=25000)
    page.wait_for_load_state("networkidle")


def mark_lessons(page: Page, slug: str, limit: int = 14) -> int:
    """Click through a course's lessons, completing each one."""
    page.goto(f"{BASE}/learn/courses/{slug}")
    page.wait_for_load_state("networkidle")
    completed = 0
    for _ in range(limit):
        button = page.locator("button:has-text('Complete and continue')")
        if button.count() == 0:
            button = page.locator("button:has-text('Finish course')")
        if button.count() == 0:
            break
        button.first.click()
        page.wait_for_timeout(1400)
        completed += 1
    return completed


def main() -> int:
    stamp = datetime.now().strftime("%H%M%S")
    learner_email = f"walkthrough.{stamp}@demo.test"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 1100})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # ------------------------------------------------------ 1. register + verify
        page.goto(f"{BASE}/register")
        page.wait_for_load_state("networkidle")
        page.fill("#name", "Walkthrough Learner")
        page.fill("#email", learner_email)
        page.fill("#password", "Walkthrough123")
        page.fill("#confirm", "Walkthrough123")
        page.click("button[type=submit]")
        settle(page, url="**/verify-email/notice*")
        check("register creates an unverified account", "/verify-email/notice" in page.url, page.url)

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("verification email arrives in the outbox", has(page, "Confirm your email address"))
        page.click("a:has-text('Confirm your email address') >> nth=0")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text('Verify my email')")
        settle(page, text="Email verified")
        check("the verification link works from the outbox", has(page, "Email verified"), page.url)

        context.clear_cookies()
        login(page, learner_email, "Walkthrough123")
        check("the new learner can sign in", "/dashboard" in page.url, page.url)

        # ------------------------------------------------ 2. browse, search, filter
        page.goto(f"{BASE}/courses")
        page.wait_for_load_state("networkidle")
        check("catalogue is browsable signed in", has(page, "All courses"))

        page.goto(f"{BASE}/courses?q=next.js&price=paid")
        page.wait_for_load_state("networkidle")
        check("search + price filter finds the Next.js course", has(page, "Ship Your First Next.js App"), body(page)[:200])

        page.goto(f"{BASE}/courses/ship-your-first-nextjs-app")
        page.wait_for_load_state("networkidle")
        check("course page offers the paid checkout", has(page, "Buy course"))

        # ------------------------------------------ 3. buy a paid course with a coupon
        page.goto(f"{BASE}/checkout/ship-your-first-nextjs-app?coupon=WELCOME10")
        page.wait_for_load_state("networkidle")
        check("coupon discounts the checkout", has(page, "£71.10"), body(page)[:400])
        page.click("button:has-text('Pay £')")
        page.wait_for_url("**/mock-stripe/checkout*", timeout=25000)
        page.wait_for_load_state("networkidle")
        page.fill("#card", "4242 4242 4242 4242")
        page.click("button:has-text('Pay £')")
        settle(page, text="Payment approved")
        check("mock payment is approved", has(page, "Payment approved"), body(page)[:200])
        page.click("button:has-text('Continue to your receipt')")
        page.wait_for_url("**/checkout/return*", timeout=25000)
        page.wait_for_load_state("networkidle")
        check("webhook enrolled the learner", has(page, "You are enrolled"), body(page)[:300])

        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        check("purchased course appears in My learning", has(page, "Ship Your First Next.js App"))

        # --------------------------------------- 4. learn: resume a video + take a quiz
        page.goto(f"{BASE}/learn/courses/ship-your-first-nextjs-app")
        page.wait_for_load_state("networkidle")
        video = page.locator("video")
        check("player loads a video lesson", video.count() == 1)
        page.wait_for_timeout(2000)
        page.evaluate("() => { const v = document.querySelector('video'); v.currentTime = 6; v.play().catch(() => {}); }")
        page.wait_for_timeout(6000)
        page.evaluate("() => document.querySelector('video').pause()")
        settle(page, text="Position saved", timeout=12000)
        check("playback position is saved", has(page, "Position saved"), body(page)[-200:])

        page.reload()
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2500)
        resumed = page.evaluate("() => { const v = document.querySelector('video'); return v ? v.currentTime : -1; }")
        check("playback resumes after a reload", resumed >= 5, f"t={resumed}")

        completed_video = mark_lessons(page, "ship-your-first-nextjs-app", limit=6)
        check("lessons can be completed", completed_video >= 3, f"completed={completed_video}")

        page.goto(f"{BASE}/learn/courses/ship-your-first-nextjs-app/quiz/23")
        page.wait_for_load_state("networkidle")
        if page.locator("a:has-text('Try again')").count() > 0:
            page.click("a:has-text('Try again')")
            page.wait_for_url("**retry=1*", timeout=20000)
            page.wait_for_load_state("networkidle")
        check("quiz form is available", page.locator("form[data-quiz-form]").count() == 1, page.url)
        page.check("input[name='q_11'][value='0']")
        page.check("input[name='q_12'][value='0']")
        page.fill("input[name='q_13']", "_folder")
        page.click("button:has-text('Submit attempt')")
        settle(page, text="Passed")
        check("quiz is marked instantly and passed", has(page, "Passed"), body(page)[:300])
        shot(page, "p10-01-quiz-passed")

        # ------------------------------- 5. free course + assignment + grading + cert
        page.goto(f"{BASE}/courses/javascript-fundamentals")
        page.wait_for_load_state("networkidle")
        page.click("button:has-text('Enrol for free')")
        page.wait_for_url("**/learn/courses/javascript-fundamentals*", timeout=25000)
        page.wait_for_load_state("networkidle")
        check("free enrolment works", has(page, "You are enrolled") or has(page, "Course content"), page.url)

        mark_lessons(page, "javascript-fundamentals", limit=14)

        page.goto(f"{BASE}/learn/courses/javascript-fundamentals/quiz/16")
        page.wait_for_load_state("networkidle")
        if page.locator("a:has-text('Try again')").count() > 0:
            page.click("a:has-text('Try again')")
            page.wait_for_url("**retry=1*", timeout=20000)
            page.wait_for_load_state("networkidle")
        page.check("input[name='q_6'][value='2']")
        page.check("input[name='q_7'][value='0']")
        page.check("input[name='q_7'][value='1']")
        page.check("input[name='q_7'][value='3']")
        page.check("input[name='q_8'][value='0']")
        page.fill("input[name='q_9']", "map")
        page.fill("textarea[name='q_10']", "I kept confusing this with hoisting, so I traced the scope chain by hand until it clicked.")
        page.click("button:has-text('Submit attempt')")
        settle(page, text="waiting for your instructor")
        check("essay quiz is queued for review", has(page, "waiting for your instructor"), body(page)[:300])

        page.goto(f"{BASE}/learn/courses/javascript-fundamentals/assignment/18")
        page.wait_for_load_state("networkidle")
        page.fill("#body_text", "I built a small quiz card that shuffles five questions and tracks the score. The hardest part was getting the shuffle to not repeat a question.")
        page.click("button:has-text('Submit assignment')")
        settle(page, text="Submitted")
        check("assignment submission is accepted", has(page, "Submitted"), body(page)[:200])

        page.goto(f"{BASE}/learn/grades")
        page.wait_for_load_state("networkidle")
        check(
            "learner sees both items awaiting review",
            has(page, "Awaiting review") and page.locator("main article, main ul > li").count() >= 2,
            body(page)[:300],
        )

        # ------------------------------------------------------------- 6. admin grades
        admin_context = browser.new_context(viewport={"width": 1400, "height": 1100})
        admin = admin_context.new_page()
        login(admin, "admin@demo.test")

        admin.goto(f"{BASE}/admin/grading")
        admin.wait_for_load_state("networkidle")
        queue = body(admin)
        check("grading queue shows the new learner's work", "Walkthrough Learner" in queue, queue[:400])

        quiz_row = admin.locator("li:has-text('Walkthrough Learner') a:has-text('Grade')").first
        quiz_row.click()
        admin.wait_for_url("**/admin/grading/quiz/**", timeout=25000)
        admin.wait_for_load_state("networkidle")
        admin.fill("input[name^='points_']", "2")
        admin.fill("textarea[name^='feedback_']", "Clear, honest answer - nice use of tracing to debug.")
        admin.click("button:has-text('Save marks')")
        settle(admin, text="already been graded", timeout=25000)
        check("essay is graded", has(admin, "already been graded"), body(admin)[:300])

        admin.goto(f"{BASE}/admin/grading")
        admin.wait_for_load_state("networkidle")
        assignment_row = admin.locator("li:has-text('Walkthrough Learner') a:has-text('Grade')").first
        assignment_row.click()
        admin.wait_for_url("**/admin/grading/assignment/**", timeout=25000)
        admin.wait_for_load_state("networkidle")
        admin.fill("#score", "86")
        admin.fill("#feedback", "Neat solution and you explained the debugging path. Add a guard for empty input next time.")
        admin.click("button:has-text('Save grade and notify')")
        settle(admin, text="Already graded", timeout=25000)
        check("assignment is graded", has(admin, "Already graded"), body(admin)[:300])

        # ------------------------------------------- 7. certificate issued + verified
        page.goto(f"{BASE}/learn/certificates")
        page.wait_for_load_state("networkidle")
        certificates = body(page)
        check("certificate was issued automatically on completion", "JavaScript Fundamentals" in certificates, certificates[:400])
        match = re.search(r"(DEMO-2026-[A-Z0-9]{6})", certificates)
        check("certificate has an id", match is not None)
        certificate_id = match.group(1) if match else ""

        page.click("a:has-text('View certificate')")
        page.wait_for_url("**/learn/certificates/DEMO-2026-*", timeout=25000)
        page.wait_for_load_state("networkidle")
        check("certificate page shows the new learner's name", has(page, "Walkthrough Learner"))
        shot(page, "p10-02-certificate")

        pdf = context.request.get(f"{BASE}/api/certificates/{certificate_id}/pdf")
        check("certificate PDF downloads", pdf.status == 200 and pdf.body()[:4] == b"%PDF", f"{pdf.status}")

        anonymous = browser.new_context()
        anon = anonymous.new_page()
        anon.goto(f"{BASE}/verify/{certificate_id}")
        anon.wait_for_load_state("networkidle")
        check("public verification page confirms the certificate", "This certificate is valid" in anon.inner_text("body"))
        anon.screenshot(path=os.path.join(SHOTS, "p10-03-verify.png"))
        anonymous.close()

        # ------------------------------------------------------------- 8. admin revokes
        admin.goto(f"{BASE}/admin/certificates")
        admin.wait_for_load_state("networkidle")
        row = admin.locator(f"li:has-text('{certificate_id}')")
        row.locator("input[name=reason]").fill("Walkthrough demo - revoked after review")
        row.locator("button:has-text('Revoke')").click()
        settle(admin, text="Revoked", timeout=25000)
        check("admin can revoke the certificate", has(admin, "Revoked"), body(admin)[:300])

        anonymous = browser.new_context()
        anon = anonymous.new_page()
        anon.goto(f"{BASE}/verify/{certificate_id}")
        anon.wait_for_load_state("networkidle")
        revoked_body = anon.inner_text("body")
        check("verification page now shows revoked", "been revoked" in revoked_body, revoked_body[:200])
        check("revocation reason is public", "revoked after review" in revoked_body, revoked_body[:300])
        anonymous.close()

        # -------------------------------------------------------------- 9. admin refunds
        admin.goto(f"{BASE}/admin/orders?q=Walkthrough%20Learner")
        admin.wait_for_load_state("networkidle")
        check("admin finds the new learner's order", has(admin, "Ship Your First Next.js App"), body(admin)[:400])
        admin.click("a:has-text('Open') >> nth=0")
        admin.wait_for_url("**/admin/orders/**", timeout=25000)
        admin.wait_for_load_state("networkidle")
        admin.fill("#reason", "Walkthrough demo - refunded on request")
        admin.click("button:has-text('Refund £')")
        settle(admin, text="Refunded", timeout=25000)
        check("admin can refund the order", has(admin, "Refunded"), body(admin)[:300])

        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        check(
            "refunded course is no longer accessible",
            "Ship Your First Next.js App" not in body(page),
            body(page)[:300],
        )

        # ------------------------------------------------------- 10. auditor is read-only
        auditor_context = browser.new_context(viewport={"width": 1400, "height": 1100})
        auditor = auditor_context.new_page()
        login(auditor, "auditor@demo.test")
        auditor.goto(f"{BASE}/admin/orders")
        auditor.wait_for_load_state("networkidle")
        check("auditor can read the orders list", has(auditor, "Orders"), body(auditor)[:200])
        check("auditor sees no write controls", auditor.locator("button:has-text('Refund')").count() == 0)
        auditor.goto(f"{BASE}/admin/audit")
        auditor.wait_for_load_state("networkidle")
        check("auditor can read the audit log", has(auditor, "Audit log"))
        auditor_context.close()

        # -------------------------------------------------------- 11. the audit trail
        admin.goto(f"{BASE}/admin/audit?q=Walkthrough")
        admin.wait_for_load_state("networkidle")
        trail = body(admin)
        check("audit log records the refund", "Refunded £" in trail, trail[:400])
        check("audit log records the certificate revocation", "Revoked certificate" in trail, trail[:400])

        admin.goto(f"{BASE}/admin/audit?q={learner_email}")
        admin.wait_for_load_state("networkidle")
        learner_trail = body(admin)
        for expected in ["Free enrolment", "certificate", "Graded", "assignment", "Enrolment"]:
            check(f"audit trail contains: {expected}", expected.lower() in learner_trail.lower(), learner_trail[:500])
        shot(admin, "p10-04-audit-trail")

        admin_context.close()
        context.close()
        browser.close()

    noisy = [
        error
        for error in console_errors
        if "Failed to load resource" not in error
        and "Download the React DevTools" not in error
        and "DeprecationWarning" not in error
    ]
    check("no runtime console errors during the journey", len(noisy) == 0, " | ".join(noisy[:2]))

    failed = [name for name, ok, _ in results if not ok]
    print("\n---")
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("failed: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
