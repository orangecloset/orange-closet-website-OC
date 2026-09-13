import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "../_lib/db.js";
import { badRequest, json, methodNotAllowed, notFound, serverError, unauthorized } from "../_lib/http.js";
import { getAuthUser } from "../_lib/auth.js";

const SETTABLE_ROLES = new Set(["staff", "pending"]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) return badRequest(res, "Missing user id");

  const authUser = await getAuthUser(req);
  if (!authUser) return unauthorized(res);

  const isAdmin = authUser.role === "super_admin";
  const isSelf = authUser.id === id;

  try {
    if (req.method === "PATCH") {
      const body = req.body as { role?: string; name?: string; email?: string };
      const wantsRole = typeof body?.role === "string";
      const wantsName = typeof body?.name === "string" && body.name.trim().length > 0;
      const wantsEmail = typeof body?.email === "string" && body.email.trim().length > 0;
      if (!wantsRole && !wantsName && !wantsEmail) {
        return badRequest(res, "Nothing to update");
      }

      if (wantsRole) {
        if (!isAdmin) return unauthorized(res);
        if (!SETTABLE_ROLES.has(body.role!)) return badRequest(res, "Invalid role");
        if (isSelf) return badRequest(res, "You cannot change your own role.");
      }

      if ((wantsName || wantsEmail) && !isAdmin && !isSelf) {
        return unauthorized(res);
      }
      if (wantsEmail) {
        const email = body.email!.trim().toLowerCase();
        if (!/.+@.+\..+/.test(email)) return badRequest(res, "A valid email is required");
      }
      if ((wantsName || wantsEmail) && !isSelf) {
        const [target] = await getDb()
          .select({ role: schema.users.role })
          .from(schema.users)
          .where(eq(schema.users.id, id));
        if (!target) return notFound(res, "User not found");
        if (target.role === "super_admin") {
          return badRequest(res, "Super admins cannot be modified here.");
        }
      }

      const db = getDb();
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

      return json(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      if (!isAdmin) return unauthorized(res);
      if (isSelf) {
        return badRequest(res, "You cannot delete your own account.");
      }
      const deleted = await getDb()
        .delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning({ role: schema.users.role });
      if (deleted.length === 0) return notFound(res, "User not found");
      if (deleted[0].role === "super_admin") {
        return badRequest(res, "Super admins cannot be deleted here.");
      }
      return json(res, 200, { ok: true });
    }

    return methodNotAllowed(res, ["PATCH", "DELETE"]);
  } catch (err) {
    return serverError(res, err);
  }
}
