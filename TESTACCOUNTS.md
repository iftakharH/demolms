# Test accounts

Everything you need to exercise the demo end to end. All accounts use the password **`Demo1234!`**
unless noted, and the login page has one-click quick-fill buttons for the first three.

The database seeds itself on first `npm run dev`. Any time you want this exact state back:

```bash
npm run seed
```

> **Note:** testing changes state (that is the point). After grading, refunding or revoking something,
> re-seed before the next run if you want the scripted demo data back.

---

## Quick reference

| # | Email | Password | Role | MFA | Use it for |
| --- | --- | --- | --- | --- | --- |
| 1 | `learner@demo.test` | `Demo1234!` | learner | no | The main learner journey: partial courses, a completed course with a certificate, a refunded order |
| 2 | `admin@demo.test` | `Demo1234!` | admin | **yes** | Every write action: course builder, grading, users, coupons, refunds, certificate revocation |
| 3 | `auditor@demo.test` | `Demo1234!` | auditor | **yes** | Read-only admin: everything visible, nothing writable |
| 4 | `ravi@demo.test` | `Demo1234!` | learner | no | Having work graded (quiz essay + assignment waiting), a second certificate |
| 5 | `grace@demo.test` | `Demo1234!` | learner | no | A third reviewer of the grading queue; resubmission requests |
| 6 | `newbie@demo.test` | `Demo1234!` | learner | no | The unverified-email flow (a live verification link sits in the outbox) |
| 7 | *register your own* | you choose | learner | no | The registration → verification → first login flow from scratch |

**Admin TOTP without an authenticator app:** when an admin or auditor signs in, the MFA screen shows
the **current valid 6-digit code** in a dev box with a 30-second countdown. Type it in. In a real
deployment that code would only exist inside the authenticator app.

---

## 1. `learner@demo.test` - Alex Morgan

**The richest account.** Use it for the main learner story.

**Seeded state**

| Course | Source | Progress | Notes |
| --- | --- | --- | --- |
| TypeScript for Production Teams | purchased (£89 - 10% coupon = **£80.10**) | **2 of 9** lessons | Video position saved at **0:14** on "Wiring tsconfig for a real app", 2 personal notes |
| JavaScript Fundamentals | free | **10 of 10, completed** | Certificate **DEMO-2026-5S8DCJ** issued, quiz 85.7%, assignment graded 88/100 |
| Clean Product Design in Figma | purchased (**£69.00**) | 1 of 5 | Video position saved at **0:44** on "Spacing is the design" |
| Data Storytelling & Dashboards | purchased then **refunded** | access revoked | Order **refunded**, so the course is gone from My learning but the receipt shows the refund |

- **Orders:** 3 paid (one with coupon `WELCOME10`), 1 refunded. Receipts are printable.
- **Grades:** TypeScript quiz 78.6% (passed, one multiple-choice answer wrong, essay marked with
  feedback) and JavaScript quiz 85.7% (passed, one short answer wrong, essay marked).
- **Notifications:** 6 total, **3 unread** (certificate issued, refund processed, quiz reviewed).
- **The outbox has:** welcome, receipt, assignment graded, certificate issued, refund processed,
  quiz reviewed, plus a **live password-reset link** (still valid for 1 hour).

**What to test with this account**

1. **Resume a video** - open TypeScript → the player resumes at 0:14 with a "Resumed where you left
   off" banner and a "Start over" option.
2. **Captions** - toggle them on/off in the player; the sample clip has a WebVTT track.
3. **Notes** - type in "My notes on this lesson": the status goes *Unsaved changes → Saving → Saved*,
   and the note appears under "My notes across this course".
4. **Downloads** - download the TypeScript cheat-sheet, then open the same URL in a private window: it
   is refused because the route checks enrolment.
5. **Quiz with an essay** - take the TypeScript checkpoint again (2 attempts left): multiple-choice
   questions are marked instantly, the written answer is queued. Then grade it as admin and watch the
   score update.
6. **Certificate** - open `/learn/certificates`, view the certificate, download the PDF, then open the
   public verification link signed out.
