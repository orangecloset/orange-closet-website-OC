import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema.js";
import type { Env } from "../env.js";

let cached: ReturnType<typeof drizzle> | null = null;
let cachedUrl: string | null = null;

export function dbAvailable(env: Env): boolean {
  return Boolean(env.DATABASE_URL);
}

function getDb(env: Env) {
  const url = env.DATABASE_URL;
  if (!cached || cachedUrl !== url) {
    cached = drizzle(neon(url), { schema });
    cachedUrl = url;
  }
  return cached;
}

export async function getUserRoleById(env: Env, userId: string): Promise<string | null> {
  try {
    const [row] = await getDb(env)
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return row?.role ?? null;
  } catch {
    return null;
  }
}
