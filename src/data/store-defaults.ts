import type { AboutPageConfig, HomepageConfig, SettingsConfig } from "./store-types";

const HOMEPAGE_KEY = "orange-cms-homepage";
const TYPES_KEY = "orange-cms-types";
const SETTINGS_KEY = "orange-cms-settings";
const ABOUT_KEY = "orange-cms-about";

export { HOMEPAGE_KEY, TYPES_KEY, SETTINGS_KEY, ABOUT_KEY };

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function seedHomepage(): HomepageConfig {
  return { heroes: [], brands: [], featuredIds: [], bestSellerIds: [], heroImageClickable: false, showOnSale: true, showNewArrivals: true };
}

export function seedSettings(): SettingsConfig {
  return {
    storeName: "",
    headerSubtitle: "",
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
    heroTextBlack: false,
    sections: [],
  };
}

export function normalizeAbout(raw: unknown): AboutPageConfig {
  const merged: Partial<AboutPageConfig> =
    typeof raw === "object" && raw !== null ? (raw as Partial<AboutPageConfig>) : {};
  const sections = Array.isArray(merged.sections) ? merged.sections : [];
  return {
    ...seedAbout(),
    ...merged,
    sections: sections.map((s, i) => {
      const sec = (typeof s === "object" && s !== null ? s : {}) as Partial<
        AboutPageConfig["sections"][number]
      >;
      return {
        id: typeof sec.id === "string" && sec.id.trim() ? sec.id : `section-${i}`,
        label: sec.label ?? "",
        enabled: sec.enabled ?? true,
        heading: sec.heading ?? "",
        body: Array.isArray(sec.body) ? sec.body : [],
        images: Array.isArray(sec.images) ? sec.images : [],
        cards: (Array.isArray(sec.cards) ? sec.cards : []).map((c) => ({
          title: c?.title ?? "",
          description: c?.description ?? "",
          image: c?.image ?? "",
        })),
        closingText: sec.closingText ?? "",
        ctaLabel: sec.ctaLabel ?? "",
        ctaUrl: sec.ctaUrl ?? "",
      };
    }),
  };
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
