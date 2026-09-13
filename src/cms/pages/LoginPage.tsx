import { useEffect, useState, type FormEvent } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { loginWithNeon, neonAuthEnabled, authClient } from "../store/auth";
import { Button, Container, Input, Label, PasswordInput } from "../components/ui";
import "../../styles/cms-theme.css";

export default function LoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [statusKnown, setStatusKnown] = useState(!neonAuthEnabled);
  const [isFirstAccount, setIsFirstAccount] = useState(false);
  const [storeName, setStoreName] = useState("");
  const [faviconUrl, setFaviconUrl] = useState(
    () =>
      document.querySelector('link[rel="icon"]')?.getAttribute("href") ||
      "/favicon.png"
  );
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/public/store-name")
      .then((r) => (r.ok ? r.json() : { storeName: "" }))
      .then(({ storeName }: { storeName: string }) => {
        if (storeName) setStoreName(storeName);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!neonAuthEnabled) return;
    fetch("/api/account/status")
      .then((r) => (r.ok ? r.json() : { initialized: true }))
      .then(({ initialized, faviconUrl }: { initialized: boolean; faviconUrl?: string }) => {
        setIsFirstAccount(!initialized);
        if (faviconUrl) setFaviconUrl(faviconUrl);
      })
      .catch(() => setIsFirstAccount(false))
      .finally(() => setStatusKnown(true));
  }, []);

  const handleNeonSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = isFirstAccount
        ? await authClient.signUp.email({
            name: name.trim() || email.split("@")[0],
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });
      if (result?.error) {
        setError(result.error.message || "Authentication failed. Please try again.");
        return;
      }
      const session = await loginWithNeon();
      if (session === "pending") {
        setError("This account is currently blocked. Please contact the super admin.");
        return;
      }
      onSuccess();
    } catch (err) {
      console.error("[cms] neon auth failed", err);
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cms-admin flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] p-4 text-[var(--fg-base)]">
      <Container className="w-full max-w-sm p-8">
        <div className="flex flex-col items-center gap-2 py-4">
          {!faviconFailed && (
            <img
              src={faviconUrl}
              alt=""
              className="h-12 w-12 object-contain"
              onError={() => {
                if (faviconUrl === "/favicon.png") setFaviconFailed(true);
                else setFaviconUrl("/favicon.png");
              }}
            />
          )}
          <h1 className="mt-2 text-lg font-medium text-[var(--fg-base)]">
            {storeName || "Store"}
          </h1>
        </div>

        {!neonAuthEnabled ? (
          <div className="flex flex-col gap-3 rounded-md bg-[var(--bg-subtle)] px-4 py-4 text-center shadow-[var(--borders-base)]">
            <TriangleAlert className="mx-auto h-5 w-5 text-[var(--tag-red-text)]" />
            <p className="text-sm text-[var(--fg-base)]">Authentication is not configured.</p>
            <p className="text-xs text-[var(--fg-subtle)]">
              Set <code className="font-mono">VITE_NEON_AUTH_URL</code> to your Neon Auth base
              URL in the environment, then redeploy.
            </p>
          </div>
        ) : !statusKnown ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-subtle)]" />
          </div>
        ) : (
          <form onSubmit={handleNeonSubmit} className="flex flex-col gap-4">
            {isFirstAccount && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isFirstAccount ? "Choose a password" : "Enter password"}
                autoComplete={isFirstAccount ? "new-password" : "current-password"}
                required
              />
            </div>

            {error && <p className="text-sm text-[var(--fg-error)]">{error}</p>}

            <Button type="submit" variant="primary" size="base" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isFirstAccount ? "Create Account" : "Sign In"}
            </Button>
          </form>
        )}
      </Container>
    </div>
  );
}
