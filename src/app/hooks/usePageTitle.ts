import { useEffect } from "react";

export function usePageTitle(title?: string) {
  useEffect(() => {
    const base = "Orange Closet";
    document.title = title ? `${title} · ${base}` : base;
  }, [title]);
}