7. **Refunded course** - open the refunded order receipt and confirm access stayed revoked.
8. **Ownership state** - open a course you own: there is **no price anywhere**, just progress,
   "Up next" and "Continue learning". Compare with a course you do not own (e.g. Design Systems that
   Scale), and with the catalogue, where owned courses carry an "Enrolled" badge and a progress bar
   instead of a price.
9. **Player extras** - the **Shortcuts** button (space, ←/→, j/k/l, c, m, f), the **Up next** strip,
   the end-of-lesson overlay with autoplay, per-section progress in the sidebar, and the
   **My notes / Resources** tabs.
10. **Grades and certificates** - the grades page groups by course with score rings and instructor
    feedback; the certificates page shows a mini preview with PDF, public page and
    *copy verification link*.
11. **Devices** - on the profile page, sign a session out individually, or use "sign out everywhere".
12. **Mobile** - the bottom tab bar (Home, Learning, Grades, Awards, Profile) and the header bell; the
    player keeps its controls in reach.

---

## 2. `admin@demo.test` - Imogen Clark

Full admin. Signs in with a TOTP code shown on screen.

**Seeded state:** nothing personal, but the admin area is loaded: 8 published courses + 1 draft
("Advanced React Patterns") + 1 archived ("Legacy: jQuery for Beginners"), 4 coupons, 6 orders,
2 certificates, 14 audit entries, and a **grading queue with 3 items** (1 quiz essay + 2 assignments).

**What to test with this account**

1. **Dashboard** - revenue, orders, new users, enrolments, completion rate, 30-day chart, "needs
   attention" count.
2. **Grading queue** - mark Ravi's written quiz answer (points + feedback) and grade an assignment.
   Each action emails the learner and writes an audit entry.
3. **Course builder** - open any course: edit settings, reorder sections/lessons with the arrows, add a
   lesson, upload video/captions/poster, add a quiz question of each of the five types, upload a
   resource, then **Preview as learner**. Publish / unpublish / archive, and delete a draft.
4. **Users** - search, filter by role, open a user to see their enrolments, orders and activity; change
   a role (sessions end immediately); disable and re-enable an account.
5. **Orders** - filter, search by learner name or order id, open an order, issue a **partial or full
   refund**, choose whether to revoke access.
6. **Coupons** - create a percentage or fixed coupon (optionally single-course, with expiry and usage
   limit), then disable it.
7. **Certificates** - revoke with a reason and watch the public verification page change.
8. **Audit log** - filter by area or search; every action you just took is in there.

**Try the guards:** publishing needs at least one section, lesson and quiz question; the last active
admin cannot be demoted or disabled; a lesson or section with learner attempts cannot be deleted.

---

## 3. `auditor@demo.test` - Sam Okonkwo

Read-only admin. Also signs in with a code from the dev box.

**What to test**

1. Every admin page is visible - dashboard, courses, builder, users, orders, coupons, grading,
   certificates, audit log - with a yellow read-only banner.
2. **No write control exists anywhere:** no Save, Publish, Create, Refund, Revoke, Grade, role or
   disable buttons.
3. The server refuses writes too. The e2e suite proves this by capturing a real publish request from an
   admin session and replaying it byte-for-byte with an auditor session: it is rejected with
   `FORBIDDEN: auditor accounts are read-only`, and the course status does not change.

---

## 4. `ravi@demo.test` - Ravi Patel

**Use this account to see grading land.**

**Seeded state**

- TypeScript for Production Teams - purchased (£89 - 20% coupon `TYPESCRIPT20` = **£71.20**), 4 of 9 done
- Data Storytelling & Dashboards - purchased (**£99.00**), 3 of 5 done, with **a quiz attempt waiting
  for manual review and an assignment waiting to be graded**
- JavaScript Fundamentals - free, **completed**, certificate **DEMO-2026-SPHNCM**
- 1 unread notification ("your assignment is in the grading queue")

**What to test**

