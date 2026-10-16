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
        for widget in ["Recent orders", "Grading queue", "Quick actions", "Newest learners", "Top courses", "Latest activity", "Announcement"]:
            check(f"dashboard widget: {widget}", widget in dashboard)
        check("dashboard KPI: Refunded", "Refunded" in dashboard)
        check("dashboard KPI: Certificates", "Certificates" in dashboard)
        check(
            "recent orders link to order detail",
            admin.locator("a[href^='/admin/orders/']").count() >= 1,
        )
        check(
            "top courses link to the builder",
            admin.locator("a[href^='/admin/courses/']").count() >= 1,
        )
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

        usage_section = admin.locator("section:has-text('Coupon usage')")
        usage_text = usage_section.inner_text().lower()
        check(
            "coupon usage analytics render",
            "redemptions" in usage_text and "net revenue" in usage_text and "discount given" in usage_text,
            usage_text[:200],
        )
        check(
            "analytics lists the redeemed coupons",
            "typescript20" in usage_text and "welcome10" in usage_text,
            usage_text[:300],
        )
        check("analytics shows money given away", "£" in usage_text, usage_text[:200])
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

        # ------------------------------------- support access: enter as learner
        # Capture the real "Enter as learner" request for the auditor replay below.
        # (No positive replay here on purpose: replaying as the admin would flip the
        # admin browser into support mode mid-test.)
        support_request: dict[str, str] = {}

        def capture_support(request) -> None:
            headers_lower = {key.lower(): value for key, value in request.headers.items()}
            if request.method != "POST" or "next-action" not in headers_lower:
                return
            if "/admin/users/" not in request.url:
                return
            raw = request.post_data_buffer
            data = raw.decode("utf-8", errors="replace") if raw else (request.post_data or "")
            if not data:
                return
            support_request["url"] = request.url
            support_request["next-action"] = headers_lower["next-action"]
            support_request["content-type"] = headers_lower.get("content-type", "multipart/form-data")
            support_request["data"] = data

        admin.on("request", capture_support)

        support_user_url = f"{BASE}/admin/users/{user_url.rsplit('/', 1)[-1]}"
        admin.goto(support_user_url)
        admin.wait_for_load_state("networkidle")
        check("admin sees the support access button", has(admin, "Enter as learner"), body(admin)[:300])
        admin.click("button:has-text('Enter as learner')")
        settle(admin, url="**/dashboard*", timeout=25000)
        check(
            "entering lands on the learner dashboard",
            "/dashboard" in admin.url and has(admin, "Return to admin"),
            admin.url,
        )
        check("support banner names the learner", has(admin, "Support access"), body(admin)[:300])
        shot(admin, "p8-06-support-mode")

        admin.goto(f"{BASE}/admin")
        admin.wait_for_load_state("networkidle")
        check("admin console is locked while in support mode", "/dashboard" in admin.url, admin.url)

        admin.goto(f"{BASE}/learn/my-learning")
        admin.wait_for_load_state("networkidle")
        check("learner pages work while in support mode", has(admin, "My learning"), body(admin)[:200])

        admin.click("button:has-text('Return to admin')")
        settle(admin, text="Support session ended", timeout=25000)
        check("returning to admin works", has(admin, "Support session ended"), body(admin)[:300])
        check("still signed in as admin after returning", has(admin, "Account controls"), body(admin)[:200])

        admin.goto(f"{BASE}/admin/audit?group=Support%20access")
        admin.wait_for_load_state("networkidle")
        support_audit = body(admin)
        check("audit records support.entered", "support.entered" in support_audit)
        check("audit records support.exited", "support.exited" in support_audit)
        check("support audit names the learner", "grace@demo.test" in support_audit, support_audit[:400])

        # ------------------------------- staff accounts cannot learn or buy
        admin.goto(f"{BASE}/dashboard")
        admin.wait_for_load_state("networkidle")
        check("admin is redirected away from the learner dashboard", "/admin" in admin.url, admin.url)
        check(
            "redirect explains support access",
            has(admin, "Staff accounts have no learner area"),
            body(admin)[:300],
        )

        admin.goto(f"{BASE}/learn/my-learning")
        admin.wait_for_load_state("networkidle")
        check("admin is redirected away from my learning", "/admin" in admin.url, admin.url)

        admin.goto(f"{BASE}/courses/sql-for-analysts")
        admin.wait_for_load_state("networkidle")
        course_body = body(admin)
        check("course page shows the staff panel", "Platform staff view" in course_body, course_body[:300])
        check(
            "no enrol or buy button for staff",
            "Enrol for free" not in course_body and "Buy course" not in course_body,
        )
        check(
            "staff panel links to the builder",
            admin.locator("a[href='/admin/courses/sql-for-analysts']").count() >= 1,
        )
        shot(admin, "p8-07-staff-course")

        admin.goto(f"{BASE}/checkout/ship-your-first-nextjs-app")
        admin.wait_for_load_state("networkidle")
        check(
            "staff cannot open checkout",
            "/courses/ship-your-first-nextjs-app" in admin.url and "staff=1" in admin.url,
            admin.url,
        )

        admin.goto(f"{BASE}/courses")
        admin.wait_for_load_state("networkidle")
        check("catalogue cards offer management for staff", has(admin, "Manage in admin"))

        admin.goto(f"{BASE}/admin/settings")
        admin.wait_for_load_state("networkidle")
        settings_body = body(admin)
        check(
            "admin settings page renders",
            "Change password" in settings_body and "Two-factor authentication" in settings_body,
            settings_body[:300],
        )
        check("admin settings shows devices", "Devices signed in" in settings_body)
        shot(admin, "p8-08-settings")

        # replay a learner's real free-enrol request as the admin: refused, nothing created
        learner_context = browser.new_context(viewport={"width": 1400, "height": 1100})
        learner = learner_context.new_page()
        enrol_request: dict[str, str] = {}

        def capture_enrol(request) -> None:
            headers_lower = {key.lower(): value for key, value in request.headers.items()}
            if request.method != "POST" or "next-action" not in headers_lower:
                return
            if "/courses/" not in request.url:
                return
            raw = request.post_data_buffer
            data = raw.decode("utf-8", errors="replace") if raw else (request.post_data or "")
            if not data:
                return
            enrol_request["url"] = request.url
            enrol_request["next-action"] = headers_lower["next-action"]
            enrol_request["content-type"] = headers_lower.get("content-type", "multipart/form-data")
            enrol_request["data"] = data

        learner.on("request", capture_enrol)
        login(learner, "learner@demo.test")
        # the client redirect after a server action can race with networkidle
        for _ in range(40):
            if "/login" not in learner.url:
                break
            learner.wait_for_timeout(250)
        check("learner sign-in worked", "/login" not in learner.url, learner.url)
        learner.goto(f"{BASE}/courses/interview-skills-for-developers")
        learner.wait_for_load_state("networkidle")
        if learner.locator("button:has-text('Enrol for free')").count() > 0:
            learner.click("button:has-text('Enrol for free')")
            learner.wait_for_load_state("networkidle")
            learner.wait_for_timeout(500)
        check("the enrol request was captured", bool(enrol_request.get("data")), str(bool(enrol_request)))

        if enrol_request.get("data"):
            enrol_headers = {
                "Next-Action": enrol_request["next-action"],
                "content-type": enrol_request["content-type"],
            }
            enrol_response = admin_context.request.post(
                enrol_request["url"],
                headers=enrol_headers,
                data=enrol_request["data"],
            )
            # server actions deliver redirects via x-action-redirect (RSC), not a 303
            redirect_header = enrol_response.headers.get("x-action-redirect", "")
            check(
                "replaying the enrol request as admin is refused",
                "staff=1" in redirect_header or "staff=1" in enrol_response.text(),
                f"{enrol_response.status} {redirect_header[:160]}",
            )
        else:
            check("replaying the enrol request as admin is refused", False, "no request captured")

        # and the admin account itself owns nothing
        admin.goto(f"{BASE}/admin/users?q=Imogen")
        admin.wait_for_load_state("networkidle")
        admin.click("a:has-text('Open')")
        admin.wait_for_url("**/admin/users/**", timeout=20000)
        admin.wait_for_load_state("networkidle")
        check("admin account has no enrolments", has(admin, "Not enrolled in anything yet"), body(admin)[:300])
        check("admin account has no orders", has(admin, "No orders"), body(admin)[:300])

        # ---------------------------------------------- platform controls (settings)
        admin.goto(f"{BASE}/admin/settings")
        admin.wait_for_load_state("networkidle")
        check(
            "settings shows platform controls",
            has(admin, "Platform controls") and has(admin, "Announcement banner"),
            body(admin)[:300],
        )
        check("settings shows the category manager", has(admin, "Categories") and has(admin, "Add category"))

        # announcement: switch it on, then confirm visitors see it
        admin.fill("#announcement_text", "Phase 8 announcement: enrolments are open")
        admin.check("input[name=announcement_enabled]")
        admin.click("button:has-text('Save platform settings')")
        settle(admin, text="Platform settings are live")
        check("platform settings save", has(admin, "Platform settings are live"), body(admin)[:300])

        # visitors see it on the public site (reused later for the categories check)
        public_context = browser.new_context(viewport={"width": 1400, "height": 1100})
        public_page = public_context.new_page()
        public_page.goto(f"{BASE}/")
        public_page.wait_for_load_state("networkidle")
        check("announcement shows on the public site", has(public_page, "Phase 8 announcement"), public_page.url)

        # the dashboard widget mirrors it, with a one-click toggle
        admin.goto(f"{BASE}/admin")
        admin.wait_for_load_state("networkidle")
        dashboard_body = body(admin)
        check(
            "dashboard widget shows the announcement",
            "Announcement" in dashboard_body and "Phase 8 announcement" in dashboard_body,
            dashboard_body[:400],
        )
        admin.click("button:has-text('Turn off')")
        toggled_off = False
        for _ in range(40):
            if admin.locator("button:has-text('Turn on')").count() == 1:
                toggled_off = True
                break
            admin.wait_for_timeout(250)
        check("announcement can be turned off from the widget", toggled_off, body(admin)[:300])

        public_page.goto(f"{BASE}/")
        public_page.wait_for_load_state("networkidle")
        check(
            "announcement is gone from the public site",
            "Phase 8 announcement" not in body(public_page),
            public_page.url,
        )

        admin.click("button:has-text('Turn on')")
        toggled_on = False
        for _ in range(40):
            if admin.locator("button:has-text('Turn off')").count() == 1:
                toggled_on = True
                break
            admin.wait_for_timeout(250)
        check("announcement can be turned back on from the widget", toggled_on, body(admin)[:300])

        admin.goto(f"{BASE}/admin/settings")
        admin.wait_for_load_state("networkidle")

        # pause enrolments: the course page stops selling and the server refuses
        admin.check("input[name=enrolments_paused]")
        admin.click("button:has-text('Save platform settings')")
        settle(admin, text="New enrolments are paused")
        check("enrolments can be paused", has(admin, "New enrolments are paused"), body(admin)[:300])

        # reuse the signed-in learner browser for the paused check
        learner.goto(f"{BASE}/courses/sql-for-analysts")
        learner.wait_for_load_state("networkidle")
        paused_body = body(learner)
        check(
            "paused course page replaces the enrol button with a notice",
            "Enrol for free" not in paused_body and "paused" in paused_body.lower(),
            paused_body[:300],
        )

        if enrol_request.get("data"):
            paused_headers = {
                "Next-Action": enrol_request["next-action"],
                "content-type": enrol_request["content-type"],
            }
            paused_response = learner_context.request.post(
                enrol_request["url"],
                headers=paused_headers,
                data=enrol_request["data"],
            )
            paused_redirect = paused_response.headers.get("x-action-redirect", "")
            check(
                "replaying the enrol request while paused is refused",
                "paused=1" in paused_redirect or "paused=1" in paused_response.text(),
                f"{paused_response.status} {paused_redirect[:160]}",
            )
        else:
            check("replaying the enrol request while paused is refused", False, "no request captured")
        learner_context.close()

        # category CRUD
        admin.fill("input[name=name][placeholder='New category name']", "Testing & QA")
        admin.click("button:has-text('Add category')")
        created = False
        for _ in range(40):
            if admin.locator("input[aria-label='Testing & QA name']").count() == 1:
                created = True
                break
            admin.wait_for_timeout(250)
        check("category can be created", created, body(admin)[:300])

        categories_page = public_page
        categories_page.goto(f"{BASE}/categories")
        categories_page.wait_for_load_state("networkidle")
        check(
            "new category appears on the public categories page",
            has(categories_page, "Testing & QA"),
            categories_page.url,
        )
        public_context.close()

        admin.locator("input[aria-label='Testing & QA name']").fill("Testing and QA")
        admin.click("form:has(input[aria-label='Testing & QA name']) button:has-text('Save')")
        renamed = False
        for _ in range(40):
            if admin.locator("input[aria-label='Testing and QA name']").count() == 1:
                renamed = True
                break
            admin.wait_for_timeout(250)
        check("category can be renamed", renamed, body(admin)[:300])

        admin.click("li:has(input[aria-label='Testing and QA name']) button[aria-label='Delete category']")
        deleted = False
        for _ in range(40):
            if admin.locator("input[aria-label='Testing and QA name']").count() == 0:
                deleted = True
                break
            admin.wait_for_timeout(250)
        check("category can be deleted", deleted, body(admin)[:200])

        admin.goto(f"{BASE}/admin/audit?q=Testing")
        admin.wait_for_load_state("networkidle")
        check("audit records the category changes", has(admin, "Testing"), body(admin)[:300])

        # leave the platform open again for the rest of the suite
        admin.goto(f"{BASE}/admin/settings")
        admin.wait_for_load_state("networkidle")
        admin.uncheck("input[name=announcement_enabled]")
        admin.uncheck("input[name=enrolments_paused]")
        admin.click("button:has-text('Save platform settings')")
        settle(admin, text="Platform settings are live")
        check("platform controls can be restored", has(admin, "Platform settings are live"), body(admin)[:200])

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
        check("auditor sees no support access button", "Enter as learner" not in body(auditor))
        shot(auditor, "p8-05-auditor")

        auditor.goto(f"{BASE}/dashboard")
        auditor.wait_for_load_state("networkidle")
        check("auditor is redirected away from the learner dashboard", "/admin" in auditor.url, auditor.url)

        auditor.goto(f"{BASE}/admin/settings")
        auditor.wait_for_load_state("networkidle")
        check(
            "auditor can open their own account settings",
            has(auditor, "Change password") and has(auditor, "Devices signed in"),
            body(auditor)[:300],
        )
        check(
            "auditor sees platform controls read-only",
            has(auditor, "Platform controls")
            and auditor.locator("button:has-text('Save platform settings')").count() == 0,
            body(auditor)[:200],
        )

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

        # auditor replay of the enter-as-learner request: rejected, and no support cookie
        if support_request.get("data"):
            support_headers = {
                "Next-Action": support_request["next-action"],
                "content-type": support_request["content-type"],
            }
            support_response = auditor_context.request.post(
                support_request["url"],
                headers=support_headers,
                data=support_request["data"],
            )
            rejected = (
                support_response.status >= 400
                or "FORBIDDEN" in support_response.text()
                or "read-only" in support_response.text().lower()
            )
            check(
                "auditor replaying the enter-as-learner request is rejected",
                rejected,
                f"{support_response.status}: {support_response.text()[:160]}",
            )
            set_cookie = support_response.headers.get("set-cookie", "")
            check(
                "rejected support request sets no support cookie",
                "demolms_support" not in set_cookie,
                set_cookie[:160],
            )
        else:
            check("auditor replaying the enter-as-learner request is rejected", False, "no request captured")
            check("rejected support request sets no support cookie", False, "no request captured")

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
