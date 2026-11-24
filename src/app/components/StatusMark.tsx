import { useStoreStatus } from "../hooks/useStoreStatus";

export default function StatusMark() {
  const status = useStoreStatus();
  const src = status?.faviconUrl?.trim() || "/favicon.png";

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
      <img
        src={src}
        alt=""
        className="h-6 w-6 object-contain"
        draggable={false}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
