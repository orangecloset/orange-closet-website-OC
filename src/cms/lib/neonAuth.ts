import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

const baseUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

export const neonAuthEnabled = Boolean(baseUrl);
export const neonAuthBaseUrl = baseUrl ?? "";

export const authClient = createAuthClient(baseUrl ?? "http://localhost", {
  adapter: BetterAuthReactAdapter(),
});
