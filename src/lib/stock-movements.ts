import { eq } from "drizzle-orm";
import { getDb, schema } from "./db.js";
import type { Env } from "../env.js";

export type StockKind = "sale" | "edit" | "create";

type ColorsJson = { name?: unknown; sizes?: { size?: unknown; stock?: unknown }[] }[];

export function flattenStock(colors: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(colors)) return map;
  for (const c of colors as ColorsJson) {
    if (!c || typeof c !== "object") continue;
    const colorName = typeof c.name === "string" ? c.name : "";
    if (!Array.isArray(c.sizes)) continue;
    for (const s of c.sizes) {
      if (!s || typeof s !== "object") continue;
      const size = typeof s.size === "string" ? s.size : "";
      const stock = Number(s.stock);
      map.set(`${colorName}::${size}`, Number.isFinite(stock) ? stock : 0);
    }
  }
  return map;
}

function movementId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function userLabel(env: Env, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  try {
    const rows = await getDb(env)
      .select({ name: schema.users.name, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const row = rows[0];
    return row ? row.name || row.email : null;
  } catch {
    return null;
  }
}

export type MovementInput = {
  productId: string | null;
  productName: string;
  colorName: string;
  size: string;
  prevStock: number;
  newStock: number;
  kind: StockKind;
  reason?: string | null;
  changedBy?: string | null;
  ref?: string | null;
};

export async function insertMovements(env: Env, rows: MovementInput[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb(env);
  await db.insert(schema.stockMovements).values(
    rows.map((r) => ({
      id: movementId(),
      productId: r.productId,
      productName: r.productName,
      colorName: r.colorName,
      size: r.size,
      prevStock: r.prevStock,
      newStock: r.newStock,
      kind: r.kind,
      reason: r.reason ?? null,
      changedBy: r.changedBy ?? null,
      ref: r.ref ?? null,
    }))
  );
}

/**
 * Compare two flattened stock maps and log every changed color/size.
 * Keys are `${colorName}::${size}`.
 */
export async function logStockDiff(
  env: Env,
  opts: {
    productId: string;
    productName: string;
    before: Map<string, number>;
    after: Map<string, number>;
    kind: StockKind;
    reason?: string | null;
    changedBy?: string | null;
    ref?: string | null;
  }
): Promise<void> {
  const rows: MovementInput[] = [];
  const keys = new Set([...opts.before.keys(), ...opts.after.keys()]);
  for (const key of keys) {
    const prev = opts.before.get(key) ?? 0;
    const next = opts.after.get(key) ?? 0;
    if (prev === next) continue;
    const [colorName, size] = key.split("::");
    rows.push({
      productId: opts.productId,
      productName: opts.productName,
      colorName: colorName ?? "",
      size: size ?? "",
      prevStock: prev,
      newStock: next,
      kind: opts.kind,
      reason: opts.reason ?? null,
      changedBy: opts.changedBy ?? null,
      ref: opts.ref ?? null,
    });
  }
  await insertMovements(env, rows);
}

export async function resolveChangedBy(env: Env, userId: string | null): Promise<string | null> {
  return userLabel(env, userId);
}
