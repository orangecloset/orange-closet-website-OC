import { useEffect, useState } from "react";

type Branding = {
  storeName?: string;
  tagline?: string;
  messageButtonLabel?: string;
  messengerUrl?: string;
  locationText?: string;
};

type StatusPayload = {
  faviconUrl?: string;
  branding?: Branding;
};

const BRANDING_CACHE_KEY = "orange-lock-branding";

function readBrandingCache(): StatusPayload | null {
  try {
    const raw = localStorage.getItem(BRANDING_CACHE_KEY);
    return raw ? (JSON.parse(raw) as StatusPayload) : null;
  } catch {
    return null;
  }
}

function writeBrandingCache(data: StatusPayload): void {
  try {
    localStorage.setItem(BRANDING_CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export default function CatalogLockScreen() {
  const [status, setStatus] = useState<StatusPayload | null>(() =>
    readBrandingCache()
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/status")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: StatusPayload) => {
        if (!cancelled) {
          setStatus(data);
          writeBrandingCache(data);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) {
    return <div className="min-h-screen bg-white" aria-busy="true" />;
  }

  const b = status.branding ?? {};
  const faviconUrl = status.faviconUrl?.trim();
  const storeName = b.storeName?.trim();
  const tagline = b.tagline?.trim();
  const messageButtonLabel = b.messageButtonLabel?.trim();
  const messengerUrl = b.messengerUrl?.trim();
  const locationText = b.locationText?.trim();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center font-sans text-black">
      {faviconUrl && (
        <img
          src={faviconUrl}
          alt=""
          className="mb-6 h-16 w-16 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      {storeName && (
        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-[0.15em] whitespace-nowrap" style={{ fontFamily: "'Cinzel', serif", WebkitTextStroke: "0.5px" }}>
          {storeName}
        </h1>
      )}
      {tagline && <p className="mt-3 text-sm text-gray-500">{tagline}</p>}

      {messengerUrl && (
        <a
          href={messengerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block border border-black px-8 py-2.5 text-xs uppercase tracking-widest transition-colors hover:bg-black hover:text-white"
        >
          {messageButtonLabel || "Message Us"}
        </a>
      )}

      <footer className="absolute inset-x-0 bottom-0 flex justify-center pb-8">
        {locationText && (
          <p className="px-4 text-xs sm:text-sm text-gray-500">{locationText}</p>
        )}
      </footer>
    </div>
  );
}
