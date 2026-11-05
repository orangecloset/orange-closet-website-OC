import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { MAX_UPLOAD_MB, uploadImage, type UploadPreset } from "../lib/cloudinary";
import { useToast } from "../store/toastContext";
import { Button } from "./ui";

const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export function UploadButton({
  onUploaded,
  label = "Upload",
  preset = "product",
  multiple = false,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  preset?: UploadPreset;
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { showToast } = useToast();

  const handleFiles = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const accepted = images.filter((file) => file.size <= MAX_UPLOAD_BYTES);

    if (accepted.length === 0) {
      showToast(
        images.length === 0
          ? "Only image files are allowed."
          : `Images must be under ${MAX_UPLOAD_MB} MB.`,
        false,
        "error"
      );
      return;
    }
    if (accepted.length < files.length) {
      showToast(
        `Some files were skipped (only images under ${MAX_UPLOAD_MB} MB are allowed).`,
        false,
        "warning"
      );
    }

    setBusy(true);
    setProgress({ done: 0, total: accepted.length });
    let failed = 0;
    for (let i = 0; i < accepted.length; i++) {
      try {
        onUploaded(await uploadImage(accepted[i], preset));
      } catch (err) {
        failed += 1;
        console.error("[cms] image upload failed", err);
      } finally {
        setProgress({ done: i + 1, total: accepted.length });
      }
    }
    setBusy(false);
    setProgress(null);

    if (failed > 0) {
      showToast(
        accepted.length === 1
          ? "Image upload failed. Please try again."
          : `${failed} of ${accepted.length} images failed to upload. Please try again.`,
        false,
        "error"
      );
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) void handleFiles(files);
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
        {busy
          ? progress && progress.total > 1
            ? `Uploading ${progress.done}/${progress.total}...`
            : "Uploading..."
          : label}
      </Button>
    </>
  );
}
