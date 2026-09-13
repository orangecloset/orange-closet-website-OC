import { Hono } from "hono";
import { isAuthorized } from "../lib/auth.js";
import type { Env } from "../env.js";

const app = new Hono<{ Bindings: Env }>();

app.post("/", async (c) => {
  if (!(await isAuthorized(c.env, c.req.header("authorization")))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const cloudName = c.env.VITE_CLOUDINARY_CLOUD_NAME || c.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = c.env.CLOUDINARY_API_KEY;
  const apiSecret = c.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return c.json({ error: "Cloudinary env vars are not configured" }, 500);
  }

  const crypto = await import("node:crypto");
  const folder = "orange-closet";
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `${folder}/${timestamp}-${crypto.randomBytes(6).toString("hex")}`;

  const signature = crypto
    .createHash("sha1")
    .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  return c.json({ cloudName, apiKey, timestamp, publicId, folder, signature });
});

export default app;
