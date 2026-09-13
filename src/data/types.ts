export type ProductType = "bags" | "watches" | "jeweleries" | "shoes";

export type ProductColorSize = {
  size: string;
  stock: number;
};

export type ProductColor = {
  name: string;
  hex: string;
  hexes?: string[];
  images: string[];
  sizes: ProductColorSize[];
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  type: ProductType;
  category: string;
  categoryLabel: string;
  price: string;
  compareAtPrice?: string;
  isNew?: boolean;
  inStock?: boolean;
  stock?: number;
  colors: ProductColor[];
  sizes: string[];
  sections?: { title: string; body: string }[];
  sectionsOpen?: boolean;
};

export type SpotlightCategory = {
  label: string;
  src: string;
  productId: string;
};

export type StyleImage = {
  user: string;
  src: string;
};

export type Category = {
  label: string;
  slug: string;
};

export type HomeSplit = {
  label: string;
  src: string;
  to: string;
};

function parsePriceValue(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function getSaleInfo(
  price: string,
  compareAtPrice?: string
): { onSale: boolean; label: string; discountPercent: number | null } {
  if (!compareAtPrice) {
    return { onSale: false, label: "", discountPercent: null };
  }

  const priceNum = parsePriceValue(price);
  const compareNum = parsePriceValue(compareAtPrice);

  if (priceNum === null || compareNum === null || compareNum <= priceNum) {
    return { onSale: false, label: "", discountPercent: null };
  }

  const discountPercent = Math.round(((compareNum - priceNum) / compareNum) * 100);

  if (discountPercent <= 0) {
    return { onSale: false, label: "", discountPercent: null };
  }

  return {
    onSale: true,
    label: `Sale ${discountPercent}%`,
    discountPercent,
  };
}
