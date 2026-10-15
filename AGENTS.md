# demolms - AGENTS.md

Localhost-only demo MVP of an e-learning platform (LMS). Its purpose is to let the user **see and
click through** how the product looks and works. Demo-grade, but it must feel real.

- Project root: `G:\codeFiles\codes\demolms` (one project inside the `codes` workspace repo)
- Run: `npm install && npm run dev` - seed runs automatically on first start
- Reset demo data: `npm run seed`
- UK-only, English-only, currency GBP (GBP symbol)
- No external services, accounts, API keys, Docker or cloud tooling. Fully offline after `npm install`.

## Phase plan

The user gave one overall go-ahead up front, then asked to be left alone: "do NOT stop to ask me
questions", and asked for a single permission check *before* starting. Per-phase gates below are
self-verified (build + click-through) and reported, not blocking. Ambiguities get the simplest
reasonable option, recorded in `README.md` under **Decisions and simplifications**.

| # | Phase | Deliverables | Self-gate |
| --- | --- | --- | --- |
| 1 | Foundation | Next.js (App Router) + TS + Tailwind scaffold, design system, SQLite schema + seed, auth (register, verify, login, reset, sessions, roles, admin MFA), app shells for `(public)/(learner)/(admin)` | `npm run build` passes; register/verify/login/MFA work by hand |
| 2 | Public catalog | Home (hero, featured, categories), catalog with search/filters/sort/pagination, course detail + curriculum + related, SEO (metadata, OG, sitemap, robots, JSON-LD) | build passes; browse/search/filter click-through |
| 3 | Admin course builder | Course/section/lesson CRUD, up/down reordering, quiz builder (5 question types), uploads (video, VTT, thumbnail, resources), Draft/Published/Archived, preview-as-learner | build passes; create a course end-to-end in UI |
| 4 | Commerce | Free + paid enrolment, coupons (WELCOME10, FREE100), mock Stripe checkout, signed + idempotent webhook, orders, printable receipts, receipt email, refunds | build passes; bad-signature rejection + double-delivery idempotency demonstrated |
| 5 | Learner area | Dashboard, My Learning, course player (resume position, captions toggle, mark complete, notes, resources), access-checked downloads | build passes; resume + notes + download enforced for enrolled users only |
| 6 | Assessment | Quiz engine (single/multi/true-false/short answer auto-marked, essay manual), attempts + pass mark, assignments with text/file submission, grading queue, grades + feedback pages, notifications on grading | build passes; take quiz, submit assignment, grade it as admin |
| 7 | Certificates | Auto-issue on completion, certificate page, PDF download, QR code, public `/verify/[certificateId]`, admin revoke | build passes; issue, scan-verify, revoke, re-verify as revoked |
| 8 | Admin ops | Dashboard KPIs + 30-day chart, users (search/filter/role/disable), orders, coupons admin, certificates list, audit log, auditor read-only enforcement | build passes; auditor sees all pages with writes hidden *and* rejected server-side |
| 9 | Notifications + outbox | Bell + unread count, dropdown, mark read / all read, notifications page, email preference toggles, `/dev/outbox` viewer with working links | build passes; every email type lands in outbox with working links |
| 10 | Polish + verification | Responsive pass, empty/loading/error states, 404, full end-to-end click-through of every flow in the brief, bug fixes, final README | all flows in the brief exercised and reported |

## Original spec (saved verbatim, 2026-10-13)

> You are building a DEMO MVP of an e-learning platform (LMS) that runs 100% on localhost. Its purpose is to
> let me SEE and CLICK through how the product looks and works. Build fast, make decisions yourself, and do
> NOT stop to ask me questions. If something is ambiguous, pick the simplest option and note it in README.md.

### Hard constraints

- No external services, accounts, API keys, Docker, or cloud tools. Everything works offline after
  `npm install`.
