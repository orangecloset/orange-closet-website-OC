import { sql } from "drizzle-orm";
import { getDb } from "./db.js";
import { hmacSha256Hex, constantTimeEqual } from "./crypto.js";
import type { Env } from "../env.js";

function tokenSecret(env: Env): string | null {
  return env.CMS_API_SECRET ?? null;
}

function verifyAppToken(env: Env, token: string): { userId: string; sessionId: string } | null {
  const secret = tokenSecret(env);
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, sessionId, expiresAt, signature] = parts;
  if (!userId || !sessionId || !expiresAt || Number(expiresAt) < Date.now()) return null;
  const expected = hmacSha256Hex(secret, `${userId}.${sessionId}.${expiresAt}`);
  const a = new TextEncoder().encode(signature);
  const b = new TextEncoder().encode(expected);
  return constantTimeEqual(a, b) ? { userId, sessionId } : null;
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
  env: Env,
  userId: string,
  sessionId: string
): Promise<{ id: string; role: string } | null> {
  try {
    const result = await getDb(env).execute(sql`
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

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7) || null;
}

export async function getAuthUser(
  env: Env,
  authorization: string | undefined
): Promise<{ id: string; role: string } | null> {
  const token = bearerToken(authorization);
  if (!token) return null;
  const verified = verifyAppToken(env, token);
  if (!verified) return null;

  const cached = getCachedUser(token);
  if (cached) return { id: cached.id, role: cached.role };

  const user = await fetchAuthUser(env, verified.userId, verified.sessionId);
  if (!user) return null;
  setCachedUser(token, user);
  return user;
}

export async function isAuthorized(
  env: Env,
  authorization: string | undefined
): Promise<boolean> {
  return (await getAuthUser(env, authorization)) !== null;
}

export async function isSuperAdmin(
  env: Env,
  authorization: string | undefined
): Promise<string | null> {
  const user = await getAuthUser(env, authorization);
  return user?.role === "super_admin" ? user.id : null;
}
