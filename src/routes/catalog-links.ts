import { Hono } from "hono";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { isAuthorized } from "../lib/auth.js";
import {
  decryptPin,
  encryptPin,
  hashPin,
  getCatalogAccess,
  signCatalogToken,
  verifyCatalogToken,
  pinLockRemainingSecs,
  recordPinFailure,
  clearPinFailures,
  verifyPin,
} from "../lib/catalog.js";
import { rateLimit } from "../lib/ratelimit.js";
import type { Env } from "../env.js";

const GRANT_TTL_MS = 182 * 24 * 60 * 60 * 1000;
const SHARE_TTL_MS = 2 * 60 * 60 * 1000;

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);
  const rows = await db
    .select({
      uid: schema.catalogLinks.uid,
      active: schema.catalogLinks.active,
      createdAt: schema.catalogLinks.createdAt,
      pinEnc: schema.catalogLinks.pinEnc,
    })
    .from(schema.catalogLinks)
    .orderBy(desc(schema.catalogLinks.createdAt));
  return c.json(
    rows.map((r) => ({
      uid: r.uid,
      active: r.active,
      createdAt: r.createdAt.toISOString(),
      pin: decryptPin(c.env, r.pinEnc),
    }))
  );
});

app.post("/", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const body = await c.req.json<{
    uid?: string;
    pin?: string;
    active?: boolean;
    createdAt?: string;
  }>();
  if (!body?.uid || !body?.pin || typeof body.pin !== "string") {
    return c.json({ error: "Missing uid or pin" }, 400);
  }
  const db = getDb(c.env);
  await db.insert(schema.catalogLinks).values({
    uid: body.uid,
    pin: hashPin(body.pin),
    pinEnc: encryptPin(c.env, body.pin),
    active: body.active ?? true,
    ...(body.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
  });
  return c.json({ ok: true }, 201);
});

app.post("/unlock", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "catalog-unlock",
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const body = await c.req.json<{ uid?: string; pin?: string }>();
  if (!body?.uid || !body?.pin) return c.json({ error: "Missing link or PIN" }, 400);

  const db = getDb(c.env);
  const [link] = await db
    .select()
    .from(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, body.uid));
  if (!link || !link.active) {
    return c.json({ error: "This link is no longer active.", code: "LINK_REVOKED" }, 403);
  }

  const lockedForSecs = await pinLockRemainingSecs(c.env, body.uid);
  if (lockedForSecs !== null) {
    return c.json(
      {
        error: `Too many incorrect attempts. Try again in ${Math.ceil(lockedForSecs / 60)} minute(s).`,
        code: "PIN_LOCKED",
      },
      429,
      { "Retry-After": String(lockedForSecs) }
    );
  }

  if (!verifyPin(body.pin, link.pin)) {
    await recordPinFailure(c.env, body.uid);
    return c.json({ error: "Incorrect PIN.", code: "BAD_PIN" }, 401);
  }
  await clearPinFailures(c.env, body.uid);

  const token = signCatalogToken(c.env, "grant", body.uid, GRANT_TTL_MS);
  return c.json({ ok: true, token });
});

app.post("/share", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "catalog-share",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const catalogToken = c.req.header("x-catalog-token");
  const access = await getCatalogAccess(c.env, c.req.header("authorization"), catalogToken);
  if (!access || access.via === "share") return c.json({ error: "Unauthorized" }, 401);

  const db = getDb(c.env);
  let uid: string;
  if (access.via === "cms") {
    const body = await c.req.json<{ uid?: string }>();
    if (!body?.uid) return c.json({ error: "Missing link uid" }, 400);
    uid = body.uid;
  } else {
    uid = access.uid;
  }

  const [link] = await db
    .select({ active: schema.catalogLinks.active })
    .from(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, uid));
  if (!link?.active) {
    return c.json({ error: "This catalog link is no longer active." }, 403);
  }

  const token = signCatalogToken(c.env, "share", uid, SHARE_TTL_MS);
  return c.json({ ok: true, token, expiresInMs: SHARE_TTL_MS });
});

app.get("/verify", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "catalog-verify",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const token = c.req.query("t");
  if (typeof token !== "string" || !token) {
    return c.json({ valid: false, reason: "missing" }, 400);
  }

  const shareToken = verifyCatalogToken(c.env, "share", token);
  if (!shareToken) {
    return c.json({ valid: false, reason: "expired" });
  }
  const [link] = await getDb(c.env)
    .select({ active: schema.catalogLinks.active })
    .from(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, shareToken.uid));
  if (!link?.active) {
    return c.json({ valid: false, reason: "revoked" });
  }
  return c.json({ valid: true, uid: shareToken.uid });
});

app.patch("/:uid", async (c) => {
  const uid = c.req.param("uid");
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ active?: boolean }>();
  if (typeof body?.active !== "boolean") return c.json({ error: "Missing active flag" }, 400);

  const updated = await getDb(c.env)
    .update(schema.catalogLinks)
    .set({ active: body.active })
    .where(eq(schema.catalogLinks.uid, uid))
    .returning({ uid: schema.catalogLinks.uid });
  if (updated.length === 0) return c.json({ error: "Link not found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:uid", async (c) => {
  const uid = c.req.param("uid");
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const deleted = await getDb(c.env)
    .delete(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, uid))
    .returning({ uid: schema.catalogLinks.uid });
  if (deleted.length === 0) return c.json({ error: "Link not found" }, 404);
  return c.json({ ok: true });
});

export default app;
