import { Hono } from "hono";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { getAuthUser, isAuthorized } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import { flattenStock, insertMovements, resolveChangedBy } from "../lib/stock-movements.js";
import type { Env } from "../env.js";

type SaleRow = typeof schema.sales.$inferSelect;

function toApiSale(r: SaleRow) {
  return {
    id: r.id,
    receiptNo: r.receiptNo ?? "",
    productId: r.productId,
    productName: r.productName,
    productImage: r.productImage,
    productSections: (r.productSections ?? null) as { title: string; body: string }[] | null,
    colorName: r.colorName,
    size: r.size,
    quantity: r.quantity,
    price: r.price,
    soldAt: (r.soldAt ?? r.createdAt).toISOString(),
    soldBy: r.soldBy,
    paymentMethod: r.paymentMethod,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    itemCode: r.itemCode,
    createdAt: r.createdAt.toISOString(),
  };
}

function optionalText(value: unknown, max = 200): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const db = getDb(c.env);

  const pageParam = c.req.query("page");
  if (pageParam === undefined) {
    const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 50));
    const rows = await db
      .select()
      .from(schema.sales)
      .orderBy(desc(schema.sales.createdAt))
      .limit(limit);
    return c.json(rows.map(toApiSale));
  }

  const page = Math.max(1, Math.floor(Number(pageParam) || 1));
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit")) || 50));
  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.sales),
    db
      .select()
      .from(schema.sales)
      .orderBy(desc(schema.sales.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
  ]);
  const count = countResult[0]?.count ?? 0;

  return c.json({
    data: rows.map(toApiSale),
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

  const from = new Date(c.req.query("from") ?? "");
  const to = new Date(c.req.query("to") ?? "");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to.getTime() <= from.getTime()) {
    return c.json({ error: "Invalid date range" }, 400);
  }
  const maxRangeMs = 92 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxRangeMs) {
    return c.json({ error: "Date range must be 90 days or less" }, 400);
  }

  const requestedTz = (c.req.query("tz") ?? "").trim();
  let tz = "UTC";
  if (requestedTz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: requestedTz });
      tz = requestedTz;
    } catch {
      tz = "UTC";
    }
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayKey = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const value = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    return `${value("year")}-${value("month")}-${value("day")}`;
  };

  const db = getDb(c.env);
  const rows = await db
    .select({
      price: schema.sales.price,
      quantity: schema.sales.quantity,
      soldAt: schema.sales.soldAt,
      createdAt: schema.sales.createdAt,
    })
    .from(schema.sales)
    .where(
      sql`coalesce(${schema.sales.soldAt}, ${schema.sales.createdAt}) >= ${from} and coalesce(${schema.sales.soldAt}, ${schema.sales.createdAt}) < ${to}`
    );

  const buckets = new Map<string, { date: string; revenue: number; units: number; count: number }>();
  for (const row of rows) {
    const key = dayKey(row.soldAt ?? row.createdAt);
    const bucket = buckets.get(key) ?? { date: key, revenue: 0, units: 0, count: 0 };
    const parsed = Number(String(row.price).replace(/[^0-9.]/g, ""));
    const lineRevenue = (Number.isFinite(parsed) ? parsed : 0) * row.quantity;
    bucket.revenue += lineRevenue;
    bucket.units += row.quantity;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const start = dayKey(from).split("-").map(Number);
  const end = dayKey(new Date(to.getTime() - 1)).split("-").map(Number);
  const startUtc = Date.UTC(start[0], start[1] - 1, start[2]);
  const endUtc = Date.UTC(end[0], end[1] - 1, end[2]);
  const days: Array<{ date: string; revenue: number; units: number; count: number }> = [];
  for (let t = startUtc; t <= endUtc; t += 24 * 60 * 60 * 1000) {
    const d = new Date(t);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    days.push(
      bucket
        ? { ...bucket, revenue: Math.round(bucket.revenue * 100) / 100 }
        : { date: key, revenue: 0, units: 0, count: 0 }
    );
  }

  return c.json({
    days,
    totals: {
      revenue: Math.round(days.reduce((sum, d) => sum + d.revenue, 0) * 100) / 100,
      units: days.reduce((sum, d) => sum + d.units, 0),
      count: days.reduce((sum, d) => sum + d.count, 0),
    },
  });
});