- Stack: Next.js (App Router) + TypeScript + Tailwind CSS + SQLite (better-sqlite3, or Prisma with
  SQLite). Server Actions or route handlers for the backend. Auth via own implementation (bcrypt
  password hashing, signed httpOnly session cookie, sessions stored in DB).
- Run with: `npm install && npm run dev` (seed runs automatically on first start, plus `npm run seed` to
  reset).
- UK-only, English-only, currency GBP (GBP symbol).
- Design: minimal, modern, clean, responsive (mobile + desktop). Consistent design system (one accent
  colour, rounded cards, good spacing, Inter font, empty states, loading states, toasts). Must look
  professional, not like a template.
- Folder structure must be clean and professional: `/src/app` (routes grouped as `(public)`, `(learner)`,
  `(admin)`), `/src/components`, `/src/lib` (auth, db, payments, mailer, certificates), `/src/db` (schema,
  seed), `/public/uploads`. Add a short README.md with demo accounts and what is mocked.

### Mocks (simulate locally, make them feel real)

- **Stripe**: a fake hosted checkout page at `/mock-stripe/checkout` (card form, test card
  `4242 4242 4242 4242` succeeds, `4000 0000 0000 0002` declines). On success it calls the app's webhook
  endpoint `/api/webhooks/payments` with an HMAC-SHA256 signature using a local secret; the webhook
  handler VERIFIES the signature, is idempotent (same event id twice = processed once), and only then
  marks the order paid and creates the enrolment. Include a "Simulate bad signature" dev button that
  shows the webhook rejecting it.
- **Email**: no real sending. Write every email to an `emails` table and show them at `/dev/outbox`
  (with a link to open each one). Verification, reset, receipts, certificates, grading and refund emails
  all go here. Verification and reset links must work from the outbox.
- **Video**: HTML5 `<video>` with a small sample video (tiny mp4 in `/public/uploads`) plus `.vtt`
  caption files. Admin can upload mp4 + vtt files, stored in `/public/uploads`.
- **Downloads**: lesson resources (PDF/zip) uploaded by admin and downloadable by enrolled learners only
  (access-checked route, not a public URL).

### Features

