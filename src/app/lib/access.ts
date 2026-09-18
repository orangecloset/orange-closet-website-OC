const ACCESS_KEY = "orange-catalog-access";

export type CatalogAccessStore = {
  mode: "grant" | "share";
  token: string;
  uid: string;
};

function getCatalogAccess(): CatalogAccessStore | null {
  try {
    const raw = localStorage.getItem(ACCESS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<CatalogAccessStore> as CatalogAccessStore;
  } catch {
    return null;
  }
}

export function getCatalogToken(): string | null {
  return getCatalogAccess()?.token ?? null;
}

export function getCatalogMode(): "grant" | "share" | null {
  return getCatalogAccess()?.mode ?? null;
}

export function getCatalogUid(): string | null {
  return getCatalogAccess()?.uid ?? null;
}

export function setCatalogAccess(access: CatalogAccessStore): void {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

export function clearCatalogToken(): void {
  localStorage.removeItem(ACCESS_KEY);
}
