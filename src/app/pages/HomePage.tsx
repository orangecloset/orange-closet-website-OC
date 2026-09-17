import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalog } from "../data/CatalogContext";
import type { HomepageHero } from "../../cms/store/types";
import { useViewport } from "../hooks/useViewport";
import { usePageTitle } from "../hooks/usePageTitle";
import ImageWithFallback from "../components/ImageWithFallback";
import BrandMarquee from "../components/BrandMarquee";
import ProductCard from "../components/ProductCard";

function HeroBlocks({ heroes, imageClickable }: { heroes: HomepageHero[]; imageClickable: boolean }) {
  const viewport = useViewport();
  const isMobile = viewport === "mobile";
  const blocks: ({ kind: "wide"; hero: HomepageHero } | { kind: "splits"; items: HomepageHero[] })[] = [];
  let buffer: HomepageHero[] = [];
  const flush = () => {
    if (buffer.length > 0) {
      blocks.push({ kind: "splits", items: buffer });
      buffer = [];
    }
  };
  for (const hero of heroes) {
    if (hero.wide) {
      flush();
      blocks.push({ kind: "wide", hero });
    } else {
      buffer.push(hero);
    }
  }
  flush();

  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "wide") {
          const wideMobile = isMobile && !!block.hero.mobileSrc;
          return (
          <section key={block.hero.id || i} className={`relative w-full ${i > 0 ? "mt-0.5" : ""}`}>
            {imageClickable ? (
              <Link to={block.hero.to} className={`block relative w-full ${wideMobile ? "" : "h-[650px]"} sm:h-auto sm:aspect-[32/15] bg-gray-200 overflow-hidden cursor-pointer`}>
                <ImageWithFallback
                  src={isMobile && block.hero.mobileSrc ? block.hero.mobileSrc : block.hero.src}
                  alt={block.hero.label}
                  className={`${wideMobile ? "w-full h-auto" : "absolute inset-0 w-full h-full object-contain"} sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover sm:object-center`}
                  priority={i === 0}
                />
                {(block.hero.label || block.hero.subtitle) && (
                  <>
                    <div className="absolute inset-0 bg-black/10" />
                    <div className={`absolute inset-0 flex ${wideMobile ? "items-end justify-center pb-9" : "items-center justify-center"} sm:items-center sm:justify-start sm:pb-0 sm:pl-16`}>
                      <div className="text-white text-center sm:text-left">
                        {block.hero.label && (
                          <h2 className={`${wideMobile ? "text-3xl" : "text-2xl"} sm:text-3xl lg:text-4xl font-normal tracking-wide mb-2`} style={{ textShadow: "0 0 5px rgba(0,0,0,0.3)" }}>
                            {block.hero.label}
                          </h2>
                        )}
                        {block.hero.subtitle && (
                          <span className="underline underline-offset-4 text-[10px] uppercase tracking-widest hover:opacity-60 transition-opacity">{block.hero.subtitle}</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </Link>
            ) : (
              <div className={`relative w-full ${wideMobile ? "" : "h-[650px]"} sm:h-auto sm:aspect-[32/15] bg-gray-200 overflow-hidden`}>
                <ImageWithFallback
                  src={isMobile && block.hero.mobileSrc ? block.hero.mobileSrc : block.hero.src}
                  alt={block.hero.label}
                  className={`${wideMobile ? "w-full h-auto" : "absolute inset-0 w-full h-full object-contain"} sm:absolute sm:inset-0 sm:w-full sm:h-full sm:object-cover sm:object-center`}
                  priority={i === 0}
                />
                {(block.hero.label || block.hero.subtitle) && (
                  <>
                    <div className="absolute inset-0 bg-black/10" />
                    <div className={`absolute inset-0 flex ${wideMobile ? "items-end justify-center pb-9" : "items-center justify-center"} sm:items-center sm:justify-start sm:pb-0 sm:pl-16`}>
                      <div className="text-white text-center sm:text-left">
                        {block.hero.label && (
                          <h2 className={`${wideMobile ? "text-3xl" : "text-2xl"} sm:text-3xl lg:text-4xl font-normal tracking-wide mb-2`} style={{ textShadow: "0 0 5px rgba(0,0,0,0.3)" }}>
                            {block.hero.label}
                          </h2>
                        )}
                        {block.hero.subtitle && (
                          <Link to={block.hero.to} className="underline underline-offset-4 text-[10px] uppercase tracking-widest hover:opacity-60 transition-opacity">{block.hero.subtitle}</Link>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
          );
        }
        return (
        <section key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-0.5 mt-0.5">
            {block.items.map((item, idx) =>
              imageClickable ? (
                <Link key={item.id || item.label} to={item.to} className="block relative h-[350px] sm:h-auto sm:aspect-[1/0.95] bg-gray-200 overflow-hidden cursor-pointer">
                  <ImageWithFallback
                    src={item.src}
                    alt={item.label}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    priority={i === 0 && idx === 0}
                  />
                  {(item.label || item.subtitle) && (
                    <>
                      <div className="absolute inset-0 bg-black/8" />
                      <div className="absolute bottom-4 left-5 sm:top-4 sm:bottom-auto">
                        {item.label && (
                          <h2 className="text-white text-2xl lg:text-3xl font-normal mb-1" style={{ textShadow: "0 0 5px rgba(0,0,0,0.3)" }}>
                            {item.label}
                          </h2>
                        )}
                        {item.subtitle && (
                          <span className="text-white underline underline-offset-4 text-[10px] uppercase tracking-widest hover:opacity-60 transition-opacity">{item.subtitle}</span>
                        )}
                      </div>
                    </>
                  )}
                </Link>
              ) : (
                <div key={item.id || item.label} className="block relative h-[350px] sm:h-auto sm:aspect-[1/0.95] bg-gray-200 overflow-hidden">
                  <ImageWithFallback
                    src={item.src}
                    alt={item.label}
                    className="absolute inset-0 w-full h-full object-cover object-center"
                    priority={i === 0 && idx === 0}
                  />
                  {(item.label || item.subtitle) && (
                    <>
                      <div className="absolute inset-0 bg-black/8" />
                      <div className="absolute bottom-4 left-5 sm:top-4 sm:bottom-auto">
                        {item.label && (
                          <h2 className="text-white text-2xl lg:text-3xl font-normal mb-1" style={{ textShadow: "0 0 5px rgba(0,0,0,0.3)" }}>
                            {item.label}
                          </h2>
                        )}
                        {item.subtitle && (
                          <Link to={item.to} className="text-white underline underline-offset-4 text-[10px] uppercase tracking-widest hover:opacity-60 transition-opacity">{item.subtitle}</Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            )}
          </section>
        );
      })}
    </>
  );
}

export default function HomePage() {
  usePageTitle();
  const viewport = useViewport();
  const { homepage, newArrivals, bestSellerProducts, onSaleProducts, getProduct } = useCatalog();
  const [featuredPaused, setFeaturedPaused] = useState(false);
  const [showFeaturedSideArrows, setShowFeaturedSideArrows] = useState(false);
  const featuredContainerRef = useRef<HTMLDivElement>(null);

  const featuredCols = viewport === "desktop" ? 4 : viewport === "tablet" ? 3 : 2;
  const featuredItems = homepage.featuredIds
    .map((id) => getProduct(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const visibleOnSale = onSaleProducts.slice(0, viewport === "mobile" ? 4 : viewport === "tablet" ? 3 : 4);
  const visibleBestSellers = bestSellerProducts.slice(0, viewport === "mobile" ? 4 : viewport === "tablet" ? 3 : 4);
  const visibleNewArrivals = newArrivals.slice(0, viewport === "mobile" ? 4 : viewport === "tablet" ? 3 : 4);
  const hasFeatured = featuredItems.length > 0;

  const featuredLen = featuredItems.length;
  const needsScroll = featuredLen > featuredCols;

  const clones = featuredCols;

  const featuredCloned = useMemo(() => {
    if (!hasFeatured || !needsScroll) return featuredItems;
    const tail = featuredItems.slice(featuredLen - clones);
    const head = featuredItems.slice(0, clones);
    return [...tail, ...featuredItems, ...head];
  }, [featuredItems, hasFeatured, needsScroll, featuredLen, clones]);

  const realLen = featuredLen;
  const startIdx = clones;

  const idxRef = useRef(startIdx);
  const [, forceRender] = useState(0);
  const snapLockRef = useRef(false);
  const transitionRef = useRef<HTMLDivElement>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [manualPause, setManualPause] = useState(false);

  const applyIndex = useCallback((newIdx: number, animate: boolean) => {
    idxRef.current = newIdx;
    const el = transitionRef.current;
    if (el) {
      if (!animate) {
        el.style.transition = "none";
        void el.offsetHeight;
        el.style.transform = `translateX(-${newIdx * (100 / featuredCols)}%)`;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (el) el.style.transition = "";
          });
        });
      } else {
        el.style.transition = "";
        el.style.transform = `translateX(-${newIdx * (100 / featuredCols)}%)`;
      }
    }
    forceRender((n) => n + 1);
  }, [featuredCols]);

  const handleTransitionEnd = useCallback(() => {
    const i = idxRef.current;
    if (i >= startIdx + realLen) {
      applyIndex(i - realLen, false);
    } else if (i < startIdx) {
      applyIndex(i + realLen, false);
    }
    snapLockRef.current = false;
  }, [startIdx, realLen, applyIndex]);

  const registerManualInteraction = useCallback(() => {
    if (manualPauseTimerRef.current) clearTimeout(manualPauseTimerRef.current);
    setManualPause(true);
    manualPauseTimerRef.current = setTimeout(() => {
      setManualPause(false);
      manualPauseTimerRef.current = null;
    }, 12000);
  }, []);

  const featuredNext = useCallback(() => {
    if (snapLockRef.current || !needsScroll) return;
    snapLockRef.current = true;
    registerManualInteraction();
    applyIndex(idxRef.current + 1, true);
  }, [needsScroll, applyIndex, registerManualInteraction]);

  const featuredPrev = useCallback(() => {
    if (snapLockRef.current || !needsScroll) return;
    snapLockRef.current = true;
    registerManualInteraction();
    applyIndex(idxRef.current - 1, true);
  }, [needsScroll, applyIndex, registerManualInteraction]);

  const restartAutoTimer = useCallback(() => {
    if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    if (!hasFeatured || !needsScroll || featuredPaused || manualPause) {
      autoTimerRef.current = null;
      return;
    }
    autoTimerRef.current = setInterval(() => {
      if (snapLockRef.current) return;
      snapLockRef.current = true;
      applyIndex(idxRef.current + 1, true);
    }, 6000);
  }, [hasFeatured, needsScroll, featuredPaused, manualPause, applyIndex]);

  useEffect(() => {
    restartAutoTimer();
    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [restartAutoTimer]);

  useEffect(() => {
    return () => {
      if (manualPauseTimerRef.current) clearTimeout(manualPauseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (needsScroll) {
      snapLockRef.current = false;
      applyIndex(startIdx, false);
    }
  }, [featuredCols, startIdx, needsScroll, applyIndex]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (autoTimerRef.current) {
          clearInterval(autoTimerRef.current);
          autoTimerRef.current = null;
        }
      } else {
        snapLockRef.current = false;
        if (needsScroll && realLen > 0) {
          const safeIdx =
            startIdx + (((idxRef.current - startIdx) % realLen) + realLen) % realLen;
          applyIndex(safeIdx, false);
        }
        restartAutoTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [needsScroll, realLen, startIdx, applyIndex, restartAutoTimer]);

  useLayoutEffect(() => {
    const el = featuredContainerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const needed = 72;
      setShowFeaturedSideArrows(
        rect.left >= needed && window.innerWidth - rect.right >= needed
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div className="pb-16">

      <HeroBlocks heroes={homepage.heroes} imageClickable={homepage.heroImageClickable} />

      <BrandMarquee brands={homepage.brands} />

      {hasFeatured && (
      <section className="mt-10">
        <div className="flex items-center justify-between mb-4 px-[18px] sm:px-[30px] lg:px-16">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold">Featured</h2>
          <div className="flex items-center gap-2">
            <button
              aria-label="Previous featured"
              onClick={featuredPrev}
              className={`p-2 transition-colors hover:opacity-60 ${showFeaturedSideArrows ? "lg:hidden" : ""}`}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              aria-label="Next featured"
              onClick={featuredNext}
              className={`p-2 transition-colors hover:opacity-60 ${showFeaturedSideArrows ? "lg:hidden" : ""}`}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
        <div
          ref={featuredContainerRef}
          className="relative"
          onMouseEnter={() => setFeaturedPaused(true)}
          onMouseLeave={() => setFeaturedPaused(false)}
        >
          <div className="overflow-hidden">
            <div
              ref={transitionRef}
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${idxRef.current * (100 / featuredCols)}%)` }}
              onTransitionEnd={handleTransitionEnd}
            >
              {featuredCloned.map((product, i) => (
                <div
                  key={`${product.id}-${i}`}
                  className="shrink-0"
                  style={{ width: `${100 / featuredCols}%` }}
                >
                  <ProductCard product={product} variant="home" />
                </div>
              ))}
            </div>
          </div>
          {showFeaturedSideArrows && (
            <>
              <button
                aria-label="Previous featured"
                onClick={featuredPrev}
                className="absolute -left-6 top-1/2 -translate-y-[calc(50%+43px)] z-10 p-3 transition-colors -translate-x-full hover:opacity-60"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                aria-label="Next featured"
                onClick={featuredNext}
                className="absolute -right-6 top-1/2 -translate-y-[calc(50%+43px)] z-10 p-3 transition-colors translate-x-full hover:opacity-60"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}
        </div>
      </section>
      )}

      {homepage.showOnSale && visibleOnSale.length > 0 && (
      <section className="mt-10 px-2.5 sm:px-3.5 lg:px-10">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4 px-2 sm:px-4 lg:px-6">On Sale</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {visibleOnSale.map((product) => (
            <ProductCard key={product.id} product={product} variant="home" />
          ))}
        </div>
        <div className="flex justify-center mt-8 px-2 sm:px-4 lg:px-6">
          <Link
            to="/sale"
            className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            View All Sale
          </Link>
        </div>
      </section>
      )}

      {homepage.showNewArrivals && visibleNewArrivals.length > 0 && (
      <section className="mt-10 px-2.5 sm:px-3.5 lg:px-10">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4 px-2 sm:px-4 lg:px-6">New Arrivals</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {visibleNewArrivals.map((product) => (
            <ProductCard key={product.id} product={product} variant="home" />
          ))}
        </div>
        <div className="flex justify-center mt-8 px-2 sm:px-4 lg:px-6">
          <Link
            to="/new-arrivals"
            className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            View All New Arrivals
          </Link>
        </div>
      </section>
      )}

      {visibleBestSellers.length > 0 && (
      <section className="mt-10 px-2.5 sm:px-3.5 lg:px-10">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-4 px-2 sm:px-4 lg:px-6">Best Seller</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
          {visibleBestSellers.map((product) => (
            <ProductCard key={product.id} product={product} variant="home" />
          ))}
        </div>
        <div className="flex justify-center mt-8 px-2 sm:px-4 lg:px-6">
          <Link
            to="/best-sellers"
            className="text-[10px] uppercase tracking-widest underline underline-offset-4 hover:opacity-60 transition-opacity"
          >
            View All Best Sellers
          </Link>
        </div>
      </section>
      )}
    </div>
  );
}
