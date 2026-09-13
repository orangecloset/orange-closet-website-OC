import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { uploadImage, type UploadPreset } from "../lib/cloudinary";
import { useToast } from "../store/toastContext";
import { Button } from "./ui";

export function UploadButton({
  onUploaded,
  label = "Upload",
  preset = "product",
}: {
  onUploaded: (url: string) => void;
  label?: string;
  preset?: UploadPreset;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            showToast("Only image files are allowed.");
            return;
          }
          if (file.size > 5 * 1024 * 1024) {
            showToast("Image must be under 5 MB.");
            return;
          }
          setBusy(true);
          try {
            onUploaded(await uploadImage(file, preset));
          } catch (err) {
            console.error("[cms] image upload failed", err);
            showToast("Image upload failed. Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button
        variant="secondary"
        size="small"
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        {busy ? "Uploading..." : label}
      </Button>
    </>
  );
}
