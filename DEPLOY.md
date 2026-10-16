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
- `.gitignore` now excludes the runtime uploads (`submissions/`, `avatars/`, and timestamped
  uploads). `npm run seed` regenerates the seeded assets, so a fresh clone still works. The only
  uploads kept in the repo are `videos/sample.mp4` and its poster, which need ffmpeg to rebuild.

```bash
git remote add origin https://github.com/<you>/demolms.git
git push -u origin main
```

Then on the host: connect the repo, set the build/start commands and env vars from the table above,
attach the disk at `data`, deploy, and open the URL. First boot seeds itself.
