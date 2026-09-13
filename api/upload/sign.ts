import crypto from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { json, methodNotAllowed, serverError, unauthorized } from "../_lib/http.js";
import { isAuthorized } from "../_lib/auth.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!(await isAuthorized(req))) return unauthorized(res);

  const cloudName =
    process.env.VITE_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return serverError(res, new Error("Cloudinary env vars are not configured"));
  }

  const folder = "orange-closet";
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folder}/${timestamp}-${crypto.randomBytes(6).toString("hex")}`;

  const signature = crypto
    .createHash("sha1")
    .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  return json(res, 200, { cloudName, apiKey, timestamp, publicId, folder, signature });
}
