import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import QRCodeStyling from "qr-code-styling";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { getCatalogToken, getCatalogUid } from "../lib/access";
import { useCatalog } from "../data/CatalogContext";

type ShareModalProps = {
  onClose: () => void;
};

export default function ShareModal({ onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { settings } = useCatalog();
  const faviconUrl = settings.faviconUrl?.trim() || "/favicon.png";
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, true, onClose);

  useEffect(() => {
    let cancelled = false;
    const token = getCatalogToken();
    if (!token) {
      setError("Your session has ended. Please unlock the catalog again.");
      return;
    }
    fetch("/api/catalog-links/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Catalog-Token": token },
      body: JSON.stringify({ uid: getCatalogUid() }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          token?: string;
          error?: string;
        } | null;
        if (!cancelled && res.ok && data?.ok && data.token) {
          const uid = getCatalogUid();
          setShareUrl(
            `${window.location.origin}/catalog/${uid}?t=${encodeURIComponent(data.token)}&p=%2F`
          );
        } else if (!cancelled) {
          setError(data?.error ?? "Couldn't create a share link. Please try again.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't create a share link. Please try again.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!shareUrl || !qrContainerRef.current) return;
    const container = qrContainerRef.current;
    container.innerHTML = "";
    const qr = new QRCodeStyling({
      width: 200,
      height: 200,
      margin: 0,
      data: shareUrl,
      image: faviconUrl,
      imageOptions: { hideBackgroundDots: true, imageSize: 0.4, margin: 4 },
      dotsOptions: { type: "dots", color: "#1a1a1a" },
      cornersSquareOptions: { type: "extra-rounded", color: "#1a1a1a" },
      cornersDotOptions: { type: "dot", color: "#1a1a1a" },
      backgroundOptions: { color: "white" },
    });
    qr.append(container);
  }, [shareUrl, faviconUrl]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Share this page"
        className="bg-white p-6 sm:p-8 w-[320px] sm:w-[380px] relative outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-black">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-2 text-center">Share this page</h3>
        <p className="text-xs text-gray-500 text-center mb-4">
          This link will expire within 2 hours.
        </p>

        {error ? (
          <p className="text-center text-xs text-red-600">{error}</p>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div
                ref={qrContainerRef}
                className="h-49 w-47 sm:h-52 sm:w-52 flex items-center justify-center"
              >
                {!shareUrl && (
                  <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                )}
              </div>
            </div>
            {shareUrl && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 min-w-0 text-xs border border-gray-200 px-3 py-2.5 bg-gray-50 truncate rounded-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="shrink-0 text-xs uppercase tracking-wide border border-black px-4 py-2.5 hover:bg-black hover:text-white transition-colors"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
