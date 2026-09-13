import { Hono } from "hono";
import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { getAuthUser, isSuperAdmin } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import type { Env } from "../env.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  try {
    const db = getDb(c.env);
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
    return c.json(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
    );
  } catch (err) {
    console.error("[api/users]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.post("/", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "user-create",
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  const adminId = await isSuperAdmin(c.env, c.req.header("authorization"));
  if (!adminId) return c.json({ error: "Unauthorized" }, 401);

  try {
    const body = await c.req.json<{ name?: string; email?: string; password?: string }>();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password ?? "";
    const name = body?.name?.trim() || email?.split("@")[0] || "";
    if (!email || !/.+@.+\..+/.test(email)) return c.json({ error: "A valid email is required" }, 400);
    if (password.length < 8) return c.json({ error: "Password must be at least 8 characters" }, 400);

    const authBase = c.env.VITE_NEON_AUTH_URL;
    if (!authBase) return c.json({ error: "Neon Auth URL is not configured" }, 500);

    const origin = c.req.header("origin") ?? "https://orange-closet.local";
    const upstream = await fetch(`${authBase}/sign-up/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ email, password, name }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[api] neon auth sign-up failed:", upstream.status, detail);
      if (detail.includes("USER_ALREADY_EXISTS") || detail.toLowerCase().includes("already")) {
        return c.json({ error: "An account with this email already exists." }, 409);
      }
      return c.json({ error: "Could not create the account. Please try again." }, 502);
    }

    const created = (await upstream.json().catch(() => null)) as { user?: { id?: string } } | null;
    const userId = created?.user?.id;
    if (!userId) return c.json({ error: "Account service returned an unexpected response." }, 502);

    const db = getDb(c.env);
    await db
      .insert(schema.users)
      .values({ id: userId, email, name, role: "staff" })
      .onConflictDoUpdate({ target: schema.users.id, set: { email, name, role: "staff" } });

    return c.json({ ok: true, user: { id: userId, email, name, role: "staff" } });
  } catch (err) {
    console.error("[api/users]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// /api/users/:id
app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing user id" }, 400);

  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const isAdmin = authUser.role === "super_admin";
  const isSelf = authUser.id === id;

  const SETTABLE_ROLES = new Set(["staff", "pending"]);

  try {
    const body = await c.req.json<{ role?: string; name?: string; email?: string }>();
    const wantsRole = typeof body?.role === "string";
    const wantsName = typeof body?.name === "string" && body.name.trim().length > 0;
    const wantsEmail = typeof body?.email === "string" && body.email.trim().length > 0;
    if (!wantsRole && !wantsName && !wantsEmail) {
      return c.json({ error: "Nothing to update" }, 400);
    }

    if (wantsRole) {
      if (!isAdmin) return c.json({ error: "Unauthorized" }, 401);
      if (!SETTABLE_ROLES.has(body.role!)) return c.json({ error: "Invalid role" }, 400);
      if (isSelf) return c.json({ error: "You cannot change your own role." }, 400);
    }

    if ((wantsName || wantsEmail) && !isAdmin && !isSelf) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (wantsEmail) {
      const email = body.email!.trim().toLowerCase();
      if (!/.+@.+\..+/.test(email)) return c.json({ error: "A valid email is required" }, 400);
    }
    if ((wantsName || wantsEmail) && !isSelf) {
      const db = getDb(c.env);
      const [target] = await db
        .select({ role: schema.users.role })
        .from(schema.users)
        .where(eq(schema.users.id, id));
      if (!target) return c.json({ error: "User not found" }, 404);
      if (target.role === "super_admin") {
        return c.json({ error: "Super admins cannot be modified here." }, 400);
      }
    }

    const db = getDb(c.env);
    if (wantsRole) {
      await db.update(schema.users).set({ role: body.role }).where(eq(schema.users.id, id));
    }
    if (wantsName || wantsEmail) {
      const profileUpdates: Record<string, string> = {};
      if (wantsName) profileUpdates.name = body.name!.trim();
      if (wantsEmail) profileUpdates.email = body.email!.trim().toLowerCase();
      await db.update(schema.users).set(profileUpdates).where(eq(schema.users.id, id));

      const name = wantsName ? body.name!.trim() : null;
      const email = wantsEmail ? body.email!.trim().toLowerCase() : null;
      await db.execute(sql`
        update neon_auth."user"
        set
          name = coalesce(${name}, name),
          email = coalesce(${email}, email)
        where id = ${id}
      `);
    }

    return c.json({ ok: true });
  } catch (err) {
    console.error("[api/users/:id]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing user id" }, 400);

  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const isAdmin = authUser.role === "super_admin";
  if (!isAdmin) return c.json({ error: "Unauthorized" }, 401);
  if (authUser.id === id) {
    return c.json({ error: "You cannot delete your own account." }, 400);
  }

  try {
    const db = getDb(c.env);
    const deleted = await db
      .delete(schema.users)
      .where(eq(schema.users.id, id))
      .returning({ role: schema.users.role });
    if (deleted.length === 0) return c.json({ error: "User not found" }, 404);
    if (deleted[0].role === "super_admin") {
      return c.json({ error: "Super admins cannot be deleted here." }, 400);
    }
    return c.json({ ok: true });
  } catch (err) {
    console.error("[api/users/:id]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;
