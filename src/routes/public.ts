import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../lib/db.js";
import type { Env } from "../env.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/store-name", async (c) => {
  try {
    const db = getDb(c.env);
    const [row] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "storeName"));
    const name = (row?.value as string) ?? "";
    return c.json({ storeName: name });
  } catch {
    return c.json({ storeName: "" });
  }
});

export default app;
