import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, SlidersHorizontal } from "lucide-react";
import type { Product, ProductColor, ProductType } from "../../data/products";
import { productColorCss } from "../../data/products";
import { getSaleInfo } from "../../data/types";
import { useCatalog } from "../data/CatalogContext";
import { useViewport } from "../hooks/useViewport";
import NotFoundPage from "./NotFoundPage";
import { usePageTitle } from "../hooks/usePageTitle";
import ProductCard from "../components/ProductCard";
import ImageWithFallback from "../components/ImageWithFallback";

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Price: Low to High", value: "price-asc" },
  { label: "Price: High to Low", value: "price-desc" },
  { label: "Name: A to Z", value: "name-asc" },
  { label: "Name: Z to A", value: "name-desc" },
];

const SORT_DISPLAY: Record<string, string> = {
  newest: "Newest",
  "price-asc": "Low to High",
  "price-desc": "High to Low",
  "name-asc": "A to Z",
  "name-desc": "Z to A",
};

function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, "")) || 0;
}

function hasNumericPrice(price: string): boolean {
  return /\d/.test(price);
}

function sortByPrice(items: Product[], direction: 1 | -1) {
  const withNumeric = items.filter((p) => hasNumericPrice(p.price));
  const withoutNumeric = items.filter((p) => !hasNumericPrice(p.price));
  withNumeric.sort((a, b) => (parsePrice(a.price) - parsePrice(b.price)) * direction);
  return [...withNumeric, ...withoutNumeric];
}

function isOnSale(product: Product): boolean {
  return getSaleInfo(product.price, product.compareAtPrice).onSale;
}

