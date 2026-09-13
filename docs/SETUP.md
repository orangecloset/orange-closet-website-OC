# Setup & Deployment Guide 

Everything needed to get this project running locally, and to switch to a new
production database without forgetting a step.

---

## 1. Prerequisites

- Node.js 22+
- A [Neon](https://neon.tech) Postgres database
- A [Cloudinary](https://cloudinary.com) account (product image uploads)
- A [Vercel](https://vercel.com) account (hosting + serverless API)

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in every value:

```
cp .env.example .env.local
```

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Serverless API only | Neon connection string. **Never** prefix with `VITE_`. |
| `CMS_API_SECRET` | Serverless API only | HMAC secret for admin tokens & catalog tokens. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CLOUDINARY_CLOUD_NAME` | Serverless API only | From Cloudinary dashboard home |
| `CLOUDINARY_API_KEY` | Serverless API only | Cloudinary Settings > Access Keys |
| `CLOUDINARY_API_SECRET` | Serverless API only | Same page. Keep server-side. |
| `CRON_SECRET` | Serverless API only | Protects the Cloudinary cleanup cron (`/api/cron/cloudinary-gc`). Vercel Cron sends it as a bearer token automatically. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `VITE_NEON_AUTH_URL` | Client bundle | Neon Auth base URL. Public by design. |
| `VITE_CLOUDINARY_CLOUD_NAME` | Client bundle | Cloud name is public; secrets are not. |

Rules:

- Anything with `VITE_` gets bundled into the browser — **no secrets there, ever**.
- `.env.local` is gitignored; mirror all values in Vercel's dashboard
  (Project > Settings > Environment Variables) for deploys.

---

## 3. Database schema (the step that's easy to forget)

This project uses **`drizzle-kit push`** — there is no migrations folder.
Schema changes are applied by diffing `db/schema.ts` against the live database.

> **IMPORTANT:** Whenever you point the project at a NEW database (e.g. moving
> from the testing DB to the client's real DB, or setting up staging), you MUST
> run push once against it or the tables won't exist:
>
> ```
> npx drizzle-kit push
> ```

What it does: reads `DATABASE_URL` from `.env.local`, compares it with
`db/schema.ts`, and creates/alters only what's missing. It will show you a
preview before applying.

Tables managed this way: `products`, `sales`, `settings`, `catalog_links`,
`users`, `rate_limits`.

Note: the API **fails open** if `rate_limits` is missing — nothing crashes,
but rate limiting silently stops being enforced. If you see a fresh database,
run push first.

---

## 4. Local development

```
npm install          # install dependencies
npx drizzle-kit push # create/sync tables on the DB from step 3
npm run dev          # start Vite dev server
```

Other commands:

```
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build           # production build
npm run test:ratelimit  # integration test for the rate limiter (hits real DB)
```

The API functions live in `api/` and are served by Vercel in production.
To test them locally use `vercel dev` (requires the Vercel CLI).

> **Vercel Hobby plan limit:** max **12 serverless functions** per deployment
> (each routed file in `api/` counts once; `_lib/` helpers don't). The project
> currently uses **11** by merging `/api/account/*` into one catch-all
> (`api/account/[[...action]].ts`). If you need more endpoints later, either
> merge related routes into catch-alls the same way or upgrade the plan.

---

## 5. Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Add **all** environment variables from section 2 in
   Project > Settings > Environment Variables.
3. Run `npx drizzle-kit push` against the production `DATABASE_URL` once.
4. Deploy. CI (`.github/workflows/ci.yml`) runs typecheck + lint + build on
   every PR and push to `main`.

### Pre-deploy checklist

- [ ] `.env.local` values mirrored into Vercel env vars
- [ ] `CRON_SECRET` set in Vercel (required — the GC endpoint refuses to run without it)
- [ ] `npx drizzle-kit push` run against the target database
- [ ] `CMS_API_SECRET` regenerated for production (don't reuse the test value)
- [ ] `npm run typecheck && npm run lint && npm run build` pass locally
- [ ] `npm run test:ratelimit` passes against the target database

---

## 5.1 Cloudinary cleanup cron (weekly garbage collector)

`api/cron/cloudinary-gc.ts` deletes orphaned images from Cloudinary so the
account doesn't fill with files that are no longer used by the CMS.

How it works:

1. Lists every asset in the Cloudinary `orange-closet/` folder.
2. Scans the database (`products`, plus all settings keys — which covers
   favicon, social share image, homepage heroes, about page, and category
   images) and collects every referenced URL.
3. Deletes any asset that is **not referenced anywhere** AND **older than
   7 days** (grace period protects images uploaded mid-edit).

Schedule: Mondays 03:00 UTC via Vercel Cron (`vercel.json`). Requires
`CRON_SECRET` in Vercel env vars — Vercel sends it automatically; the
endpoint returns 401 without it.

Manual runs:

```
# Preview only — shows what would be deleted, deletes nothing:
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-deployment>/api/cron/cloudinary-gc?dry=1

# Actually delete orphans:
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-deployment>/api/cron/cloudinary-gc
```

> After first deploying this, run the dry-run once and sanity-check that it
> only flags genuinely unused files before letting a scheduled run delete.

---

## 6. Switching to the real client database (checklist)

When moving off the testing phase:

1. Get the new Neon connection string from the client's Neon console.
2. Update `DATABASE_URL` in `.env.local`.
3. Run `npx drizzle-kit push` — creates all six tables on the fresh DB.
4. Run `npm run test:ratelimit` to confirm the DB works end-to-end.
5. Update `DATABASE_URL` (and any other changed vars) in Vercel's environment
   variables.
6. Redeploy so the functions pick up the new values.
7. Log into the CMS and re-create content/users on the new DB (data does NOT
   migrate automatically — export/import separately if the old data is needed).

> **IMPORTANT (first login on a fresh database):** the first account that
> signs in and exchanges a session becomes `super_admin`; everyone after is
> `pending`. On a brand-new DB, make sure **you** are the first person to log
> in, then promote staff from Accounts. Anyone who logs in before you will
> still be `pending`, but don't leave the window open unnecessarily.

---

## 7. Security notes

- Auth: HMAC-signed bearer tokens (`api/_lib/auth.ts`) checked against live
  Neon sessions; roles enforced per endpoint (`staff` vs `super_admin`).
- Rate limiting: Postgres-backed atomic upsert (`rate_limits` table),
  shared across all serverless instances. IP comes from the right-most
  `x-forwarded-for` entry set by Vercel's edge. Per-link PIN lockout:
  10 wrong unlocks on a catalog link blocks it for 15 minutes
  (`catalog-fail:<uid>` rows in the same table).
- Known remaining hardening items: add a Content-Security-Policy and HSTS
  header in `vercel.json`; consider shortening catalog grant token TTL;
  gate first-user bootstrap behind an `ADMIN_EMAILS` allowlist.
