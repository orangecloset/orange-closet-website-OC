import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema.js";
import type { Env } from "../env.js";

let cached: ReturnType<typeof drizzle> | null = null;
let cachedUrl: string | null = null;

export function getDb(env: Env) {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!cached || cachedUrl !== url) {
    cached = drizzle(neon(url), { schema });
    cachedUrl = url;
  }
  return cached;
}

export { schema };
