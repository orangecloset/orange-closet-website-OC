import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../_lib/db.js";
import { badRequest, methodNotAllowed, notFound, serverError, unauthorized, json } from "../_lib/http.js";
import { isAuthorized } from "../_lib/auth.js";
import { getCatalogAccess } from "../_lib/catalog.js";
import { cmsProductToRow, rowToCmsProduct } from "../_lib/products.js";

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

const isColorsArray = (v: unknown): boolean =>
  Array.isArray(v) &&
  v.every((c) => {
    if (typeof c !== "object" || c === null) return false;
    const r = c as Record<string, unknown>;
    if (typeof r.name !== "string" || typeof r.hex !== "string") return false;
    if (
      r.hexes !== undefined &&
      !(
        Array.isArray(r.hexes) &&
        r.hexes.every((x) => typeof x === "string")
      )
    )
      return false;
    return true;
  });

const PATCHABLE = {
  name: (v: unknown) => String(v),
  brand: (v: unknown) => (v == null ? null : String(v)),
  type: (v: unknown) => String(v),
  category: (v: unknown) => String(v),
  categoryLabel: (v: unknown) => String(v),
  price: (v: unknown) => String(v),
  compareAtPrice: (v: unknown) => (v == null ? null : String(v)),
  description: (v: unknown) => String(v),
  status: (v: unknown) => (v === "active" || v === "draft" ? v : undefined),
  colors: (v: unknown) => (isColorsArray(v) ? v : undefined),
  sizes: (v: unknown) => (isColorsArray(v) ? v : undefined),
  details: (v: unknown) => (isStringArray(v) ? v : undefined),
  sections: (v: unknown) => (isStringArray(v) ? v : undefined),
  sectionsOpen: (v: unknown) => (typeof v === "boolean" ? v : undefined),
} as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (typeof id !== "string" || !id) return badRequest(res, "Missing product id");

  try {
    if (req.method === "GET") {
      if (!(await getCatalogAccess(req))) return unauthorized(res);
      const db = getDb();
      const [row] = await db.select().from(schema.products).where(eq(schema.products.id, id));
      if (!row) return notFound(res, "Product not found");
      return json(res, 200, rowToCmsProduct(row));
    }

    if (req.method === "PUT") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const body = req.body as { name?: string };
      if (!body?.name) return badRequest(res, "Invalid product body");
      const db = getDb();
      const values = cmsProductToRow(body as never);
      delete values.createdAt;
      const updated = await db
        .update(schema.products)
        .set(values)
        .where(eq(schema.products.id, id))
        .returning({ id: schema.products.id });
      if (updated.length === 0) return notFound(res, "Product not found");
      return json(res, 200, { ok: true });
    }

    if (req.method === "PATCH") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const body = req.body as Record<string, unknown>;
      const values: Record<string, unknown> = { updatedAt: new Date() };
      let touched = false;
      for (const [key, transform] of Object.entries(PATCHABLE)) {
        if (body[key] !== undefined) {
          const result = transform(body[key]);
          if (result !== undefined) {
            values[key] = result;
            touched = true;
          }
        }
      }
      if (!touched) return badRequest(res, "Nothing to update");
      const db = getDb();
      const updated = await db
        .update(schema.products)
        .set(values)
        .where(eq(schema.products.id, id))
        .returning({ id: schema.products.id });
      if (updated.length === 0) return notFound(res, "Product not found");
      return json(res, 200, { ok: true });
    }

    if (req.method === "DELETE") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const db = getDb();
      const deleted = await db
        .delete(schema.products)
        .where(eq(schema.products.id, id))
        .returning({ id: schema.products.id });
      if (deleted.length === 0) return notFound(res, "Product not found");
      return json(res, 200, { ok: true });
    }

    return methodNotAllowed(res, ["GET", "PUT", "PATCH", "DELETE"]);
  } catch (err) {
    return serverError(res, err);
  }
}
