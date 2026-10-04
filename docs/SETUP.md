# Setup & Deployment Guide 

Everything needed to get this project running locally, and to switch to a new
production database without forgetting a step.

---

## 1. Prerequisites

- Node.js 22+
- A [Neon](https://neon.tech) Postgres database
- A [Cloudinary](https://cloudinary.com) account (product image uploads)
- A [Cloudflare](https://dash.cloudflare.com) account (Workers hosting the
  site + API) and the Wrangler CLI (`npx wrangler`, no global install needed)

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in every value:

```
cp .env.example .env.local
```

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Worker only | Neon connection string. **Never** prefix with `VITE_`. |
| `CMS_API_SECRET` | Worker only | HMAC secret for admin tokens & catalog tokens. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `CLOUDINARY_CLOUD_NAME` | Worker only | From Cloudinary dashboard home |
| `CLOUDINARY_API_KEY` | Worker only | Cloudinary Settings > Access Keys |
| `CLOUDINARY_API_SECRET` | Worker only | Same page. Keep server-side. |
| `CRON_SECRET` | Worker only | Bearer token for manually hitting the Cloudinary cleanup endpoint (`/api/cron/cloudinary-gc`). The scheduled Monday run calls `runCloudinaryGC()` directly and does **not** need it. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `VITE_NEON_AUTH_URL` | Client bundle | Neon Auth base URL. Public by design. |
| `VITE_CLOUDINARY_CLOUD_NAME` | Client bundle | Cloud name is public; secrets are not. |

Rules:

- Anything with `VITE_` gets bundled into the browser — **no secrets there, ever**.
- `.env.local` is gitignored. Locally, `wrangler dev` reads it automatically
  (it prints `Using secrets defined in .env.local`). For the deployed Worker
  you must set the same values explicitly — see section 5.

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

Tables managed this way: `products`, `sales`, `stock_movements`, `settings`,
`catalog_links`, `users`, `rate_limits`.

Note: the API **fails open** if `rate_limits` is missing — nothing crashes,
but rate limiting silently stops being enforced. If you see a fresh database,
run push first.

---

## 4. Local development

```
npm install          # install dependencies
npx drizzle-kit push # create/sync tables on the DB from step 3
```

Two ways to run:

```
npm run dev        # Vite dev server (frontend only, hot reload)
npm run dev:worker # the Worker: API + built dist/ on http://127.0.0.1:8787
```

`npm run dev` serves only the frontend — `vite.config.ts` has no `/api` proxy,
so requests to `/api/*` never reach the Worker. For a full local app use:

```
npm run build && npm run dev:worker
```

Wrangler serves `dist/` as-is (no watch on Vite's output), so run the build
again after frontend edits. It also auto-loads every value from `.env.local`
as a local binding — prints `Using secrets defined in .env.local` — so no
secrets need configuring for local work.

Other commands:

```
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run build           # production build -> dist/
npm run deploy          # wrangler deploy (Worker + dist/ assets)
npm run test:ratelimit  # integration test for the rate limiter (hits real DB)
```

The API lives in `src/routes/*`, mounted by the Hono app in `src/index.ts`,
and runs inside the Worker — there is no separate serverless folder.

To exercise the cron locally (scheduled events don't fire on their own in
`wrangler dev`):

```
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

---

## 5. Deploying to Cloudflare Workers

One `wrangler deploy` ships both the Worker code and the static site — the
`[assets]` block in `wrangler.toml` attaches `dist/` to the same Worker.

1. Push the repo to GitHub. CI (`.github/workflows/ci.yml`) runs typecheck +
   lint + build on every PR and push to `main`.
2. Run `npx drizzle-kit push` against the production `DATABASE_URL` once.
3. Set every server-side value as a Worker secret (one-time, or again whenever
   a value changes):

   ```
   npx wrangler secret put DATABASE_URL
   npx wrangler secret put CMS_API_SECRET
   npx wrangler secret put CRON_SECRET
   npx wrangler secret put CLOUDINARY_CLOUD_NAME
   npx wrangler secret put CLOUDINARY_API_KEY
   npx wrangler secret put CLOUDINARY_API_SECRET
   npx wrangler secret put VITE_CLOUDINARY_CLOUD_NAME
   npx wrangler secret put VITE_NEON_AUTH_URL
   ```

   Confirm with `npx wrangler secret list`. `VITE_*` secrets are read by the
   Worker at runtime (e.g. `src/routes/upload.ts`); the browser copy still
   comes from `.env.local` at `npm run build` time.
4. Build, then deploy:

   ```
   npm run build
   npm run deploy
   ```

   `npm run deploy` is just `wrangler deploy`, which uploads `dist/` —
   skipping the build ships a stale site.
5. The cron trigger ships with the deploy (`crons = ["0 3 * * 1"]` in
   `wrangler.toml`). Confirm it under Workers > `orange` > Triggers.

### Pre-deploy checklist

- [ ] `npx wrangler secret list` shows every value from section 2
- [ ] `CRON_SECRET` set (only needed for manually hitting the GC endpoint)
- [ ] `npx drizzle-kit push` run against the target database
- [ ] `CMS_API_SECRET` regenerated for production (don't reuse the test value)
- [ ] `npm run typecheck && npm run lint && npm run build` pass locally
- [ ] `npm run build` run immediately before `npm run deploy`
- [ ] `npm run test:ratelimit` passes against the target database

---

## 5.1 Cloudinary cleanup cron (weekly garbage collector)

`src/routes/cron.ts` deletes orphaned images from Cloudinary so the
account doesn't fill with files that are no longer used by the CMS. It runs
from the Worker's `scheduled` handler in `src/index.ts`.

How it works:

1. Lists every asset under the Cloudinary `orange-closet/` folder. The
   prefix also matches subfolders, so `orange-closet/hero/` and
   `orange-closet/settings/` are covered automatically.
2. Scans the database — `products.colors`, `products.sections`, every
   settings key (favicon, social share image, homepage heroes, about page,
   category images) and `sales.productImage` / `sales.productSections` —
   and collects every referenced URL.
3. Deletes any asset that is **not referenced anywhere** — immediately, with
   no waiting period. The weekly schedule itself is the only buffer, so an
   image uploaded but not yet saved to the database can be removed if a run
   happens first.

Schedule: Mondays 03:00 UTC via the Cloudflare Worker cron trigger —
`crons = ["0 3 * * 1"]` in `wrangler.toml`. The `scheduled` handler calls
`runCloudinaryGC()` directly and needs no secret header. The HTTP endpoint
below still requires `CRON_SECRET` (`wrangler secret put CRON_SECRET`) and
returns 401 without it.

Manual runs:

```
# Preview only — shows what would be deleted, deletes nothing:
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-worker>.workers.dev/api/cron/cloudinary-gc?dry=1

# Actually delete orphans:
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://<your-worker>.workers.dev/api/cron/cloudinary-gc

# Local only — fire the scheduled event without deploying:
curl "http://127.0.0.1:8787/cdn-cgi/local/scheduled"
```

> After first deploying this, run the dry-run once and sanity-check that it
> only flags genuinely unused files before letting a scheduled run delete.

---

## 6. Switching to the real client database (checklist)

When moving off the testing phase:

1. Get the new Neon connection string from the client's Neon console.
2. Update `DATABASE_URL` in `.env.local`.
3. Run `npx drizzle-kit push` — creates all seven tables on the fresh DB.
4. Run `npm run test:ratelimit` to confirm the DB works end-to-end.
5. Update the Worker secret: `npx wrangler secret put DATABASE_URL` (and any
   other changed values).
6. `npm run build && npm run deploy` so the Worker and site pick up the new
   values.
7. Log into the CMS and re-create content/users on the new DB (data does NOT
   migrate automatically — export/import separately if the old data is needed).

> **IMPORTANT (first login on a fresh database):** the first account that
> signs in and exchanges a session becomes `super_admin`; everyone after is
> `pending`. On a brand-new DB, make sure **you** are the first person to log
> in, then promote staff from Accounts. Anyone who logs in before you will
> still be `pending`, but don't leave the window open unnecessarily.

---

## 7. Security notes

- Auth: HMAC-signed bearer tokens (`src/lib/auth.ts`) checked against live
  Neon sessions; roles enforced per endpoint (`staff` vs `super_admin`).
- Rate limiting: Postgres-backed atomic upsert (`rate_limits` table), shared
  across requests. IP comes from Cloudflare's `cf-connecting-ip` header,
  falling back to the right-most `x-forwarded-for` entry. Per-link PIN
  lockout: 10 wrong unlocks on a catalog link blocks it for 15 minutes
  (`catalog-fail:<uid>` rows in the same table).
- Security headers (HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) are applied in `src/index.ts`.
- Known remaining hardening items: add a Content-Security-Policy header;
  consider shortening catalog grant token TTL; gate first-user bootstrap
  behind an `ADMIN_EMAILS` allowlist.
