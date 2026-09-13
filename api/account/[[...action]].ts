import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../_lib/db.js";
import {
  badRequest,
  json,
  methodNotAllowed,
  notFound,
  serverError,
  unauthorized,
} from "../_lib/http.js";
import { rateLimit } from "../_lib/ratelimit.js";
import { getAuthUser } from "../_lib/auth.js";

function getPathSegments(req: VercelRequest): string[] {
  const pathname = (req.url ?? "").split("?")[0];
  const parts = pathname.split("/").map(decodeURIComponent).filter(Boolean);
  const idx = parts.indexOf("account");
  if (idx >= 0) return parts.slice(idx + 1);
  return parts;
}

// GET /api/account/status — public branding + initialized flag
async function status(req: VercelRequest, res: VercelResponse) {
  if (!await rateLimit(req, res, { key: "status", limit: 30, windowMs: 60_000 })) return;

  try {
    const db = getDb();
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
      storeName: str("storeName", "Orange Closet"),
      tagline: str("tagline"),
      conciergeHeading: str("conciergeHeading"),
      conciergeText: str("conciergeText"),
      messageButtonLabel: str("messageButtonLabel"),
      messengerUrl: str("messengerUrl"),
      locationText: str("locationText"),
      locationUrl: str("locationUrl"),
      copyrightText: str("copyrightText"),
    };
    return json(res, 200, { initialized: count > 0, faviconUrl, branding });
  } catch (err) {
    return serverError(res, err);
  }
}

// POST /api/account/session — exchange a Neon Auth session token for an app token
async function session(req: VercelRequest, res: VercelResponse) {
  if (!await rateLimit(req, res, { key: "session", limit: 10, windowMs: 60_000 })) return;

  const body = req.body as { token?: string };
  if (!body?.token) return badRequest(res, "Missing session token");

  try {
    const db = getDb();

    const verified = await db.execute<{ userId: string; sessionId: string; email: string; name: string | null }>(sql`
      select s."userId", s.id as "sessionId", u.email, u.name
      from neon_auth.session s
      join neon_auth.user u on u.id = s."userId"
      where s.token = ${body.token} and s."expiresAt" > now()
      limit 1
    `);
    const sessionRow = verified.rows[0];
    if (!sessionRow?.email || !sessionRow?.sessionId) {
      return json(res, 401, { error: "Session verification failed.", code: "AUTH_04" });
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

    const secret = process.env.CMS_API_SECRET;
    if (!secret) return serverError(res, new Error("CMS_API_SECRET is not configured"));

    const expiresAt = Date.now() + 12 * 60 * 60 * 1000;
    const payload = `${row.id}.${authSessionId}.${expiresAt}`;
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return json(res, 200, {
      appToken: `${payload}.${signature}`,
      role: row.role,
      user: { id: row.id, email: row.email, name: row.name, role: row.role },
    });
  } catch (err) {
    return serverError(res, err);
  }
}

// PATCH /api/account/profile — update own name/email
async function profile(req: VercelRequest, res: VercelResponse) {
  if (!await rateLimit(req, res, { key: "profile", limit: 10, windowMs: 60_000 })) return;

  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized(res);

  try {
    const body = req.body as { name?: string; email?: string };
    const updates: Record<string, string> = {};
    if (typeof body?.name === "string" && body.name.trim()) {
      updates.name = body.name.trim();
    }
    if (typeof body?.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!/.+@.+\..+/.test(email)) return badRequest(res, "A valid email is required");
      updates.email = email;
    }
    if (Object.keys(updates).length === 0) return badRequest(res, "Nothing to update");

    await getDb()
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, authUser.id));
    return json(res, 200, { ok: true });
  } catch (err) {
    return serverError(res, err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = getPathSegments(req);

  try {
    if (path[0] === "status") {
      if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
      return await status(req, res);
    }

    if (path[0] === "session") {
      if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
      return await session(req, res);
    }

    if (path[0] === "profile") {
      if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);
      return await profile(req, res);
    }

    if (path.length > 0) return notFound(res, "Unknown account endpoint");
    return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
  } catch (err) {
    return serverError(res, err);
  }
}
