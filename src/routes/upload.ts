import { Hono, type Context } from "hono";
import { isAuthorized } from "../lib/auth.js";
import type { Env } from "../env.js";

const DEFAULT_FOLDER = "orange-closet";
const ALLOWED_FOLDERS = new Set([
  DEFAULT_FOLDER,
  "orange-closet/hero",
  "orange-closet/settings",
]);

type UploadContext = Context<{ Bindings: Env }>;

async function signUpload(c: UploadContext) {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const cloudName = c.env.VITE_CLOUDINARY_CLOUD_NAME || c.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = c.env.CLOUDINARY_API_KEY;
  const apiSecret = c.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return c.json({ error: "Cloudinary env vars are not configured" }, 500);
  }

  const body = await c.req.json<{ folder?: string }>().catch(() => null);
  const requested = typeof body?.folder === "string" ? body.folder.trim() : "";
  const folder = requested || DEFAULT_FOLDER;

  if (!ALLOWED_FOLDERS.has(folder)) {
    return c.json({ error: "Invalid upload folder" }, 400);
  }

  const crypto = await import("node:crypto");
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folder}/${timestamp}-${crypto.randomBytes(6).toString("hex")}`;

  const signature = crypto
    .createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  return c.json({ cloudName, apiKey, timestamp, publicId, folder, signature });
}

const app = new Hono<{ Bindings: Env }>();

app.post("/", signUpload);

app.post("/sign", signUpload);

export default app;
