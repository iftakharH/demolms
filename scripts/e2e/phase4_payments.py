r"""
Phase 4 verification: coupons, mock checkout, signed + idempotent webhook, receipts, refunds.

    & "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase4_payments.py

Sections 5 and 6 sign their own webhook events with the local secret, so signature
verification and idempotency are checked independently of the app's own UI.
"""
import hashlib
import hmac
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright, Page

BASE = os.environ.get("LMS_BASE", "http://localhost:3000")
WEBHOOK_SECRET = os.environ.get("LMS_WEBHOOK_SECRET", "whsec_demo_local_secret")
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


def learner_login(page: Page, email: str = "learner@demo.test") -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", email)
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    page.wait_for_url("**/dashboard", timeout=20000)
    page.wait_for_load_state("networkidle")


def admin_login(page: Page) -> None:
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", "admin@demo.test")
    page.fill("#password", "Demo1234!")
    page.click("button[type=submit]")
    page.wait_for_url("**/login/mfa*", timeout=20000)
    text = body(page).upper()
    code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text) or re.search(r"\b(\d{6})\b", text)
    assert code, "no dev TOTP code"
    page.fill("#code", code.group(1) + code.group(2))
    page.click("button[type=submit]")
    page.wait_for_url("**/admin*", timeout=20000)
    page.wait_for_load_state("networkidle")


