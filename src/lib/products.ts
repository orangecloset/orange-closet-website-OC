import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { CmsProduct } from "../../src/cms/store/types";
import type { products } from "../../db/schema.js";

export type ProductRow = InferSelectModel<typeof products>;
export type ProductInsert = InferInsertModel<typeof products>;

export function rowToCmsProduct(row: ProductRow): CmsProduct {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? "",
    type: row.type,
    category: row.category,
    categoryLabel: row.categoryLabel,
    price: row.price,
    ...(row.compareAtPrice ? { compareAtPrice: row.compareAtPrice } : {}),
    colors: (row.colors ?? []) as CmsProduct["colors"],
    sizes: (row.sizes ?? []) as string[],
    sections: (row.sections ?? undefined) as CmsProduct["sections"],
    sectionsOpen: row.sectionsOpen ?? false,
    status: row.status as CmsProduct["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function cmsProductToRow(input: CmsProduct): ProductInsert {
  return {
    id: input.id,
    name: input.name,
    brand: input.brand || null,
    type: input.type,
    category: input.category,
    categoryLabel: input.categoryLabel,
    price: input.price,
    compareAtPrice: input.compareAtPrice || null,
    colors: input.colors ?? [],
    sizes: input.sizes ?? [],
    status: input.status ?? "active",
    sections: input.sections ?? [],
    sectionsOpen: input.sectionsOpen ?? false,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(),
  };
}
