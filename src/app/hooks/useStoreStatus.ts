import { useEffect, useState } from "react";

export type StoreBranding = {
  storeName?: string;
  headerSubtitle?: string;
  tagline?: string;
  messageButtonLabel?: string;
  messengerUrl?: string;
  locationText?: string;
  locationUrl?: string;
};

export type StoreStatus = {
  faviconUrl?: string;
  branding?: StoreBranding;
};

const CACHE_KEY = "orange-lock-branding";

function readCache(): StoreStatus | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as StoreStatus) : null;
  } catch {
    return null;
  }
}

function writeCache(data: StoreStatus): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function useStoreStatus(): StoreStatus | null {
  const [status, setStatus] = useState<StoreStatus | null>(() => readCache());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/status")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: StoreStatus) => {
        if (cancelled) return;
        setStatus(data);
        writeCache(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
