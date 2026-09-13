import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { isAuthorized } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import { getCatalogAccess } from "../lib/catalog.js";
import type { Env } from "../env.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const catalogToken = c.req.header("x-catalog-token");
  if (!(await getCatalogAccess(c.env, c.req.header("authorization"), catalogToken))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const key = c.req.query("key");
  if (!key || typeof key !== "string") {
    const rows = await db.select().from(schema.settings);
    return c.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  }
  const [row] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key));
  return c.json(row?.value ?? null);
});

app.put("/", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "settings-update",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ key?: string; value?: unknown }>();
  if (!body?.key || typeof body.key !== "string") return c.json({ error: "Missing settings key" }, 400);

  const db = getDb(c.env);
  await db
    .insert(schema.settings)
    .values({ key: body.key, value: body.value ?? null })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: body.value ?? null, updatedAt: new Date() },
    });
  return c.json({ ok: true });
});

export default app;
