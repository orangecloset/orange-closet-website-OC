import crypto from "crypto";
import type { VercelRequest } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { dbAvailable } from "./users.js";
import { getAuthUser } from "./auth.js";
import { getDb, schema } from "./db.js";

export type CatalogAccess = { uid: string | "*"; via: "cms" | "grant" | "share" };

function tokenSecret(): string {
  return process.env.CMS_API_SECRET ?? "";
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, expectedHex] = parts;
  const actual = crypto.scryptSync(pin, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

const PIN_ENC_PREFIX = "orange-closet:pin-enc:v1";

// AES-256-GCM key derived from CMS_API_SECRET (which the CMS auth already
// requires, so no extra env var is needed). The prefix keeps the key domain-
// separated from the HMAC usage of the same secret.
function pinEncryptionKey(): Buffer {
  const secret = process.env.CMS_API_SECRET ?? "";
  if (!secret) throw new Error("CMS_API_SECRET is not set");
  return crypto
    .createHash("sha256")
    .update(PIN_ENC_PREFIX)
    .update(":")
    .update(secret)
    .digest();
}

export function encryptPin(pin: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", pinEncryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `aesgcm:v1:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function decryptPin(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== "aesgcm" || parts[1] !== "v1") return null;
  const [, , ivHex, tagHex, ctHex] = parts;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      pinEncryptionKey(),
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

const PIN_FAIL_LIMIT = 10;
const PIN_LOCK_WINDOW_SECS = 15 * 60;

function pinFailKey(uid: string): string {
  return `catalog-fail:${uid}`;
}

export async function pinLockRemainingSecs(uid: string): Promise<number | null> {
  try {
    const result = await getDb().execute(sql`
      select reset_at from rate_limits
      where key = ${pinFailKey(uid)}
        and count >= ${PIN_FAIL_LIMIT}
        and reset_at > now()
      limit 1
    `);
    const row = result.rows[0] as { reset_at: string | Date } | undefined;
    if (!row) return null;
    const resetMs = new Date(row.reset_at).getTime();
    return Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
  } catch {
    return null;
  }
}

export async function recordPinFailure(uid: string): Promise<void> {
  try {
    await getDb().execute(sql`
      insert into rate_limits (key, count, reset_at)
      values (${pinFailKey(uid)}, 1, now() + make_interval(secs => ${PIN_LOCK_WINDOW_SECS}))
      on conflict (key) do update set
        count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now()
          then now() + make_interval(secs => ${PIN_LOCK_WINDOW_SECS})
          else rate_limits.reset_at end
    `);
  } catch {
    // fail open: never block unlock because failure tracking broke
  }
}

export async function clearPinFailures(uid: string): Promise<void> {
  try {
    await getDb().execute(
      sql`delete from rate_limits where key = ${pinFailKey(uid)}`
    );
  } catch {
    /* ignore */
  }
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", tokenSecret()).update(payload).digest("hex");
}

export function signCatalogToken(kind: "grant" | "share", uid: string, ttlMs: number): string {
  const expiresAt = Date.now() + ttlMs;
  const payload = `${uid}.${expiresAt}`;
  return `${kind}.${payload}.${sign(`${kind}.${payload}`)}`;
}

export function verifyCatalogToken(
  kind: "grant" | "share",
  token: string
): { uid: string } | null {
  const secret = tokenSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [tokenKind, uid, expiresAt, signature] = parts;
  if (tokenKind !== kind || !uid || !expiresAt || Number(expiresAt) < Date.now()) return null;
  const expected = sign(`${kind}.${uid}.${expiresAt}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { uid };
}

async function isLinkActive(uid: string): Promise<boolean> {
  try {
    const [row] = await getDb()
      .select({ active: schema.catalogLinks.active })
      .from(schema.catalogLinks)
      .where(eq(schema.catalogLinks.uid, uid));
    return Boolean(row?.active);
  } catch {
    return false;
  }
}

function catalogHeader(req: VercelRequest): string | null {
  const header = req.headers["x-catalog-token"];
  if (typeof header === "string" && header.length > 0) return header;
  return null;
}

async function cmsAuthed(req: VercelRequest): Promise<boolean> {
  return (await getAuthUser(req)) !== null;
}

export async function getCatalogAccess(req: VercelRequest): Promise<CatalogAccess | null> {
  if (!dbAvailable()) return null;

  if (await cmsAuthed(req)) return { uid: "*", via: "cms" };

  const token = catalogHeader(req);
  if (!token) return null;

  const grant = verifyCatalogToken("grant", token);
  if (grant && (await isLinkActive(grant.uid))) return { uid: grant.uid, via: "grant" };

  const share = verifyCatalogToken("share", token);
  if (share && (await isLinkActive(share.uid))) return { uid: share.uid, via: "share" };

  return null;
}
