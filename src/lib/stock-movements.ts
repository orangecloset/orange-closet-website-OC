import { eq } from "drizzle-orm";
import { getDb, schema } from "./db.js";
import type { Env } from "../env.js";

export type StockKind = "sale" | "edit" | "create";

export type StockChange = {
  colorName: string;
  size: string;
  newStock: number;
};

type ColorsJson = { name?: unknown; sizes?: { size?: unknown; stock?: unknown }[] }[];

type StockColorJson = {
  name?: unknown;
  sizes?: { size?: unknown; stock?: unknown }[];
  [key: string]: unknown;
};

function stockKey(colorName: string, size: string): string {
  return `${colorName}::${size}`;
}

function readColorName(color: unknown): string {
  if (!color || typeof color !== "object") return "";
  const name = (color as { name?: unknown }).name;
  return typeof name === "string" ? name : "";
}

function readSize(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const size = (value as { size?: unknown }).size;
  return typeof size === "string" ? size : "";
}

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
      map.set(stockKey(colorName, size), Number.isFinite(stock) ? stock : 0);
    }
  }
  return map;
}

export function applyStockChanges(colors: unknown, changes: StockChange[]): unknown[] {
  const byKey = new Map(
    changes.map((change) => [stockKey(change.colorName, change.size), change.newStock])
  );

  return (Array.isArray(colors) ? colors : []).map((color) => {
    if (!color || typeof color !== "object") return color;
    const c = color as StockColorJson;
    if (!Array.isArray(c.sizes)) return color;
    const colorName = readColorName(color);

    return {
      ...c,
      sizes: c.sizes.map((s) => {
        if (!s || typeof s !== "object") return s;
        const next = byKey.get(stockKey(colorName, readSize(s)));
        return next === undefined ? s : { ...s, stock: next };
      }),
    };
  });
}

export function mergePreservedStock(
  colors: unknown,
  oldColors: unknown
): { colors: unknown[]; removedInStock: string[] } {
  const oldStock = flattenStock(oldColors);
  const oldColorList = Array.isArray(oldColors) ? oldColors : [];
  const incoming = Array.isArray(colors) ? colors : [];
  const incomingKeys = new Set<string>();

  const merged = incoming.map((color) => {
    if (!color || typeof color !== "object") return color;
    const c = color as StockColorJson;
    const colorName = readColorName(color);

    const sizes = Array.isArray(c.sizes)
      ? c.sizes
      : (oldColorList as StockColorJson[]).find(
          (oldColor) => readColorName(oldColor) === colorName
        )?.sizes;

    if (!Array.isArray(sizes)) return color;

    return {
      ...c,
      sizes: sizes.map((s) => {
        if (!s || typeof s !== "object") return s;
        const key = stockKey(colorName, readSize(s));
        incomingKeys.add(key);
        return { ...s, stock: oldStock.get(key) ?? 0 };
      }),
    };
  });

  const removedInStock: string[] = [];
  for (const [key, stock] of oldStock) {
    if (stock > 0 && !incomingKeys.has(key)) {
      const [colorName, size] = key.split("::");
      removedInStock.push(`${colorName} / ${size} (${stock} in stock)`);
    }
  }

  return { colors: merged, removedInStock };
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

export function toMovementValues(rows: MovementInput[]) {
  return rows.map((r) => ({
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
  }));
}

export async function insertMovements(env: Env, rows: MovementInput[]): Promise<void> {
  if (rows.length === 0) return;
  const db = getDb(env);
  await db.insert(schema.stockMovements).values(toMovementValues(rows));
}

export function buildStockDiffMovements(opts: {
  productId: string;
  productName: string;
  before: Map<string, number>;
  after: Map<string, number>;
  kind: StockKind;
  reason?: string | null;
  changedBy?: string | null;
  ref?: string | null;
}): MovementInput[] {
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
  return rows;
}

export async function logStockDiff(
  env: Env,
  opts: Parameters<typeof buildStockDiffMovements>[0]
): Promise<void> {
  await insertMovements(env, buildStockDiffMovements(opts));
}

export async function resolveChangedBy(env: Env, userId: string | null): Promise<string | null> {
  return userLabel(env, userId);
}
