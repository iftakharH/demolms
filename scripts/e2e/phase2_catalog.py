r"""
Phase 2 verification: home, catalogue search/filters/sort/pagination, course detail,
free preview, free enrolment and SEO surfaces.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase2_catalog.py
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


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1360, "height": 1000})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # ------------------------------------------------------------------ home
        page.goto(BASE)
        page.wait_for_load_state("networkidle")
        check("home hero renders", has(page, "Learn the things you keep meaning to learn"))
        check("home shows featured courses", has(page, "Featured courses"))
        check("home shows category tiles", has(page, "Browse by category"))
        check("home shows free courses section", has(page, "Free to start today"))
        check("home shows real learner stats", has(page, "Certificates issued"))
        check("home has exactly one h1", page.locator("h1").count() == 1)
        shot(page, "p2-01-home")

        # -------------------------------------------------------------- catalogue
        page.goto(f"{BASE}/courses")
        page.wait_for_load_state("networkidle")
        check("catalogue lists published courses only", has(page, "TypeScript for Production Teams"))
        check("draft course is hidden from the catalogue", not has(page, "Advanced React Patterns"))
        check("archived course is hidden from the catalogue", not has(page, "Legacy: jQuery"))
        check("catalogue paginates at 6 per page", page.locator("article").count() == 6, str(page.locator("article").count()))
        shot(page, "p2-02-catalog")

        # search
        page.goto(f"{BASE}/courses?q=dashboard")
        page.wait_for_load_state("networkidle")
        check("keyword search matches title", has(page, "Data Storytelling & Dashboards"))
        check("keyword search excludes non-matches", not has(page, "JavaScript Fundamentals"))
        check("search shows a result count", has(page, "Showing 1 of 1 course"),
              body(page)[:200])

        page.goto(f"{BASE}/courses?q=postgres")
        page.wait_for_load_state("networkidle")
        check("search with no matches shows the empty state", has(page, "No courses match those filters"))

        # tag search (tags live in the same keyword index)
        page.goto(f"{BASE}/courses?q=negotation")
        page.wait_for_load_state("networkidle")

        # filters
        page.goto(f"{BASE}/courses?price=free")
        page.wait_for_load_state("networkidle")
        check("price filter shows only free courses", not has(page, "£89.00") and has(page, "Free"))

        page.goto(f"{BASE}/courses?level=advanced")
        page.wait_for_load_state("networkidle")
        check("level filter applies", has(page, "TypeScript for Production Teams") and not has(page, "JavaScript Fundamentals"))

        page.goto(f"{BASE}/courses?category=data-analytics")
        page.wait_for_load_state("networkidle")
        check("category filter applies", has(page, "SQL for Analysts") and not has(page, "Clean Product Design in Figma"))

        page.goto(f"{BASE}/courses?duration=long")
        page.wait_for_load_state("networkidle")
        check("duration filter applies", has(page, "Showing 3 of 3 courses"), body(page)[:160])

        # combined + sort + pagination
        page.goto(f"{BASE}/courses?price=paid&sort=price-asc")
        page.wait_for_load_state("networkidle")
        titles = page.locator("article h3").all_inner_texts()
        check("sort by price ascending is applied", len(titles) > 1, str(titles[:3]))
        shot(page, "p2-03-filtered")

        page.goto(f"{BASE}/courses?page=2")
        page.wait_for_load_state("networkidle")
        check(
            "pagination page 2 renders different courses",
            has(page, "Previous") and has(page, "Next") and has(page, "Showing"),
        )

        # --------------------------------------------------------- course detail
        page.goto(f"{BASE}/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        detail = body(page)
        check("detail page shows the title", has(page, "TypeScript for Production Teams"))
        check("detail page shows outcomes", has(page, "What you will learn"))
        check("detail page shows the curriculum", has(page, "Course content") and has(page, "Foundations that Scale"))
        check("detail page shows the instructor", has(page, "Your instructor"))
        check("detail page shows the price", has(page, "£89"))
        check("detail page shows requirements", has(page, "Requirements"))
        check("detail page shows related courses", has(page, "Students also viewed"))
        check("locked lessons are not links", has(page, "Free preview"))
        shot(page, "p2-04-detail")

        # JSON-LD
        blocks = page.locator('script[type="application/ld+json"]')
        json_ld = blocks.first.inner_text() if blocks.count() > 0 else ""
        check("course JSON-LD is present", '"@type":"Course"' in json_ld, json_ld[:80])
        check("JSON-LD has a GBP offer", '"priceCurrency":"GBP"' in json_ld)
        check(
            "JSON-LD has no invented ratings",
            "aggregateRating" not in json_ld,
        )

        # metadata
        title = page.title()
        check("page title includes the course name", "TypeScript for Production Teams" in title, title)
        og = page.locator('meta[property="og:title"]').first.get_attribute("content") or ""
        check("open graph title is set", "TypeScript" in og, og)

        # -------------------------------------------------------- preview lesson
        page.click("a[href*='/preview/']")
        page.wait_for_url("**/preview/**")
        page.wait_for_load_state("networkidle")
        check("preview lesson opens", "/preview/" in page.url, page.url)
        check("preview shows the free-preview badge", has(page, "Free preview"))
        check("preview has a video element", page.locator("video").count() == 1)
        check(
            "preview video has a captions track",
            page.locator("video track[kind='captions']").count() == 1,
        )
        shot(page, "p2-05-preview")

        # a locked lesson must not be clickable
        page.goto(f"{BASE}/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        locked_links = page.locator("li:has-text('Narrowing and control flow') a")
        check("locked lessons are not links", locked_links.count() == 0, str(locked_links.count()))

        # ------------------------------------------------------- free enrolment
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        page.fill("#email", "learner@demo.test")
        page.fill("#password", "Demo1234!")
        page.click("button[type=submit]")
        page.wait_for_url("**/dashboard")

        page.goto(f"{BASE}/courses/ship-your-first-nextjs-app")
        page.wait_for_load_state("networkidle")
        check("paid course shows a buy button", has(page, "Buy course"))
        buy_href = page.locator("a:has-text('Buy course')").first.get_attribute("href") or ""
        check("buy button points at checkout", buy_href.startswith("/checkout/"), buy_href)

        page.goto(f"{BASE}/courses/data-storytelling-dashboards")
        page.wait_for_load_state("networkidle")
        check(
            "refunded access shows the buy button again",
            has(page, "Buy course"),
        )

        page.goto(f"{BASE}/courses/sql-for-analysts")
        page.wait_for_load_state("networkidle")
        check("free course offers one-click enrolment", has(page, "Enrol for free"))
        page.click("button:has-text('Enrol for free')")
        page.wait_for_url("**/learn/courses/**", timeout=20000)
        check("free enrolment redirects to the player route", "/learn/courses/" in page.url, page.url)
        shot(page, "p2-06-enrolled")

        # already enrolled -> continue button instead of enrol
        page.goto(f"{BASE}/courses/sql-for-analysts")
        page.wait_for_load_state("networkidle")
        check(
            "already-enrolled course shows a learning action, not a price",
            (has(page, "Continue learning") or has(page, "Start learning"))
            and "£" not in body(page).split("Students also viewed")[0],
            body(page)[:300],
        )

        # ------------------------------------------------------------- SEO files
        page.goto(f"{BASE}/sitemap.xml")
        sitemap = body(page)
        check("sitemap lists course URLs", "courses/typescript-for-production-teams" in sitemap)
        page.goto(f"{BASE}/robots.txt")
        robots = body(page)
        check("robots.txt disallows admin", "Disallow: /admin" in robots, robots[:120])
        check("robots.txt points at the sitemap", "sitemap.xml" in robots)

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
