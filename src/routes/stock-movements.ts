import { Hono } from "hono";
import { desc, ilike, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { isAuthorized } from "../lib/auth.js";
import type { Env } from "../env.js";

const app = new Hono<{ Bindings: Env }>();

function toApiMovement(r: typeof schema.stockMovements.$inferSelect) {
  return {
    id: r.id,
    productId: r.productId ?? "",
    productName: r.productName,
    colorName: r.colorName,
    size: r.size,
    prevStock: r.prevStock,
    newStock: r.newStock,
    kind: r.kind,
    reason: r.reason,
    changedBy: r.changedBy,
    ref: r.ref,
    createdAt: r.createdAt.toISOString(),
  };
}

app.get("/", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);

  const page = Math.max(1, Math.floor(Number(c.req.query("page")) || 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
  const search = typeof c.req.query("search") === "string" ? c.req.query("search")!.trim() : "";

  const where = search
    ? ilike(schema.stockMovements.productName, `%${search.replace(/[%_]/g, "\\$&")}%`)
    : undefined;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.stockMovements)
      .where(where),
    db
      .select()
      .from(schema.stockMovements)
      .where(where)
      .orderBy(desc(schema.stockMovements.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  const count = countResult[0]?.count ?? 0;

  return c.json({
    data: rows.map(toApiMovement),
    page,
    limit,
    totalItems: count,
    totalPages: Math.max(1, Math.ceil(count / limit)),
    hasNextPage: page * limit < count,
    hasPrevPage: page > 1,
  });
});

app.get("/stats", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);

  const stockTotal = sql<number>`coalesce((
    select sum((s->>'stock')::int)
    from jsonb_array_elements(${schema.products.colors}) c,
        jsonb_array_elements(c->'sizes') s
  ), 0)`;

  const [row] = await db
    .select({
      totalUnits: sql<number>`coalesce(sum(${stockTotal}), 0)::int`,
      productsWithStock: sql<number>`(count(*) filter (where ${stockTotal} > 0))::int`,
      soldOut: sql<number>`(count(*) filter (where ${stockTotal} <= 0))::int`,
    })
    .from(schema.products);

  const productRows = await db
    .select({ price: schema.products.price, stock: stockTotal })
    .from(schema.products);

  let totalValue = 0;
  for (const p of productRows) {
    const price = Number(String(p.price).replace(/[^0-9.]/g, ""));
    if (Number.isFinite(price) && price > 0) totalValue += price * (Number(p.stock) || 0);
  }

  return c.json({
    totalUnits: row?.totalUnits ?? 0,
    productsWithStock: row?.productsWithStock ?? 0,
    soldOut: row?.soldOut ?? 0,
    totalValue,
  });
});

export default app;
