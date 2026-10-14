r"""
Phase 3 verification: admin course builder + uploads + quiz builder + auditor read-only.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase3_builder.py

Leaves a new published course behind (created by the test) - re-run `npm run seed` after.
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

# fixtures
VIDEO = os.path.join(ROOT, "public", "uploads", "videos", "sample.mp4")
CAPTIONS = os.path.join(ROOT, "public", "uploads", "videos", "sample.vtt")
RESOURCE = os.path.join(ROOT, "public", "uploads", "resources", "migration-worksheet.pdf")

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


def settle(page: Page, text: str | None = None, url: str | None = None, timeout: int = 20000) -> bool:
    """Wait for expected text or URL - server actions do not always change the URL."""
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


def shot(page: Page, name: str) -> None:
    page.screenshot(path=os.path.join(SHOTS, f"{name}.png"))


def admin_login(page: Page, email: str = "admin@demo.test") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    page.wait_for_url("**/login/mfa*", timeout=20000)
    text = body(page).upper()
    code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text)
    if not code:
        code = re.search(r"\b(\d{6})\b", text)
    assert code, "no dev TOTP code on the MFA screen"
    page.fill("#code", code.group(1) + code.group(2))
    page.click("button[type=submit]")
    page.wait_for_url("**/admin*", timeout=20000)


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 1000})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        admin_login(page)

        # ------------------------------------------------------------ course list
        page.goto(f"{BASE}/admin/courses")
        page.wait_for_load_state("networkidle")
        check("course list shows all statuses", has(page, "Draft") and has(page, "Archived") and has(page, "Published"))
        check("course list shows the draft course", has(page, "Advanced React Patterns"))
        page.goto(f"{BASE}/admin/courses?status=draft")
        page.wait_for_load_state("networkidle")
        check("status filter shows only drafts", has(page, "Advanced React Patterns") and not has(page, "JavaScript Fundamentals"), body(page)[:200])
        shot(page, "p3-01-course-list")

        # ---------------------------------------------------------- create course
        page.goto(f"{BASE}/admin/courses/new")
        page.wait_for_load_state("networkidle")
        page.fill("#title", "Build a CLI Tool with Node.js")
        page.select_option("#category_id", label="Software Development")
        page.select_option("#level", label="Intermediate")
        page.fill("#price", "39.50")
        page.click("button:has-text('Create draft course')")
        page.wait_for_url("**/admin/courses/build-a-cli-tool-with-node-js*", timeout=20000)
        check("new course gets a slug from the title", "build-a-cli-tool-with-node-js" in page.url, page.url)
        check("new course starts as a draft", has(page, "Draft"))
        check("publishing checklist is shown", has(page, "Publishing checklist"))

        # -------------------------------------------------------- settings + thumbnail
        page.fill("#subtitle", "Ship a real command line tool with tests and CI")
        page.fill("#outcomes", "Parse arguments safely\nWrite integration tests\nPublish to npm")
        page.fill("#tags", "nodejs, cli, testing")
        page.set_input_files("input[name=thumbnail]", os.path.join(ROOT, "public", "uploads", "thumbnails", "sql-for-analysts.svg"))
        page.click("button:has-text('Save settings')")
        settle(page, text="Course settings saved")
        check("settings save round-trips", has(page, "Course settings saved"), body(page)[:200])

        page.reload()
        page.wait_for_load_state("networkidle")
        check("subtitle persisted", page.input_value("#subtitle") == "Ship a real command line tool with tests and CI", page.input_value("#subtitle"))
        check("price persisted as 39.50", page.input_value("#price") == "39.50", page.input_value("#price"))
        check("thumbnail persisted", page.locator("img[src*='/uploads/']").count() > 0)

        # ------------------------------------------------------------- sections
        page.fill("input[name=title][placeholder='New section title']", "Getting started")
        page.click("button:has-text('Add section')")
        settle(page, text="Getting started")
        check(
            "section added",
            page.locator("input[name=title][value='Getting started']").count() >= 1,
            body(page)[:200],
        )

        page.fill("input[placeholder='New lesson title'] >> nth=0", "Welcome and setup")
        page.select_option("select[name=type] >> nth=0", "video")
        page.click("button:has-text('Add lesson')")
        page.wait_for_url("**/lessons/**", timeout=20000)
        check("lesson editor opens after adding a lesson", "/lessons/" in page.url, page.url)

        # upload video + captions on the video lesson
        page.set_input_files("input[name=video]", VIDEO)
        page.set_input_files("input[name=captions]", CAPTIONS)
        page.click("button:has-text('Save lesson')")
        settle(page, text="current: videos/")
        check("video upload saved", has(page, "current: videos/"), body(page)[:200])
        check("captions upload saved", has(page, "current: captions/"), body(page)[:400])
        check("lesson editor embeds a preview player", page.locator("video").count() >= 1)
        shot(page, "p3-02-lesson-editor")

        # resource upload
        page.fill("#resource-title", "CLI worksheet")
        page.set_input_files("#resource-file", RESOURCE)
        page.click("button:has-text('Upload')")
        settle(page, text="CLI worksheet")
        check("resource uploaded and listed", has(page, "CLI worksheet"), body(page)[:300])

        # free preview flag
        page.check("input[name=is_preview]")
        page.click("button:has-text('Save lesson')")
        settle(page, text="Saved.")
        check("free preview flag saved", has(page, "Free preview"))

        # --------------------------------------------------------- article lesson
        page.goto(f"{BASE}/admin/courses/build-a-cli-tool-with-node-js")
        page.wait_for_load_state("networkidle")
        page.fill("input[placeholder='New lesson title'] >> nth=0", "How CLIs are structured")
        page.select_option("select[name=type] >> nth=0", "text")
        page.click("button:has-text('Add lesson')")
        page.wait_for_url("**/lessons/**", timeout=20000)
        page.fill("#body_md", "## Structure\n\nA CLI is a parser, a command layer and a renderer.\n\n```js\nconsole.log('hi')\n```")
        page.click("button:has-text('Save lesson')")
        settle(page, text="Saved.")
        page.reload()
        page.wait_for_load_state("networkidle")
        check("article body persisted", "A CLI is a parser" in page.input_value("#body_md"), page.input_value("#body_md")[:80])

        # ------------------------------------------------------------ quiz builder
        page.goto(f"{BASE}/admin/courses/build-a-cli-tool-with-node-js")
        page.wait_for_load_state("networkidle")
        page.fill("input[placeholder='New lesson title'] >> nth=0", "Knowledge check")
        page.select_option("select[name=type] >> nth=0", "quiz")
        page.click("button:has-text('Add lesson')")
        page.wait_for_url("**/lessons/**", timeout=20000)
        quiz_url = page.url

        # 1. single choice
        page.fill("#prompt", "Which npm field marks a package as executable?")
        page.fill("input[name=options] >> nth=0", "bin")
        page.fill("input[name=options] >> nth=1", "main")
        page.check("input[name=correct_index][value='0']")
        page.click("button:has-text('Add question')")
        settle(page, text="Which npm field marks a package as executable?")
        check("single-choice question added", has(page, "Which npm field marks a package as executable?"), body(page)[:400])

        # 2. multiple choice (reload first: each save is a full action round-trip)
        page.goto(quiz_url)
        page.wait_for_load_state("networkidle")
        page.select_option("#question-type", "multiple")
        page.fill("#prompt", "Which of these are valid argument styles?")
        page.click("button:has-text('Add option')")
        page.fill("input[name=options] >> nth=0", "--flag")
        page.fill("input[name=options] >> nth=1", "-f")
        page.fill("input[name=options] >> nth=2", "flag")
        page.check("input[name=correct_index][value='0']")
        page.check("input[name=correct_index][value='1']")
        page.click("button:has-text('Add question')")
        settle(page, text="Which of these are valid argument styles?")
        check(
            "multiple-choice question added",
            has(page, "Which of these are valid argument styles?"),
            body(page)[:400],
        )

        # 3. true/false
        page.goto(quiz_url)
        page.wait_for_load_state("networkidle")
        page.select_option("#question-type", "truefalse")
        page.fill("#prompt", "process.argv includes the node executable path.")
        page.select_option("#truefalse_correct", "0")
        page.click("button:has-text('Add question')")
        settle(page, text="process.argv includes the node executable path.")
        check("true/false question added", has(page, "process.argv includes the node executable path."))

        # 4. short answer
        page.goto(quiz_url)
        page.wait_for_load_state("networkidle")
        page.select_option("#question-type", "short")
        page.fill("#prompt", "Which module reads command line arguments?")
        page.fill("#accepted", "process\nprocess.argv")
        page.click("button:has-text('Add question')")
        settle(page, text="Which module reads command line arguments?")
        check(
            "short-answer question added with accepted answers",
            has(page, "Which module reads command line arguments?") and has(page, "Accepted:"),
            body(page)[:400],
        )

        # 5. essay
        page.goto(quiz_url)
        page.wait_for_load_state("networkidle")
        page.select_option("#question-type", "essay")
        page.fill("#prompt", "Describe how you would test a CLI end to end.")
        page.fill("#points", "3")
        page.click("button:has-text('Add question')")
        settle(page, text="Describe how you would test a CLI end to end.")
        check("essay question added", has(page, "Describe how you would test a CLI end to end."))
        check(
            "quiz now lists all five questions",
            all(
                has(page, prompt)
                for prompt in [
                    "Which npm field marks a package as executable?",
                    "Which of these are valid argument styles?",
                    "process.argv includes the node executable path.",
                    "Which module reads command line arguments?",
                    "Describe how you would test a CLI end to end.",
                ]
            ),
            body(page)[:600],
        )
        shot(page, "p3-03-quiz-builder")

        # assignment lesson
        page.goto(f"{BASE}/admin/courses/build-a-cli-tool-with-node-js")
        page.wait_for_load_state("networkidle")
        page.fill("input[placeholder='New lesson title'] >> nth=0", "Build your own CLI")
        page.select_option("select[name=type] >> nth=0", "assignment")
        page.click("button:has-text('Add lesson')")
        page.wait_for_url("**/lessons/**", timeout=20000)
        page.fill("#brief_md", "Submit a working CLI with at least two commands and one test.")
        page.click("button:has-text('Save lesson')")
        settle(page, text="Saved.")
        page.reload()
        page.wait_for_load_state("networkidle")
        check(
            "assignment brief persisted",
            "at least two commands" in page.input_value("#brief_md"),
            page.input_value("#brief_md")[:120],
        )

        # ------------------------------------------------------------- reorder
        page.goto(f"{BASE}/admin/courses/build-a-cli-tool-with-node-js")
        page.wait_for_load_state("networkidle")
        first_before = page.locator("li:has-text('Welcome and setup')").count()
        page.locator("button[aria-label='Move lesson down']").first.click()
        settle(page, text="Curriculum")
        check("lesson reorder works without error", first_before == 1, body(page)[:120])

        # ------------------------------------------------------- publish + preview
        page.click("button:has-text('Publish')")
        settle(page, text="Published")
        check("course publishes", has(page, "Published"), body(page)[:200])
        shot(page, "p3-04-published")

        checks_before = len(results)
        with page.expect_popup() as popup_info:
            page.click("a:has-text('Preview as learner')")
        preview = popup_info.value
        preview.wait_for_load_state("networkidle")
        check(
            "preview as learner opens the public page",
            "/courses/build-a-cli-tool-with-node-js" in preview.url,
            preview.url,
        )
        preview_body = preview.inner_text("body")
        check("new course appears with its price", "£39.50" in preview_body, preview_body[:300])
        check("new course shows the uploaded thumbnail", preview.locator("img[src*='/uploads/']").count() > 0)
        preview.screenshot(path=os.path.join(SHOTS, "p3-05-learner-preview.png"))
        preview.close()
        assert len(results) > checks_before

        # draft staff preview banner (also opens in a new tab)
        page.goto(f"{BASE}/admin/courses/advanced-react-patterns")
        page.wait_for_load_state("networkidle")
        with page.expect_popup() as draft_info:
            page.click("a:has-text('Preview as learner')")
        draft = draft_info.value
        draft.wait_for_load_state("networkidle")
        check("draft preview shows the staff banner", "Staff preview" in draft.inner_text("body"), draft.url)
        draft.close()

        # the draft must NOT be visible to a signed-out visitor
        context.clear_cookies()
        page.goto(f"{BASE}/courses/advanced-react-patterns")
        page.wait_for_load_state("networkidle")
        check("draft course 404s for visitors", has(page, "could not find that page"), page.url)

        # --------------------------------------------------------- auditor is read-only
        admin_login(page, "auditor@demo.test")
        page.goto(f"{BASE}/admin/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        check("auditor sees the builder", has(page, "Course settings"))
        check(
            "auditor sees no publish controls",
            page.locator("button:has-text('Publish')").count() == 0
            and page.locator("button:has-text('Unpublish')").count() == 0
            and page.locator("button:has-text('Archive')").count() == 0,
        )
        check("auditor sees no delete buttons", page.locator("button[aria-label^='Delete']").count() == 0)
        check("auditor cannot add sections", page.locator("button:has-text('Add section')").count() == 0)
        check("auditor cannot save settings", page.locator("button:has-text('Save settings')").count() == 0)
        shot(page, "p3-06-auditor-builder")

        page.goto(f"{BASE}/admin/courses/new")
        page.wait_for_load_state("networkidle")
        check(
            "auditor is sent back from the new-course page with a message",
            "read-only" in body(page).lower() and page.locator("#title").count() == 0,
            page.url,
        )

        noisy = [
            error
            for error in console_errors
            if "Failed to load resource" not in error and "Download the React DevTools" not in error
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
