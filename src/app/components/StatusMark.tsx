import { useStoreStatus } from "../hooks/useStoreStatus";

export default function StatusMark({ markClassName = "" }: { markClassName?: string }) {
  const status = useStoreStatus();
  const src = status?.faviconUrl?.trim() || "/favicon.png";
  const b = status?.branding ?? {};
  const storeName = b.storeName?.trim();
  const headerSubtitle = b.headerSubtitle?.trim();

  return (
    <>
      <img
        src={src}
        alt=""
        className={`h-16 w-16 object-contain ${markClassName}`}
        draggable={false}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
      {storeName && (
        <h1
          className="text-xl sm:text-2xl font-black uppercase tracking-[0.15em] whitespace-nowrap"
          style={{ fontFamily: "'Cinzel', serif", WebkitTextStroke: "0.5px" }}
        >
          {storeName}
        </h1>
      )}
      {headerSubtitle && (
        <p
          className="flex items-center gap-2 text-[10px] font-normal tracking-[0.25em] whitespace-nowrap"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          <span aria-hidden="true" className="ln-l" />
          {headerSubtitle}
          <span aria-hidden="true" className="ln-r" />
        </p>
      )}
    </>
  );
}
