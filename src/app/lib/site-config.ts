import { TYPE_LABELS } from "../../data/products";
import type { ProductType } from "../../data/products";

export const FACEBOOK_PAGE_URL = "https://www.facebook.com/may.orange.986";
export const MESSENGER_URL = "https://m.me/may.orange.986";

const MAIN_NAV_COUNT = 4;

export type NavItem = { label: string; href: string };

export function splitNavItems(types: { label: string; slug: string }[]): {
  main: NavItem[];
  more: NavItem[];
} {
  const items = types.map((t) => ({ label: t.label, href: `/${t.slug}` }));
  if (items.length <= MAIN_NAV_COUNT) return { main: items, more: [] };
  return {
    main: items.slice(0, MAIN_NAV_COUNT - 1),
    more: items.slice(MAIN_NAV_COUNT - 1),
  };
}

const NAV_TYPES = (Object.keys(TYPE_LABELS) as ProductType[]).map((t) => ({
  label: TYPE_LABELS[t],
  slug: t,
}));

const DEFAULT_NAV = splitNavItems(NAV_TYPES);

export const MAIN_NAV_ITEMS = DEFAULT_NAV.main;
export const MORE_NAV_ITEMS = DEFAULT_NAV.more;

export const ABOUT_US_LINKS = [
  { label: "Brand Profile", to: "/about#brand-profile" },
  { label: "Sustainability", to: "/about#sustainability" },
  { label: "Franchising", to: "/about#franchising" },
  { label: "Affiliates", to: "/about#affiliates" },
];

export const BRANCHES = ["Cagayan de Oro", "Iligan City", "Manila City", "Cebu City"];

export const LEGAL_LINKS = ["Terms of Use", "Privacy Policy", "Cookies Policy"];

export const LOCATION_LABEL =
  "CAGAYAN TOWN CENTER (CTC) 2nd floor of YAKIMIX, Cagayan de Oro City";
