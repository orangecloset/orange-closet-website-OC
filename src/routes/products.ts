import { Hono } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { getAuthUser, isAuthorized } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import { getCatalogAccess } from "../lib/catalog.js";
import { cmsProductToRow, rowToCmsProduct } from "../lib/products.js";
import {
  applyStockChanges,
  buildStockDiffMovements,
  flattenStock,
  logStockDiff,
  mergePreservedStock,
  resolveChangedBy,
  toMovementValues,
  type StockChange,
} from "../lib/stock-movements.js";
import type { Env } from "../env.js";

const MAX_PAGE_SIZE = 30;
const MAX_STOCK = 500_000;

function hasInvalidStock(colors: unknown): boolean {
  for (const stock of flattenStock(colors).values()) {
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > MAX_STOCK) {
      return true;
    }
  }
  return false;
}

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
  const row = cmsProductToRow(body as never);
  if (hasInvalidStock(row.colors)) {
    return c.json(
      {
        error: `Stock values must be whole numbers between 0 and ${MAX_STOCK.toLocaleString("en-US")}.`,
      },
      400
    );
  }
  await db.insert(schema.products).values(row);

  const initialStock = flattenStock(row.colors);
  const changedBy = await resolveChangedBy(c.env, (await getAuthUser(c.env, c.req.header("authorization")))?.id ?? null);
  await logStockDiff(c.env, {
    productId: row.id,
    productName: row.name,
    before: new Map(),
    after: initialStock,
    kind: "create",
    reason: "Initial stock",
    changedBy,
  });

  return c.json({ ok: true }, 201);
});

app.post("/:id/stock-adjustments", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing product id" }, 400);

  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req
    .json<{ reason?: unknown; changes?: unknown }>()
    .catch(() => null);

  const reason =
    typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  if (!reason) {
    return c.json({ error: "A reason is required when stock changes." }, 400);
  }

  const rawChanges = Array.isArray(body?.changes) ? body.changes : [];
  if (rawChanges.length === 0) {
    return c.json({ error: "No stock changes were provided." }, 400);
  }
  if (rawChanges.length > 500) {
    return c.json({ error: "Too many stock changes in one request." }, 400);
  }

  const changes: StockChange[] = [];
  const seen = new Set<string>();
  for (const raw of rawChanges) {
    if (!raw || typeof raw !== "object") {
      return c.json({ error: "Invalid stock change." }, 400);
    }
    const value = raw as Record<string, unknown>;
    const colorName = typeof value.colorName === "string" ? value.colorName : "";
    const size = typeof value.size === "string" ? value.size : "";
    const newStock = Number(value.newStock);

    if (
      !colorName ||
      !size ||
      !Number.isSafeInteger(newStock) ||
      newStock < 0 ||
      newStock > MAX_STOCK
    ) {
      return c.json(
        {
          error: `Stock values must be whole numbers between 0 and ${MAX_STOCK.toLocaleString("en-US")}.`,
        },
        400
      );
    }

    const key = `${colorName}::${size}`;
    if (seen.has(key)) {
      return c.json(
        { error: `Duplicate stock change for ${colorName} / ${size}.` },
        400
      );
    }
    seen.add(key);
    changes.push({ colorName, size, newStock });
  }

  const db = getDb(c.env);
  const [row] = await db
    .select({ name: schema.products.name, colors: schema.products.colors })
    .from(schema.products)
    .where(eq(schema.products.id, id));
  if (!row) return c.json({ error: "Product not found" }, 404);

  const before = flattenStock(row.colors);
  for (const change of changes) {
    if (!before.has(`${change.colorName}::${change.size}`)) {
      return c.json(
        { error: `Unknown variant: ${change.colorName} / ${change.size}.` },
        400
      );
    }
  }

  const updatedColors = applyStockChanges(row.colors, changes);
  const after = flattenStock(updatedColors);
  const movements = buildStockDiffMovements({
    productId: id,
    productName: row.name,
    before,
    after,
    kind: "edit",
    reason,
    changedBy: await resolveChangedBy(c.env, authUser.id),
  });

  if (movements.length === 0) {
    return c.json({ error: "The new stock matches the current stock." }, 400);
  }

  const updateQuery = db
    .update(schema.products)
    .set({ colors: updatedColors, updatedAt: new Date() })
    .where(eq(schema.products.id, id));
  const insertQuery = db
    .insert(schema.stockMovements)
    .values(toMovementValues(movements));

  await db.batch([updateQuery, insertQuery]);

  const [updated] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.id, id));

  return c.json({
    ok: true,
    changed: movements.length,
    product: updated ? rowToCmsProduct(updated) : null,
  });
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

  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  if (!authUser) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<{
    name?: string;
    stockReason?: string;
    colors?: unknown;
    sizes?: unknown;
  }>();
  if (!body?.name) return c.json({ error: "Invalid product body" }, 400);

  const db = getDb(c.env);
  const [oldRow] = await db
    .select({
      name: schema.products.name,
      colors: schema.products.colors,
      sizes: schema.products.sizes,
    })
    .from(schema.products)
    .where(eq(schema.products.id, id));
  if (!oldRow) return c.json({ error: "Product not found" }, 404);

  const values = cmsProductToRow(body as never);
  delete values.createdAt;

  const legacyReason =
    typeof body.stockReason === "string" && body.stockReason.trim()
      ? body.stockReason.trim().slice(0, 200)
      : null;

  if (body.colors === undefined) {
    values.colors = oldRow.colors;
  } else if (!legacyReason) {
    const merged = mergePreservedStock(values.colors, oldRow.colors);
    if (merged.removedInStock.length > 0) {
      return c.json(
        {
          error: `Cannot remove or rename ${merged.removedInStock.join(
            ", "
          )}. Adjust the stock to 0 first, then save the change.`,
        },
        400
      );
    }
    values.colors = merged.colors;
  }

  if (body.sizes === undefined && body.colors === undefined) {
    values.sizes = oldRow.sizes;
  }

  if (legacyReason && body.colors !== undefined && hasInvalidStock(values.colors)) {
    return c.json(
      {
        error: `Stock values must be whole numbers between 0 and ${MAX_STOCK.toLocaleString("en-US")}.`,
      },
      400
    );
  }

  const updated = await db
    .update(schema.products)
    .set(values)
    .where(eq(schema.products.id, id))
    .returning({ id: schema.products.id });
  if (updated.length === 0) return c.json({ error: "Product not found" }, 404);

  if (legacyReason) {
    await logStockDiff(c.env, {
      productId: id,
      productName: values.name ?? oldRow.name,
      before: flattenStock(oldRow.colors),
      after: flattenStock(values.colors ?? []),
      kind: "edit",
      reason: legacyReason,
      changedBy: await resolveChangedBy(c.env, authUser.id),
    });
  }

  return c.json({ ok: true });
});

app.patch("/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "Missing product id" }, 400);

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<Record<string, unknown>>();

  if (body.colors !== undefined || body.sizes !== undefined) {
    return c.json(
      {
        error:
          "Stock and variant changes must be made through the product form or the stock adjustment endpoint.",
      },
      400
    );
  }

  const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string");

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
