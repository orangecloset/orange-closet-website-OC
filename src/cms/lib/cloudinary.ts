import imageCompression from "browser-image-compression";
import { authHeaders } from "../store/auth";

type SignedUpload = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  publicId: string;
  folder: string;
  signature: string;
};

async function getSignedParams(): Promise<SignedUpload> {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to sign upload (${res.status})`);
  return res.json() as Promise<SignedUpload>;
}

export type UploadPreset = "product" | "hero" | "raw";

const PRESETS: Record<UploadPreset, { maxWidthOrHeight: number; initialQuality: number } | null> = {
  product: { maxWidthOrHeight: 1200, initialQuality: 0.8 },
  hero: { maxWidthOrHeight: 1750, initialQuality: 0.9 },
  raw: null,
};

const MAX_SIZE_BYTES = 500 * 1024;

async function compress(file: File, preset: UploadPreset): Promise<File> {
  const presetOptions = PRESETS[preset];
  if (!presetOptions) return file;

  if (file.size < MAX_SIZE_BYTES) return file;

  const options = {
    ...presetOptions,
    maxSizeMB: 0.5,
    useWebWorker: true,
    fileType: "image/webp" as const,
  };
  try {
    return await imageCompression(file, options);
  } catch {
    return imageCompression(file, { ...options, fileType: undefined });
  }
}

export async function uploadImage(file: File, preset: UploadPreset = "product"): Promise<string> {
  const [compressed, params] = await Promise.all([compress(file, preset), getSignedParams()]);

  const form = new FormData();
  form.append("file", compressed);
  form.append("api_key", params.apiKey);
  form.append("timestamp", String(params.timestamp));
  form.append("public_id", params.publicId);
  form.append("folder", params.folder);
  form.append("signature", params.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${params.cloudName}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload failed: ${body || res.statusText}`);
  }
  const data = (await res.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error("Cloudinary upload returned no URL");
  return data.secure_url;
}
