import crypto from "crypto";
import type { VercelRequest } from "@vercel/node";
import { sql } from "drizzle-orm";
import { dbAvailable } from "./users.js";
import { getDb } from "./db.js";

function tokenSecret(): string | null {
  return process.env.CMS_API_SECRET ?? null;
}

function verifyAppToken(token: string): { userId: string; sessionId: string } | null {
  const secret = tokenSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionId, expiresAt, signature] = parts;
  if (!userId || !sessionId || !expiresAt || Number(expiresAt) < Date.now()) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${userId}.${sessionId}.${expiresAt}`)
    .digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? { userId, sessionId } : null;
}

const AUTH_CACHE_TTL_MS = 60_000;
type CachedUser = { id: string; role: string; expiresAt: number };
let authCache = new Map<string, CachedUser>();

function getCachedUser(token: string): CachedUser | null {
  const hit = authCache.get(token);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    authCache.delete(token);
    return null;
  }
  return hit;
}

function setCachedUser(token: string, user: { id: string; role: string }): void {
  if (authCache.size > 500) authCache = new Map();
  authCache.set(token, { ...user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

export function clearAuthCache(): void {
  authCache = new Map();
}

async function fetchAuthUser(
  userId: string,
  sessionId: string
): Promise<{ id: string; role: string } | null> {
  try {
    const result = await getDb().execute(sql`
      select u.role
      from neon_auth.session s
      join users u on u.id = ${userId}
      where s.id = ${sessionId} and s."expiresAt" > now() and u.role in ('super_admin', 'staff')
      limit 1
    `);
    const row = result.rows[0] as { role: string } | undefined;
    if (!row) return null;
    return { id: userId, role: row.role };
  } catch {
    return null;
  }
}

function bearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7) || null;
}

export async function getAuthUser(
  req: VercelRequest
): Promise<{ id: string; role: string } | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const verified = verifyAppToken(token);
  if (!verified || !dbAvailable()) return null;

  const cached = getCachedUser(token);
  if (cached) return { id: cached.id, role: cached.role };

  const user = await fetchAuthUser(verified.userId, verified.sessionId);
  if (!user) return null;
  setCachedUser(token, user);
  return user;
}

export async function isAuthorized(req: VercelRequest): Promise<boolean> {
  return (await getAuthUser(req)) !== null;
}

export async function isSuperAdmin(req: VercelRequest): Promise<string | null> {
  const user = await getAuthUser(req);
  return user?.role === "super_admin" ? user.id : null;
}
