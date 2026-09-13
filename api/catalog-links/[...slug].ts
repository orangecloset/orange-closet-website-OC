import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../_lib/db.js";
import {
  badRequest,
  json,
  methodNotAllowed,
  notFound,
  serverError,
  unauthorized,
} from "../_lib/http.js";
import { isAuthorized } from "../_lib/auth.js";
import {
  clearPinFailures,
  getCatalogAccess,
  pinLockRemainingSecs,
  signCatalogToken,
  verifyCatalogToken,
  recordPinFailure,
  verifyPin,
} from "../_lib/catalog.js";
import { rateLimit } from "../_lib/ratelimit.js";

const GRANT_TTL_MS = 182 * 24 * 60 * 60 * 1000;
const SHARE_TTL_MS = 2 * 60 * 60 * 1000;

async function unlock(req: VercelRequest, res: VercelResponse) {
  if (!await rateLimit(req, res, { key: "catalog-unlock", limit: 5, windowMs: 60_000 })) return;

  const body = req.body as { uid?: string; pin?: string };
  if (!body?.uid || !body?.pin) return badRequest(res, "Missing link or PIN");

  const db = getDb();
  const [link] = await db
    .select()
    .from(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, body.uid));
  if (!link || !link.active) {
    return json(res, 403, { error: "This link is no longer active.", code: "LINK_REVOKED" });
  }

  const lockedForSecs = await pinLockRemainingSecs(body.uid);
  if (lockedForSecs !== null) {
    res.setHeader("Retry-After", String(lockedForSecs));
    return json(res, 429, {
      error: `Too many incorrect attempts. Try again in ${Math.ceil(lockedForSecs / 60)} minute(s).`,
      code: "PIN_LOCKED",
    });
  }

  if (!verifyPin(body.pin, link.pin)) {
    await recordPinFailure(body.uid);
    return json(res, 401, { error: "Incorrect PIN.", code: "BAD_PIN" });
  }
  await clearPinFailures(body.uid);

  const token = signCatalogToken("grant", body.uid, GRANT_TTL_MS);
  return json(res, 200, { ok: true, token });
}

async function share(req: VercelRequest, res: VercelResponse) {
  if (!await rateLimit(req, res, { key: "catalog-share", limit: 20, windowMs: 60_000 })) return;

  const access = await getCatalogAccess(req);
  if (!access || access.via === "share") return unauthorized(res);

  const db = getDb();
  let uid: string;
  if (access.via === "cms") {
    const body = req.body as { uid?: string };
    if (!body?.uid) return badRequest(res, "Missing link uid");
    uid = body.uid;
  } else {
    uid = access.uid;
  }

  const [link] = await db
    .select({ active: schema.catalogLinks.active })
    .from(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, uid));
  if (!link?.active) {
    return json(res, 403, { error: "This catalog link is no longer active." });
  }

  const token = signCatalogToken("share", uid, SHARE_TTL_MS);
  return json(res, 200, { ok: true, token, expiresInMs: SHARE_TTL_MS });
}

async function verify(req: VercelRequest, res: VercelResponse) {
  if (!await rateLimit(req, res, { key: "catalog-verify", limit: 30, windowMs: 60_000 })) return;

  const token = req.query.t;
  if (typeof token !== "string" || !token) {
    return json(res, 400, { valid: false, reason: "missing" });
  }

  const shareToken = verifyCatalogToken("share", token);
  if (!shareToken) {
    return json(res, 200, { valid: false, reason: "expired" });
  }
  const [link] = await getDb()
    .select({ active: schema.catalogLinks.active })
    .from(schema.catalogLinks)
    .where(eq(schema.catalogLinks.uid, shareToken.uid));
  if (!link?.active) {
    return json(res, 200, { valid: false, reason: "revoked" });
  }
  return json(res, 200, { valid: true, uid: shareToken.uid });
}

async function manageLink(
  req: VercelRequest,
  res: VercelResponse,
  uid: string
) {
  if (!(await isAuthorized(req))) return unauthorized(res);

  if (req.method === "PATCH") {
    const body = req.body as { active?: boolean };
    if (typeof body?.active !== "boolean") return badRequest(res, "Missing active flag");
    const updated = await getDb()
      .update(schema.catalogLinks)
      .set({ active: body.active })
      .where(eq(schema.catalogLinks.uid, uid))
      .returning({ uid: schema.catalogLinks.uid });
    if (updated.length === 0) return notFound(res, "Link not found");
    return json(res, 200, { ok: true });
  }

  if (req.method === "DELETE") {
    const deleted = await getDb()
      .delete(schema.catalogLinks)
      .where(eq(schema.catalogLinks.uid, uid))
      .returning({ uid: schema.catalogLinks.uid });
    if (deleted.length === 0) return notFound(res, "Link not found");
    return json(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ["PATCH", "DELETE"]);
}

function getPathSegments(req: VercelRequest): string[] {
  const pathname = (req.url ?? "").split("?")[0];
  const parts = pathname.split("/").map(decodeURIComponent).filter(Boolean);
  const idx = parts.indexOf("catalog-links");
  if (idx >= 0) return parts.slice(idx + 1);
  return parts;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const fromUrl = getPathSegments(req);
    const slug = req.query.slug;
    const fromQuery = Array.isArray(slug)
      ? slug
      : typeof slug === "string"
        ? [slug]
        : [];
    const path = fromUrl.length > 0 ? fromUrl : fromQuery;

    if (path.length === 1 && path[0] === "unlock") {
      if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
      return await unlock(req, res);
    }

    if (path.length === 1 && path[0] === "share") {
      if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
      return await share(req, res);
    }

    if (path.length === 1 && path[0] === "verify") {
      if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
      return await verify(req, res);
    }

    if (path.length >= 1) {
      return await manageLink(req, res, path[path.length - 1]);
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (err) {
    return serverError(res, err);
  }
}
