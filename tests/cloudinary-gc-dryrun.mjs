// ---------------------------------------------------------------------------
// Cloudinary GC dry-run — shows which assets would be deleted, deletes nothing.
//
//   node tests/cloudinary-gc-dryrun.mjs
//
// Requires DATABASE_URL + Cloudinary creds in .env.local.
// Mirrors the logic in api/cron/cloudinary-gc.ts.
// ---------------------------------------------------------------------------

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const FOLDER = "orange-closet";
const GRACE_DAYS = 7;

const cloudName =
  process.env.VITE_CLOUDINARY_CLOUD_NAME ?? process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloudName || !apiKey || !apiSecret) {
  console.error("Missing Cloudinary env vars in .env.local");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

async function listAssets() {
  const auth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
  const assets = [];
  let nextCursor;
  do {
    const params = new URLSearchParams({
      type: "upload",
      prefix: `${FOLDER}/`,
      max_results: "500",
    });
    if (nextCursor) params.set("next_cursor", nextCursor);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?${params}`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) throw new Error(`list failed ${res.status}: ${await res.text()}`);
    const data = await res.json();
    assets.push(...data.resources);
    nextCursor = data.next_cursor;
  } while (nextCursor);
  return assets;
}

function collectUrls(value, out) {
  if (typeof value === "string") {
    if (value.includes(`/${FOLDER}/`)) out.add(value);
    return;
  }
  if (Array.isArray(value)) value.forEach((v) => collectUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectUrls(v, out));
}

const sql = neon(process.env.DATABASE_URL);

const assets = await listAssets();
console.log(`Cloudinary assets in "${FOLDER}/": ${assets.length}`);

const referenced = new Set();
const productRows = await sql`select colors from products`;
for (const row of productRows) collectUrls(row.colors, referenced);
const settingRows = await sql`select value from settings`;
for (const row of settingRows) collectUrls(row.value, referenced);
console.log(`Referenced image URLs in database: ${referenced.size}`);

const cutoff = Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000;
const orphans = [];
const keptRecent = [];
for (const a of assets) {
  if ([...referenced].some((url) => url.includes(a.public_id))) continue;
  if (new Date(a.created_at).getTime() < cutoff) orphans.push(a);
  else keptRecent.push(a);
}

console.log(`\nWOULD DELETE (${orphans.length}):`);
orphans.forEach((a) =>
  console.log(`  - ${a.public_id}  (uploaded ${a.created_at}, ${(a.bytes / 1024).toFixed(0)} KB)`)
);
console.log(`\nKEPT — unused but newer than ${GRACE_DAYS} days (${keptRecent.length}):`);
keptRecent.forEach((a) => console.log(`  - ${a.public_id}  (uploaded ${a.created_at})`));
if (orphans.length === 0 && keptRecent.length === 0) {
  console.log("  (none — everything in Cloudinary is referenced)");
}