1. **Public site (no login)**: home with hero, featured courses, categories; catalog with keyword search
   (title/description/tags) and filters (category, level, price free/paid, duration), sort and
   pagination, only Published visible; course detail page (overview, curriculum with free-preview
   lessons, instructor, what you'll learn, price, enrol/buy, related courses); SEO: per-page title +
   meta description, Open Graph, clean slugs, sitemap.xml, robots.txt, JSON-LD Course structured data.
2. **Accounts and security**: register, email verification (via outbox), login, forgot/reset password
   (via outbox), logout, "log out of all devices", profile (name, avatar optional, change password).
   Roles: learner, admin, auditor (read-only admin). Route protection by role everywhere (middleware +
   server-side checks). Admin MFA: TOTP (otplib or own), QR during setup, current valid code shown in dev
   mode on screen for demo without an authenticator app. Basic rate limiting on login; generic error
   messages (no user enumeration).
3. **Learner area**: dashboard (continue-learning card, progress summary, recent notifications,
   upcoming/pending assignments); My Learning with progress bars; course player with sidebar curriculum
   and completion ticks, video player, captions toggle (VTT), mark complete, next/previous lesson, RESUME
   (save video position every few seconds and restore), per-lesson notes (autosave, list), downloadable
   resources; lesson types: video, text/article, quiz, assignment.
4. **Enrolment and payments**: free course one-click enrol; paid course cart-less single checkout, coupon
   code field (percentage or fixed, expiry date, usage limit, per-course or global), then mock Stripe,
   then webhook, then order paid, then enrolment, then receipt page (printable) + receipt email. Orders
   page for learner. Refunds: admin refunds order (full or partial), marks refunded, revokes enrolment
   access (configurable), sends email, writes audit log. Seed coupons: WELCOME10 (10%), FREE100 (100%
   off).
5. **Quizzes, assignments, grading**: question types single choice, multiple choice, true/false, short
   answer (auto-marked vs accepted answers, case-insensitive), essay (manually marked by admin). Pass
   mark, attempts limit, instant score for auto-marked, "pending review" when essays exist, show correct
   answers after submit (configurable). Assignments: learner submits text and/or file upload; admin
   submissions queue with score + written feedback, optional resubmission request. Learners see grades
   and feedback on a Grades/Feedback page; notifications fire when graded.
6. **Certificates**: auto-issue on completion (all lessons done + quiz pass marks met + assignments
   graded if required). Certificate page, unique certificate ID, PDF download (@react-pdf/renderer or
   pdfkit) plus QR code. Public verification `/verify/[certificateId]` showing valid / revoked / not
   found, learner name, course, date (reached by scanning the QR). Admin can revoke (with reason); the
   verification page then shows "Revoked".
7. **Admin panel** (`/admin`): dashboard KPI cards (revenue, orders, new users, enrolments, completion
   rate) + simple 30-day chart; course builder (course fields, sections/lessons with reorder, all lesson
   types, uploads, quiz builder UI, Draft/Published/Archived, preview-as-learner); users (list, search,
   role filter, enrolments/orders per user, disable/enable, change role); orders (list/filter/search,
   detail, refund); coupons management; grading queue; certificates list with revoke; audit log (who did
   what when, for every admin action, filterable, read-only); auditor role sees everything but ALL write
   buttons hidden/disabled and writes rejected server-side.
8. **Notifications**: in-app bell with unread count, dropdown, mark read / mark all read, full
   notifications page; email notifications to the outbox (welcome/verify, receipt, assignment graded,
   quiz-needs-review result, certificate issued, refund processed); learner toggles email preferences on
   profile.

### Seed data

- Accounts (also in README and shown on the login page as "Demo accounts" quick-fill buttons in dev
  mode): `learner@demo.test` / `Demo1234!`, `admin@demo.test` / `Demo1234!` (TOTP shown on screen),
  `auditor@demo.test` / `Demo1234!`.
- 8 realistic courses across 4 categories (mix of free/paid, levels), at least 2 fully built with
  sections, video lessons, text lessons, a quiz covering all 5 question types, and an assignment. 1
  Draft and 1 Archived course for admin demo.
- Learner already enrolled in 2 courses with partial progress, 1 completed course with an issued
  certificate, a few past orders, notifications, and a few audit log entries. Some sample submissions
  waiting for admin grading.

### Build order

1. Project setup, DB schema, seed script, design system, layout, auth + roles + MFA.
2. Public catalog, search/filters, course pages, SEO.
3. Admin course builder + uploads (so content can be created).
4. Enrolment, coupons, mock Stripe + verified webhook, orders, receipts, refunds.
5. Learner dashboard, My Learning, player (resume, captions, notes, downloads).
6. Quizzes, assignments, grading, feedback.
7. Certificates, QR verification, revoke.
8. Admin dashboard, users, orders, audit log, auditor read-only.
9. Notifications + outbox.
10. Polish: responsive checks, empty/loading/error states, 404 page, fix every bug found by clicking
    through the full flows, update README.

### Quality bar

- After each step run `npm run build` (or type-check) and fix errors before continuing.
- At the end, walk through these flows and fix anything broken: register, verify, login; browse, search,
  filter; buy a paid course with a coupon; learn, resume a video, take a quiz; submit an assignment;
  admin grades it; certificate issued, QR verify page works, revoke it; admin refunds an order; auditor
  cannot modify anything; audit log shows all of it.
- Print final instructions: how to start, demo accounts, and a 5-minute click-through demo script.

## Standing decisions (made up front, per "build fast, decide yourself")

1. **SQLite access**: `better-sqlite3` with hand-written SQL and a tiny migration runner in `/src/db`.
   No ORM, no codegen step, synchronous and easy to seed. Chosen over Prisma for simplicity.
2. **Auth**: own implementation. `bcryptjs` hashing, 32-byte random session tokens stored in a
   `sessions` table, delivered as a signed httpOnly cookie. "Log out of all devices" deletes all the
   user's sessions.
3. **TOTP**: `otplib` for admin MFA, `qrcode` for the setup QR. In dev, the current valid code is shown
   on the MFA screen and next to the admin demo account.
4. **Certificates**: server-side PDF with `pdfkit`, QR image via `qrcode`. Chosen over
   `@react-pdf/renderer` to avoid a second React renderer.
5. **Charts**: hand-rolled inline SVG (no chart dependency) for the admin 30-day chart.
6. **Reorder**: up/down buttons for sections and lessons (the brief allows either; no drag library).
7. **Uploads**: route handlers writing multipart files into `/public/uploads/<type>/`, filenames
   sanitised and uniquified.
8. **Sample video**: a tiny mp4 generated at implementation time with ffmpeg if available; the file is
   committed so the app never needs the network at runtime. Captions ship as `.vtt`.
9. **Rate limiting**: in-process limiter keyed by IP + email for login and password reset, backed by a
   DB table so restarts do not reset it.
10. **Mock Stripe**: `/mock-stripe/checkout` posts to a mock-payments route which signs the event with
    `PAYMENT_WEBHOOK_SECRET` from `.env.local` (seedable default) and calls the real webhook handler over
    HTTP, proving the signature + idempotency path end to end.
11. **Money**: stored as integer pence; formatted with `Intl.NumberFormat('en-GB', { currency: 'GBP' })`.
12. **Notifications/emails**: single `notifications` table for in-app, `emails` table for the outbox, a
    `/src/lib/mailer.ts` that only ever writes rows.

## Verification protocol

Every phase ends with: `npm run build` clean, `npm run lint` clean (no rule disabled to pass), then a
click-through of the phase's flows. Anything not actually run is reported as `UNVERIFIED`, never as a
pass. Final report: exact commands run, demo accounts, and a 5-minute demo script.

## Results (2026-10-13)

### Learner experience pass (same day, after the first review)

Requested follow-up: document the accounts, stop selling courses people already own, and bring the
learner side up to production standard.

- **`TESTACCOUNTS.md`** now documents every account with its real seeded state (generated from the
  database, not from memory), what each one is for, and a per-account test checklist.
- **Ownership beats commerce**: an owned course shows a progress panel (lessons, "Up next", Continue
  learning, certificate link) and **no price, payment copy or checkout tip anywhere**, including the
  mobile bar. Catalogue and home cards for owned courses show an "Enrolled"/"Completed" badge plus a
  progress bar instead of a price, and the CTA becomes Continue/Start learning. The home hero
  personalises for a signed-in learner ("Pick up where you left off" with remaining time).
- **Learner surfaces rebuilt**: dashboard (time-aware greeting, continue-watching hero naming the next
  lesson, snapshot, up-next list, latest award), My learning (tabs, search, sort, progress rings,
  per-tab empty states), player (progress ring header, per-section progress, current-lesson highlight,
  Up-next strip, end-of-lesson overlay with autoplay + cancelable countdown, keyboard shortcuts,
  My notes/Resources tabs), grades (average ring, grouped by course, instructor feedback blocks),
  certificates (mini preview, copy verification link), notifications (day grouping, per-type icons,
  unread dots), profile (devices signed in with per-session sign-out, danger zone), orders (receipt
  cards with a status timeline), mobile bottom tab bar, flash toasts on actions, `prefers-reduced-motion`.

### Verification (unchanged commands, re-run after the pass)

| Command | Result |
| --- | --- |
| `npm run build` | clean - Next.js 16.4 (Turbopack) |
| `npm run typecheck` | clean |
| `npm run lint` | clean - 0 errors, 0 warnings |
| `scripts/e2e/run_all.py` | **13/13 suites, 462 checks passed** |

Suite totals: phase1 36, phase2 48, phase3 39, phase4 34, phase5 34, phase6 32, phase7 35, phase8 54,
phase9 31, phase10a 23, phase10b 46, phase10c 10, phase10d 50.

Bugs found while doing it (all fixed):

1. `LearnerNav` (a client component) imported a server component that uses `next/headers`, which broke
   every route in dev.
2. An `onChange` handler on a `<select>` inside a server component crashed the My Learning page
   (event handlers cannot cross that boundary) - extracted a small client `SortSelect`.
3. A `'use server'` file exported a synchronous function (`listSessions`), which is invalid and took the
   whole app down; the query now lives in `lib/queries/sessions.ts`.
4. The mobile grid track was `auto`, so a card's min-content width (from `truncate`d nowrap text)
   pushed the dashboard 138px wider than the phone viewport - fixed with `grid-cols-1`
   (`minmax(0, 1fr)`) and `min-w-0` on the flex children.
5. `ProgressRing` had no ARIA role, so screen readers saw nothing for every score in the learner area.

### First build (for the record)

| Command | Result |
| --- | --- |
| `npm run build` | clean - Next.js 16.4 (Turbopack) |
| `npm run typecheck` | clean |
| `npm run lint` | clean - 0 errors, 0 warnings |
| `npm run seed` | clean - 4 categories, 10 courses, 49 lessons, 30 questions, 6 users, 6 orders, 2 certificates, 10 emails, 14+ audit entries |
| `scripts/e2e/run_all.py` | **12/12 suites, 412 checks passed** |

Bugs found and fixed by the click-throughs (each would have shipped otherwise):

1. The scaffold's `src/app/page.tsx` shadowed the `(public)` route group's home page.
2. `availableAdminNav()` lived in a client module but was called from a server layout, crashing the
   whole admin area.
3. A client component imported `@/lib/uploads`, which pulls in `better-sqlite3` - the route's module
   graph broke in dev. Split into `lib/file-url.ts` (browser-safe) and `lib/uploads.ts` (server-only).
4. Tailwind 4 cannot `@apply` a component class; the shared button base is now a real `@utility`.
5. `pdfkit` read its `.afm` font data from a bogus bundled path - fixed with
   `serverExternalPackages: ['better-sqlite3', 'pdfkit']`.
6. The seeded resume position (137s) exceeded the 24-second sample clip, so resume never triggered.
7. Seed progress was applied in `sort_order` order rather than course order, marking the wrong lessons
   complete.
8. Lesson resources attached to the wrong lesson: the seed's lesson-key map collided across sections.
9. `createCourseAction` had a placeholder/parameter mismatch that threw on every course creation.
10. `formatPenceShort` rendered `£39.5` instead of `£39.50`.
11. A revoked-refund order made the learner's receipt page 404 for staff.
12. The admin orders search did not match the customer's name.
13. After a graded attempt the quiz page offered no way to retake it.
14. Replacing a thumbnail deleted the previous file even when another course shared it.
15. The mobile learner nav's negative margin leaked past the viewport (44px of horizontal scroll).
16. `page.fill("#points_...", ...)` style bugs aside, the quiz marking form's `max` attribute protects
    the server - the server also clamps marks itself.
17. Login rate limiting was IP-keyed at 6 failures, so one account's failures locked out every other
    account on localhost. Now per-account lockout plus a much higher per-IP flood limit.
18. Grading/refund/revoke confirmation messages vanished because the form unmounts once the record
    changes state; the pages now show the resulting state (score, refund banner, revoked badge).

Deliberately `UNVERIFIED` (honest gaps):

- `npm install` on a *fresh clone* of this machine: every run here installs into the existing
  `node_modules`. The post-install path (`predev` → `ensure.ts` → schema + seed, then `next dev`) has
  been exercised on every start.
- Literally disconnecting the network: no outbound requests are made at runtime (fonts, video, PDF data
  and QR generation are all local, verified by reading the code and by the absence of network errors),
  but the cable was not pulled.
- Real print *output* on paper: the print stylesheets were verified by emulating print media in
  Chromium (screenshots in `%TEMP%\opencode\lms-print`), not by sending a job to a printer.

## Results - navigation glass pass (2026-10-15)

Requested follow-up: "make the navbar glassmorphism in every pages ... with dynamic effects",
then "the glassmorphism navbar should be smaller while scrolling the page ... in every device
view". The site header (shared by the public, learner and admin shells) is glass on every
page. A second pass, on request, replaced the vertical shrink with a horizontal one: the bar
keeps its 64px height everywhere and, on desktop, narrows to the width of its own content as
the page scrolls.

### What changed

- `src/components/layout/glass-header.tsx` (new): the frosted bar. A rAF-throttled scroll
  listener writes `--condense` (0 -> 1 over the first 140px) and `--progress` straight to CSS
  variables, so scrolling never re-renders React. Holds the frost layer, two drifting aurora
  blurs and a hairline reading meter.
- `src/components/layout/nav-links.tsx` (new): desktop links with one highlight pill, measured
  against the hovered/focused/active link and slid between them.
- `site-header.tsx`, `mobile-nav.tsx`, `learner-tab-bar.tsx`, `user-menu.tsx`,
  `notification-bell.tsx`, `brand.tsx`: glass triggers and panels, a frosted mobile sheet with
  staggered links, a floating learner dock with a sliding indicator, account menus as
  full-width sheets on phones and button-anchored dropdowns from `sm` up.
- `src/app/globals.css`: `.glass-nav`, `.glass-panel`, `.nav-aurora`, `.nav-meter`,
  `.nav-pill` / `.dock-pill`, `.sheen`, the keyframes, and `@source not "../../data"`.
- `.gitignore`: `data/` (see the Turbopack note below).

### Measured behaviour (headless Chromium at 390 / 768 / 1280)

| viewport | at the top | scrolled |
| --- | --- | --- |
| 390 | full width, 64px, no radius | full width minus 12px insets, 64px, 16px radius |
| 768 | full width, 64px | **668px**, centered, 64px, 16px radius |
| 1280 | full width, 64px | **689px**, centered, 64px, 16px radius |

The desktop width interpolates from full width to the measured content width as the scroll
position moves through the first 140px (`--condense`), and the height never changes. The
header reserves 4.5rem, so the floating bar cannot cover the page below it: the header box
and the content top stay at 72px in every state, and there is no horizontal overflow.

### Bugs found and fixed while verifying in a browser

1. Lightning CSS kept only the `-webkit-backdrop-filter` declaration when both forms were
   hand-written, and Chrome drops that property, so there was no blur at all. The frost now
   uses a Tailwind utility layer.
2. An animated `opacity` turns an element into a backdrop root and silently kills its own
   `backdrop-filter`; proved with a side-by-side probe in the browser. Panels animate transform
   only (`animate-drop`), the staggered menu items keep `animate-pop`.
3. Account dropdowns overflowed the left edge on a 390px viewport.
4. The dev server crashed mid-run: Turbopack panicked reading the locked `data/demolms.db-shm`
   while Tailwind's scanner was tracking globs. `data/` is now gitignored and excluded with
   `@source not`, so the scanner never touches the SQLite files.
5. The content-width pass exposed a Chrome trap: a transitioned property whose value comes from
   a custom property can stay stuck at its old value when only that custom property changes, so
   the bar kept computing as if `--condense` were 0. `--condense` is written on every scroll
   frame anyway, so the transitions on the bar were removed and it now tracks the page directly.
6. A ResizeObserver feedback loop: the observer fired while the bar animated, and re-writing the
   variables restarted the transitions every frame. Variable writes are now skipped when the
   value has not changed.
7. At tablet widths the nav links wrapped, because the content width was measured from an
   already-squeezed row. The links are `whitespace-nowrap` now, so the measurement is always the
   natural width. (Verified: children widths 407 + 217, gap 16, padding 48 -> 689px, unchanged
   between the two states.)

### Verification

| Command | Result |
| --- | --- |
| `npm run build` | clean - Next.js 16.4 (Turbopack) |
| `npm run typecheck` | clean |
| `npm run lint` | clean - 0 errors, 0 warnings |
| `scripts/e2e/run_all.py` | **13/13 suites, 462 checks passed** |

Browser checks (headless Chromium at 390 / 768 / 1280): the shrink table above, the sliding
highlight aligned to its link within 1.5px on both the desktop nav and the dock, no horizontal
overflow, print still hides the header (phase 10c), and the mobile sheet blurs the page behind
it.

Known, pre-existing and dev-only: the first MFA page render of each `next dev` process emits
Node's `DEP0005` from `otplib` -> `thirty-two` (`new Buffer()`), and Next dev forwards server
logs into the browser console, so phase 1's "no runtime console errors" check fails on a cold
process. Traced to an exact stack (`currentTotp` -> `Authenticator.generate` -> `keyDecoder` ->
`exports.decode`). It is not from this change and it is deliberately not silenced: a full
`run_all.py` on a freshly started dev server reports 12/13 for that reason alone, and running
it again (or opening the MFA page once) gives 13/13.

## Results - admin console pass (2026-10-16)

Requested follow-up: admins control everything from a full-width desktop console, a richer
dashboard, support access into learner accounts, no learner surfaces for staff, and simpler
course authoring. Delivered in five phases, one commit each:

1. `ceae7d5` full-width admin shell - the console spans the viewport (the shared glass header
   gained a `wide` variant); public/learner keep their reading caps.
2. `396010e` data-heavy dashboard - eight KPIs, 30-day window summary, and six widgets with
   deep links (recent orders, grading preview, quick actions, newest learners, top courses,
   latest audit).
3. `334f94f` support access - "Enter as learner" from the user page and dashboard: a learner
   session in its own signed cookie, admin session untouched, floating banner with one-click
   return, entry/exit audited, auditor rejected server-side, forward migration for
   `sessions.impersonated_by`.
4. `8c931fe` staff lock-out - `/dashboard`, `/learn/*` and every learner action redirect staff;
   enrolment/checkout refuse staff with a notice; course pages show a staff panel (edit +
   enter-as-learner) instead of price/Enrol; new `/admin/settings` holds staff account controls.
5. Settings + authoring - `settings` table (announcement banner, pause enrolments), categories
   CRUD with inline rename and reorder, featured toggle (settings form + list star), title-only
   course creation, inline section/lesson add, click-to-edit titles, duplicate lesson/section/
   course, and sortable courses list with quick publish/feature/duplicate actions.

### Verification

| Command | Result |
| --- | --- |
| `npm run build` | clean - Next.js 16.4 (Turbopack) |
| `npm run typecheck` | clean |
| `npm run lint` | clean - 0 errors, 0 warnings |
| `scripts/e2e/run_all.py` | 13/13 suites, 513+ checks (phase 3 53, phase 8 108) |

Also exercised by hand in a browser: support round-trip (enter, learn, return, sign-out while
impersonating signs out fully), staff redirects, announcement on the public site, pause notices,
category CRUD, duplicate/rename flows.

Two environment notes from the long test runs (not app bugs): a headless-Chromium driver
connection dropped once, and the dev server eventually died with `memory allocation ... failed`
after hours of serving ~4900 requests. Both are dev-server/test-infrastructure resource issues;
every suite passes on a fresh `next dev`.

Deliberately `UNVERIFIED`: no real network disconnection test (unchanged from earlier passes);
the announcement banner and paused states were checked via Playwright, not by hand on a phone.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
