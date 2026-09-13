import { Hono } from "hono";
import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import { isAuthorized } from "../lib/auth.js";
import { rateLimit } from "../lib/ratelimit.js";
import type { Env } from "../env.js";

type SaleRow = typeof schema.sales.$inferSelect;

function toApiSale(r: SaleRow) {
  return {
    id: r.id,
    receiptNo: r.receiptNo ?? "",
    productId: r.productId,
    productName: r.productName,
    productImage: r.productImage,
    colorName: r.colorName,
    size: r.size,
    quantity: r.quantity,
    price: r.price,
    soldAt: (r.soldAt ?? r.createdAt).toISOString(),
    soldBy: r.soldBy,
    paymentMethod: r.paymentMethod,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
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
  const [row] = await db
    .insert(schema.sales)
    .values({
      id: body.id!,
      receiptNo: sql`'RCPT-' || lpad(((select coalesce(max(nullif(regexp_replace(receipt_no, '[^0-9]', '', 'g'), '')::int), 0) from ${schema.sales}) + 1)::text, 4, '0')`,
      productId: body.productId!,
      productName: body.productName!,
      productImage: optionalText(body.productImage, 2048),
      colorName: body.colorName!,
      size: body.size!,
      quantity: body.quantity!,
      price: body.price!,
      soldAt,
      soldBy: optionalText(body.soldBy),
      paymentMethod: optionalText(body.paymentMethod),
      customerName: optionalText(body.customerName),
      customerPhone: optionalText(body.customerPhone),
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

  return c.json(toApiSale(row), 201);
});

export default app;
