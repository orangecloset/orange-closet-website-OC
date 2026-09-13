import type { VercelRequest, VercelResponse } from "@vercel/node";
import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "./_lib/db.js";
import { badRequest, json, methodNotAllowed, serverError, unauthorized } from "./_lib/http.js";
import { isAuthorized } from "./_lib/auth.js";
import { rateLimit } from "./_lib/ratelimit.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === "GET") {
      if (!(await isAuthorized(req))) return unauthorized(res);
      const db = getDb();

      if (!("page" in req.query)) {
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
        const rows = await db
          .select()
          .from(schema.sales)
          .orderBy(desc(schema.sales.createdAt))
          .limit(limit);
        return json(res, 200, rows.map(toApiSale));
      }

      const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
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

      return json(res, 200, {
        data: rows.map(toApiSale),
        page,
        limit,
        totalItems: count,
        totalPages: Math.max(1, Math.ceil(count / limit)),
        hasNextPage: page * limit < count,
        hasPrevPage: page > 1,
      });
    }

    if (req.method === "POST") {
      if (!await rateLimit(req, res, { key: "sales-create", limit: 10, windowMs: 60_000 })) return;
      if (!(await isAuthorized(req))) return unauthorized(res);
      const body = req.body as {
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
      };
      if (
        !body?.id ||
        !body?.productId ||
        !body?.productName ||
        !body?.colorName ||
        !body?.size ||
        !body?.quantity ||
        !body?.price
      ) {
        return badRequest(res, "Missing sale fields");
      }

      if (!Number.isInteger(body.quantity) || body.quantity < 1) {
        return badRequest(res, "Quantity must be a positive integer");
      }

      let soldAt: Date | null = null;
      if (body.soldAt !== undefined && body.soldAt !== null && body.soldAt !== "") {
        soldAt = new Date(body.soldAt);
        if (Number.isNaN(soldAt.getTime())) return badRequest(res, "Invalid soldAt date");
      }

      const db = getDb();
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

      return json(res, 201, toApiSale(row));
    }

    return methodNotAllowed(res, ["GET", "POST"]);
  } catch (err) {
    return serverError(res, err);
  }
}
