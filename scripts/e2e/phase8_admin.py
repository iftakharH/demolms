r"""
Phase 8 verification: admin dashboard KPIs, users, coupons, audit log and the
auditor read-only guarantee (UI *and* server-side rejection).

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase8_admin.py
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
    if email in ("admin@demo.test", "auditor@demo.test"):
        page.wait_for_url("**/login/mfa*", timeout=20000)
        text = body(page).upper()
        code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text) or re.search(r"\b(\d{6})\b", text)
        page.fill("#code", code.group(1) + code.group(2))
        page.click("button[type=submit]")
        page.wait_for_url("**/admin*", timeout=20000)
    page.wait_for_load_state("networkidle")


ADMIN_PAGES = [
    ("/admin", ["Dashboard", "Net revenue", "New users", "Enrolments", "Completion rate"]),
    ("/admin/courses", ["Courses", "Advanced React Patterns"]),
    ("/admin/users", ["Users", "Alex Morgan"]),
    ("/admin/orders", ["Orders", "Net revenue"]),
    ("/admin/coupons", ["Coupons", "WELCOME10"]),
    ("/admin/grading", ["Grading queue"]),
    ("/admin/certificates", ["Certificates", "Valid"]),
    ("/admin/audit", ["Audit log", "auth.login"]),
]


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        admin_context = browser.new_context(viewport={"width": 1400, "height": 1100})
        admin = admin_context.new_page()
        admin.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        login(admin, "admin@demo.test")

        # ------------------------------------------------------------------ dashboard
        admin.goto(f"{BASE}/admin")
        admin.wait_for_load_state("networkidle")
        dashboard = body(admin)
        for label in ["Net revenue", "New users", "Enrolments", "Completion rate", "Needs attention"]:
            check(f"dashboard KPI: {label}", has(admin, label), dashboard[:200])
        check("dashboard has the 30-day chart", "Revenue, last 30 days" in dashboard)
        check("chart shows revenue bars", admin.locator("div[title*='£']").count() >= 1)
        shot(admin, "p8-01-dashboard")

        # ---------------------------------------------------------------------- users
        admin.goto(f"{BASE}/admin/users?role=learner")
        admin.wait_for_load_state("networkidle")
        users_body = body(admin)
        check("users list is filtered to learners", "Alex Morgan" in users_body and "Imogen Clark" not in users_body)
        admin.goto(f"{BASE}/admin/users?q=grace")
        admin.wait_for_load_state("networkidle")
        check("user search works", "Grace Adeyemi" in body(admin), body(admin)[:200])

        admin.click("a:has-text('Open')")
        admin.wait_for_url("**/admin/users/**", timeout=20000)
        admin.wait_for_load_state("networkidle")
        user_detail = body(admin)
        check("user detail shows enrolments", "Enrolments" in user_detail)
        check("user detail shows orders", "Orders" in user_detail)
        check("user detail shows account controls", "Account controls" in user_detail)
        user_url = admin.url
        shot(admin, "p8-02-user-detail")

        # role change + back, then disable + re-enable
        admin.select_option("#role", "auditor")
        admin.click("button:has-text('Update role')")
        settle(admin, text="is now auditor", timeout=25000)
        check("role change works", has(admin, "is now auditor"), body(admin)[:300])
        admin.reload()
        admin.wait_for_load_state("networkidle")
        check("role change persisted", admin.locator("#role").input_value() == "auditor")

        admin.fill("#reason", "Phase 8 verification - temporary demotion")
        admin.click("button:has-text('Disable account and sign out')")
        settle(admin, text="can sign in again", timeout=2000)  # not expected yet
        settle(admin, text="has been disabled", timeout=25000)
        check("account can be disabled", has(admin, "has been disabled"), body(admin)[:300])
        admin.reload()
        admin.wait_for_load_state("networkidle")
        check("disabled state is visible", has(admin, "disabled"))
        admin.click("button:has-text('Enable account')")
        settle(admin, text="can sign in again", timeout=25000)
        check("account can be re-enabled", has(admin, "can sign in again"), body(admin)[:300])

        # restore the learner role
        admin.select_option("#role", "learner")
        admin.click("button:has-text('Update role')")
        settle(admin, text="is now learner", timeout=25000)
        check("role restored to learner", has(admin, "is now learner"), body(admin)[:300])

        # -------------------------------------------------------------------- coupons
        admin.goto(f"{BASE}/admin/coupons")
        admin.wait_for_load_state("networkidle")
        check("coupon list shows the seeded coupons", has(admin, "WELCOME10") and has(admin, "FREE100"))
        admin.fill("#code", "SAVE15")
        admin.select_option("#kind", "percent")
        admin.fill("#value", "15")
        admin.fill("#max_uses", "10")
        admin.click("button:has-text('Create coupon')")
        settle(admin, text="Coupon SAVE15 created", timeout=25000)
        admin.reload()
        admin.wait_for_load_state("networkidle")
        check("coupon creation works", has(admin, "SAVE15"), body(admin)[:400])
        shot(admin, "p8-03-coupons")

        row = admin.locator("article:has-text('SAVE15')")
        check("new coupon appears in the list", row.count() == 1)
        row.locator("button:has-text('Disable')").click()
        settle(admin, text="disabled", timeout=25000)
        admin.reload()
        admin.wait_for_load_state("networkidle")
        check("coupon can be disabled", "disabled" in body(admin).lower(), body(admin)[:400])

        # ------------------------------------------------------------------ audit log
        admin.goto(f"{BASE}/admin/audit")
        admin.wait_for_load_state("networkidle")
        audit_body = body(admin)
        check("audit log lists entries", "auth.login" in audit_body or "user." in audit_body)
        check("audit log shows who acted", "admin@demo.test" in audit_body or "system" in audit_body)
        shot(admin, "p8-04-audit")

        admin.goto(f"{BASE}/admin/audit?group=Users%20%26%20auth")
        admin.wait_for_load_state("networkidle")
        check("audit log filters by group", has(admin, "user.") or has(admin, "auth."), body(admin)[:300])

        admin.goto(f"{BASE}/admin/audit?q=SAVE15")
        admin.wait_for_load_state("networkidle")
        check("audit log records the coupon this test created", has(admin, "SAVE15"), body(admin)[:400])

        admin.goto(f"{BASE}/admin/audit?q=Phase%208%20verification")
        admin.wait_for_load_state("networkidle")
        check("audit log records the disable reason", has(admin, "Phase 8 verification"), body(admin)[:400])

        # ------------------------------------------- auditor: read-only by UI and by server
        # Capture a *real* browser request for a write action as the admin, then replay
        # the exact same request as the auditor. Same URL, same Next-Action header,
        # same multipart body - only the session cookie differs.
        captured: dict[str, str] = {}

        def capture(request) -> None:
            headers_lower = {key.lower(): value for key, value in request.headers.items()}
            if request.method != "POST" or "next-action" not in headers_lower:
                return
            if "/admin/courses/" not in request.url:
                return
            raw = request.post_data_buffer
            body = raw.decode("utf-8", errors="replace") if raw else (request.post_data or "")
            if not body:
                return
            captured["url"] = request.url
            captured["next-action"] = headers_lower["next-action"]
            captured["content-type"] = headers_lower.get("content-type", "multipart/form-data")
            captured["data"] = body

        admin.on("request", capture)

        # the Figma course is published; unpublish it, capture the publish action, restore it
        admin.goto(f"{BASE}/admin/courses/clean-product-design-figma")
        admin.wait_for_load_state("networkidle")
        check("course is published before the audit test", has(admin, "Published"), body(admin)[:200])
        admin.click("button:has-text('Unpublish')")
        settle(admin, text="Saved.", timeout=25000)
        admin.reload()
        admin.wait_for_load_state("networkidle")
        check("admin can unpublish a course", has(admin, "Draft"), body(admin)[:200])

        admin.click("button:has-text('Publish')")
        settle(admin, text="Saved.", timeout=25000)
        admin.reload()
        admin.wait_for_load_state("networkidle")
        check("admin can publish it again", has(admin, "Published"), body(admin)[:200])

        publish_request = dict(captured)
        check("the publish request was captured", bool(publish_request.get("data")), str(bool(publish_request)))

        # unpublish again so a replayed publish would be a visible change
        admin.click("button:has-text('Unpublish')")
        settle(admin, text="Saved.", timeout=25000)

        auditor_context = browser.new_context(viewport={"width": 1400, "height": 1100})
        auditor = auditor_context.new_page()
        auditor.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        login(auditor, "auditor@demo.test")

        for path, expects in ADMIN_PAGES:
            auditor.goto(f"{BASE}{path}")
            auditor.wait_for_load_state("networkidle")
            page_body = body(auditor)
            rendered = all(text.lower() in page_body.lower() for text in expects)
            check(f"auditor can read {path}", rendered, page_body[:160])
            writes = auditor.locator(
                "button:has-text('Save'), button:has-text('Create'), button:has-text('Revoke'), "
                "button:has-text('Publish'), button:has-text('Delete'), button:has-text('Refund'), "
                "button:has-text('Disable'), button:has-text('Grade'), button:has-text('Update role')"
            )
            check(f"auditor sees no write controls on {path}", writes.count() == 0, f"{writes.count()} found")

        auditor.goto(f"{BASE}/admin/users/{user_url.rsplit('/', 1)[-1]}")
        auditor.wait_for_load_state("networkidle")
        check("auditor sees the read-only explanation on user controls", has(auditor, "read-only"), body(auditor)[:300])
        shot(auditor, "p8-05-auditor")

        if publish_request.get("data"):
            replay_headers = {
                "Next-Action": publish_request["next-action"],
                "content-type": publish_request["content-type"],
            }

            auditor_response = auditor_context.request.post(
                publish_request["url"],
                headers=replay_headers,
                data=publish_request["data"],
            )
            rejected = (
                auditor_response.status >= 400
                or "FORBIDDEN" in auditor_response.text()
                or "read-only" in auditor_response.text().lower()
            )
            check(
                "auditor replaying a real publish request is rejected server-side",
                rejected,
                f"{auditor_response.status}: {auditor_response.text()[:200]}",
            )
            check(
                "rejection is attributed to the read-only guard",
                "FORBIDDEN" in auditor_response.text() or "read-only" in auditor_response.text().lower(),
                f"{auditor_response.status}: {auditor_response.text()[:200]}",
            )

            admin.goto(f"{BASE}/admin/courses/clean-product-design-figma")
            admin.wait_for_load_state("networkidle")
            check("course is still unpublished after the auditor attempt", has(admin, "Draft"), body(admin)[:200])

            # positive control: the very same request works for an admin
            admin_response = admin_context.request.post(
                publish_request["url"],
                headers=replay_headers,
                data=publish_request["data"],
            )
            check(
                "the same request succeeds for an admin",
                admin_response.status == 200,
                str(admin_response.status),
            )
            admin.goto(f"{BASE}/admin/courses/clean-product-design-figma")
            admin.wait_for_load_state("networkidle")
            check("replayed publish restored the course for the admin", has(admin, "Published"), body(admin)[:200])
        else:
            check("auditor replaying a real publish request is rejected server-side", False, "no request captured")
            check("rejection is attributed to the read-only guard", False, "no request captured")
            check("course is still unpublished after the auditor attempt", False, "no request captured")
            check("the same request succeeds for an admin", False, "no request captured")
            check("replayed publish restored the course for the admin", False, "no request captured")

        auditor_context.close()
        admin_context.close()
        browser.close()

    noisy = [
        error
        for error in console_errors
        if "Failed to load resource" not in error
        and "Download the React DevTools" not in error
        and "DeprecationWarning" not in error
    ]
    check("no runtime console errors", len(noisy) == 0, " | ".join(noisy[:2]))

    failed = [name for name, ok, _ in results if not ok]
    print("\n---")
    print(f"{len(results) - len(failed)}/{len(results)} checks passed")
    if failed:
        print("failed: " + ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
