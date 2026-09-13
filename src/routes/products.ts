import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { isAuthorized } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import { getCatalogAccess } from "../lib/catalog.js";
import { cmsProductToRow, rowToCmsProduct } from "../lib/products.js";
import type { Env } from "../env.js";

const MAX_PAGE_SIZE = 30;

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  const catalogToken = c.req.header("x-catalog-token");
  if (!(await getCatalogAccess(c.env, c.req.header("authorization"), catalogToken))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);

  const pagingParams = ["page", "limit", "search", "type", "status", "availability", "ids", "stats"];
  const paginated = pagingParams.some((k) => c.req.query(k) !== undefined);

  if (!paginated) {
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.status, "active"))
      .orderBy(desc(schema.products.createdAt))
      .limit(500);
    return c.json(rows.map(rowToCmsProduct));
  }

  const page = Math.max(1, Math.floor(Number(c.req.query("page")) || 1));
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.floor(Number(c.req.query("limit")) || MAX_PAGE_SIZE))
  );
  const search = typeof c.req.query("search") === "string" ? c.req.query("search")!.trim() : "";
  const type = typeof c.req.query("type") === "string" ? c.req.query("type")! : "";
  const status = typeof c.req.query("status") === "string" ? c.req.query("status")! : "";
  const availability = typeof c.req.query("availability") === "string" ? c.req.query("availability")! : "";

  const stockTotal = sql<number>`coalesce((
    select sum((s->>'stock')::int)
    from jsonb_array_elements(${schema.products.colors}) c,
        jsonb_array_elements(c->'sizes') s
  ), 0)`;

  if (c.req.query("stats") === "1") {
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

    return c.json({
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
  const idsParam = c.req.query("ids");
  if (typeof idsParam === "string" && idsParam.trim()) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
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

  return c.json({
    data: rows.map(rowToCmsProduct),
    page,
    limit,
    totalItems: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
    hasNextPage: page * limit < count,
    hasPrevPage: page > 1,
  });
});

app.post("/", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "products-create",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ id?: string; name?: string }>();
  if (!body?.id || !body?.name) return c.json({ error: "Invalid product body" }, 400);

  const db = getDb(c.env);
  const existing = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, body.id));
  if (existing.length > 0) return c.json({ error: "Product id already exists" }, 400);
  await db.insert(schema.products).values(cmsProductToRow(body as never));
  return c.json({ ok: true }, 201);
});

app.delete("/", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const type = typeof c.req.query("type") === "string" ? c.req.query("type")! : "";
  if (!type) return c.json({ error: "Missing type" }, 400);

  const db = getDb(c.env);
  const deleted = await db
    .delete(schema.products)
    .where(eq(schema.products.type, type))
    .returning({ id: schema.products.id });
  return c.json({ ok: true, deletedIds: deleted.map((d) => d.id) });
});

// /api/products/:id
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing product id" }, 400);

  const catalogToken = c.req.header("x-catalog-token");
  if (!(await getCatalogAccess(c.env, c.req.header("authorization"), catalogToken))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDb(c.env);
  const [row] = await db.select().from(schema.products).where(eq(schema.products.id, id));
  if (!row) return c.json({ error: "Product not found" }, 404);
  return c.json(rowToCmsProduct(row));
});

app.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing product id" }, 400);

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ name?: string }>();
  if (!body?.name) return c.json({ error: "Invalid product body" }, 400);

  const db = getDb(c.env);
  const values = cmsProductToRow(body as never);
  delete values.createdAt;
  const updated = await db
    .update(schema.products)
    .set(values)
    .where(eq(schema.products.id, id))
    .returning({ id: schema.products.id });
  if (updated.length === 0) return c.json({ error: "Product not found" }, 404);
  return c.json({ ok: true });
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing product id" }, 400);

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<Record<string, unknown>>();

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

  const PATCHABLE: Record<string, (v: unknown) => unknown> = {
    name: (v) => String(v),
    brand: (v) => (v == null ? null : String(v)),
    type: (v) => String(v),
    category: (v) => String(v),
    categoryLabel: (v) => String(v),
    price: (v) => String(v),
    compareAtPrice: (v) => (v == null ? null : String(v)),
    description: (v) => String(v),
    status: (v) => (v === "active" || v === "draft" ? v : undefined),
    colors: (v) => (isColorsArray(v) ? v : undefined),
    sizes: (v) => (isColorsArray(v) ? v : undefined),
    details: (v) => (isStringArray(v) ? v : undefined),
    sections: (v) => (isStringArray(v) ? v : undefined),
    sectionsOpen: (v) => (typeof v === "boolean" ? v : undefined),
  };

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
  if (!touched) return c.json({ error: "Nothing to update" }, 400);

  const db = getDb(c.env);
  const updated = await db
    .update(schema.products)
    .set(values)
    .where(eq(schema.products.id, id))
    .returning({ id: schema.products.id });
  if (updated.length === 0) return c.json({ error: "Product not found" }, 404);
  return c.json({ ok: true });
});

app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing product id" }, 400);

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDb(c.env);
  const deleted = await db
    .delete(schema.products)
    .where(eq(schema.products.id, id))
    .returning({ id: schema.products.id });
  if (deleted.length === 0) return c.json({ error: "Product not found" }, 404);
  return c.json({ ok: true });
});

export default app;
