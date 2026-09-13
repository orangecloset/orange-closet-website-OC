import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "drizzle-orm";
import { json } from "./http.js";
import { getDb } from "./db.js";

type Options = { key: string; limit: number; windowMs: number };

function clientIp(req: VercelRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? "unknown";
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export async function rateLimit(
  req: VercelRequest,
  res: VercelResponse,
  options: Options
): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;

  const bucketKey = `${options.key}:${clientIp(req)}`;
  try {
    const result = await getDb().execute(sql`
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
      res.setHeader("Retry-After", String(retryAfter));
      json(res, 429, { error: "Too many requests. Please try again later." });
      return false;
    }

    if (Math.random() < 0.05) {
      await getDb().execute(sql`delete from rate_limits where reset_at < now()`);
    }

    return true;
  } catch (err) {
    console.error("[ratelimit]", err);
    return false;
  }
}
