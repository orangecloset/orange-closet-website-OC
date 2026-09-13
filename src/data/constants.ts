import type { Category, Product, ProductColor, ProductType } from "./types";

export const TYPE_LABELS: Record<ProductType, string> = {
  bags: "Bags",
  jeweleries: "Jeweleries",
  watches: "Watches",
  shoes: "Shoes",
};

export const TYPE_ROUTES: Record<ProductType, string> = {
  bags: "/bags",
  jeweleries: "/jeweleries",
  watches: "/watches",
  shoes: "/shoes",
};

export const TYPE_CATEGORIES: Record<ProductType, Category[]> = {
  bags: [
    { label: "All Bags", slug: "" },
    { label: "Tote Bags", slug: "tote-bags" },
    { label: "Crossbody Bags", slug: "crossbody-bags" },
    { label: "Clutches", slug: "clutches" },
    { label: "Backpacks", slug: "backpacks" },
    { label: "Shoulder Bags", slug: "shoulder-bags" },
  ],
  watches: [
    { label: "All Watches", slug: "" },
    { label: "Smart Watches", slug: "smart-watches" },
    { label: "Analog Watches", slug: "analog-watches" },
    { label: "Digital Watches", slug: "digital-watches" },
    { label: "Luxury Watches", slug: "luxury-watches" },
  ],
  jeweleries: [
    { label: "All Jeweleries", slug: "" },
    { label: "Necklaces", slug: "necklaces" },
    { label: "Earrings", slug: "earrings" },
    { label: "Bracelets", slug: "bracelets" },
    { label: "Rings", slug: "rings" },
    { label: "Anklets", slug: "anklets" },
  ],
  shoes: [
    { label: "All Shoes", slug: "" },
    { label: "Sneakers", slug: "sneakers" },
    { label: "Heels", slug: "heels" },
    { label: "Boots", slug: "boots" },
    { label: "Sandals", slug: "sandals" },
    { label: "Loafers", slug: "loafers" },
    { label: "Mary Janes", slug: "mary-janes" },
  ],

};

export const getCategoryLabel = (type: ProductType, category: string): string | undefined =>
  TYPE_CATEGORIES[type].find((c) => c.slug === category)?.label;

export const primaryColor = (p: Product): ProductColor => p.colors[0];

export const colorSwatchCss = (colors: string[]): string => {
  const list = colors.filter((c) => typeof c === "string" && c.trim() !== "");
  if (list.length === 0) return "#e5e7eb";
  if (list.length === 1) return list[0];
  const slice = 360 / list.length;
  const stops = list.map((c, i) => `${c} ${i * slice}deg ${(i + 1) * slice}deg`).join(", ");
  return `conic-gradient(${stops})`;
};

export const productColorCss = (color: Pick<ProductColor, "hex" | "hexes">): string =>
  colorSwatchCss(color.hexes && color.hexes.length > 0 ? color.hexes : [color.hex]);
