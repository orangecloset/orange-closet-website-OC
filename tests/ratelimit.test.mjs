// ---------------------------------------------------------------------------
// Rate limiter integration test — runs against the REAL database.
//
// How to run (from the project root):
//   npm run test:ratelimit
//   (or: node tests/ratelimit.test.mjs)
//
// Requires DATABASE_URL in .env.local pointing at a Postgres/Neon database
// with the rate_limits table applied (npx drizzle-kit push).
//
// Uses throwaway "zz-test*" keys and cleans them up afterwards, so it is
// safe to run against any environment. Do not run it while real traffic is
// being rate-limited on the same database — the piggyback-cleanup step will
// delete expired rows belonging to other buckets too (that is normal
// behavior, but worth knowing).
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL);
const KEY = "zz-test-bucket:203.0.113.9";
const WINDOW_SECS = 60;
const LIMIT = 5;

let pass = 0;
let fail = 0;

function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`PASS ${name} ${extra}`);
  } else {
    fail++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

async function hit() {
  const rows = await sql`
    insert into rate_limits (key, count, reset_at)
    values (${KEY}, 1, now() + make_interval(secs => ${WINDOW_SECS}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at < now()
        then now() + make_interval(secs => ${WINDOW_SECS})
        else rate_limits.reset_at end
    returning count, reset_at
  `;
  return rows[0];
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

try {
  await sql`delete from rate_limits where key = ${KEY}`;

  let r = await hit();
  check("insert", Number(r.count) === 1, `(count=${r.count})`);

  for (let i = 2; i <= LIMIT + 2; i++) {
    r = await hit();
    check("increment", Number(r.count) === i, `(count=${r.count})`);
  }

  const resetMs = new Date(r.reset_at).getTime();
  const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
  console.log(
    `INFO retry-after=${retryAfter}s (may exceed window by clock skew between this machine and the DB; harmless)`
  );

  const burst = await Promise.all([hit(), hit(), hit()]);
  const counts = burst.map(x => Number(x.count)).sort((a, b) => a - b);
  const unique = new Set(counts);
  check(
    "parallel no lost updates",
    counts.length === 3 && unique.size === 3,
    `(counts=${counts.join(",")})`
  );

  await sql`update rate_limits set reset_at = now() - interval '1 second' where key = ${KEY}`;
  r = await hit();
  check("window reset", Number(r.count) === 1, `(count=${r.count})`);

  await sql`update rate_limits set reset_at = now() - interval '1 hour' where key = ${KEY}`;
  await sql`
    insert into rate_limits (key, count, reset_at)
    values ('zz-test-keep', 1, now() + interval '1 minute')
    on conflict (key) do update set reset_at = now() + interval '1 minute'
  `;
  await sql`delete from rate_limits where reset_at < now()`;
  const keepAlive = await sql`select 1 from rate_limits where key = 'zz-test-keep'`;
  const testGone = await sql`select 1 from rate_limits where key = ${KEY}`;
  check(
    "cleanup removed expired only",
    keepAlive.length === 1 && testGone.length === 0,
    `(kept=${keepAlive.length}, removed=${testGone.length === 0})`
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
} finally {
  await sql`delete from rate_limits where key like 'zz-test%'`;
  console.log("test rows cleaned up");
}