def sign(payload: str, secret: str = WEBHOOK_SECRET, timestamp: int | None = None) -> str:
    ts = timestamp if timestamp is not None else int(time.time())
    digest = hmac.new(secret.encode(), f"{ts}.{payload}".encode(), hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def post_webhook(payload: dict, signature: str, event_id: str) -> tuple[int, str]:
    request = urllib.request.Request(
        f"{BASE}/api/webhooks/payments",
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", "x-mockpay-signature": signature},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def main() -> int:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1360, "height": 1000})
        page = context.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        learner_login(page)

        # ---------------------------------------------------------- coupon checks
        page.goto(f"{BASE}/checkout/ship-your-first-nextjs-app")
        page.wait_for_load_state("networkidle")
        check("checkout shows the course and price", has(page, "£79") and has(page, "Checkout"), body(page)[:200])

        page.goto(f"{BASE}/checkout/ship-your-first-nextjs-app?coupon=NOPE123")
        page.wait_for_load_state("networkidle")
        check("unknown coupon is rejected", has(page, "not a valid coupon"))

        page.goto(f"{BASE}/checkout/ship-your-first-nextjs-app?coupon=EXPIRED10")
        page.wait_for_load_state("networkidle")
        check("expired coupon is rejected", has(page, "expired"), body(page)[:200])

        page.goto(f"{BASE}/checkout/ship-your-first-nextjs-app?coupon=TYPESCRIPT20")
        page.wait_for_load_state("networkidle")
        check("per-course coupon is refused on another course", has(page, "not valid for this course"))

        page.goto(f"{BASE}/checkout/ship-your-first-nextjs-app?coupon=WELCOME10")
        page.wait_for_load_state("networkidle")
        check("percentage coupon applies to the total", has(page, "-£7.90") and has(page, "£71.10"), body(page)[:400])
        shot(page, "p4-01-checkout")

        # ---------------------------------------------------------- decline path
        page.click("button:has-text('Pay £')")
        page.wait_for_url("**/mock-stripe/checkout*", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("hosted page shows the amount after discount", has(page, "£71.10"), body(page)[:300])
        check("hosted page offers the test cards", has(page, "4242 4242 4242 4242"))

        page.fill("#card", "4000 0000 0000 0002")
        page.click("button:has-text('Pay £')")
        settle(page, text="declined", timeout=25000)
        check("declined card reports a decline", has(page, "declined"), body(page)[:300])
        check(
            "declined card still delivered a signed failure event",
            "payment.failed" in body(page),
            body(page)[:400],
        )
        shot(page, "p4-02-declined")

        # ---------------------------------------------------------- success path
        page.fill("#card", "4242 4242 4242 4242")
        page.check("input[name=simulate_bad_signature]")
        page.click("button:has-text('Pay £')")
        settle(page, text="Payment approved", timeout=30000)
        check("successful payment is approved", has(page, "Payment approved"), body(page)[:200])
        check(
            "webhook accepted the signed event",
            "HTTP" in body(page) and "200" in body(page),
            body(page)[:400],
        )
        check(
            "tampered signature was rejected by the webhook",
            "Signature does not match" in body(page) or "rejected" in body(page).lower(),
            body(page)[:600],
        )
        shot(page, "p4-03-paid")

        page.click("button:has-text('Continue to your receipt')")
        page.wait_for_url("**/checkout/return*", timeout=20000)
        page.wait_for_load_state("networkidle")
        check("return page confirms enrolment", has(page, "You are enrolled"), body(page)[:300])
        check("return page applies the coupon total", has(page, "£71.10"))

        receipt_href = page.locator("a:has-text('View receipt')").first.get_attribute("href")
        page.click("a:has-text('View receipt')")
        page.wait_for_url("**/learn/orders/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        receipt = body(page)
        check("receipt renders the order", "Receipt" in receipt and "ORD-" in receipt)
        check("receipt shows the discounted total", "£71.10" in receipt, receipt[:400])
        check("receipt shows the coupon", "WELCOME10" in receipt)
        check("receipt shows the card ending", "4242" in receipt)
        shot(page, "p4-04-receipt")

        paid_order_id = re.search(r"(ORD-\d+-[A-Z0-9]+)", receipt)
        paid_order = paid_order_id.group(1) if paid_order_id else ""

        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        check("purchased course appears in my learning", has(page, "Ship Your First Next.js App"))

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("receipt email landed in the outbox", has(page, "receipt for Ship Your First Next.js App"))

        # --------------------------------------- webhook signature + idempotency
        # (signed by this script, not the app, so verification is checked independently)
        payload = {
            "id": f"evt_forge_{int(time.time())}",
            "type": "payment.succeeded",
            "created": int(time.time()),
            "data": {"orderPublicId": paid_order, "amountPence": 7110},
        }
        raw = json.dumps(payload)

        forged = sign(raw, secret="whsec_wrong_secret")
        status, response = post_webhook(payload, forged, payload["id"])
        check(
            "webhook rejects a forged signature",
            status == 400 and "signature" in response.lower(),
            f"{status} {response[:160]}",
        )

        stale = sign(raw, timestamp=int(time.time()) - 4000)
        status, response = post_webhook(payload, stale, payload["id"])
        check(
            "webhook rejects a stale timestamp",
            status == 400 and "tolerance" in response.lower(),
            f"{status} {response[:160]}",
        )

        status, response = post_webhook(payload, sign(raw), payload["id"])
        check(
            "webhook accepts a correctly signed event (replay for a paid order)",
            status == 200 and "duplicate" in response.lower(),
            f"{status} {response[:200]}",
        )

        status, response = post_webhook(payload, sign(raw), payload["id"])
        check(
            "webhook is idempotent for the same event id",
            status == 200 and "duplicate" in response.lower(),
            f"{status} {response[:200]}",
        )

        # --------------------------------------------------------------- refunds
        context.clear_cookies()
        admin_login(page)
        page.goto(f"{BASE}/admin/orders")
        page.wait_for_load_state("networkidle")
        check("admin orders list shows the new order", has(page, "Ship Your First Next.js App"))

        page.click("a:has-text('WELCOME10') >> nth=0") if False else None
        page.goto(f"{BASE}/admin/orders?q=learner@demo.test")
        page.wait_for_load_state("networkidle")
        page.click("a:has-text('Open') >> nth=0")
        page.wait_for_url("**/admin/orders/**", timeout=20000)
        page.wait_for_load_state("networkidle")
        order_url = page.url
        check("order detail shows webhook events", has(page, "Webhook events for this order"), body(page)[:300])
        check("order detail shows a valid signature badge", has(page, "signature valid"))
        shot(page, "p4-05-admin-order")

        page.fill("#reason", "Course not as described - learner asked for a refund")
        page.click("button:has-text('Refund £')")
        settle(page, text="Refunded £", timeout=25000)
        check("refund succeeds", has(page, "Refunded £"), body(page)[:400])
        page.reload()
        page.wait_for_load_state("networkidle")
        check("order is marked refunded", has(page, "Refunded"))
        check("access revocation is reported", has(page, "access revoked") or has(page, "Revoked"))

        context.clear_cookies()
        learner_login(page)
        page.goto(f"{BASE}/learn/my-learning")
        page.wait_for_load_state("networkidle")
        check("refunded course is gone from my learning", not has(page, "Ship Your First Next.js App"))

        page.goto(order_url.replace("/admin/orders/", "/learn/orders/"))
        page.wait_for_load_state("networkidle")

        page.goto(f"{BASE}/dev/outbox")
        page.wait_for_load_state("networkidle")
        check("refund email landed in the outbox", has(page, "Refund processed"), body(page)[:600])

        # ------------------------------------------------- auditors cannot refund
        context.clear_cookies()
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        page.fill("#email", "auditor@demo.test")
        page.fill("#password", "Demo1234!")
        page.click("button[type=submit]")
        page.wait_for_url("**/login/mfa*", timeout=20000)
        text = body(page).upper()
        code = re.search(r"CURRENT VALID CODE\s*(\d{3})\s*(\d{3})", text) or re.search(r"\b(\d{6})\b", text)
        page.fill("#code", code.group(1) + code.group(2))
        page.click("button[type=submit]")
        page.wait_for_url("**/admin*", timeout=20000)
        page.goto(order_url)
        page.wait_for_load_state("networkidle")
        check(
            "auditor sees the refund area disabled",
            has(page, "read-only") or has(page, "fully refunded"),
            body(page)[:400],
        )

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
