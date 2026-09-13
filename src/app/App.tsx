import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ShareModal from "./components/ShareModal";
import ScrollToTopButton from "./components/ScrollToTopButton";
import ScrollHint from "./components/ScrollHint";
import HomePage from "./pages/HomePage";
import CategoryPage from "./pages/CategoryPage";
import CollectionPage from "./pages/CollectionPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import AboutPage from "./pages/AboutPage";
import LegalPage from "./pages/LegalPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useCatalog } from "./data/CatalogContext";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { getCatalogToken, getCatalogMode } from "./lib/access";
import CatalogLockScreen from "./components/CatalogLockScreen";

export default function App() {
  const [shareOpen, setShareOpen] = useState(false);
  const { newArrivals, bestSellerProducts, onSaleProducts, settings, locked, loading } = useCatalog();
  useScrollRestoration();

  if (locked || !getCatalogToken()) {
    return <CatalogLockScreen />;
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Header
        onShare={() => setShareOpen(true)}
        showShare={settings.showShareButton && getCatalogMode() === "grant"}
      />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products/:productId" element={<ProductDetailPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/legal/:slug" element={<LegalPage />} />
          <Route
            path="/new-arrivals"
            element={<CollectionPage title="New Arrivals" products={newArrivals} />}
          />
          <Route
            path="/best-sellers"
            element={<CollectionPage title="Best Sellers" products={bestSellerProducts} />}
          />
          <Route
            path="/sale"
            element={<CollectionPage title="On Sale" products={onSaleProducts} variant="sale" />}
          />
          <Route path="/:type/:category" element={<CategoryPage />} />
          <Route path="/:type" element={<CategoryPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {!loading && <Footer />}
      {shareOpen && <ShareModal onClose={() => setShareOpen(false)} />}
      {!loading && <ScrollToTopButton />}
      {!loading && <ScrollHint />}
    </div>
  );
}
