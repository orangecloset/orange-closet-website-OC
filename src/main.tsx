/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import App from "./app/App.tsx";
import { StoreProvider } from "./app/hooks/useStore.tsx";
import { CatalogProvider } from "./app/data/CatalogContext.tsx";
import { applyBranding } from "./cms/store/defaults";
import { ErrorBoundary } from "./app/components/ErrorBoundary.tsx";
import "./styles/index.css";

const AdminApp = lazy(() => import("./cms/AdminApp.tsx"));
const CatalogAccessPage = lazy(() => import("./app/pages/CatalogAccessPage.tsx"));

applyBranding();

function CatalogManifest() {
  const { pathname, search } = useLocation();
  const hasShareToken = search.includes("t=");
  const isStaffCatalog = pathname.startsWith("/catalog/") && !hasShareToken;
  const isAdmin = pathname.startsWith("/cms-admin");
  const shouldInject = isStaffCatalog || isAdmin;

  useEffect(() => {
    if (!shouldInject) return;
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/manifest.json";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [shouldInject]);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <ErrorBoundary>
      <BrowserRouter>
        <CatalogManifest />
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-white">
              <p className="text-xs uppercase tracking-widest text-gray-400">Loading…</p>
            </div>
          }
        >
          <Routes>
            <Route path="/cms-admin/*" element={<AdminApp />} />
            <Route path="/catalog/:uid" element={<CatalogAccessPage />} />
            <Route
              path="/*"
              element={
                <CatalogProvider>
                  <App />
                </CatalogProvider>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </StoreProvider>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}
