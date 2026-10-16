# demolms

A **demo MVP of an e-learning platform** that runs 100% on localhost. Nothing talks to the network:
payments, email and certificates are all simulated on your machine so you can click through the whole
product - browse, buy, learn, take a quiz, submit an assignment, get graded, earn a certificate,
verify it by QR, revoke it, refund an order and read the audit log.

> Demo-grade, not production-grade: the security model, the payment provider and the mailer are
> deliberately local approximations. Every simplification is listed below.

---

## Start here

```bash
npm install          # installs everything; no accounts, keys or services needed
npm run dev          # creates + seeds the database on first run, then serves the app
```

Open <http://localhost:3000>. If you ever want a clean demo state again:

```bash
npm run seed         # drops and re-seeds the database, regenerates the demo assets
```

Other useful scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | production build (also makes sure the DB exists) |
| `npm run typecheck` | generates route types and runs `tsc --noEmit` |
| `npm run lint` | ESLint, zero warnings allowed |
| `npm run assets` | regenerates the sample lesson video + poster with ffmpeg |
| `npm run db:reset` | alias of `npm run seed` |
| `powershell -File scripts/fresh-clone-check.ps1` | proves a clean checkout boots, seeds itself and serves pages (see Verification) |

Requires **Node 20.9+** (developed on Node 22). `ffmpeg` is optional - it is only used once to render
the sample lesson clip, and the generated file is already committed.

---

## Demo accounts

Shown on the login screen as one-click quick-fill buttons (dev mode).

| Email | Password | Who it is |
| --- | --- | --- |
| `learner@demo.test` | `Demo1234!` | **Alex Morgan** - enrolled on 3 courses, partial progress, a completed course with a certificate, a refunded order |
| `admin@demo.test` | `Demo1234!` | **Imogen Clark** - full admin. Sign-in asks for a TOTP code |
| `auditor@demo.test` | `Demo1234!` | **Sam Okonkwo** - read-only admin. Also asks for a TOTP code |
| `ravi@demo.test` | `Demo1234!` | **Ravi Patel** - learner with work waiting to be graded |
| `grace@demo.test` | `Demo1234!` | **Grace Adeyemi** - learner with a submission in the queue |
| `newbie@demo.test` | `Demo1234!` | **Noor Shah** - unverified account, for the verify-email flow |

**Admin MFA without an authenticator app:** the MFA screen prints the current valid TOTP code in a
dev-mode box, and it refreshes every 30 seconds. In a real deployment that code would only ever exist
in the authenticator app.

---

## The 5-minute demo script

A click-through that shows the whole product. Everything below happens on your machine.

**1. Public site (30s)**
1. Home page - hero with live numbers, featured courses, categories, free-to-start section. Every course
   cover is drawn from that course's own data (a bar per lesson, the tallest in the accent); nothing is a
   stock image.
2. `/courses` - search `dashboard`, then filter *Free only* + *Under 1 hour*, then change *Sort by*.
   Note the URL carries every filter, so any view is shareable.
3. Open **TypeScript for Production Teams** - outcomes, curriculum with two **free preview** lessons
   (locked lessons are genuinely not links), instructor, sticky price card. `View source` and look for
   the JSON-LD `Course` block.
4. Tap the **theme control** in the header and switch to Dark - the choice survives a reload, and there
   is no white flash on load.

**2. Buy a course with a coupon (60s)**
4. On the course page click **Buy course** - you are signed in as the learner? If not, use the
   quick-fill button on `/login`.
5. On checkout, apply coupon **`WELCOME10`** - the summary recalculates to £71.10.
6. Click through to the **mockpay** page: it is styled like a separate hosted checkout. Leave
   *Simulate bad signature* ticked and pay with `4242 4242 4242 4242`.
7. Read the two panels: **HTTP 200** for the signed webhook (order paid, enrolment created) and
   **HTTP 400 - "Signature does not match the payload"** for the tampered one. That is the webhook
   verifying HMAC-SHA256 and refusing it.
8. Continue to the receipt: printable, with the coupon line and the card ending 4242. The receipt email
   is waiting in `/dev/outbox`.

**3. Learn (60s)**
9. `/learn/my-learning` → tabs, search and sort; open **TypeScript for Production Teams**.
10. The player resumes the video at **0:14** ("Resumed where you left off at 0:14") - the position is
    saved every few seconds and on pause. The header shows a progress ring, the sidebar shows
    per-section progress and highlights the lesson you are on, and the **Up next** strip points at the
    next lesson.
11. Toggle **Captions** on/off (the `.vtt` track is attached). Try the **Shortcuts** button and press
    `space`, `←`, `→`, `c`, `f`. Watch the **end-of-lesson overlay** appear with a countdown when
    autoplay is on.
