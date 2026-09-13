import type { VercelRequest, VercelResponse } from "@vercel/node";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, serverError, unauthorized } from "./_lib/http.js";
import { isAuthorized } from "./_lib/auth.js";
import { rateLimit } from "./_lib/ratelimit.js";
import { getCatalogAccess } from "./_lib/catalog.js";
import { cmsProductToRow, rowToCmsProduct } from "./_lib/products.js";

const MAX_PAGE_SIZE = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      if (!(await getCatalogAccess(req))) return unauthorized(res);
      const db = getDb();

      const pagingParams = ["page", "limit", "search", "type", "status", "availability", "ids", "stats"];
      const paginated = pagingParams.some((k) => k in req.query);

      if (!paginated) {
        const rows = await db
          .select()
          .from(schema.products)
          .where(eq(schema.products.status, "active"))
          .orderBy(desc(schema.products.createdAt))
          .limit(500);
        return json(res, 200, rows.map(rowToCmsProduct));
      }

      const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
      const limit = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, Math.floor(Number(req.query.limit) || MAX_PAGE_SIZE))
      );
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const type = typeof req.query.type === "string" ? req.query.type : "";
      const status = typeof req.query.status === "string" ? req.query.status : "";
      const availability =
        typeof req.query.availability === "string" ? req.query.availability : "";

      const stockTotal = sql<number>`coalesce((
        select sum((s->>'stock')::int)
        from jsonb_array_elements(${schema.products.colors}) c,
            jsonb_array_elements(c->'sizes') s
      ), 0)`;

      if (req.query.stats === "1") {
        const [countResult, soldOutRows] = await Promise.all([
          db
            .select({
              total: sql<number>`count(*)::int`,
              active: sql<number>`(count(*) filter (where ${schema.products.status} = 'active'))::int`,
              draft: sql<number>`(count(*) filter (where ${schema.products.status} = 'draft'))::int`,
              soldOut: sql<number>`(count(*) filter (where ${stockTotal} <= 0))::int`,
              addedThisWeek: sql<number>`(count(*) filter (where ${schema.products.createdAt} > now() - interval '7 days'))::int`,
            })
            .from(schema.products),
          db
            .select()
            .from(schema.products)
            .where(sql`${stockTotal} <= 0`)
            .orderBy(desc(schema.products.createdAt)),
        ]);

        return json(res, 200, {
          ...(countResult[0] ?? { total: 0, active: 0, draft: 0, soldOut: 0, addedThisWeek: 0 }),
          soldOutProducts: soldOutRows.map(rowToCmsProduct),
        });
      }

      const conditions = [];
      if (search) {
        const term = `%${search.replace(/[%_]/g, "\\$&")}%`;
        conditions.push(
          sql`(${schema.products.name} ILIKE ${term} ESCAPE '\\' OR ${schema.products.brand} ILIKE ${term} ESCAPE '\\' OR ${schema.products.id} ILIKE ${term} ESCAPE '\\')`
        );
      }
      if (type && type !== "all") conditions.push(eq(schema.products.type, type));
      if (status && status !== "all") conditions.push(eq(schema.products.status, status));
      if (availability === "available") conditions.push(sql`${stockTotal} > 0`);
      if (availability === "soldout") conditions.push(sql`${stockTotal} <= 0`);
      if (typeof req.query.ids === "string" && req.query.ids.trim()) {
        const ids = req.query.ids.split(",").map((s) => s.trim()).filter(Boolean);
        conditions.push(inArray(schema.products.id, ids.length > 0 ? ids : ["__none__"]));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult, rows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.products)
          .where(where),
        db
          .select()
          .from(schema.products)
          .where(where)
          .orderBy(desc(schema.products.createdAt))
          .limit(limit)
          .offset((page - 1) * limit),
      ]);
      const count = countResult[0]?.count ?? 0;

      return json(res, 200, {
        data: rows.map(rowToCmsProduct),
        page,
        limit,
        totalItems: count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
        hasNextPage: page * limit < count,
        hasPrevPage: page > 1,
      });
    }

    if (req.method === "POST") {
      if (!await rateLimit(req, res, { key: "products-create", limit: 10, windowMs: 60_000 })) return;
      if (!(await isAuthorized(req))) return unauthorized(res);
      const body = req.body as { id?: string; name?: string };
      if (!body?.id || !body?.name) return badRequest(res, "Invalid product body");
      const db = getDb();
      const existing = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.id, body.id));
      if (existing.length > 0) return badRequest(res, "Product id already exists");
      await db.insert(schema.products).values(cmsProductToRow(body as never));
      return json(res, 201, { ok: true });
    }

    if (req.method === "DELETE") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const type = typeof req.query.type === "string" ? req.query.type : "";
      if (!type) return badRequest(res, "Missing type");
      const db = getDb();
      const deleted = await db
        .delete(schema.products)
        .where(eq(schema.products.type, type))
        .returning({ id: schema.products.id });
      return json(res, 200, { ok: true, deletedIds: deleted.map((d) => d.id) });
    }

    return methodNotAllowed(res, ["GET", "POST", "DELETE"]);
  } catch (err) {
    return serverError(res, err);
  }
}
