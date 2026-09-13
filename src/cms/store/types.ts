import type { Product } from "../../data/products";

export type ProductStatus = "draft" | "active";

export type CmsProduct = Omit<Product, "type"> & {
  type: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  stock?: number;
};

export const DEFAULT_NEW_ARRIVAL_DAYS = 30;

export function isNewProduct(
  product: Pick<CmsProduct, "createdAt">,
  days: number = DEFAULT_NEW_ARRIVAL_DAYS
): boolean {
  return (
    Date.now() - new Date(product.createdAt).getTime() <
    days * 24 * 60 * 60 * 1000
  );
}

export type CatalogLink = {
  uid: string;
  pin?: string;
  active: boolean;
  createdAt: string;
};

export type RecentSale = {
  id: string;
  receiptNo?: string;
  productId?: string;
  productName: string;
  productImage?: string | null;
  colorName: string;
  size: string;
  quantity: number;
  price: string;
  soldAt?: string;
  soldBy?: string | null;
  paymentMethod?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt: string;
};

export type CmsColorInput = {
  name: string;
  hex: string;
  hexes?: string[];
  images: string[];
  stockBySize?: Record<string, number>;
};

export type CmsProductInput = {
  name: string;
  brand?: string;
  type: string;
  category: string;
  categoryLabel: string;
  price: string;
  compareAtPrice?: string | null;
  colors?: CmsColorInput[];
  sizes?: string[];
  status?: ProductStatus;
  sections?: { title: string; body: string }[];
  sectionsOpen?: boolean;
};

export type HomepageHero = {
  id: string;
  label: string;
  subtitle: string;
  src: string;
  mobileSrc: string;
  to: string;
  wide: boolean;
};

export type HomepageConfig = {
  heroes: HomepageHero[];
  brands: string[];
  featuredIds: string[];
  bestSellerIds: string[];
  heroImageClickable: boolean;
  showOnSale: boolean;
};

export type TypeCategory = {
  label: string;
  slug: string;
  tagline?: string;
  heroImage?: string;
};

export type ProductTypeInfo = {
  slug: string;
  label: string;
  route: string;
  tagline: string;
  heroImage: string;
  categories: TypeCategory[];
  builtin: boolean;
};

export type FooterLink = {
  label: string;
  url: string;
  body?: string;
};

export type FooterSocial = {
  label: string;
  url: string;
};

export type SettingsConfig = {
  storeName: string;
  tagline: string;
  faviconUrl: string;
  ogImageUrl: string;
  facebookUrl: string;
  messengerUrl: string;
  aboutLinks: FooterLink[];
  branchLinks: FooterLink[];
  legalLinks: FooterLink[];
  conciergeHeading: string;
  conciergeText: string;
  messageButtonLabel: string;
  locationText: string;
  locationUrl: string;
  socials: FooterSocial[];
  copyrightText: string;
  showShareButton: boolean;
  showStockOnStorefront: boolean;
  newArrivalDays: number;
};

export type AboutPageConfig = {
  heroHeading: string;
  heroSubtitle: string;
  heroImage?: string;
  mobileHeroImage?: string;
  sections: {
    id: string;
    label: string;
    enabled: boolean;
    heading: string;
    body: string[];
    images: string[];
    cards: { title: string; description: string }[];
    closingText: string;
    ctaLabel: string;
    ctaUrl: string;
  }[];
};
