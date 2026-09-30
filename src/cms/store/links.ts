import { randomPin, randomString } from "../lib/utils";
import type { CatalogLink } from "../../data/store-types";

export const LINK_KEY = "orange-cms-catalog-link";

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