12. Open the **My notes** tab and type - the status goes *Unsaved changes → Saving... → Saved*, and the
    note appears under "My notes across this course".
13. Download the lesson resource from the **Resources** tab - it is served through `/api/resources/[id]`,
    which checks your enrolment before streaming the file. Copy that URL into a private window: **401**.

**4. Quiz + assignment (60s)**
14. In the sidebar open **Checkpoint: types & narrowing** → *Try again*. Answer the five questions,
    including the written one, and submit. Correct answers are marked instantly; the written answer is
    queued and the page says *auto-marked 4 of 7 points so far*.
15. `/learn/grades` shows the attempt under **Awaiting review**.
16. Open the assignment lesson and submit text + a file.

**5. Admin (90s)**
17. Sign in as **admin@demo.test** (copy the code from the dev box).
18. **Grading queue**: mark the written quiz answer (points + feedback) and grade an assignment (score,
    feedback, or *request resubmission*). Each action emails the learner and writes an audit entry.
19. **Courses** → open a course: sections, lessons, up/down reordering, quiz builder, video/caption
    uploads, **Preview as learner**, Draft → Published → Archived.
20. **Coupons**: create one (percentage or fixed, optional single course, expiry, usage limit).
21. **Users**: search, change a role, disable an account (the change is audited and sessions end).
22. **Certificates**: revoke one with a reason.

**6. Certificates (30s)**
23. Back as the learner: `/learn/certificates` → **View certificate** (designed page with a QR),
    **Download PDF** (pdfkit, generated locally).
24. Scan or open `/verify/<certificateId>` **signed out** - it is a public page. Revoke that
    certificate as admin and reload: it now says *This certificate has been revoked* with the reason.

**7. Auditor + audit log (30s)**
25. Sign in as **auditor@demo.test**: the admin console shows a read-only banner, every write control
    is gone, and the API rejects writes from that account (the e2e suite proves this by replaying a
    real publish request from an admin session with an auditor session).
26. **Audit log** filters by area and search - every action above is in there, including the webhook
    and the certificate issuance.

**8. Refund (30s)**
27. As admin: **Orders** → open the order from step 6 → refund it (full or partial, revoke access).
    The learner gets an email and a notification, the course disappears from *My learning*, and the
    receipt shows the refund.

---

## What is mocked (and how faithfully)

| Real product | In this demo | Notes |
| --- | --- | --- |
| **Stripe** | A local **mockpay** page at `/mock-stripe/checkout` | Card form with the familiar test numbers (`4242…` succeeds, `4000 0000 0000 0002` declines, `5555…` Mastercard). Only the brand and last four digits are stored. |
| **Stripe webhooks** | `/api/webhooks/payments` | Real HMAC-SHA256 signature over the raw body with a timestamp tolerance, **verified before anything is written**, and **idempotent**: the event id is claimed first, so a duplicate delivery is acknowledged without side effects. The mockpay page shows the raw HTTP status + response for both the good and the tampered event. |
| **Transactional email** | An `emails` table + `/dev/outbox` | Every email the app would send is stored and viewable. Verification, password-reset, receipt, grading, certificate and refund emails all land there, and the links inside them **work**. |
| **Video hosting** | `public/uploads/videos/sample.mp4` | A 24-second clip generated locally with ffmpeg, with a burned-in timecode so *resume* is verifiable by eye, plus a WebVTT caption file. |
| **Object storage** | `public/uploads/**` | Admin uploads (video, captions, poster, thumbnail, resources) write here. Lesson resources and submission files are **never linked directly** - they are streamed through access-checked route handlers. |
| **CDN / external fonts** | `src/fonts/InstrumentSans-Variable.woff2` | Fetched once by `scripts/fetch-fonts.mjs` and self-hosted, so the app has no runtime network dependencies. |
| **PDF service** | `pdfkit` + `qrcode` | Certificate PDFs are generated in-process. |

---

## Design

The interface follows a written art direction - **Calm Minimal** - recorded in `docs/DESIGN.md`
together with the type scale, the palette, the motion rules and the cover-art system. In short:

- **One typeface**, Instrument Sans, self-hosted in `src/fonts/`, on a real type scale with a 68ch
  measure for body copy.
- **Near-monochrome.** A single cool-neutral ramp carries almost everything, and separation comes from
  hairlines rather than shadows - elevation is reserved for things that genuinely float (menus, sheets,
  toasts). The accent is a deep teal, used for meaning (links, focus, active, progress), never as
  decoration.
