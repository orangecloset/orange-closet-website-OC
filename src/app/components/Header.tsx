import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Search, Share2, ChevronDown, ShoppingBag } from "lucide-react";
import { TYPE_LABELS, primaryColor } from "../../data/products";
import { useCatalog } from "../data/CatalogContext";
import { splitNavItems } from "../lib/site-config";

function formatLabel(text: string): string {
  return text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function MobileDropdown({ open, children }: { open: boolean; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(open ? "auto" : 0);
  const mounted = useRef(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (!mounted.current) { mounted.current = true; return; }
    if (open) {
      setHeight(el.scrollHeight);
    } else {
      setHeight(el.scrollHeight);
      requestAnimationFrame(() => requestAnimationFrame(() => setHeight(0)));
    }
  }, [open]);

  return (
    <div
      style={{ height, overflow: "hidden" }}
      className="transition-[height] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] will-change-[height]"
      onTransitionEnd={() => { if (open) setHeight("auto"); }}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

type HeaderProps = {
  onShare: () => void;
  showShare?: boolean;
};

export default function Header({ onShare, showShare = true }: HeaderProps) {
  const { products, types, settings } = useCatalog();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuClosing, setMobileMenuClosing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [megaType, setMegaType] = useState<string | null>(null);
  const [megaCategory, setMegaCategory] = useState<string>("");
  const [moreActiveType, setMoreActiveType] = useState<string | null>(null);
  const [moreCategory, setMoreCategory] = useState<string>("");
  const [mobileExpandedType, setMobileExpandedType] = useState<string | null>(null);
  const megaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const megaEnterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreEnterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setMoreOpen(false);
    setSearchQuery("");
    setMegaType(null);
    setMegaCategory("");
    setMoreActiveType(null);
    setMoreCategory("");
    setMobileExpandedType(null);
  }, [location]);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return products.filter((p) =>
      [p.name, p.category, p.categoryLabel, TYPE_LABELS[p.type] ?? p.type].some(
        (field) => field.toLowerCase().includes(q)
      )
    ).slice(0, 8);
  }, [searchQuery, products]);

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
  };

  useEffect(() => {
    if (!searchOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        closeSearch();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSearch();
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [searchOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const nav = useMemo(() => splitNavItems(types), [types]);
  const mainNavItems = nav.main;
  const moreNavItems = nav.more;

  const closeMobileMenu = () => {
    setMobileMenuClosing(true);
    setMobileExpandedType(null);
    setTimeout(() => { setMobileMenuOpen(false); setMobileMenuClosing(false); }, 300);
  };

  const navigateAndCloseMobileMenu = () => {
    setMobileExpandedType(null);
  };

  const toggleMobileExpand = (slug: string) => {
    setMobileExpandedType((prev) => (prev === slug ? null : slug));
  };

  const getCATEGORIES = useMemo(() => {
    const map: Record<string, { label: string; slug: string; heroImage?: string }[]> = {};
    for (const t of types) {
      let cats: { label: string; slug: string; heroImage?: string }[] = [];
      if (t.categories && t.categories.length > 0) {
        cats = t.categories.map((c) => ({ label: c.label, slug: c.slug, heroImage: c.heroImage }));
      }
      if (!cats.some((c) => c.slug === "")) {
        cats.unshift({ label: "View All", slug: "" });
      }
      map[t.slug] = cats;
    }
    return map;
  }, [types]);

  const megaTypeHero = useMemo(() => {
    if (!megaType) return null;
    return types.find((t) => t.slug === megaType)?.heroImage ?? null;
  }, [megaType, types]);

  const megaPreviewImage = useMemo(() => {
    if (!megaType) return null;
    const cats = getCATEGORIES[megaType] ?? [];
    const cat = cats.find((c) => c.slug === megaCategory);
    if (cat?.heroImage) return cat.heroImage;
    return megaTypeHero;
  }, [megaType, megaCategory, getCATEGORIES, megaTypeHero]);

  const moreTypeHero = useMemo(() => {
    if (!moreActiveType) return null;
    return types.find((t) => t.slug === moreActiveType)?.heroImage ?? null;
  }, [moreActiveType, types]);

  const morePreviewImage = useMemo(() => {
    if (!moreActiveType) return null;
    const cats = getCATEGORIES[moreActiveType] ?? [];
    const cat = cats.find((c) => c.slug === moreCategory);
    if (cat?.heroImage) return cat.heroImage;
    return moreTypeHero;
  }, [moreActiveType, moreCategory, getCATEGORIES, moreTypeHero]);

  const handleMegaEnter = (slug: string) => {
    if (megaEnterRef.current) clearTimeout(megaEnterRef.current);
    if (megaTimeoutRef.current) clearTimeout(megaTimeoutRef.current);
    megaEnterRef.current = setTimeout(() => {
      setMegaType(slug);
      const cats = getCATEGORIES[slug];
      setMegaCategory(cats && cats.length > 0 ? cats[0].slug : "");
    }, 60);
  };

  const handleMegaLeave = () => {
    if (megaEnterRef.current) clearTimeout(megaEnterRef.current);
    megaTimeoutRef.current = setTimeout(() => {
      setMegaType(null);
      setMegaCategory("");
    }, 120);
  };

  const handleMegaDropdownEnter = () => {
    if (megaTimeoutRef.current) clearTimeout(megaTimeoutRef.current);
  };

  const handleMoreEnter = () => {
    if (moreEnterRef.current) clearTimeout(moreEnterRef.current);
    if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current);
    moreEnterRef.current = setTimeout(() => {
      setMoreOpen(true);
      const firstSlug = moreNavItems[0]?.href.slice(1) ?? null;
      setMoreActiveType(firstSlug);
      if (firstSlug) {
        const cats = getCATEGORIES[firstSlug];
        setMoreCategory(cats && cats.length > 0 ? cats[0].slug : "");
      }
    }, 60);
  };

  const handleMoreLeave = () => {
    if (moreEnterRef.current) clearTimeout(moreEnterRef.current);
    moreTimeoutRef.current = setTimeout(() => {
      setMoreOpen(false);
      setMoreActiveType(null);
      setMoreCategory("");
    }, 120);
  };

  const handleMorePanelEnter = () => {
    if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current);
  };

  const handleMoreTypeEnter = (slug: string) => {
    setMoreActiveType(slug);
    const cats = getCATEGORIES[slug];
    setMoreCategory(cats && cats.length > 0 ? cats[0].slug : "");
  };

  const handleMoreSubCatEnter = (slug: string) => {
    setMoreCategory(slug);
  };

  const megaCats = megaType ? (getCATEGORIES[megaType] ?? []) : [];
  const moreCats = moreActiveType ? (getCATEGORIES[moreActiveType] ?? []) : [];

  const renderCatLabel = (cat: { label: string; slug: string }) =>
    cat.slug === "" ? "View All" : formatLabel(cat.label);

  const isCategoryActive = (typeSlug: string | null, catSlug: string) => {
    if (!typeSlug) return false;
    const base = `/${typeSlug}`;
    if (catSlug === "") {
      return location.pathname === base || location.pathname === `${base}/`;
    }
    return location.pathname.startsWith(`${base}/${catSlug}`);
  };

  return (
    <header className={`sticky top-0 bg-white shadow-sm border-b border-gray-100 ${mobileMenuOpen ? 'z-[100]' : 'z-50'}`}>
      <div className="px-2.5 sm:px-3.5 lg:px-16.5">
        <div className="relative flex items-center h-14 gap-4">

          <div
            className={`flex items-center min-w-0 flex-1 gap-4 transition-opacity duration-300 ease-out ${
              searchOpen ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >

            <button
              className="lg:hidden p-1 text-black"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="hidden lg:flex items-center text-[13px] uppercase tracking-wide shrink-0">
              {mainNavItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href);
                const slug = item.href.slice(1);
                const hasDropdown = (getCATEGORIES[slug]?.length ?? 0) > 0;
                const isMega = megaType === slug;
                return (
                  <div
                    key={item.label}
                    className="relative px-[10px] first:pl-0"
                    onMouseEnter={() => hasDropdown && handleMegaEnter(slug)}
                    onMouseLeave={() => hasDropdown && handleMegaLeave()}
                  >
                    <Link
                      to={item.href}
                      onClick={() => window.scrollTo(0, 0)}
                      className={`relative inline-block whitespace-nowrap py-2 transition-opacity ${isActive || isMega ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                    >
                      {item.label}
                    </Link>
                  </div>
                );
              })}
              {moreNavItems.length > 0 && (
                <div
                  className="relative px-[10px]"
                  onMouseEnter={handleMoreEnter}
                  onMouseLeave={handleMoreLeave}
                >
                  <button
                    type="button"
                    aria-expanded={moreOpen}
                    className={`flex items-center gap-1 whitespace-nowrap py-2 transition-opacity ${moreOpen ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                  >
                    More
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </nav>

            <div className="flex-1" />
            <Link
              to="/"
              onClick={() => window.scrollTo(0, 0)}
              className="absolute left-1/2 -translate-x-1/2"
            >
              <span className="text-xl sm:text-2xl font-black tracking-[0.15em] uppercase whitespace-nowrap" style={{ fontFamily: "'Cinzel', serif", WebkitTextStroke: "0.5px" }}>
                {settings.storeName}
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <button
                aria-label="Search"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen(true)}
                className="text-gray-500 hover:text-black transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
              {showShare && (
                <button
                  aria-label="Share"
                  onClick={onShare}
                  className="hidden sm:flex text-gray-500 hover:text-black transition-colors"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          <div
            ref={searchContainerRef}
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out ${
              searchOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <div
              className={`w-full max-w-md flex items-center gap-2 bg-gray-100 border-[1.5px] border-gray-200 focus-within:border-black rounded-none pl-3.5 pr-3 h-10 transition-all duration-300 ease-out ${
                searchOpen ? "scale-x-100" : "scale-x-90"
              }`}
            >
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 min-w-0 outline-none bg-transparent text-sm text-black placeholder-gray-400"
              />
              <button
                onClick={closeSearch}
                aria-label="Close search"
                className="shrink-0 text-gray-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mx-auto w-full max-w-md bg-white border border-gray-200 shadow-md max-h-80 overflow-y-auto thin-scrollbar z-50">
                {searchResults.length > 0 ? (
                  <ul>
                    {searchResults.map((p) => {
                      const color = primaryColor(p);
                      return (
                        <li key={p.id}>
                          <Link
                            to={`/products/${p.id}`}
                            onClick={closeSearch}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                          >
                            <img
                              src={color.images[0]}
                              alt=""
                              className="w-10 h-10 object-cover bg-gray-100 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-sm text-gray-900 truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 capitalize">
                                {p.categoryLabel} · {TYPE_LABELS[p.type] ?? p.type}
                              </p>
                            </div>
                            <span className="ml-auto text-sm text-gray-900 shrink-0">
                              {p.price}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-sm text-gray-500">No products found</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {megaType && megaCats.length > 0 && (
        <div
          className="hidden lg:block absolute left-0 right-0 top-full bg-white border-t border-gray-100 shadow-lg z-50"
          onMouseEnter={handleMegaDropdownEnter}
          onMouseLeave={handleMegaLeave}
        >
          <div className="h-3 w-full" />
          <div className="px-2.5 sm:px-3.5 lg:px-16.5 flex">
            <div className="py-6 pl-0 pr-8 min-w-[200px]">
              {megaCats.map((cat) => (
                <Link
                  key={cat.slug}
                  to={cat.slug ? `/${megaType}/${cat.slug}` : `/${megaType}`}
                  onMouseEnter={() => setMegaCategory(cat.slug)}
                  onClick={() => { setMegaType(null); setMegaCategory(""); window.scrollTo(0, 0); }}
                  className={`block py-1.5 text-sm transition-colors ${megaCategory === cat.slug || isCategoryActive(megaType, cat.slug) ? 'text-black font-medium' : 'text-gray-500 hover:text-black'}`}
                >
                  {renderCatLabel(cat)}
                </Link>
              ))}
            </div>
            <div className="w-px bg-gray-200 my-4 shrink-0" />
            <div className="flex items-center justify-center py-6 pl-8">
              {megaPreviewImage ? (
                <img
                  src={megaPreviewImage}
                  alt=""
                  className="h-[320px] w-auto object-cover transition-all duration-300"
                />
              ) : (
                <div className="h-[320px] w-[320px] bg-gray-50 flex items-center justify-center text-gray-300">
                  <ShoppingBag className="w-12 h-12" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {moreOpen && moreNavItems.length > 0 && (
        <div
          className="hidden lg:block absolute left-0 right-0 top-full bg-white border-t border-gray-100 shadow-lg z-50"
          onMouseEnter={handleMorePanelEnter}
          onMouseLeave={handleMoreLeave}
        >
          <div className="h-3 w-full" />
          <div className="px-2.5 sm:px-3.5 lg:px-16.5 flex">
            <div className="py-6 pl-0 pr-8 min-w-[180px]">
              {moreNavItems.map((item) => {
                const slug = item.href.slice(1);
                const isActive = moreActiveType === slug;
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    onMouseEnter={() => handleMoreTypeEnter(slug)}
                    onClick={() => { setMoreOpen(false); setMoreActiveType(null); setMoreCategory(""); window.scrollTo(0, 0); }}
                    className={`block py-1.5 text-sm cursor-pointer transition-colors ${isActive ? 'text-black font-medium' : 'text-gray-500 hover:text-black'}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <div className="w-px bg-gray-200 my-4 shrink-0" />
            <div className="py-6 px-8 min-w-[200px]">
              {moreCats.length > 0 ? (
                moreCats.map((cat) => (
                  <Link
                    key={cat.slug}
                    to={cat.slug ? `/${moreActiveType}/${cat.slug}` : `/${moreActiveType}`}
                    onMouseEnter={() => handleMoreSubCatEnter(cat.slug)}
                    onClick={() => { setMoreOpen(false); setMoreActiveType(null); setMoreCategory(""); window.scrollTo(0, 0); }}
                    className={`block py-1.5 text-sm transition-colors ${moreCategory === cat.slug || isCategoryActive(moreActiveType, cat.slug) ? 'text-black font-medium' : 'text-gray-500 hover:text-black'}`}
                  >
                    {renderCatLabel(cat)}
                  </Link>
                ))
              ) : (
                <div className="py-1.5 text-sm text-gray-400">No subcategories</div>
              )}
            </div>
            <div className="w-px bg-gray-200 my-4 shrink-0" />
            <div className="flex items-center justify-center py-6 pl-8">
              {morePreviewImage ? (
                <img
                  src={morePreviewImage}
                  alt=""
                  className="h-[320px] w-auto object-cover transition-all duration-300"
                />
              ) : (
                <div className="h-[320px] w-[320px] bg-gray-50 flex items-center justify-center text-gray-300">
                  <ShoppingBag className="w-12 h-12" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className={`absolute inset-0 bg-black/50 ${mobileMenuClosing ? "overlay closing" : "overlay anim-in"}`}
            onClick={closeMobileMenu}
          />
          <div className={`panel absolute top-0 left-0 h-full w-full md:w-96 bg-white shadow-2xl flex flex-col ${mobileMenuClosing ? "anim-out" : "anim-in"}`}>
            <div className="flex items-center justify-between px-6 h-14 border-b border-gray-100 shadow-sm">
              <Link
                to="/"
                className="text-lg font-black tracking-[0.15em] uppercase"
                style={{ fontFamily: "'Cinzel', serif", WebkitTextStroke: "0.5px" }}
                onClick={() => { window.scrollTo(0, 0); navigateAndCloseMobileMenu(); }}
              >
                {settings.storeName}
              </Link>
              <div className="flex items-center gap-4">
                <button
                  aria-label="Search"
                  onClick={() => { closeMobileMenu(); setTimeout(() => setSearchOpen(true), 200); }}
                  className="text-gray-500 hover:text-black transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
                {showShare && (
                  <button
                    aria-label="Share"
                    onClick={onShare}
                    disabled={!showShare}
                    className={`transition-colors ${showShare ? "text-gray-500 hover:text-black" : "text-gray-300 cursor-not-allowed"}`}
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                  className="text-gray-500 hover:text-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto py-1">
              {[...mainNavItems, ...moreNavItems].map((item, idx) => {
                const isActive = location.pathname.startsWith(item.href);
                const showDivider = idx === 0 ? null : <div className="border-t border-gray-100 mx-6" />;
                const slug = item.href.slice(1);
                const cats = getCATEGORIES[slug] ?? [];
                const hasDropdown = cats.length > 0;
                const isExpanded = mobileExpandedType === slug;
                return (
                  <div key={item.label}>
                    {showDivider}
                    <div
                      className={`flex items-center justify-between px-6 py-3.5 text-base capitalize tracking-wide transition-colors ${
                        isActive ? "text-black font-medium" : "text-gray-500 hover:text-black hover:bg-gray-50"
                      }`}
                    >
                      <Link
                        to={item.href}
                        className="flex-1"
                        onClick={() => { window.scrollTo(0, 0); navigateAndCloseMobileMenu(); }}
                      >
                        {item.label}
                      </Link>
                      {hasDropdown && (
                        <button
                          type="button"
                          aria-label={isExpanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
                          aria-expanded={isExpanded}
                          onClick={() => toggleMobileExpand(slug)}
                          className="p-1.5 mr-1 shrink-0 text-gray-700 hover:text-black transition-colors"
                        >
                          <ChevronDown
                            className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
                          />
                        </button>
                      )}
                    </div>
                    <MobileDropdown open={hasDropdown && isExpanded}>
                      <div className="bg-white pb-2">
                        {cats.map((cat) => (
                          <Link
                            key={cat.slug}
                            to={cat.slug ? `/${slug}/${cat.slug}` : `/${slug}`}
                            onClick={() => { window.scrollTo(0, 0); navigateAndCloseMobileMenu(); }}
                            className={`block pl-10 pr-6 py-2 text-sm capitalize transition-colors ${isCategoryActive(slug, cat.slug) ? 'text-black font-medium' : 'text-gray-500 hover:text-black'}`}
                          >
                            {renderCatLabel(cat)}
                          </Link>
                        ))}
                      </div>
                    </MobileDropdown>
                  </div>
                );
              })}
              <div className="border-t border-gray-100 mx-6" />
            </nav>
            {settings.socials.filter(s => s.url).length > 0 && (
              <div className="border-t border-gray-100 px-6 py-4 shrink-0">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Visit us</p>
                <div className="flex items-center gap-3 flex-wrap">
                  {settings.socials.filter(s => s.url).map((s) => (
                    <a
                      key={s.label}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
                    >
                      {s.label}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}