app.get("/by-receipt/:receiptNo", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const receiptNo = c.req.param("receiptNo");
  if (!receiptNo) return c.json({ error: "Missing receipt number" }, 400);
  const db = getDb(c.env);
  const [row] = await db
    .select()
    .from(schema.sales)
    .where(eq(schema.sales.receiptNo, receiptNo))
    .limit(1);
  if (!row) return c.json({ error: "Sale not found" }, 404);
  return c.json(toApiSale(row));
});

app.post("/", async (c) => {
  const rl = await rateLimit(c.env, c.req.raw.headers, {
    key: "sales-create",
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }

  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{
    id?: string;
    productId?: string;
    productName?: string;
    productImage?: string;
    colorName?: string;
    size?: string;
    quantity?: number;
    price?: string;
    soldAt?: string;
    soldBy?: string;
    paymentMethod?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    itemCode?: string;
  }>();

  if (
    !body?.id ||
    !body?.productId ||
    !body?.productName ||
    !body?.colorName ||
    !body?.size ||
    !body?.quantity ||
    !body?.price
  ) {
    return c.json({ error: "Missing sale fields" }, 400);
  }

  if (!Number.isInteger(body.quantity) || body.quantity < 1) {
    return c.json({ error: "Quantity must be a positive integer" }, 400);
  }

  let soldAt: Date | null = null;
  if (body.soldAt !== undefined && body.soldAt !== null && body.soldAt !== "") {
    soldAt = new Date(body.soldAt);
    if (Number.isNaN(soldAt.getTime())) return c.json({ error: "Invalid soldAt date" }, 400);
  }

  const db = getDb(c.env);

  const [productRow] = await db
    .select({
      name: schema.products.name,
      colors: schema.products.colors,
      sections: schema.products.sections,
    })
    .from(schema.products)
    .where(eq(schema.products.id, body.productId!));
  if (!productRow) {
    return c.json({ error: "Product not found" }, 404);
  }

  const beforeStock = flattenStock(productRow.colors);
  const key = `${body.colorName}::${body.size}`;
  const prevStock = beforeStock.get(key) ?? 0;

  if (body.quantity > prevStock) {
    return c.json(
      {
        error: `Only ${prevStock} unit${prevStock === 1 ? "" : "s"} in stock for ${body.colorName} / ${body.size}.`,
      },
      400
    );
  }

  const authUser = await getAuthUser(c.env, c.req.header("authorization"));
  const changedBy =
    optionalText(body.soldBy) ?? (await resolveChangedBy(c.env, authUser?.id ?? null));

  const [row] = await db
    .insert(schema.sales)
    .values({
      id: body.id!,
      receiptNo: sql`'RCPT-' || lpad(((select coalesce(max(nullif(regexp_replace(receipt_no, '[^0-9]', '', 'g'), '')::int), 0) from ${schema.sales}) + 1)::text, 4, '0')`,
      productId: body.productId!,
      productName: body.productName!,
      productImage: optionalText(body.productImage, 2048),
      productSections: (productRow?.sections ?? []) as { title: string; body: string }[],
      colorName: body.colorName!,
      size: body.size!,
      quantity: body.quantity!,
      price: body.price!,
      soldAt,
      soldBy: optionalText(body.soldBy),
      paymentMethod: optionalText(body.paymentMethod),
      customerName: optionalText(body.customerName),
      customerPhone: optionalText(body.customerPhone),
      customerEmail: optionalText(body.customerEmail),
      itemCode: optionalText(body.itemCode),
    })
    .returning();

  await db.execute(sql`
    update ${schema.products} set
      colors = (
        select coalesce(jsonb_agg(
          case when c->>'name' = ${body.colorName} then
            jsonb_set(c, '{sizes}', (
              select coalesce(jsonb_agg(
                case when s->>'size' = ${body.size} then
                  jsonb_set(s, '{stock}', to_jsonb(greatest(0, (s->>'stock')::int - ${body.quantity})))
                else s end
                order by sord
              ), '[]'::jsonb)
              from jsonb_array_elements(c->'sizes') with ordinality as st(s, sord)
            ))
          else c end
          order by cord
        ), '[]'::jsonb)
        from jsonb_array_elements(${schema.products.colors}) with ordinality as ct(c, cord)
      ),
      updated_at = now()
    where id = ${body.productId}
  `);

  const newStock = Math.max(0, prevStock - body.quantity);
  await insertMovements(c.env, [
    {
      productId: body.productId!,
      productName: body.productName!,
      colorName: body.colorName!,
      size: body.size!,
      prevStock,
      newStock,
      kind: "sale",
      reason: null,
      changedBy,
      ref: row.receiptNo || null,
    },
  ]);

  return c.json(toApiSale(row), 201);
});

export default app;