export default function CategoryPage() {
  const { type, category } = useParams<{ type?: string; category?: string }>();
  const location = useLocation();
  const { productsByType, types, loading } = useCatalog();
  const [sortBy, setSortBy] = useState("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [brand, setBrand] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [availability, setAvailability] = useState<"all" | "available" | "sold">("all");
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const brandRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [catHasMore, setCatHasMore] = useState(false);

  const checkCatScroll = useCallback(() => {
    const el = catScrollRef.current;
    if (!el) return;
    setCatHasMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkCatScroll();
    const el = catScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkCatScroll, { passive: true });
    window.addEventListener("resize", checkCatScroll);
    return () => {
      el.removeEventListener("scroll", checkCatScroll);
      window.removeEventListener("resize", checkCatScroll);
    };
  }, [checkCatScroll, type, category]);

  const cmsType = types.find((t) => t.slug === type);
  const productType = cmsType ? (type as ProductType) : undefined;

  useEffect(() => {
    setBrand("");
    setSelectedColor("");
    setAvailability("all");
    setOnSaleOnly(false);
  }, [type, category]);

  useEffect(() => {
    const close = () => { setSortOpen(false); setBrandOpen(false); setFilterOpen(false); };
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, []);

  useEffect(() => {
    if (!brandOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (brandRef.current && !brandRef.current.contains(e.target as Node)) {
        setBrandOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBrandOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [brandOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterOpen]);

  const brandOptions = useMemo(() => {
    if (!productType) return [];
    const base = productsByType(productType);
    return Array.from(new Set(base.map((p) => p.brand))).sort();
  }, [productType, productsByType]);

  const baseProducts = useMemo(() => {
    if (!productType) return [];
    return category
      ? productsByType(productType).filter((p) => p.category === category)
      : [...productsByType(productType)];
  }, [productType, category, productsByType]);

  const hasSaleItems = useMemo(() => baseProducts.some(isOnSale), [baseProducts]);

  const filtered = useMemo(() => {
    let items = [...baseProducts];
    if (brand) items = items.filter((p) => p.brand === brand);
    if (selectedColor) {
      items = items.filter((p) =>
        p.colors.some((c) => c.name === selectedColor)
      );
    }
    if (availability === "available") {
      items = items.filter((p) => p.inStock !== false);
    } else if (availability === "sold") {
      items = items.filter((p) => p.inStock === false);
    }
    if (onSaleOnly) {
      items = items.filter(isOnSale);
    }

    const sorted = (() => {
      switch (sortBy) {
        case "price-asc":
          return sortByPrice(items, 1);
        case "price-desc":
          return sortByPrice(items, -1);
        case "name-asc":
          return items.sort((a, b) => a.name.localeCompare(b.name));
        case "name-desc":
          return items.sort((a, b) => b.name.localeCompare(a.name));
        default:
          return items;
      }
    })();

    if (availability !== "sold") {
      const inStock = sorted.filter((p) => p.inStock !== false);
      const soldOut = sorted.filter((p) => p.inStock === false);
      return [...inStock, ...soldOut];
    }
    return sorted;
  }, [baseProducts, sortBy, brand, selectedColor, availability, onSaleOnly]);

  const availableColors = useMemo(() => {
    const colorMap = new Map<string, ProductColor>();
    for (const p of baseProducts) {
      for (const c of p.colors) {
        if (!colorMap.has(c.name)) colorMap.set(c.name, c);
      }
    }
    return Array.from(colorMap.values());
  }, [baseProducts]);

  const viewport = useViewport();
  const cols = viewport === "desktop" ? 4 : viewport === "tablet" ? 3 : 2;
  const defaultRows = viewport === "desktop" ? 8 : viewport === "tablet" ? 10 : 14;
  const storageKey = `cat-loaded-rows-${location.pathname}`;
  const [loadedRows, setLoadedRows] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      return saved ? Number(saved) : defaultRows;
    } catch { return defaultRows; }
  });
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setLoadedRows(defaultRows);
    try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [type, category, sortBy, brand, selectedColor, availability, onSaleOnly, viewport, defaultRows, storageKey]);

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, String(loadedRows)); } catch { /* ignore */ }
  }, [storageKey, loadedRows]);

  const visibleProducts = useMemo(
    () => filtered.slice(0, loadedRows * cols),
    [filtered, loadedRows, cols]
  );
  const hiddenCount = Math.max(0, filtered.length - visibleProducts.length);

  const typeLabel = cmsType?.label ?? (productType as string);

  usePageTitle(
    productType
      ? category
        ? cmsType?.categories.find((c) => c.slug === category)?.label || typeLabel
        : `All ${typeLabel}`
      : "Page Not Found"
  );

  if (!productType) {
    if (loading) return null;
    return <NotFoundPage />;
  }

  const categories = [
    { label: `All ${typeLabel}`, slug: "" },
    ...(cmsType?.categories ?? []),
  ];
  const heroImage = category
    ? (cmsType?.categories.find((c) => c.slug === category)?.heroImage ?? cmsType?.heroImage ?? "")
    : (cmsType?.heroImage ?? "");
  const title = category
    ? cmsType?.categories.find((c) => c.slug === category)?.label || category
    : `All ${typeLabel}`;
  const tagline = category
    ? cmsType?.categories.find((c) => c.slug === category)?.tagline
    : cmsType?.tagline;

  return (
    <>
      <section className="relative w-full">
        <div className="block">
          <div className="relative w-full h-[350px] sm:h-auto sm:aspect-[16/9] lg:aspect-[1920/900] bg-gray-200 overflow-hidden">
            {heroImage && (
              <ImageWithFallback
                key={heroImage}
                src={heroImage}
                alt={`${typeLabel} Collection`}
                className="absolute inset-0 w-full h-full object-cover object-center"
                priority
              />
            )}
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0 flex items-center justify-center sm:justify-start sm:pl-16">
              <div className="text-white text-center sm:text-left">
                <Link
                  to="/"
                  className="hidden sm:flex items-center gap-1 text-xs uppercase tracking-widest text-white/80 hover:text-white transition-colors mb-4"
                
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Home
                </Link>
                <h1 className="text-2xl sm:text-3xl lg:text-[2.5rem] font-normal tracking-wide mb-2 hero-title-shadow">{title}</h1>
                {tagline && (
                  <p
                    className="text-white text-[10px] uppercase tracking-widest"
                  
                  >
                    {tagline}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-2.5 sm:px-3.5 lg:px-10 mt-8">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Category</p>
        <div className="relative">
          <div ref={catScrollRef} className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 pr-8">
            {categories.map((cat) => {
              const isActive = cat.slug === "" ? !category : category === cat.slug;
              return (
                <Link
                  key={cat.slug}
                  to={cat.slug ? `/${type}/${cat.slug}` : `/${type}`}
                  className={`text-xs uppercase tracking-widest font-medium whitespace-nowrap px-4 py-2 border transition-colors ${
                    isActive
                      ? "bg-black text-white border-black"
                      : "bg-white border-gray-300 hover:bg-black hover:text-white hover:border-black"
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>
          {catHasMore && (
            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
          )}
        </div>
      </section>

      <section className="px-2.5 sm:px-3.5 lg:px-10 mt-4">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Brand</p>
        <div className="flex items-center pb-2">
          <div className="relative" ref={brandRef}>
            <button
              onClick={() => setBrandOpen(!brandOpen)}
              className="w-[140px] sm:w-[180px] lg:w-[200px] bg-white border border-gray-300 px-3 py-2 text-xs uppercase tracking-widest font-medium text-gray-900 flex items-center justify-between gap-2 hover:border-black transition-colors"
            >
              <span className="truncate">{brand || "All Brands"}</span>
              <ChevronDown className={`w-3 h-3 shrink-0 transition-transform duration-200 ${brandOpen ? "rotate-180" : ""}`} />
            </button>
            {brandOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 shadow-md z-40 min-w-[140px] sm:min-w-[180px] lg:min-w-[200px] max-h-60 overflow-y-auto thin-scrollbar">
                <button
                  onClick={() => { setBrand(""); setBrandOpen(false); }}
                  className={`block w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest hover:bg-gray-50 transition-colors ${brand === "" ? "text-black" : "text-gray-500"}`}
                >
                  All Brands
                </button>
                {brandOptions.map((b) => (
                  <button
                    key={b}
                    onClick={() => { setBrand(b); setBrandOpen(false); }}
                    className={`block w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest hover:bg-gray-50 transition-colors ${brand === b ? "text-black" : "text-gray-500"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-2.5 sm:px-3.5 lg:px-10 mt-6 mb-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <p className="text-xs text-gray-500">{filtered.length} Products</p>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => { setSortOpen(!sortOpen); setFilterOpen(false); }}
                className="text-xs uppercase tracking-widest font-medium flex items-center gap-1"
              >
                Sort by: {SORT_DISPLAY[sortBy]}
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${sortOpen ? "rotate-180" : ""}`} />
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-md z-40 min-w-[180px]">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => { setSortBy(option.value); setSortOpen(false); }}
                      className={`block w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 transition-colors ${sortBy === option.value ? "text-black" : "text-gray-500"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => { setFilterOpen(!filterOpen); setSortOpen(false); }}
                className={`p-1 transition-colors ${
                  selectedColor || availability !== "all" || onSaleOnly
                    ? "text-black"
                    : "text-gray-900 hover:opacity-70"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                {(selectedColor || availability !== "all" || onSaleOnly) && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-black" />
                )}
              </button>
              {filterOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-md z-40 w-[265px] p-4">
                  {hasSaleItems && (
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={onSaleOnly}
                      onClick={() => setOnSaleOnly((v) => !v)}
                      className={`w-full flex items-center gap-3 border px-3 py-2.5 mb-5 text-left transition-colors ${
                        onSaleOnly ? "border-black" : "border-gray-300 hover:border-black"
                      }`}
                    >
                      <span
                        className={`w-4 h-4 shrink-0 flex items-center justify-center border transition-colors ${
                          onSaleOnly
                            ? "bg-black border-black text-white"
                            : "bg-white border-gray-400"
                        }`}
                      >
                        {onSaleOnly && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest font-medium text-gray-900">
                        On Sale Only
                      </span>
                    </button>
                  )}
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Availability</p>
                  <div className="flex gap-2 mb-5">
                    {(["all", "available", "sold"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setAvailability(opt)}
                        className={`text-[10px] uppercase tracking-widest px-3 py-1.5 border transition-colors ${
                          availability === opt
                            ? "bg-black text-white border-black"
                            : "bg-white border-gray-300 hover:border-black"
                        }`}
                      >
                        {opt === "all" ? "All" : opt === "available" ? "Available" : "Sold Out"}
                      </button>
                    ))}
                  </div>
                  {availableColors.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Color</p>
                      <div className="max-h-[200px] overflow-y-auto thin-scrollbar pr-1">
                        <div className="grid grid-cols-3 gap-x-2 gap-y-3">
                          {availableColors.map((c) => {
                            const isActive = selectedColor === c.name;
                            return (
                              <button
                                key={c.name}
                                onClick={() => setSelectedColor(isActive ? "" : c.name)}
                                className="flex flex-col items-center gap-1 min-w-0"
                              >
                                <span
                                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                                    isActive
                                      ? "border-black scale-110"
                                      : "border-gray-200 hover:border-gray-400"
                                  }`}
                                  style={{ background: productColorCss(c) }}
                                />
                                <span
                                  className={`max-w-full truncate text-[9px] leading-none transition-colors ${
                                    isActive ? "text-black font-medium" : "text-gray-500"
                                  }`}
                                >
                                  {c.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                  {(selectedColor || availability !== "all" || onSaleOnly) && (
                    <button
                      onClick={() => { setSelectedColor(""); setAvailability("all"); setOnSaleOnly(false); }}
                      className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-black transition-colors mt-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {filtered.length > 0 ? (
        <section className="mb-16 px-2.5 sm:px-3.5 lg:px-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} variant="full" />
            ))}
          </div>
          {hiddenCount > 0 && (
            <div className="flex justify-center mt-8 px-2 sm:px-4 lg:px-6">
              <button
                type="button"
                onClick={() => setLoadedRows((n) => n + 8)}
                className="border border-black bg-white px-8 py-2.5 text-xs uppercase tracking-widest font-medium text-gray-900 transition-colors hover:bg-black hover:text-white"
              >
                View more
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="mb-16 px-2.5 sm:px-3.5 lg:px-10">
          <div className="text-center py-16 text-gray-500 px-2 sm:px-4 lg:px-6">
            <p className="text-sm">No products found in this category.</p>
            <Link to={`/${type}`} className="text-xs underline underline-offset-2 mt-2 inline-block hover:opacity-60">
              View all {typeLabel.toLowerCase()}
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
