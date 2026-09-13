const ACCESS_KEY = "orange-catalog-access";

export type CatalogAccessStore = {
  mode: "grant" | "share";
  token: string;
  uid: string;
};

export function getCatalogToken(): string | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogAccessStore>;
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

export function getCatalogMode(): "grant" | "share" | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogAccessStore>;
    return parsed.mode ?? null;
  } catch {
    return null;
  }
}

export function getCatalogUid(): string | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogAccessStore>;
    return parsed.uid ?? null;
  } catch {
    return null;
  }
}

export function setCatalogAccess(access: CatalogAccessStore): void {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

export function clearCatalogToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}