1. Open `/learn/grades`: one attempt is pending review, the completed course shows a graded quiz.
2. Ask the admin to grade the pending quiz essay and the assignment, then reload Ravi's grades page: the
   score, pass/fail and written feedback appear, and the notification bell lights up.
3. Resubmit the assignment if the admin requests one - the submission history keeps both versions.

---

## 5. `grace@demo.test` - Grace Adeyemi

Good for a second opinion on the grading queue and for diving into a course with no history.

**Seeded state**

- SQL for Analysts - free, 1 of 4 done
- Design Systems that Scale - purchased (**£129.00**), 1 of 4 done, video saved at **1:01**
- JavaScript Fundamentals - free, 5 of 10 done, **assignment submitted and waiting to be graded**

**What to test**

1. Admin side: grade or request a resubmission on Grace's assignment, then sign in as Grace to see the
   request and submit updated work.
2. Learner side: enrol in a new free course, complete a couple of lessons and watch the dashboard
   update.
3. Turn **grades emails off** on Grace's profile, have the admin grade something, and check the outbox:
   no grading email is written. Turn it back on and grade again - the email appears.

---

## 6. `newbie@demo.test` - Noor Shah

An **unverified** account, created so the verification flow can be tested without registering.

**What to test**

1. Sign in - you land on the dashboard with an "email not verified" banner.
2. Open `/dev/outbox`, find **"Confirm your email address"** (the newest one) and click the link. The
   account is verified, the welcome email is written, and the banner disappears.
3. `/dev/outbox` also holds a verification email for whatever account you register yourself.

---

## Everything else that is seeded

| Thing | What is there |
| --- | --- |
| **Courses** | 8 published across 4 categories (Software Development, Data & Analytics, Design, Business & Career) + 1 draft + 1 archived. Two courses are fully built (video, article, 5-question-type quiz, assignment, resources). |
| **Free courses** | JavaScript Fundamentals, SQL for Analysts, Interview Skills for Developers (one-click enrolment, no card) |
| **Paid courses** | TypeScript £89, Next.js £79, Figma £69, Dashboards £99, Design Systems £129 |
| **Coupons** | `WELCOME10` 10% all courses · `FREE100` 100% off · `TYPESCRIPT20` 20% off one course · `EXPIRED10` £5 off, expired |
| **Test cards** | `4242 4242 4242 4242` succeeds · `4000 0000 0000 0002` declines · `5555 5555 5555 4444` succeeds |
| **Grading queue** | 3 items: Ravi's quiz essay, Ravi's dashboard assignment, Grace's JavaScript assignment |
| **Certificates** | 2 valid (both for JavaScript Fundamentals: Alex and Ravi) |
| **Outbox** | 10 emails covering every template: verification, reset, welcome, receipt, assignment graded, quiz pending review, quiz reviewed, certificate, refund, submission received |
| **Audit log** | 14 entries: logins, course publishing, role change, refund, grading, quiz review, coupons, certificate issuance |
| **Dev tools** | `/dev/outbox` (all email), `/mock-stripe/checkout` (reached from checkout), `/verify/<certificateId>` (public, no login) |

---

## Flows that need two accounts

Keep a normal window and a private window open side by side.

| Flow | Do this | Watch for |
| --- | --- | --- |
| Buy → receipt | Learner buys a paid course with `WELCOME10` | mockpay shows the signed webhook at HTTP 200; the receipt email lands in the outbox |
| Webhook security | Tick **Simulate bad signature** before paying | A second panel shows HTTP 400 *"Signature does not match the payload"* - the tampered event is refused and the order is untouched by it |
| Submit → grade | Learner submits an assignment; admin grades it | In-app notification + graded email + audit entry, and the score appears on the learner's grades page |
| Refund | Admin refunds that order with access revocation | The learner receives a refund email and the course vanishes from My learning |
| Certificate | Learner finishes a course with a pass mark; admin revokes the certificate | `/verify/<id>` flips from *valid* to *revoked* with the reason, without signing in |
| Auditor guarantee | Replay any admin write as the auditor | Rejected server-side; the data does not change |
