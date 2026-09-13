import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import usersRoutes from "./routes/users.js";
import productsRoutes from "./routes/products.js";
import salesRoutes from "./routes/sales.js";
import settingsRoutes from "./routes/settings.js";
import uploadRoutes from "./routes/upload.js";
import catalogLinksRoutes from "./routes/catalog-links.js";
import accountRoutes from "./routes/account.js";
import { runCloudinaryGC } from "./routes/cron.js";

const api = new Hono<{ Bindings: Env }>();

api.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "x-catalog-token"],
    exposeHeaders: ["Retry-After"],
  })
);

api.route("/users", usersRoutes);
api.route("/products", productsRoutes);
api.route("/sales", salesRoutes);
api.route("/settings", settingsRoutes);
api.route("/upload", uploadRoutes);
api.route("/catalog-links", catalogLinksRoutes);
api.route("/account", accountRoutes);

// Cloudinary GC: exposed both as /api/cron/cloudinary-gc and via scheduled handler
api.all("/cron/cloudinary-gc", async (c) => {
  const method = c.req.method;
  if (method !== "GET" && method !== "POST") {
    return c.json({ error: "Method not allowed" }, 405);
  }

  const secret = c.env.CRON_SECRET;
  const authHeader = c.req.header("authorization");
  const cronAuthed = Boolean(secret) && authHeader === `Bearer ${secret}`;

  const { getAuthUser } = await import("./lib/auth.js");
  if (!cronAuthed && !(await getAuthUser(c.env, authHeader))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const dryRun = c.req.query("dry") === "1";
    const result = await runCloudinaryGC(c.env, dryRun);
    return c.json(result);
  } catch (err) {
    console.error("[cloudinary-gc]", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  await next();
  for (const [key, value] of Object.entries(securityHeaders)) {
    c.header(key, value);
  }
});

app.route("/api", api);

// SPA fallback: serve static assets, rewriting non-file paths to /index.html
app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  if (pathname.includes(".") && !pathname.endsWith(".html")) {
    return c.env.ASSETS.fetch(c.req.raw);
  }

  const assetReq = new Request(
    new URL("/index.html", c.req.url).toString(),
    c.req.raw
  );
  return c.env.ASSETS.fetch(assetReq);
});

type CfExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

export default {
  async fetch(request: Request, env: Env, ctx: CfExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx as never);
  },

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async scheduled(event: ScheduledEvent, env: Env, _ctx: CfExecutionContext): Promise<void> {
    console.log(`[cron] Running scheduled Cloudinary GC at ${new Date(event.scheduledTime).toISOString()}`);
    try {
      const result = await runCloudinaryGC(env, false);
      console.log("[cron] GC result:", JSON.stringify(result));
    } catch (err) {
      console.error("[cron] GC failed:", err);
    }
  },
};