- **Primary actions are ink**, not colour: near-black on light, near-white on dark.
- **Generative cover art.** Every course draws its cover from its own data - a bar per lesson on a
  hairline baseline, the tallest in accent, the course initial ghosted behind it. Deterministic, inline
  SVG, theme-aware, no image files involved; an admin-uploaded thumbnail still wins over it.
- **Dark mode is designed, not inverted**, and remembers your choice - light / dark / system, applied
  before first paint so there is no flash. The toggle sits in the header on desktop and in the menu
  sheet on a phone.
- **Motion is subtle by design**: 130 / 190 / 260ms on one ease-out curve, nothing animates on load,
  and `prefers-reduced-motion: reduce` collapses all of it.

---

## Roles

| Role | Can do |
| --- | --- |
| **learner** | Learn, take quizzes, submit assignments, see grades, certificates, orders and notifications. Owners of a course never see its price again - just progress, "Up next" and Continue learning |
| **admin** | Everything, plus course building, grading, users, coupons, refunds, certificate revocation |
| **auditor** | Reads the entire admin console including the audit log. Every write control is hidden **and** every write endpoint rejects them server-side |

Writes are guarded in the data layer (`requireAdminWriter()`), not just in the UI. The e2e suite
proves it by capturing a real publish request from an admin session and replaying it byte-for-byte with
an auditor session: it is rejected with `FORBIDDEN: auditor accounts are read-only`, and the course
status stays unchanged.

---

## Security notes

- Passwords: **bcrypt** (cost 10). Login errors are generic, and there is no user enumeration on
  login or password reset (registration necessarily reveals a duplicate address).
- Sessions: 32-byte random tokens stored **hashed** in SQLite, delivered as an **HMAC-signed httpOnly**
  cookie. "Sign out of all devices" deletes every session row, as does a password reset and any
  role change made by an admin.
- Admin accounts: optional **TOTP** MFA (otplib). Seeded admins have it enabled; the current code is
  printed on screen in dev mode only.
- Rate limiting: DB-backed, keyed by IP and email for login, MFA, registration and reset. Login is
  blocked after 6 failures in 10 minutes.
