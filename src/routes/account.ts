import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { getAuthUser } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import { hmacSha256Hex } from "../lib/crypto.js";
import type { Env } from "../env.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/status", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "status",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  try {
    const db = getDb(c.env);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users);
    const [settingsRow] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "orange-cms-settings"));
    const settings = settingsRow?.value as Record<string, unknown> | null | undefined;
    const str = (key: string, fallback = "") =>
      typeof settings?.[key] === "string" && (settings[key] as string).trim()
        ? (settings[key] as string).trim()
        : fallback;
    const faviconUrl = str("faviconUrl", "/favicon.png");
    const branding = {
      storeName: str("storeName", "Store"),
      tagline: str("tagline"),
      conciergeHeading: str("conciergeHeading"),
      conciergeText: str("conciergeText"),
      messageButtonLabel: str("messageButtonLabel"),
      messengerUrl: str("messengerUrl"),
      locationText: str("locationText"),
      locationUrl: str("locationUrl"),
      copyrightText: str("copyrightText"),
    };
    return c.json({ initialized: count > 0, faviconUrl, branding });
  } catch (err) {
    console.error("[api/account/status]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/session", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "session",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const body = await c.req.json<{ token?: string }>();
  if (!body?.token) return c.json({ error: "Missing session token" }, 400);

  try {
    const db = getDb(c.env);

    const verified = await db.execute<{ userId: string; sessionId: string; email: string; name: string | null }>(sql`
      select s."userId", s.id as "sessionId", u.email, u.name
      from neon_auth.session s
      join neon_auth.user u on u.id = s."userId"
      where s.token = ${body.token} and s."expiresAt" > now()
      limit 1
    `);
    const sessionRow = verified.rows[0];
    if (!sessionRow?.email || !sessionRow?.sessionId) {
      return c.json({ error: "Session verification failed.", code: "AUTH_04" }, 401);
    }
    const user = { id: sessionRow.userId, email: sessionRow.email, name: sessionRow.name };
    const authSessionId = sessionRow.sessionId;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.users);
    const isFirstUser = count === 0;

    await db
      .insert(schema.users)
      .values({
        id: user.id,
        email: user.email.toLowerCase(),
        name: user.name ?? user.email.split("@")[0] ?? "Staff",
        role: isFirstUser ? "super_admin" : "pending",
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          email: user.email.toLowerCase(),
          name: user.name ?? user.email.split("@")[0] ?? "Staff",
        },
      });

    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user.id));

    const secret = c.env.CMS_API_SECRET;
    if (!secret) return c.json({ error: "CMS_API_SECRET is not configured" }, 500);

    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const payload = `${row!.id}.${authSessionId}.${expiresAt}`;
    const signature = hmacSha256Hex(secret, payload);

    return c.json({
      appToken: `${payload}.${signature}`,
      role: row!.role,
      user: { id: row!.id, email: row!.email, name: row!.name, role: row!.role },
    });
  } catch (err) {
    console.error("[api/account/session]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.patch("/profile", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "profile",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json<{ name?: string; email?: string }>();
    const updates: Record<string, string> = {};
    if (typeof body?.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body?.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!/.+@.+\..+/.test(email)) return c.json({ error: "A valid email is required" }, 400);
      updates.email = email;
    }
    if (Object.keys(updates).length === 0) return c.json({ error: "Nothing to update" }, 400);

    await getDb(c.env)
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, authUser.id));
    return c.json({ ok: true });
  } catch (err) {
    console.error("[api/account/profile]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
