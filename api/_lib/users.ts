import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../../db/schema.js";

let cached: ReturnType<typeof drizzle> | null = null;

export function dbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function getDb() {
  if (!cached) {
    const url = process.env.DATABASE_URL!;
    cached = drizzle(neon(url), { schema });
  }
  return cached;
}

export async function getUserRoleById(userId: string): Promise<string | null> {
  try {
    const [row] = await getDb()
      .select({ role: schema.users.role })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    return row?.role ?? null;
  } catch {
    return null;
  }
}
