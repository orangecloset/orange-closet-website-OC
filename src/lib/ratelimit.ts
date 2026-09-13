import { sql } from "drizzle-orm";
import { getDb } from "./db.js";
import type { Env } from "../env.js";

type Options = { key: string; limit: number; windowMs: number };

function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf;
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? "unknown";
  }
  return "unknown";
}

export async function rateLimit(
  env: Env,
  headers: Headers,
  options: Options
): Promise<{ allowed: boolean; retryAfter?: number; headers?: Record<string, string> }> {
  if (!env.DATABASE_URL) return { allowed: true };

  const bucketKey = `${options.key}:${clientIp(headers)}`;
  try {
    const result = await getDb(env).execute(sql`
      insert into rate_limits (key, count, reset_at)
      values (${bucketKey}, 1, now() + make_interval(secs => ${options.windowMs / 1000}))
      on conflict (key) do update set
        count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now()
          then now() + make_interval(secs => ${options.windowMs / 1000})
          else rate_limits.reset_at end
      returning count, reset_at
    `);

    const row = result.rows[0] as { count: number; reset_at: string } | undefined;
    const count = Number(row?.count ?? 1);

    if (count > options.limit) {
      const resetMs = row ? new Date(row.reset_at).getTime() : Date.now();
      const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
      return { allowed: false, retryAfter, headers: { "Retry-After": String(retryAfter) } };
    }

    if (Math.random() < 0.05) {
      await getDb(env).execute(sql`delete from rate_limits where reset_at < now()`);
    }

    return { allowed: true };
  } catch (err) {
    console.error("[ratelimit]", err);
    return { allowed: true };
  }
}
