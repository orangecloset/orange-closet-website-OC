import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, schema } from "../_lib/db.js";
import { json, methodNotAllowed, serverError, unauthorized } from "../_lib/http.js";
import { getAuthUser } from "../_lib/auth.js";

const FOLDER = "orange-closet";
const GRACE_DAYS = 7;
const CLOUDINARY_API_BASE = "https://api.cloudinary.com/v1_1";
const MAX_BATCH = 100;

function cloudinaryEnv() {
  const cloudName =
    process.env.VITE_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function adminAuth(apiKey: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

type CloudinaryAsset = { public_id: string; created_at: string };

async function listFolderAssets(
  cloudName: string,
  apiKey: string,
  apiSecret: string
): Promise<CloudinaryAsset[]> {
  const assets: CloudinaryAsset[] = [];
  let nextCursor: string | undefined;

  do {
    const params = new URLSearchParams({
      type: "upload",
      prefix: `${FOLDER}/`,
      max_results: "500",
    });
    if (nextCursor) params.set("next_cursor", nextCursor);

    const res = await fetch(
      `${CLOUDINARY_API_BASE}/${cloudName}/resources/image/upload?${params}`,
      { headers: { Authorization: adminAuth(apiKey, apiSecret) } }
    );
    if (!res.ok) {
      throw new Error(`Cloudinary list failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as {
      resources: CloudinaryAsset[];
      next_cursor?: string;
    };
    assets.push(...data.resources);
    nextCursor = data.next_cursor;
  } while (nextCursor);

  return assets;
}

async function deleteAssets(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  publicIds: string[]
): Promise<void> {
  for (let i = 0; i < publicIds.length; i += MAX_BATCH) {
    const batch = publicIds.slice(i, i + MAX_BATCH);
    const params = new URLSearchParams();
    batch.forEach((id) => params.append("public_ids[]", id));
    const res = await fetch(
      `${CLOUDINARY_API_BASE}/${cloudName}/resources/image/upload?${params}`,
      {
        method: "DELETE",
        headers: { Authorization: adminAuth(apiKey, apiSecret) },
      }
    );
    if (!res.ok) {
      throw new Error(`Cloudinary delete failed (${res.status}): ${await res.text()}`);
    }
  }
}

function collectCloudinaryUrls(value: unknown, out: Set<string>) {
  if (typeof value === "string") {
    if (value.includes(`/${FOLDER}/`)) out.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => collectCloudinaryUrls(v, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => collectCloudinaryUrls(v, out));
  }
}

async function collectReferencedUrls(): Promise<Set<string>> {
  const db = getDb();
  const urls = new Set<string>();

  const productRows = await db.select({ colors: schema.products.colors }).from(schema.products);
  for (const row of productRows) collectCloudinaryUrls(row.colors, urls);

  const settingsRows = await db.select({ value: schema.settings.value }).from(schema.settings);
  for (const row of settingsRows) collectCloudinaryUrls(row.value, urls);

  const saleRows = await db.select({ productImage: schema.sales.productImage }).from(schema.sales);
  for (const row of saleRows) collectCloudinaryUrls(row.productImage, urls);

  return urls;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  // Two ways in: Vercel Cron (bearer CRON_SECRET) or an authenticated
  // CMS admin (manual cleanup button in Settings).
  const secret = process.env.CRON_SECRET;
  const cronAuthed =
    Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
  if (!cronAuthed && !(await getAuthUser(req))) {
    return unauthorized(res);
  }

  try {
    const env = cloudinaryEnv();
    if (!env) {
      return serverError(res, new Error("Cloudinary env vars are not configured"));
    }

    const dryRun = req.query.dry === "1";

    const [assets, referencedUrls] = await Promise.all([
      listFolderAssets(env.cloudName, env.apiKey, env.apiSecret),
      collectReferencedUrls(),
    ]);

    const cutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000;
    const orphans = assets.filter(
      (asset) =>
        !referencedUrls.has(asset.public_id) &&
        ![...referencedUrls].some((url) => url.includes(asset.public_id)) &&
        new Date(asset.created_at).getTime() < cutoff
    );

    if (dryRun) {
      return json(res, 200, {
        ok: true,
        dryRun: true,
        totalAssets: assets.length,
        referencedUrlCount: referencedUrls.size,
        orphans: orphans.map((a) => a.public_id),
      });
    }

    await deleteAssets(
      env.cloudName,
      env.apiKey,
      env.apiSecret,
      orphans.map((a) => a.public_id)
    );

    console.log(
      `[cloudinary-gc] scanned ${assets.length} assets, ${referencedUrls.size} referenced URLs, deleted ${orphans.length} orphan(s)`
    );
    return json(res, 200, {
      ok: true,
      totalAssets: assets.length,
      deletedCount: orphans.length,
      deleted: orphans.map((a) => a.public_id),
    });
  } catch (err) {
    return serverError(res, err);
  }
}
