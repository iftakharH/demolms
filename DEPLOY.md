# Deploying demolms to a host with a persistent disk

This app is **not** a serverless app. It keeps a SQLite file at `data/demolms.db` and writes
uploads to `public/uploads/`, so it needs a host that gives a Node process a **writable disk that
survives restarts**. That is the whole reason Vercel cannot run it unmodified (see
[Why Vercel cannot run this as-is](#why-vercel-cannot-run-this-as-is)).

Read this before deploying: the demo deliberately ships public credentials and dev tooling, and you
should decide whether you are happy exposing them (see [What a public URL exposes](#what-a-public-url-exposes)).

---

## Host options (checked 2026-10-17)

Prices and free tiers move; these were verified against the pricing pages on 2026-10-17. Raw research
with source URLs is in `docs/host-research.md`.

| Host | Works for this app? | Cheapest setup with a disk | Notes |
| --- | --- | --- | --- |
| **Fly.io** | yes | **~$2.34/mo**: `shared-cpu-1x` 256 MB machine ($2.19) + 1 GB volume ($0.15) | Cheapest. **No free tier any more** (trial only), card required. Needs a Dockerfile, so this is the one route I would have to write *and test with you*. Keep exactly one machine on the volume. |
| **Railway** | yes | **Hobby $5/mo + usage** (a 0.5 GB always-on service ≈ $5 of usage, so realistically **$6-8/mo**) | Easiest: connect the repo, it detects Next.js, no Dockerfile. The **free plan cannot attach a custom domain** and its $1/mo credit lasts days, so it is not viable for a portfolio link. |
| **Render** | yes | **$7.25/mo**: $7 web service (0.5 CPU / 512 MB) + $0.25 for a 1 GB disk | Most predictable. Free tier **cannot attach a disk** and wipes the filesystem on spin-down, so it cannot run this. Disks are single-instance with no zero-downtime deploys - fine here. |
| **Koyeb** | not recommended | volumes are preview-grade and priced under Pro ($29/mo) | Free instance has no volumes and scales to zero. |
| **Northflank** | maybe | ~$2.70/mo compute + disk | Free-tier volume availability is unverified. |

**My recommendation:** Railway if you want the least fuss (~$6-8/mo), Render if you want the most
predictable behaviour (~$7.25/mo), Fly.io if you want the lowest possible bill (~$2.34/mo) and are
happy for me to write a Dockerfile and test it with you. All three need a card and an account, and I
will not create or pay for anything without your explicit go-ahead.

---

## Render, step by step

Render was the chosen route. These steps are written against Render's own documentation, which is
worth knowing about in advance:

- **Disks require a paid instance** - a free web service cannot attach one, and it also spins down
  after 15 minutes idle and loses its filesystem.
- **The disk is not available while the build runs** (build and pre-deploy commands run on separate
  compute). This is exactly why the seed happens at *boot* (`src/instrumentation.ts`) rather than
  during the build: the build has no writable `/opt/render/project/src/data` to seed into.
- **A disk disables zero-downtime deploys.** Render stops the old instance before starting the new
  one, so each deploy has a few seconds of downtime. Fine for a demo, and the disk keeps the data.
- Disks are snapshotted automatically once every 24 hours, kept at least seven days.

### 1. Create the service

1. Render Dashboard -> **New -> Web Service** -> connect your GitHub account -> pick the **demolms** repo.
2. Name `demolms`, region closest to you, branch `main`, language **Node**.
3. Build command: `npm ci && npm run build`
4. Start command: `npm start`
5. Health check path: `/`

### 2. Pick a paid instance and attach the disk

6. Instance type: **Starter** (or higher). A disk cannot be attached to a Free instance.
7. **Advanced -> Add disk**: mount path **`/opt/render/project/src/data`**, size **1 GB** (the smallest
   that works; you can grow it later but not shrink it).
   - That path is Render's documented source directory for Node services
     (`/opt/render/project/src`) plus this app's `data/` directory. Mounting anywhere else means the
     database is not actually on the disk - Render only preserves files written *under* the mount path.

### 3. Environment variables

| Key | Value |
| --- | --- |
| `APP_URL` | `https://<your-service-name>.onrender.com` (or your custom domain) - used in metadata, the sitemap and the links inside emails |
| `SESSION_SECRET` | a long random string - signs the session cookie |
| `PAYMENT_WEBHOOK_SECRET` | a random string starting `whsec_` - signs the mock webhook |
| `DEMO_HIDE_DEV_TOOLS` | optional, `true` to hide the on-screen MFA code, demo-account quick-fill buttons and the footer outbox link |

Generate the two secrets locally and paste them in (do not reuse the defaults from `src/lib/env.ts`):

```bash
node -e "console.log('SESSION_SECRET=' + require('node:crypto').randomBytes(32).toString('hex'))"
node -e "console.log('PAYMENT_WEBHOOK_SECRET=whsec_' + require('node:crypto').randomBytes(24).toString('hex'))"
```

`NODE_ENV=production` is set by Render; `PORT` is picked up by `next start` automatically.

### 4. Deploy, then check the logs

8. **Create Web Service**. The first deploy takes a few minutes (`npm ci` compiles/downloads
   `better-sqlite3`).
9. Open the service's **Logs** and look for the first-boot seed:

   ```
   [db] empty database - seeding demo data...
     assets: covers, captions, resource PDFs written to public/uploads
     ...
   Seeded the demo database at data/demolms.db
   [db] ready (6 users)
   ```

   If you see `[db] ready (6 users)` on the next restart instead of the seeding lines, the disk is
   working and the data survived.
10. Open `https://<your-service>.onrender.com` and sign in with `learner@demo.test` / `Demo1234!`
    (and `admin@demo.test` with the TOTP code shown on screen).

### 5. After the first deploy

- **Smoke test worth doing:** register a new account, and check the verification email in
  `/dev/outbox` - its link uses `APP_URL`, so a wrong `APP_URL` shows up here first.
- **A file uploaded by an admin disappears on the next deploy** (uploads live outside the disk), while
  accounts, progress and orders survive. Mount a second disk at `/opt/render/project/src/public/uploads`
  if that matters to you.
- **To reset the demo data**, run `npm run seed` from the service's Shell page - the disk keeps it.

---

## What the host must provide

| Requirement | Why | Where it is configured |
| --- | --- | --- |
| A single Node instance (no autoscaling to >1) | SQLite is single-writer. Two instances on one disk corrupt nothing, but they fight over the WAL; two instances on separate disks diverge. | host setting |
| A persistent disk mounted at `data/` | The database lives there. Without it, every restart re-seeds and visitors lose their progress. | host setting |
| A writable filesystem for `public/uploads/` | Admin uploads (video, captions, thumbnails, resources) are written at runtime. | default container fs is fine; the files are lost on redeploy (see below) |
| Build: `npm ci && npm run build` | Standard Next.js build; `prebuild` seeds the demo content into the build. | host setting |
| Start: `npm run start` | `next start` on `$PORT`. | host setting |
| Env: `APP_URL`, `SESSION_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `NODE_ENV=production` | `APP_URL` is used in metadata, sitemap and the receipt/verification links inside emails. The two secrets sign the session cookie and the mock webhook. | host env vars |

`PORT` is honoured by `next start` automatically. `APP_URL` must be the public URL (e.g.
`https://demolms.onrender.com`) or the links inside the outbox will point at localhost.

One native-module note: `better-sqlite3` needs its **install script** to run during `npm ci` (it
downloads a prebuilt binary, or compiles with `node-gyp`). Render's Node runtime has the toolchain, so
this works. If a host ever blocks lifecycle scripts, the build fails with a "Could not locate the
bindings file" style error - npm 11.19 and newer print an advisory `allowScripts` warning but do not
block by default. The lockfile is verified in sync (`npm ci --dry-run` exits 0).

### What survives a redeploy

| Path | Survives? | Note |
| --- | --- | --- |
| `data/demolms.db` (mount a disk here) | **Yes** | Accounts, enrolments, progress, orders, certificates, emails |
| `public/uploads/**` written by the seed at build time | yes (baked into the image) | Sample video, captions, seeded resources |
| `public/uploads/**` written by an **admin at runtime** | **No** | Uploaded videos/thumbnails are lost on the next deploy. Acceptable for a demo; a real product wants object storage |

---

## First boot

`src/instrumentation.ts` runs once when the server starts. It applies the schema, runs forward
migrations, and **seeds the demo content only if the database is empty**. So a fresh disk fills
itself in on first boot: no shell step needed. `npm run seed` remains the way to reset the demo data
by hand.

---

## What a public URL exposes

This is a demo, and it is honest about it. Before you put it on a public URL, know that:

- **The demo accounts are public and printed on the login page**: `admin@demo.test` / `Demo1234!`
  (and the auditor). Anyone can sign in as the admin and grade, refund, revoke certificates, or
  change content. That is the point of the demo - but it means anyone can also delete or vandalise
  the seeded content. Re-seed (`npm run seed` on the host, or restart with an empty disk) to reset.
- **Admin MFA codes are shown on screen** (dev tooling, `DEMO_HIDE_DEV_TOOLS` unset). The TOTP step
  is demonstrated, not enforced against a real secret.
- **`/dev/outbox` is public.** It contains every email the app "sent", including password-reset links
  for the demo accounts. On a public URL that means a visitor can reset a demo account's password -
  which is exactly the flow the demo wants to show, but it is a real consideration if you reuse any
  of this code.
- **Mock payments only.** No card data is stored beyond the brand and last four digits, and nothing
  leaves the machine.
- Set `DEMO_HIDE_DEV_TOOLS=true` to hide the TOTP code, the demo-account quick-fill buttons and the
  footer outbox link. The accounts still exist (they are seeded data) - hiding the tools is cosmetic,
  not access control.

If you would rather show the product without any of that, deploy with the dev tools hidden and keep
the accounts to yourself; the README documents them.

---

## Why Vercel cannot run this as-is

Vercel's functions have a read-only filesystem except `/tmp`, and `/tmp` is per-invocation and not
shared between requests. Concretely:

1. **Signing in fails**: a login inserts a session row into SQLite. The write cannot happen, and even
   if it could, the next request may land on a different instance that cannot see it.
2. **Every DB-backed page fails**: `data/` is git-ignored by design and
   `process.cwd()/data/demolms.db` is not traced into the serverless bundle.
3. **Uploads fail** with `EROFS`.
4. **The mock webhook** posts to `APP_URL`; it would have nothing to write to anyway.

Moving this to Vercel would mean replacing SQLite with a hosted Postgres (the data layer is
synchronous `better-sqlite3` in ~40 files, and the SQL is SQLite-flavoured) plus object storage for
uploads, and giving up the "everything runs locally, offline after `npm install`" property that is
the point of this demo.

---

## Pushing to GitHub

The repo is ready to push, with one piece of housekeeping already done:

- `data/` and `.env*` are git-ignored, so no database and no secrets can be committed.
- `.gitignore` excludes the runtime uploads (`submissions/`, `avatars/`, and timestamped uploads).
  `npm run seed` regenerates the seeded assets, so a fresh clone still works. The only uploads kept in
  the repo are `videos/sample.mp4`, its poster and captions, which need ffmpeg to rebuild.

```bash
gh repo create demolms --public --source=. --push      # or your own org/name
# equivalently, with a remote you already made:
git remote add origin https://github.com/<you>/demolms.git
git push -u origin main
```

Then on the host: connect the repo, set the build/start commands and env vars from the table above,
attach the disk at `/opt/render/project/src/data`, deploy, and open the URL. First boot seeds itself.

### Verifying the deployed URL

Worth running once against the live site (these suites only read pages, they change nothing):

```bash
$env:LMS_BASE='https://<your-service>.onrender.com'
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase10_responsive.py
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" scripts\e2e\phase10e_design.py
```

`phase10e` checks the deployed build the way a visitor experiences it: the self-hosted font loads, the
theme choice persists and is applied before paint, dark mode is themed rather than inverted, covers are
drawn as SVG, and there is no horizontal overflow at 390 / 768 / 1280 in both themes.
