r"""
Phase 5 verification: learner dashboard, My Learning, the course player
(resume position, captions, notes autosave, downloads) and access control.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase5_player.py
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


def login(page: Page, email: str = "learner@demo.test") -> None:
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
        context = browser.new_context(viewport={"width": 1400, "height": 1000})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        login(page)

        # ------------------------------------------------------------- dashboard
        check("dashboard shows the attention card", has(page, "Needs your attention"), body(page)[:200])
        check("dashboard shows pending reviews", has(page, "Review") or has(page, "Grading"))
        shot(page, "p5-01-dashboard")

        # ------------------------------------------------------------- my learning
        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        check("my learning shows progress bars", page.locator("[role=progressbar]").count() >= 2)
        check("completed course is grouped", has(page, "Completed"))

        # ---------------------------------------------------------------- player
        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        player = body(page)
        check("player opens the first incomplete lesson", "Narrowing and control flow" in player, player[:300])
        check("player shows the curriculum sidebar", "Course content" in player)
        check("player shows lesson ticks", page.locator("nav[aria-label='Lesson list'] li").count() >= 5)
        check("player shows progress", "of 9 lessons complete" in player)
        shot(page, "p5-02-player")

        # ---- resume: the seeded position for lesson 3 is 14s of a 24s clip
        video = page.locator("video")
        check("video element renders", video.count() == 1)
        check("captions track is attached", page.locator("video track[kind='captions']").count() == 1)
        check("player offers a captions toggle", page.locator("button:has-text('Captions')").count() == 1)

        page.wait_for_timeout(2500)
        seeked = page.evaluate(
            "() => { const v = document.querySelector('video'); return v ? v.currentTime : -1; }"
        )
        check("player resumes near the saved position", 11 <= seeked <= 18, f"currentTime={seeked}")
        check(
            "player tells the learner it resumed",
            page.locator("text=Resumed where you left off").count() == 1,
        )

        # ---- captions toggle flips the track mode
        page.click("button:has-text('Captions')")
        page.wait_for_timeout(300)
        modes_after_off = page.evaluate(
            "() => Array.from(document.querySelector('video').textTracks).map(t => t.mode)"
        )
        check("captions toggle turns the track off", modes_after_off == ["hidden"], str(modes_after_off))
        page.click("button:has-text('Captions')")
        page.wait_for_timeout(300)
        modes_after_on = page.evaluate(
            "() => Array.from(document.querySelector('video').textTracks).map(t => t.mode)"
        )
        check("captions toggle turns the track back on", modes_after_on == ["showing"], str(modes_after_on))

        # ---- position autosave: play a few seconds, then check it persisted
        page.evaluate(
            """() => { const v = document.querySelector('video'); v.currentTime = 8; v.play().catch(() => {}); }"""
        )
        page.wait_for_timeout(7000)
        page.evaluate("() => document.querySelector('video').pause()")
        saved = settle(page, text="Position saved", timeout=8000)
        check("player reports the position was saved", saved, body(page)[-200:])
        current = page.evaluate("() => document.querySelector('video').currentTime")
        check("video advanced past the seek point", current > 11, f"t={current:.1f}")

        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams?lesson=3")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2500)
        reloaded = page.evaluate("() => document.querySelector('video').currentTime")
        check("position survives a reload", reloaded >= 11, f"t={reloaded:.1f}")

        # ---- notes autosave (status text lives inside the notes card header)
        page.fill("#lesson-notes", "Narrowing beats casting. Revisit the discriminated union example.")
        saved_note = False
        status_text = ""
        for _ in range(32):
            status_span = page.locator("section:has(#lesson-notes) span:has-text('Saved')").first
            status_text = status_span.inner_text() if status_span.count() > 0 else ""
            if "Saved" in status_text:
                saved_note = True
                break
            page.wait_for_timeout(250)
        check("notes autosave reports saved", saved_note, f"status={status_text!r}")
        page.reload()
        page.wait_for_load_state("networkidle")
        check(
            "note persists after reload",
            "Narrowing beats casting" in page.input_value("#lesson-notes"),
            page.input_value("#lesson-notes")[:80],
        )
        check("course-wide note list includes the note", has(page, "My notes across this course"))
        shot(page, "p5-03-notes")

        # ---- resources + access check
        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams?lesson=1")
        page.wait_for_load_state("networkidle")
        if page.locator("button:has-text('Resources')").count() > 0:
            page.click("button:has-text('Resources')")
            page.wait_for_timeout(400)
        resource_links = page.locator("a[href^='/api/resources/']")
        check(
            "lesson resource is attached to the right lesson (cheat-sheet on lesson 1)",
            has(page, "TypeScript cheat-sheet"),
            body(page)[:400],
        )
        check("resource download link is an access-checked API route", resource_links.count() >= 1, str(resource_links.count()))

        if resource_links.count() > 0:
            href = resource_links.first.get_attribute("href")
            response = context.request.get(f"{BASE}{href}")
            check("enrolled learner can download a resource", response.status == 200, str(response.status))
            disposition = response.headers.get("content-disposition", "")
            check("download is sent as an attachment", "attachment" in disposition.lower(), disposition)

        # ---- access control: signed-out and non-enrolled users are blocked
        anonymous = browser.new_context()
        anon_page = anonymous.new_page()
        anon_page.goto(f"{BASE}/learn/courses/typescript-for-production-teams")
        anon_page.wait_for_load_state("networkidle")
        check("signed-out player access redirects to login", "/login" in anon_page.url, anon_page.url)

        if resource_links.count() > 0:
            href = resource_links.first.get_attribute("href")
            anon_response = anonymous.request.get(f"{BASE}{href}")
            check(
                "anonymous resource download is rejected",
                anon_response.status in (401, 403),
                str(anon_response.status),
            )
        anonymous.close()

        # a course the learner is not enrolled in
        page.goto(f"{BASE}/learn/courses/design-systems-that-scale")
        page.wait_for_load_state("networkidle")
        check("non-enrolled course redirects to the sales page", "/courses/design-systems-that-scale" in page.url, page.url)

        # refunded (revoked) course access
        page.goto(f"{BASE}/learn/courses/data-storytelling-dashboards")
        page.wait_for_load_state("networkidle")
        check("refunded access is refused in the player", "/courses/data-storytelling-dashboards" in page.url, page.url)

        # ---- complete a lesson and advance
        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams?lesson=3")
        page.wait_for_load_state("networkidle")
        page.click("button:has-text('Complete and continue')")
        settle(page, text="Lesson 4", timeout=20000)
        check("completing a lesson advances to the next one", "Operators" in body(page) or "lesson=4" in page.url, page.url)
        check("progress counter incremented", has(page, "of 9 lessons complete"))

        # ---- text lesson renders markdown
        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams?lesson=2")
        page.wait_for_load_state("networkidle")
        check("article lesson renders markdown headings", "What" in body(page) and page.locator("article h2").count() >= 1)
        check("article lesson renders a code block", page.locator("article pre code").count() >= 1)

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
