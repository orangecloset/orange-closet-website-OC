import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Clock, Lock, ShieldAlert } from "lucide-react";
import { setCatalogAccess } from "../lib/access";

type PageState = "checking" | "pin" | "expired" | "revoked" | "error";

export default function CatalogAccessPage() {
  const { uid } = useParams<{ uid: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<PageState>(
    searchParams.get("t") ? "checking" : "pin"
  );
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const shareToken = searchParams.get("t");
    if (!shareToken) return;

    let cancelled = false;
    fetch(`/api/catalog-links/verify?t=${encodeURIComponent(shareToken)}`)
      .then((r) => r.json())
      .then((data: { valid: boolean; reason?: string; uid?: string }) => {
        if (cancelled) return;
        if (data.valid && data.uid) {
          setCatalogAccess({ mode: "share", token: shareToken, uid: data.uid });
          navigate(searchParams.get("p") || "/", { replace: true });
          return;
        }
        if (data.reason === "revoked") setState("revoked");
        else setState("expired");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    if (!uid || !pin || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/catalog-links/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, pin }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        token?: string;
        error?: string;
        code?: string;
      } | null;
      if (res.ok && data?.ok && data.token) {
        setCatalogAccess({ mode: "grant", token: data.token, uid });
        navigate("/", { replace: true });
        return;
      }
      if (data?.code === "LINK_REVOKED") {
        setState("revoked");
      } else if (res.status === 429) {
        setError(
          data?.error ?? "Too many attempts. Please wait a minute and try again."
        );
      } else {
        setError(data?.error ?? "Couldn't unlock this link. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-xs uppercase tracking-widest text-gray-400">Checking link…</p>
      </div>
    );
  }

  if (state === "expired") {
    return (
      <Frame
        icon={<Clock className="h-6 w-6 text-gray-500" />}
        title="Link Expired"
        message="This share link has expired. Please contact the store for a new link."
      />
    );
  }

  if (state === "revoked") {
    return (
      <Frame
        icon={<ShieldAlert className="h-6 w-6 text-gray-500" />}
        title="Link Revoked"
        message="This access link is no longer active. Please contact the store for assistance."
      />
    );
  }

  if (state === "error") {
    return (
      <Frame
        icon={<ShieldAlert className="h-6 w-6 text-gray-500" />}
        title="Something went wrong"
        message="We couldn't verify your link. Please try opening it again."
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      <form
        onSubmit={handleUnlock}
        className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Lock className="h-6 w-6 text-gray-500" />
        </div>
        <h1 className="text-sm font-semibold uppercase tracking-widest text-black">
          Staff Access
        </h1>
        <p className="text-xs leading-relaxed text-gray-500">
          Enter the PIN provided by the admin to unlock this catalog.
        </p>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter PIN"
          autoFocus
          className="w-full border border-gray-200 px-3 py-2.5 text-center font-mono text-sm tracking-[0.3em] outline-none focus:border-black"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || pin.length === 0}
          className="w-full border border-black px-4 py-2.5 text-xs uppercase tracking-wide transition-colors hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

function Frame({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        {icon}
      </div>
      <h1 className="text-sm font-semibold uppercase tracking-widest text-black">{title}</h1>
      <p className="max-w-xs text-xs leading-relaxed text-gray-500">{message}</p>
    </div>
  );
}
