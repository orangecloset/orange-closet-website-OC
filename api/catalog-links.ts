import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc } from "drizzle-orm";
import { getDb, schema } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, serverError, unauthorized } from "./_lib/http.js";
import { isAuthorized } from "./_lib/auth.js";
import { decryptPin, encryptPin, hashPin } from "./_lib/catalog.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const db = getDb();
      const rows = await db
        .select({
          uid: schema.catalogLinks.uid,
          active: schema.catalogLinks.active,
          createdAt: schema.catalogLinks.createdAt,
          pinEnc: schema.catalogLinks.pinEnc,
        })
        .from(schema.catalogLinks)
        .orderBy(desc(schema.catalogLinks.createdAt));
      return json(
        res,
        200,
        rows.map((r) => ({
          uid: r.uid,
          active: r.active,
          createdAt: r.createdAt.toISOString(),
          pin: decryptPin(r.pinEnc),
        }))
      );
    }

    if (req.method === "POST") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const body = req.body as {
        uid?: string;
        pin?: string;
        active?: boolean;
        createdAt?: string;
      };
      if (!body?.uid || !body?.pin || typeof body.pin !== "string") {
        return badRequest(res, "Missing uid or pin");
      }
      const db = getDb();
      await db.insert(schema.catalogLinks).values({
        uid: body.uid,
        pin: hashPin(body.pin),
        pinEnc: encryptPin(body.pin),
        active: body.active ?? true,
        ...(body.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
      });
      return json(res, 201, { ok: true });
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (err) {
    return serverError(res, err);
  }
}
