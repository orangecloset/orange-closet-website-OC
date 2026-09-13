import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, serverError, unauthorized } from "./_lib/http.js";
import { isAuthorized } from "./_lib/auth.js";
import { rateLimit } from "./_lib/ratelimit.js";
import { getCatalogAccess } from "./_lib/catalog.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      if (!(await getCatalogAccess(req))) return unauthorized(res);
      const db = getDb();
      if (!req.query.key || typeof req.query.key !== "string") {
        const rows = await db.select().from(schema.settings);
        return json(res, 200, Object.fromEntries(rows.map((r) => [r.key, r.value])));
      }
      const [row] = await db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, req.query.key));
      return json(res, 200, row?.value ?? null);
    }

    if (req.method === "PUT") {
      if (!await rateLimit(req, res, { key: "settings-update", limit: 30, windowMs: 60_000 })) return;
      if (!(await isAuthorized(req))) return unauthorized(res);
      const body = req.body as { key?: string; value?: unknown };
      if (!body?.key || typeof body.key !== "string") return badRequest(res, "Missing settings key");
      const db = getDb();
      await db
        .insert(schema.settings)
        .values({ key: body.key, value: body.value ?? null })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: body.value ?? null, updatedAt: new Date() },
        });
      return json(res, 200, { ok: true });
    }

    return methodNotAllowed(res, ["GET", "PUT"]);
  } catch (err) {
    return serverError(res, err);
  }
}
