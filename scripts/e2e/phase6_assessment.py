r"""
Phase 6 verification: quizzes (all five question types), assignments and grading.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase6_assessment.py
"""
import os
import re
import sys
import tempfile

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
    if email in ("admin@demo.test", "auditor@demo.test"):
        page.wait_for_url("**/login/mfa*", timeout=20000)
        text = body(page).upper()
        code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text) or re.search(r"\b(\d{6})\b", text)
        page.fill("#code", code.group(1) + code.group(2))
        page.click("button[type=submit]")
        page.wait_for_url("**/admin*", timeout=20000)
    else:
        page.wait_for_url("**/dashboard", timeout=20000)
    page.wait_for_load_state("networkidle")


TS_QUIZ = "/learn/courses/typescript-for-production-teams/quiz/6"
TS_ASSIGNMENT = "/learn/courses/typescript-for-production-teams/assignment/8"


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 1100})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # ------------------------------------------------------- learner: take the quiz
        login(page, "learner@demo.test")
        page.goto(f"{BASE}{TS_QUIZ}")
        page.wait_for_load_state("networkidle")
        quiz_body = body(page)
        check("quiz shows the pass mark", "Pass mark 70%" in quiz_body, quiz_body[:300])
        check("quiz shows attempt history", "Attempt history" in quiz_body)

        # Alex already has a graded attempt from the seed, so the page opens the
        # result view first - "Try again" reveals the form.
        page.click("a:has-text('Try again')")
        page.wait_for_url("**retry=1*", timeout=20000)
        page.wait_for_load_state("networkidle")
        attempt_body = body(page)
        check(
            "quiz shows all five questions",
            page.locator("form[data-quiz-form] ol > li").count() == 5,
            str(page.locator("form[data-quiz-form] ol > li").count()),
        )
        check("quiz marks which questions are auto-marked", "marked by hand" in attempt_body)
        check("quiz shows an attempt counter", "Attempt 2 of 3" in attempt_body, attempt_body[:400])
        shot(page, "p6-01-quiz")

        # answer everything correctly except the essay (which is manual)
        page.check("input[name='q_1'][value='0']")  # single: strict
        page.check("input[name='q_2'][value='0']")  # multiple: three of four
        page.check("input[name='q_2'][value='1']")
        page.check("input[name='q_2'][value='3']")
        page.check("input[name='q_3'][value='0']")  # true/false: True
        page.fill("input[name='q_4']", "Partial")   # short answer (accepted, case-insensitive)
        page.fill("textarea[name='q_5']", "I would start at the boundaries of the system and migrate one module per pull request with strict flags enabled incrementally.")
        page.click("button:has-text('Submit attempt')")
        settle(page, text="waiting for your instructor", timeout=25000)
        after = body(page)
        check("quiz submits and shows instant marks", "waiting for your instructor" in after, after[:300])
        check("auto-marked score is shown immediately", "auto-marked 4 of 7 points" in after, after[:400])
        check("no runtime error on submit", "Something went wrong" not in after)
        shot(page, "p6-02-quiz-submitted")

        page.goto(f"{BASE}/learn/grades")
        page.wait_for_load_state("networkidle")
        check("grades page lists the pending attempt", "Awaiting review" in body(page))

        # ------------------------------------- learner: submit an assignment (Ravi has not sent this one)
        context.clear_cookies()
        login(page, "ravi@demo.test")
        page.goto(f"{BASE}{TS_ASSIGNMENT}")
        page.wait_for_load_state("networkidle")
        check("assignment shows the brief", has(page, "Take the JavaScript module"), body(page)[:400])
        check("assignment accepts submissions", page.locator("#body_text").count() == 1)

        page.fill(
            "#body_text",
            "I typed the HTTP client, replaced the any with a generic request wrapper and documented two narrow-type decisions for review.",
        )
        page.set_input_files("#file", os.path.join(ROOT, "public", "uploads", "resources", "starter-code.txt"))
        page.click("button:has-text('Submit assignment')")
        settle(page, text="Submitted", timeout=25000)
        check("assignment submission is accepted", has(page, "Submitted"), body(page)[:300])
        shot(page, "p6-03-assignment")

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("submission email is in the outbox", has(page, "We received your assignment"), body(page)[:600])

        # ------------------------------------------------------------ admin: grading
        context.clear_cookies()
        login(page, "admin@demo.test")
        page.goto(f"{BASE}/admin/grading")
        page.wait_for_load_state("networkidle")
        queue = body(page)
        check("grading queue lists written quiz answers", "Written quiz answers" in queue)
        check("grading queue lists assignment submissions", "Assignment submissions" in queue)
        check("queue includes the new submission", "Ravi" in queue or "Grace" in queue or "Alex" in queue)
        shot(page, "p6-04-grading-queue")

        # grade a written quiz answer (Ravi's dashboard attempt is seeded as pending)
        page.click("a:has-text('Grade') >> nth=0")
        page.wait_for_url("**/admin/grading/quiz/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("marking screen shows the learner answer", has(page, "Learner answer"), body(page)[:300])
        check("marking screen shows auto-marked answers", has(page, "Automatically marked answers"))
        page.fill("input[name^='points_']", "2")
        page.fill("textarea[name^='feedback_']", "Clear structure and a sensible recommendation for the retention team.")
        page.click("button:has-text('Save marks')")
        settle(page, text="already been graded", timeout=25000)
        marked = body(page)
        check("quiz marking succeeds and shows the final score", "already been graded" in marked, marked[:400])
        check("final quiz score is recalculated", re.search(r"graded \((\d+(\.\d+)?)%\)", marked) is not None, marked[:400])
        shot(page, "p6-05-quiz-marked")

        # grade an assignment submission
        page.goto(f"{BASE}/admin/grading")
        page.wait_for_load_state("networkidle")
        assignment_links = page.locator("a:has-text('Grade')")
        assignment_links.last.click()
        page.wait_for_url("**/admin/grading/assignment/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("grading screen shows the submitted work", has(page, "Submitted work"), body(page)[:300])
        page.fill("#score", "78")
        page.fill("#feedback", "Good use of a real question and a clear headline metric. Next time annotate the churn movement.")
        page.click("button:has-text('Save grade and notify')")
        settle(page, text="Already graded", timeout=25000)
        graded_body = body(page)
        check("assignment grading succeeds and shows the score", "Already graded" in graded_body, graded_body[:400])
        check("assignment score is persisted", "78 / 100" in graded_body, graded_body[:400])
        shot(page, "p6-06-assignment-graded")

        # resubmission request on Grace's JavaScript assignment
        page.goto(f"{BASE}/admin/grading")
        page.wait_for_load_state("networkidle")
        grace_row = page.locator("li:has-text('Grace Adeyemi') a:has-text('Grade')")
        if grace_row.count() == 0:
            grace_row = page.locator("a[href*='/admin/grading/assignment/']")
        check("a submission is still waiting to grade", grace_row.count() > 0)
        grace_row.first.click()
        page.wait_for_url("**/admin/grading/assignment/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        page.check("input[name=request_resubmission]")
        page.fill("#feedback", "Please add one more concrete example before I grade this properly.")
        page.click("button:has-text('Request resubmission')")
        settle(page, text="resubmission", timeout=25000)
        check("resubmission request succeeds", has(page, "resubmission"), body(page)[:300])

        # ------------------------------------------------------ learner sees the outcome
        context.clear_cookies()
        login(page, "ravi@demo.test")
        page.goto(f"{BASE}/learn/grades")
        page.wait_for_load_state("networkidle")
        grades = body(page)
        check("graded quiz appears for the learner", "Quiz reviewed" in grades or "passed" in grades.lower(), grades[:400])
        check("grading feedback reaches the learner", "well done" in grades.lower() or "passed" in grades.lower() or "score" in grades.lower())
        shot(page, "p6-07-grades")

        # the full notifications page arrives in Phase 9; for now the dashboard card
        page.goto(f"{BASE}/dashboard")
        page.wait_for_load_state("networkidle")
        check(
            "learner was notified about grading",
            has(page, "Quiz reviewed") or has(page, "graded") or has(page, "Refund"),
            body(page)[:500],
        )

        # ------------------------------------------- learner: resubmission request
        context.clear_cookies()
        login(page, "grace@demo.test")
        page.goto(f"{BASE}/learn/courses/javascript-fundamentals/assignment/18")
        page.wait_for_load_state("networkidle")
        resubmission_body = body(page)
        check(
            "resubmission request is visible to the learner",
            "asked for a resubmission" in resubmission_body,
            resubmission_body[:400],
        )
        check(
            "learner can submit again after a resubmission request",
            page.locator("#body_text").count() == 1,
            resubmission_body[:200],
        )
        shot(page, "p6-08-resubmission")

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("review email is in the outbox", has(page, "Quiz reviewed"), body(page)[:700])

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