- Route protection: `src/proxy.ts` (Next 16's renamed middleware) does the optimistic signed-cookie
  check; every page and server action re-checks the session and role against the database.
- Uploads: extension allow-lists per purpose, size caps, sanitised + uniquified filenames.
- Downloads: lesson resources require an active enrolment; submission attachments are visible only to
  their owner and staff.

---

## Decisions and simplifications

Everything here was chosen for demo clarity; each item is somewhere a real build would differ.

1. **Money** is stored as integer pence and formatted with `Intl.NumberFormat('en-GB', …)`. There is no
   tax, invoicing or multi-currency support; refunds are recorded locally rather than sent to a
   provider.
2. **One course per checkout.** No cart, no bundles, no subscriptions - the brief asked for a
   cart-less single checkout.
3. **Coupons** support percentage or fixed amounts, optional single-course scope, expiry and a usage
   limit. Redemptions are counted when the webhook confirms payment, not when checkout starts.
4. **Course completion** = every lesson complete, plus quiz pass marks when the course requires them,
   plus graded assignments when the course requires them. Certificates are issued exactly once and are
   idempotent.
5. **Quizzes** mark single/multiple/true-false/short answers instantly (case-insensitive,
   whitespace-normalised); essays always need a human. Multiple-choice is all-or-nothing.
6. **Attempts** are limited per quiz; the passing attempt marks the lesson complete. A learner can
   reopen a lesson marked complete by mistake.
7. **Seeded content** is authored for this demo. Where a course claims a duration, it is the sum of its
   lesson durations - no invented numbers are displayed anywhere, and the certificates show only facts
   the database holds.
8. **PDF downloads** are limited to the certificate owner and staff; the public surface is the
   verification page.
9. **Uploads are never garbage-collected.** Replacing an uploaded thumbnail leaves the old file on
    disk, because two courses could share it and deleting it would break the other row. A real product
    would reference-count. Course covers that nobody uploaded are **not files at all** - they are drawn
    from the course's own data, so there is nothing to clean up.
10. **Markdown is sanitised with a small allow-list** (script/style/iframe removal, `on*` handlers and
    `javascript:` stripped). Content is admin-authored, so a full HTML sanitiser was not worth the
    dependency.
11. **Session cookie is `secure: false`** because the demo runs over `http://localhost`. A real
    deployment sets `secure: true` and a real domain.
12. **Demo secrets have working defaults** (`SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `APP_URL` in
    `src/lib/env.ts`) so `npm install && npm run dev` needs no setup. Override them with `.env.local`.
13. **`cacheComponents` is off.** Next 16 defaults to Cache Components and partial prefetching, which
    prerender pages at build time; this app is DB-backed and must always render fresh data. Reasoning is
    written up in `docs/next16-notes.md`, along with the other Next 16 changes this build relies on
    (`proxy.ts` instead of middleware, async `cookies()`, `PageProps<'/route'>`, `serverExternalPackages`).
14. **Seed dates are relative to the moment you seed**, so the dashboard's 30-day chart and "new users"
    KPI always look alive.

---

## Project structure

```
src/
  app/
    (public)/          # marketing + catalogue + checkout + auth + /dev/outbox + /verify
    (learner)/         # dashboard, my-learning, player, quiz, assignment, grades,
                       # certificates, orders, notifications, profile
    (admin)/           # dashboard, courses (builder), grading, users, orders,
                       # coupons, certificates, audit
    api/               # webhooks/payments, progress, notes, resources, submissions, certificates
    mock-stripe/       # the hosted-payment look-alike (its own isolated chrome)
  components/          # ui primitives, layout chrome, course, learner, admin, notifications
  db/                  # schema.sql, seed.ts (content + data), ensure.ts
  lib/                 # auth, db, payments, mailer, certificates, uploads, quiz, progress,
                       # rate-limit, audit, notify, markdown, format, env, actions/, queries/
  fonts/               # self-hosted Instrument Sans
docs/DESIGN.md         # art direction: type, colour, motion, the cover-art system
docs/host-research.md  # hosting options with verified 2026 prices
docs/next16-notes.md   # what changed in Next 16 and what this app relies on
DEPLOY.md              # what a disk-backed host needs, and what a public URL exposes
scripts/               # asset + font generators, e2e test suites
public/uploads/        # generated demo assets + runtime uploads
data/demolms.db        # SQLite database (git-ignored, recreated by the seed)
```

---

## Verification

The product was built in ten phases; each phase ended with `npm run build` clean plus a browser-driven
end-to-end suite. The suites live in `scripts/e2e/` and drive a real Chromium against the running app:

| Suite | Covers |
| --- | --- |
| `phase1_auth.py` | register → verify → login, MFA, wrong password, rate limiting, reset from the outbox, 404 |
| `phase2_catalog.py` | search, every filter, sorting, pagination, course detail, previews, free enrolment, sitemap/robots/JSON-LD |
| `phase3_builder.py` | creating a course end to end, uploads, quiz builder (all five question types), publish, staff preview, auditor read-only UI |
| `phase4_payments.py` | coupons (valid/expired/per-course/unknown), declines, signed webhook, **forged signature and stale timestamp rejected**, **idempotency**, receipts, refunds |
| `phase5_player.py` | resume position (persisted + restored), captions toggle, note autosave, access-checked downloads, non-enrolled + refunded access refused |
| `phase6_assessment.py` | quiz attempt with instant marking, essay pending review, assignment submission, grading both, resubmission requests, grades pages |
| `phase7_certificates.py` | completing a whole course → certificate issued, PDF download, public QR verification, revocation and its public effect |
| `phase8_admin.py` | KPIs + chart, users (role/disable), coupons, audit log filters, auditor read-only on every page **and the replayed-request rejection** |
| `phase9_notifications.py` | bell + unread count, mark read/all read, notifications page, every email type in the outbox, email preferences actually suppressing mail |
| `phase10_responsive.py` | no horizontal overflow at 390px and 820px across 23 key pages |
| `phase10_walkthrough.py` | the whole journey in one session: register → verify → browse → buy with a coupon → learn/resume → quiz → assignment → grade → certificate → QR verify → revoke → refund → auditor read-only → audit trail |
| `phase10_print.py` | receipts and certificates print cleanly (chrome hidden, content kept) |
| `phase10_learner_ui.py` | the ownership rules (an owned course shows progress and no price anywhere, the catalogue marks owned courses, a returning learner gets a personalised hero) and the learner surfaces (dashboard, my learning tabs/search/sort, player up-next + shortcuts, grades, certificates, profile, mobile tab bar) |
| `phase10e_design.py` | the design system: the self-hosted face actually loads, tokens defined, the theme choice persists and is applied before paint, dark mode is designed (surfaces raised, hairlines lighter), covers are generative and per-course, no overflow at 390/768/1280 in **both** themes, reduced motion collapses the scale |

`scripts/e2e/run_all.py` runs all of them against a freshly seeded database and prints one summary -
598 checks across fourteen suites at the time of writing:

Run one with the dev server up, for example:

```bash
# PowerShell, using the Python 3.13 install that has Playwright
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/phase4_payments.py

# everything at once (seeds a clean database between suites):
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts/e2e/run_all.py
```

The suites screenshot what they see into `%TEMP%\opencode\lms-shots`, which is handy when reviewing a
change.
