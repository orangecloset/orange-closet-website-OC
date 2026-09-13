import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "../lib/api";
import type { CmsProduct } from "../store/types";
import { Button } from "../components/ui";
import { ProductFormInner } from "../components/ProductFormInner";

export default function ProductFormPage() {
  const { productId } = useParams();
  const [fetched, setFetched] = useState<CmsProduct | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">(
    productId ? "loading" : "ready"
  );

  useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    setState("loading");
    api
      .getProduct(productId)
      .then((p) => {
        if (cancelled) return;
        setFetched(p);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (productId && state === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--fg-muted)]" />
      </div>
    );
  }

  if (productId && (state === "missing" || !fetched)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-[var(--fg-muted)]">Product not found. It may have been deleted.</p>
        <Link to="/admin/products"><Button variant="secondary" size="small">Back to products</Button></Link>
      </div>
    );
  }

  return <ProductFormInner editing={productId && fetched ? fetched : undefined} />;
}
