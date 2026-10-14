r"""
Phase 7 verification: certificate issuance on completion, the certificate page,
PDF download, QR verification and revocation.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase7_certificates.py
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


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 1100})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # ------------------------------------------------- seeded certificate list
        login(page, "learner@demo.test")
        page.goto(f"{BASE}/learn/certificates")
        page.wait_for_load_state("networkidle")
        check("certificate list shows the seeded certificate", has(page, "JavaScript Fundamentals"))
        check("certificate is marked valid", has(page, "Valid"))
        certificate_id = re.search(r"(DEMO-2026-[A-Z0-9]{6})", body(page))
        check("certificate has a public id", certificate_id is not None)
        cert_id = certificate_id.group(1) if certificate_id else "DEMO-2026-UNKNOWN"
        check("certificate list offers a PDF download", page.locator("a[href*='/api/certificates/']").count() >= 1)
        shot(page, "p7-01-certificate-list")

        # ------------------------------------------------------- certificate page
        page.click("a:has-text('View certificate')")
        page.wait_for_url("**/learn/certificates/DEMO-2026-*", timeout=20000)
        page.wait_for_load_state("networkidle")
        cert_body = body(page)
        check("certificate page names the learner", "Alex Morgan" in cert_body)
        check("certificate page names the course", "JavaScript Fundamentals" in cert_body, cert_body[:300])
        check("certificate page shows the instructor", "Tom Whitfield" in cert_body)
        check("certificate page shows the certificate id", cert_id in cert_body)
        check("certificate page renders the QR code", page.locator("img[alt*='Verification QR']").count() == 1)
        check("certificate page has a print button", page.locator("button:has-text('Print')").count() == 1)
        shot(page, "p7-02-certificate")

        # ----------------------------------------------------------- PDF download
        pdf_response = context.request.get(f"{BASE}/api/certificates/{cert_id}/pdf")
        check("certificate PDF downloads", pdf_response.status == 200, str(pdf_response.status))
        pdf_bytes = pdf_response.body()
        check("PDF is a real PDF file", pdf_bytes[:4] == b"%PDF", str(pdf_bytes[:8]))
        check("PDF has real content (vector text + QR image)", len(pdf_bytes) > 5_000, f"{len(pdf_bytes)} bytes")
        check(
            "PDF is served as an attachment",
            "attachment" in (pdf_response.headers.get("content-disposition") or "").lower(),
        )

        # ------------------------------------------------- public verification page
        anonymous = browser.new_context()
        anon = anonymous.new_page()
        anon.goto(f"{BASE}/verify/{cert_id}")
        anon.wait_for_load_state("networkidle")
        anon_body = anon.inner_text("body")
        check("verification page is public", "This certificate is valid" in anon_body, anon_body[:200])
        check("verification page shows the learner", "Alex Morgan" in anon_body)
        check("verification page shows the course", "JavaScript Fundamentals" in anon_body)
        anon.screenshot(path=os.path.join(SHOTS, "p7-03-verify-valid.png"))

        anon.goto(f"{BASE}/verify/DEMO-2026-NOPE99")
        anon.wait_for_load_state("networkidle")
        check("unknown certificate id shows not found", "No certificate found" in anon.inner_text("body"))

        anonymous.close()

        # ------------------------------------ automatic issuance on course completion
        # Alex has lessons 1-2 done and lesson 3 in progress on the TypeScript course;
        # his quiz and assignment there are already graded and passed.
        page.goto(f"{BASE}/learn/courses/typescript-for-production-teams")
        page.wait_for_load_state("networkidle")
        check("course starts part-finished", has(page, "2 of 9 lessons complete"), body(page)[:300])

        completed = 0
        for _ in range(14):
            button = page.locator("button:has-text('Complete and continue')")
            if button.count() == 0:
                button = page.locator("button:has-text('Finish course')")
            if button.count() == 0:
                break
            button.first.click()
            page.wait_for_timeout(1500)
            completed += 1
            if "finished" in page.url or has(page, "You finished"):
                break
        check("lessons can be completed one after another", completed >= 6, f"completed={completed}")
        page.wait_for_load_state("networkidle")
        finished_body = body(page)
        check(
            "course completion is recognised",
            "You finished" in finished_body or "Course complete" in finished_body,
            finished_body[:400],
        )
        check(
            "certificate is offered on completion",
            has(page, "View my certificate") or has(page, "certificate is ready"),
            finished_body[:400],
        )
        shot(page, "p7-04-course-finished")

        page.goto(f"{BASE}/learn/certificates")
        page.wait_for_load_state("networkidle")
        list_body = body(page)
        check("new certificate appears in the list", "TypeScript for Production Teams" in list_body, list_body[:400])
        ts_cert_match = re.findall(r"(DEMO-2026-[A-Z0-9]{6})", list_body)
        ts_cert = next((value for value in ts_cert_match if value != cert_id), None)
        check("new certificate has its own id", ts_cert is not None, str(ts_cert_match))

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("certificate email is in the outbox", has(page, "Your certificate for"), body(page)[:700])

        # ------------------------------------------------------------------ revocation
        context.clear_cookies()
        login(page, "admin@demo.test")
        page.goto(f"{BASE}/admin/certificates")
        page.wait_for_load_state("networkidle")
        check("admin certificate list shows both certificates", has(page, "TypeScript for Production Teams"), body(page)[:400])
        check("admin list shows the revoke control", page.locator("button:has-text('Revoke')").count() >= 1)
        shot(page, "p7-05-admin-certificates")

        if ts_cert:
            row = page.locator(f"li:has-text('{ts_cert}')")
            row.locator("input[name=reason]").fill("Issued in error - assessment retaken under supervision")
            row.locator("button:has-text('Revoke')").click()
            settle(page, text="Revoked", timeout=25000)
            check("revocation succeeds", has(page, "Revoked"), body(page)[:400])
            page.reload()
            page.wait_for_load_state("networkidle")
            check("certificate now shows as revoked in admin", has(page, "assessment retaken"), body(page)[:600])

        context.clear_cookies()
        anonymous = browser.new_context()
        anon = anonymous.new_page()
        if ts_cert:
            anon.goto(f"{BASE}/verify/{ts_cert}")
            anon.wait_for_load_state("networkidle")
            revoked_body = anon.inner_text("body")
            check("verification page shows revoked", "been revoked" in revoked_body, revoked_body[:200])
            check("revocation reason is public", "assessment retaken" in revoked_body, revoked_body[:300])
            anon.screenshot(path=os.path.join(SHOTS, "p7-06-verify-revoked.png"))

            anon.goto(f"{BASE}/verify/{cert_id}")
            anon.wait_for_load_state("networkidle")
            check("the other certificate is still valid", "This certificate is valid" in anon.inner_text("body"))
        anonymous.close()

        # PDF for a revoked certificate still downloads, with the REVOKED mark
        admin_context = browser.new_context()
        admin_page = admin_context.new_page()
        login(admin_page, "admin@demo.test")
        if ts_cert:
            revoked_pdf = admin_context.request.get(f"{BASE}/api/certificates/{ts_cert}/pdf")
            check("revoked certificate PDF still downloads for staff", revoked_pdf.status == 200, str(revoked_pdf.status))
            check("revoked PDF is a real PDF", revoked_pdf.body()[:4] == b"%PDF")
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
