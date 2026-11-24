import { useStoreStatus } from "../hooks/useStoreStatus";

export default function StatusMark() {
  const status = useStoreStatus();
  const src = status?.faviconUrl?.trim() || "/favicon.png";

  return (
    <img
      src={src}
      alt=""
      className="h-16 w-16 object-contain"
      draggable={false}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}
