import {
  TYPE_LABELS,
  TYPE_ROUTES,
} from "../../data/products";
import type { ProductColor } from "../../data/products";
import { randomString, randomPin } from "../lib/utils";
import type {
  AboutPageConfig,
  CatalogLink,
  CmsProduct,
  HomepageConfig,
  ProductStatus,
  ProductTypeInfo,
  SettingsConfig,
} from "./types";

const PRODUCTS_KEY = "orange-cms-products";
export const LINK_KEY = "orange-cms-catalog-link";
const HOMEPAGE_KEY = "orange-cms-homepage";
const TYPES_KEY = "orange-cms-types";
export const SETTINGS_KEY = "orange-cms-settings";
const ABOUT_KEY = "orange-cms-about";
const RECENT_SALES_KEY = "orange-cms-recent-sales";

export {
  PRODUCTS_KEY,
  HOMEPAGE_KEY,
  TYPES_KEY,
  ABOUT_KEY,
  RECENT_SALES_KEY,
};

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function migrateProducts(products: CmsProduct[]): CmsProduct[] {
  return products.map((p) => {
    const colors = p.colors.map((c) => {
      const color = c as Record<string, unknown>;
      if (Array.isArray(color.sizes) && color.sizes.length > 0) return c;
      const legacyStock =
        typeof color.stock === "number"
          ? color.stock
          : typeof (color as { sizes?: unknown }).sizes === "undefined"
            ? 0
            : NaN;
      const stockNum = Number.isNaN(legacyStock) ? 0 : (legacyStock as number);
      const sizeList: string[] =
        p.sizes && p.sizes.length > 0 ? p.sizes : ["One Size"];
      return {
        ...c,
        sizes: sizeList.map((s: string) => ({ size: s, stock: stockNum })),
      } as ProductColor;
    });
    const totalStock = colors.reduce(
      (sum, c) => sum + (c.sizes ?? []).reduce((s, vs) => s + vs.stock, 0),
      0
    );
    const status: ProductStatus =
      ((p as Record<string, unknown>).status as ProductStatus) ?? "active";
    return {
      ...p,
      colors,
      stock: totalStock,
      status,
    } as CmsProduct;
  });
}

export function seedHomepage(): HomepageConfig {
  return { heroes: [], brands: [], featuredIds: [], bestSellerIds: [], heroImageClickable: false, showOnSale: true, showNewArrivals: true };
}

const DEFAULT_TYPE_SLUGS = ["bags", "jeweleries", "watches", "shoes"] as const;

const TYPE_TAGLINES: Record<string, string> = {
  bags: "Carry the moment.",
  jeweleries: "Adorn the everyday.",
  watches: "Timeless in every detail.",
  shoes: "Walk in confidence.",
};

export function seedTypes(): ProductTypeInfo[] {
  return DEFAULT_TYPE_SLUGS.map((slug) => ({
    slug,
    label: TYPE_LABELS[slug],
    route: TYPE_ROUTES[slug],
    tagline: TYPE_TAGLINES[slug] ?? "",
    heroImage: "",
    categories: [],
    builtin: true,
  }));
}

export function seedSettings(): SettingsConfig {
  return {
    storeName: "",
    tagline: "",
    facebookUrl: "",
    messengerUrl: "",
    aboutLinks: [],
    branchLinks: [],
    legalLinks: [],
    conciergeHeading: "",
    conciergeText: "",
    messageButtonLabel: "",
    locationText: "",
    locationUrl: "",
    socials: [
      { label: "Facebook", url: "" },
      { label: "Instagram", url: "" },
      { label: "YouTube", url: "" },
      { label: "Twitter", url: "" },
    ],
    copyrightText: "",
    showShareButton: true,
    showStockOnStorefront: true,
    newArrivalDays: 30,
    faviconUrl: "/favicon.png",
    ogImageUrl: "/og-image.jpg",
  };
}

export function seedAbout(): AboutPageConfig {
  return {
    heroHeading: "",
    heroSubtitle: "",
    sections: [],
  };
}

export function createCatalogLinkValue(): CatalogLink {
  return {
    uid: randomString(8),
    pin: randomPin(),
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function loadLinks(): CatalogLink[] {
  try {
    const raw = localStorage.getItem(LINK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((l) => ({
        uid: l.uid,
        pin: l.pin,
        active: l.active,
        createdAt: l.createdAt ?? l.lastRegeneratedAt ?? new Date().toISOString(),
      }));
    }
    if (parsed && typeof parsed === "object") {
      return [
        {
          uid: parsed.uid,
          pin: parsed.pin,
          active: parsed.active,
          createdAt: parsed.lastRegeneratedAt ?? new Date().toISOString(),
        },
      ];
    }
    return [];
  } catch {
    return [];
  }
}

export function applyBranding(settings?: SettingsConfig) {
  const s = settings ?? load(SETTINGS_KEY, seedSettings());
  if (typeof document === "undefined") return;
  const favicon = s.faviconUrl?.trim() || "/favicon.png";
  const ogImage = s.ogImageUrl?.trim() || "/og-image.jpg";
  document.querySelectorAll('link[rel="icon"]').forEach((el) => {
    el.setAttribute("href", favicon);
  });
  document
    .querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]')
    .forEach((el) => {
      el.setAttribute("content", ogImage);
    });
}
