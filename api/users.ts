import type { VercelRequest, VercelResponse } from "@vercel/node";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, serverError, unauthorized } from "./_lib/http.js";
import { isSuperAdmin, getAuthUser } from "./_lib/auth.js";
import { rateLimit } from "./_lib/ratelimit.js";

async function createAccount(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { name?: string; email?: string; password?: string };
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  const name = body?.name?.trim() || email?.split("@")[0] || "";
  if (!email || !/.+@.+\..+/.test(email)) return badRequest(res, "A valid email is required");
  if (password.length < 8) return badRequest(res, "Password must be at least 8 characters");

  const authBase = process.env.VITE_NEON_AUTH_URL ?? process.env.NEON_AUTH_BASE_URL;
  if (!authBase) return serverError(res, new Error("Neon Auth URL is not configured"));

  const origin = req.headers.origin ?? "https://orange-closet.local";
  const upstream = await fetch(`${authBase}/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password, name }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[api] neon auth sign-up failed:", upstream.status, detail);
    if (detail.includes("USER_ALREADY_EXISTS") || detail.toLowerCase().includes("already")) {
      return json(res, 409, { error: "An account with this email already exists." });
    }
    return json(res, 502, { error: "Could not create the account. Please try again." });
  }

  const created = (await upstream.json().catch(() => null)) as { user?: { id?: string } } | null;
  const userId = created?.user?.id;
  if (!userId) return json(res, 502, { error: "Account service returned an unexpected response." });

  const db = getDb();
  await db
    .insert(schema.users)
    .values({ id: userId, email, name, role: "staff" })
    .onConflictDoUpdate({ target: schema.users.id, set: { email, name, role: "staff" } });

  return json(res, 200, { ok: true, user: { id: userId, email, name, role: "staff" } });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    if (!await rateLimit(req, res, { key: "user-create", limit: 5, windowMs: 60_000 })) return;
    const adminId = await isSuperAdmin(req);
    if (!adminId) return unauthorized(res);
    try {
      return await createAccount(req, res);
    } catch (err) {
      return serverError(res, err);
    }
  }

  if (req.method !== "GET") return methodNotAllowed(res, ["GET", "POST"]);

  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized(res);

  try {
    const db = getDb();
    const baseSelection = {
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    };
    const rows =
      authUser.role === "super_admin"
        ? await db.select(baseSelection).from(schema.users).orderBy(asc(schema.users.createdAt))
        : await db
            .select(baseSelection)
            .from(schema.users)
            .where(eq(schema.users.id, authUser.id));
    return json(
      res,
      200,
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    );
  } catch (err) {
    return serverError(res, err);
  }
}
