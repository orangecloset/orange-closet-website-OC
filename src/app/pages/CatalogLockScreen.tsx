import { useStoreStatus } from "../hooks/useStoreStatus";
import StatusMark from "../components/StatusMark";

export default function CatalogLockScreen() {
  const status = useStoreStatus();

  if (!status) {
    return <div className="min-h-dvh bg-white" aria-busy="true" />;
  }

  const b = status.branding ?? {};
  const tagline = b.tagline?.trim();
  const messageButtonLabel = b.messageButtonLabel?.trim();
  const messengerUrl = b.messengerUrl?.trim();
  const locationText = b.locationText?.trim();
  const locationUrl = b.locationUrl?.trim();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 text-center font-sans text-black">
      <StatusMark markClassName="mb-6" />
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
          locationUrl ? (
            <a
              href={locationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 text-xs sm:text-sm text-gray-500 transition-colors hover:text-black"
            >
              {locationText}
            </a>
          ) : (
            <p className="px-4 text-xs sm:text-sm text-gray-500">{locationText}</p>
          )
        )}
      </footer>
    </div>
  );
}
