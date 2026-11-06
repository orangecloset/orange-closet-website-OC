import { useEffect } from "react";
import { useCatalog } from "../context/CatalogContext";

export function usePageTitle(title?: string) {
  const { settings } = useCatalog();
  const base = settings.storeName || "Store";
  useEffect(() => {
    document.title = title ? `${title} · ${base}` : base;
  }, [title, base]);
}
