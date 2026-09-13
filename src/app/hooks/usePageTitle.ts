import { useEffect } from "react";
import { useCatalog } from "../data/CatalogContext";

export function usePageTitle(title?: string) {
  let base = "Store";
  try {
    const { settings } = useCatalog();
    base = settings.storeName || "Store";
  } catch {
    // outside CatalogProvider — use default
  }
  useEffect(() => {
    document.title = title ? `${title} · ${base}` : base;
  }, [title, base]);
}
