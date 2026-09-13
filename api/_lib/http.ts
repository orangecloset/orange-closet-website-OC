import type { VercelResponse } from "@vercel/node";

export function json(res: VercelResponse, status: number, data: unknown) {
  return res.status(status).json(data);
}

export function badRequest(res: VercelResponse, message: string) {
  return json(res, 400, { error: message });
}

export function notFound(res: VercelResponse, message = "Not found") {
  return json(res, 404, { error: message });
}

export function unauthorized(res: VercelResponse) {
  return json(res, 401, { error: "Unauthorized" });
}

export function serverError(res: VercelResponse, err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  console.error("[api]", detail);
  return json(res, 500, { error: "Internal server error" });
}

export function methodNotAllowed(res: VercelResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  return json(res, 405, { error: "Method not allowed" });
}
