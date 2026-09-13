import { neonAuthEnabled, neonAuthBaseUrl, authClient } from "../lib/neonAuth";

const AUTH_KEY = "orange-cms-auth";

export { neonAuthEnabled, authClient };

export type CmsSession = {
  appToken: string;
  role: string;
  user: { id: string; email: string; name: string; role: string };
};

export async function loginWithNeon(): Promise<CmsSession | "pending"> {
  const sessionRes = await fetch(`${neonAuthBaseUrl}/get-session`, {
    credentials: "include",
  });
  const result = (await sessionRes.json().catch(() => null)) as {
    session?: { token?: string };
  } | null;
  const token = result?.session?.token;
  if (!result?.session || !token) {
    console.error("[cms] getSession returned no session/token:", result);
    throw new Error("We couldn't complete your sign-in. Please try again. (AUTH_01)");
  }

  const res = await fetch("/api/account/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[cms] session exchange failed:", res.status, body);
    if (res.status === 404) {
      throw new Error("Service is temporarily unavailable. Please try again later. (AUTH_02)");
    }
    if (res.status === 501) {
      throw new Error("This service isn't set up right now. Please check back soon. (AUTH_03)");
    }
    if (res.status === 401) {
      throw new Error("We couldn't verify your session. Please sign in again. (AUTH_04)");
    }
    throw new Error(`Sign-in failed. Please try again. (AUTH_${res.status})`);
  }
  const data = (await res.json()) as CmsSession;
  if (!data.appToken) throw new Error("Session exchange returned no app token.");
  if (data.role === "pending") return "pending";

  sessionStorage.setItem(AUTH_KEY, JSON.stringify({ mode: "neon", value: data.appToken, session: data }));
  return data;
}

function readAuth(): { mode?: string; value?: string; session?: CmsSession } | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const auth = readAuth();
  if (!auth?.value) return {};
  return { Authorization: `Bearer ${auth.value}` };
}

export function getCmsSession(): CmsSession | null {
  return readAuth()?.session ?? null;
}

export function updateStoredUser(patch: Partial<CmsSession["user"]>): void {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    if (!raw) return;
    const auth = JSON.parse(raw) as { session?: CmsSession };
    if (auth.session?.user) {
      auth.session.user = { ...auth.session.user, ...patch };
      sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    }
  } catch {
    /* ignore */
  }
}

export function isAuthenticated(): boolean {
  const auth = readAuth();
  return neonAuthEnabled && auth?.mode === "neon" && Boolean(auth.session);
}

export function logout(): void {
  sessionStorage.removeItem(AUTH_KEY);
  void authClient.signOut();
}
