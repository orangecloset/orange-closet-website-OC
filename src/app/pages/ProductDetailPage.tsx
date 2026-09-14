import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Check, Share2, ShoppingBag, X } from "lucide-react";
import { TYPE_LABELS, productColorCss } from "../../data/products";
import { getSaleInfo } from "../../data/types";
import { useCatalog } from "../data/CatalogContext";
import { useViewport } from "../hooks/useViewport";
import { getCatalogToken, getCatalogUid, getCatalogMode } from "../lib/access";
import ProductCard from "../components/ProductCard";
import MarkdownText from "../components/MarkdownText";
import { usePageTitle } from "../hooks/usePageTitle";
import type { ReactNode } from "react";

function GalleryImage({
  src,
  alt,
  className,
  eager,
  onError,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
  onError?: (src: string) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className ?? ""}`}>
        <ShoppingBag className="w-10 h-10 text-gray-300" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => {
        setFailed(true);
        onError?.(src);
      }}
    />
  );
}

function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-3 py-4 text-left text-sm font-medium text-gray-900"
      >
        <ChevronRight
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
        {title}
      </button>
      <div
        style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 0.25s ease-out" }}
      >
        <div className="overflow-hidden">
          <div className="pb-5 pl-7 text-sm text-gray-600 space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const { getProduct, productsByType, settings, types } = useCatalog();
  const viewport = useViewport();
  const product = productId ? getProduct(productId) : undefined;

  const [colorIndex, setColorIndex] = useState(0);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxFade, setLightboxFade] = useState<string | null>(null);
  const lightboxFadeKeyRef = useRef(0);
  const [, setAdded] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  const galleryRef = useRef<HTMLDivElement>(null);
  const imageCountRef = useRef(0);
  const lockedRef = useRef(false);
  const wheelAccumRef = useRef(0);
  const lockTimeoutRef = useRef<number | undefined>(undefined);
  const lightboxDebounceRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const thumbScrollRef = useRef<HTMLDivElement>(null);
  const [thumbScrollState, setThumbScrollState] = useState({ up: false, down: false });
  const [galleryHeight, setGalleryHeight] = useState<number | undefined>(undefined);
  const advanceRef = useRef<(direction: number) => void>(() => {});

  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 1024px)").matches
  );
  const isDesktopRef = useRef(isDesktop);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      isDesktopRef.current = mq.matches;
      setIsDesktop(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const advanceImage = (direction: number) => {
    if (lockedRef.current) return;
    lockedRef.current = true;
    if (lockTimeoutRef.current) window.clearTimeout(lockTimeoutRef.current);
    lockTimeoutRef.current = window.setTimeout(() => {
      lockedRef.current = false;
    }, 600);
    setImageIndex((prev) => {
      const count = imageCountRef.current;
      if (count <= 1) return prev;
      const next = prev + direction;
      if (next < 0 || next >= count) return prev;
      return next;
    });
  };
  advanceRef.current = advanceImage;

  const navigateLightboxRef = useRef<(direction: number) => void>(() => {});
  navigateLightboxRef.current = (direction: number) => {
    if (lightboxDebounceRef.current) return;
    lightboxDebounceRef.current = true;
    window.setTimeout(() => { lightboxDebounceRef.current = false; }, 400);
    setLightboxIndex((prev) => {
      if (prev === null) return prev;
      const next = (prev + direction + activeImages.length) % activeImages.length;
      lightboxFadeKeyRef.current += 1;
      setLightboxFade(activeImages[prev]);
      return next;
    });
  };

  useEffect(() => {
    const el = galleryRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (imageCountRef.current <= 1) return;
      e.preventDefault();
      if (lockedRef.current) {
        wheelAccumRef.current = 0;
        return;
      }
      wheelAccumRef.current += e.deltaY;
      if (Math.abs(wheelAccumRef.current) >= 40) {
        const direction = wheelAccumRef.current > 0 ? 1 : -1;
        wheelAccumRef.current = 0;
        advanceRef.current(direction);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (imageCountRef.current <= 1) return;
      touchStartXRef.current = e.touches[0]?.clientX ?? null;
      touchStartYRef.current = e.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (imageCountRef.current <= 1) return;
      if (isDesktopRef.current) {
        if (e.cancelable) e.preventDefault();
        return;
      }
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      const touch = e.touches[0];
      if (startX === null || startY === null || !touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8 && e.cancelable) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (imageCountRef.current <= 1) {
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        return;
      }
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      if (startX === null || startY === null) return;
      const changed = e.changedTouches[0];
      if (!changed) return;
      const dx = changed.clientX - startX;
      const dy = changed.clientY - startY;
      if (isDesktopRef.current) {
        if (Math.abs(dy) < 30) return;
        advanceRef.current(dy < 0 ? 1 : -1);
      } else {
        if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
        advanceRef.current(dx < 0 ? 1 : -1);
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    setColorIndex(0);
    setImageIndex(0);
    setAdded(false);
    setFailedImages([]);
    setSelectedSize("");
  }, [product?.id]);

  const handleImageError = (src: string) => {
    setFailedImages((prev) => (prev.includes(src) ? prev : [...prev, src]));
  };

  const validImageCount = product?.colors[colorIndex]?.images.filter(
    (src) => !failedImages.includes(src)
  ).length;
  useEffect(() => {
    if (validImageCount !== undefined && imageIndex >= validImageCount) {
      setImageIndex(Math.max(validImageCount - 1, 0));
    }
  }, [failedImages, validImageCount, imageIndex]);

  const activeImageCount =
    product?.colors[colorIndex]?.images.filter((src) => !failedImages.includes(src)).length ?? 0;

  useEffect(() => {
    imageCountRef.current = activeImageCount;
  }, [activeImageCount]);

  useEffect(() => {
    const activeThumb = thumbRefs.current[imageIndex];
    activeThumb?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [imageIndex]);

  const needsSize = (product?.sizes.length ?? 0) > 0;
  const cmsTypeInfo = product ? types.find((t) => t.slug === product.type) : undefined;
  const typeLabel = product
    ? (cmsTypeInfo?.label ?? TYPE_LABELS[product.type] ?? product.type)
    : undefined;
  const typeRoute = product
    ? (cmsTypeInfo?.route || `/${product.type}`)
    : "/";
  const activeColorObj = product?.colors[colorIndex];
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleSelectColor = (index: number) => {
    setColorIndex(index);
    setImageIndex(0);
    setSelectedSize("");
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const token = getCatalogToken();
      if (!token) return;
      const res = await fetch("/api/catalog-links/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Catalog-Token": token },
        body: JSON.stringify({ uid: getCatalogUid() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; token?: string } | null;
      if (!res.ok || !data?.ok || !data.token) return;
      const uid = getCatalogUid();
      const path = window.location.pathname;
      const url = `${window.location.origin}/catalog/${uid}?t=${encodeURIComponent(data.token)}&p=${encodeURIComponent(path)}`;
      if (navigator.share && viewport !== "desktop") {
        await navigator.share({ title: product?.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 5000);
      }
    } catch {
      // user cancelled or error
    } finally {
      setSharing(false);
    }
  };

  const similar = useMemo(() => {
    if (!product) return [];
    const sameType = productsByType(product.type).filter((p) => p.id !== product.id);
    const sameCategory = sameType.filter((p) => p.category === product.category);
    const others = sameType.filter((p) => p.category !== product.category);
    const limit = viewport === "mobile" ? 4 : viewport === "tablet" ? 6 : 8;
    return [...sameCategory, ...others].slice(0, limit);
  }, [product, productsByType, viewport]);

  usePageTitle(
    product
      ? `${product.name}${product.colors[colorIndex] ? ` - ${product.colors[colorIndex].name}` : ""}`
      : "Product Not Found"
  );

  const activeColor = product?.colors[colorIndex];
  const activeImages = (activeColor?.images ?? []).filter((src) => !failedImages.includes(src));

  const updateThumbScrollState = useCallback(() => {
    const el = thumbScrollRef.current;
    if (!el) return;
    setThumbScrollState((prev) => {
      const next = {
        up: el.scrollTop > 4,
        down: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
      };
      return next.up === prev.up && next.down === prev.down ? prev : next;
    });
  }, []);

  useEffect(() => {
    const el = thumbScrollRef.current;
    if (!el) return;
    updateThumbScrollState();
    el.addEventListener("scroll", updateThumbScrollState, { passive: true });
    const observer = new ResizeObserver(updateThumbScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateThumbScrollState);
      observer.disconnect();
    };
  }, [updateThumbScrollState, activeImages.length, isDesktop, galleryHeight]);

  useEffect(() => {
    if (!isDesktop) {
      setGalleryHeight(undefined);
      setThumbScrollState({ up: false, down: false });
      return;
    }
    const gallery = galleryRef.current;
    if (!gallery) return;
    const update = () => setGalleryHeight(gallery.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(gallery);
    return () => observer.disconnect();
  }, [isDesktop, activeImages.length]);

  const scrollThumbs = (direction: number) => {
    thumbScrollRef.current?.scrollBy({
      top: direction * 96,
      left: direction * 96,
      behavior: "smooth",
    });
  };

  const showThumbChevrons = isDesktop && activeImages.length > 7;

  useEffect(() => {
    if (lightboxIndex === null) return;
    const scrollY = window.scrollY;
    const prevRootOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") navigateLightboxRef.current(1);
      if (e.key === "ArrowLeft") navigateLightboxRef.current(-1);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.documentElement.style.overflow = prevRootOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPaddingRight;
      window.removeEventListener("keydown", handleKey);
      window.scrollTo(0, scrollY);
    };
  }, [lightboxIndex]);

  if (!product) {
    return (
      <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-xl font-semibold mb-3">Product not found</h1>
        <p className="text-sm text-gray-500 mb-6">
          We could not find the product you are looking for.
        </p>
        <Link
          to="/"
          className="inline-block border border-black px-8 py-3 text-xs uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          Back to Home
        </Link>
      </section>
    );
  }

  const color = activeColor!;

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-14">

        <div className="w-full lg:w-[55%] shrink-0 lg:sticky lg:top-24 lg:self-start">
          <nav className="text-[11px] text-gray-500 uppercase tracking-wide mb-6 flex flex-wrap items-center gap-1.5">
            <Link to="/" className="hover:text-black transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to={typeRoute} className="hover:text-black transition-colors">
              {typeLabel}
            </Link>
            <span>/</span>
            <Link
              to={`${typeRoute}/${product.category}`}
              className="hover:text-black transition-colors"
            >
              {product.categoryLabel}
            </Link>
            <span>/</span>
            <span className="text-gray-900">{product.name}</span>
          </nav>
          <div className="flex flex-col lg:flex-row gap-3">

            <div className="flex lg:flex-col gap-2 order-2 lg:order-1 shrink-0 lg:w-20">
              {showThumbChevrons && (
                <button
                  type="button"
                  onClick={() => scrollThumbs(-1)}
                  aria-label="Scroll thumbnails up"
                  disabled={!thumbScrollState.up}
                  className="flex items-center justify-center h-6 w-full text-gray-700 hover:text-black transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:text-gray-700"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              )}
              <div
                  ref={thumbScrollRef}
                  onScroll={updateThumbScrollState}
                  className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-1 lg:pb-0 lg:max-h-[min(70vh,640px)]"
                  style={
                    showThumbChevrons && galleryHeight !== undefined
                      ? { maxHeight: Math.max(0, galleryHeight - 64) }
                      : undefined
                  }
                >
                {activeImages.map((src, i) => (
                  <button
                    key={i}
                    ref={(el) => {
                      thumbRefs.current[i] = el;
                    }}
                    onClick={() => setImageIndex(i)}
                    className={`shrink-0 w-14 lg:w-20 aspect-square bg-gray-100 border overflow-hidden transition-all ${
                      i === imageIndex
                        ? "border-black opacity-100"
                        : "border-transparent opacity-60 hover:opacity-100 hover:border-gray-300"
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <GalleryImage
                      key={src}
                      src={src}
                      alt={`${product.name} - ${color.name} view ${i + 1}`}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                  </button>
                ))}
              </div>
              {showThumbChevrons && (
                <button
                  type="button"
                  onClick={() => scrollThumbs(1)}
                  aria-label="Scroll thumbnails down"
                  disabled={!thumbScrollState.down}
                  className="flex items-center justify-center h-6 w-full text-gray-700 hover:text-black transition-colors disabled:opacity-40 disabled:cursor-default disabled:hover:text-gray-700"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
            </div>

            <div ref={galleryRef} className="order-1 lg:order-2 relative flex-1 bg-gray-100 cursor-zoom-in" onClick={() => { if (activeImages.length > 0) setLightboxIndex(imageIndex); }}>
              <div className="relative aspect-[4/3] lg:aspect-[3/4] w-full overflow-hidden">
                {activeImages.length > 0 ? (
                  <div
                    className="h-full flex flex-row lg:flex-col will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      transform: isDesktop
                        ? `translateY(-${imageIndex * 100}%)`
                        : `translateX(-${imageIndex * 100}%)`,
                    }}
                  >
                    {activeImages.map((src, idx) => (
                      <div key={src} className="h-full w-full shrink-0">
                        <GalleryImage
                          src={src}
                          alt={`${product.name} - ${color.name}`}
                          className="w-full h-full object-contain"
                          eager={idx === 0}
                          onError={handleImageError}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ShoppingBag className="w-10 h-10 text-gray-300" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:pt-[17px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {(() => {
                  const saleInfo = getSaleInfo(product.price, product.compareAtPrice);
                  return (
                    <>
                      {product.isNew && (
                        <span className="inline-block border border-black px-2 py-[3px] text-[10px] uppercase tracking-widest leading-none">
                          New
                        </span>
                      )}
                      {product.inStock === false && (
                        <span className="inline-block border border-red-800/90 bg-red-800/90 text-white px-2 py-[3px] text-[10px] uppercase tracking-widest leading-none">
                          Sold Out
                        </span>
                      )}
                      {saleInfo.onSale && (
                        <span className="inline-block border border-black bg-black text-white px-2 py-[3px] text-[10px] uppercase tracking-widest leading-none">
                          {saleInfo.label}
                        </span>
                      )}
                    </>
                  );
                })()}
                {settings.showStockOnStorefront && (() => {
                  const colorStock = (color.sizes ?? []).reduce((sum, s) => sum + s.stock, 0);
                  return colorStock > 0 ? (
                    <span className="inline-block text-[10px] uppercase tracking-widest px-2 py-[3px] border border-gray-100 bg-gray-100 text-gray-600 leading-none">
                      {colorStock} in stock
                    </span>
                  ) : null;
                })()}
              </div>
              <p className="mt-1 text-sm text-gray-500">{product.brand}</p>
              <h1 className="text-xl sm:text-2xl font-semibold leading-snug">
                {product.name} - {color.name}
              </h1>
              <p className="mt-2 text-base">
                {product.price}
                {product.compareAtPrice && (
                  <span className="ml-2 text-gray-400 line-through">
                    {product.compareAtPrice}
                  </span>
                )}
              </p>
            </div>
            {settings.showShareButton && getCatalogMode() === "grant" && (
              <button
                onClick={handleShare}
                disabled={sharing || copied}
                aria-label="Share this product"
                className={`shrink-0 mt-1 transition-colors ${copied ? "text-black cursor-default" : sharing ? "opacity-50 cursor-not-allowed" : "text-gray-500 hover:text-black"}`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 mt-5 pt-5">
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">
              Colour: <span className="text-black">{color.name}</span>
            </p>
            <div className="flex items-center gap-2">
              {product.colors.map((color, i) => (
                <button
                  key={color.name}
                  onClick={() => handleSelectColor(i)}
                  aria-label={`Select colour ${color.name}`}
                  className={`w-8 h-8 rounded-full border transition-all ${
                    i === colorIndex
                      ? "border-black ring-1 ring-black ring-offset-2"
                      : "border-gray-300 hover:border-black"
                  }`}
                  style={{ background: productColorCss(color) }}
                />
              ))}
            </div>
          </div>

          {needsSize && activeColorObj && (
            <div className="border-t border-gray-200 mt-5 pt-5">
              <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">
                Size{selectedSize ? `: ${selectedSize}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {activeColorObj.sizes?.map((vs) => {
                  const out = vs.stock <= 0;
                  const selected = vs.size === selectedSize;
                  return (
                    <button
                      key={vs.size}
                      onClick={() => !out && setSelectedSize(vs.size)}
                      disabled={out}
                      title={out ? "Out of stock" : `${vs.stock} available`}
                      className={`relative min-w-[3rem] px-4 py-2.5 text-sm font-medium border transition-all ${
                        out
                          ? "border-gray-200 text-gray-300 cursor-not-allowed line-through bg-gray-50"
                          : selected
                            ? "border-black bg-black text-white shadow-sm"
                            : "border-gray-300 hover:border-black hover:shadow-sm"
                      }`}
                    >
                      {vs.size}
                    </button>
                  );
                })}
              </div>
              {selectedSize && settings.showStockOnStorefront && (() => {
                const vs = activeColorObj.sizes?.find((s) => s.size === selectedSize);
                if (!vs) return null;
                return (
                  <p className="mt-2 text-xs text-gray-500">
                    {vs.stock <= 5
                      ? `Only ${vs.stock} left in stock`
                      : `${vs.stock} available`}
                  </p>
                );
              })()}
            </div>
          )}

          <div className="mt-6 border-t border-gray-200">
            {(product.sections ?? [])
              .filter((section) => section.body.trim() !== "")
              .map((section) => (
                <Accordion key={section.title} title={section.title} defaultOpen={product.sectionsOpen}>
                  <MarkdownText text={section.body} />
                </Accordion>
              ))}
          </div>
        </div>
      </div>
    </div>

      {similar.length > 0 && (
        <section className="mt-8 mb-8 sm:mt-16 sm:mb-16 px-4 sm:px-6 lg:px-10">
          <h2 className="text-xl font-bold mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {similar.map((item) => (
                <div key={item.id} onClick={() => window.scrollTo(0, 0)}>
                  <ProductCard product={item} variant="compact" />
                </div>
              ))}
            </div>
        </section>
      )}

      {lightboxIndex !== null && activeImages[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={(e) => { if (e.target === e.currentTarget) setLightboxIndex(null); }}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>

          {activeImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightboxRef.current(-1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors z-10"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}

          {activeImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); navigateLightboxRef.current(1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors z-10"
              aria-label="Next image"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          )}

          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={activeImages[lightboxIndex]}
              alt={`${product.name} - ${color.name}`}
              className="max-h-[90vh] max-w-[90vw] object-contain select-none"
              draggable={false}
            />
            {lightboxFade && (
              <img
                key={lightboxFadeKeyRef.current}
                src={lightboxFade}
                alt={`${product.name} - ${color.name}`}
                className="absolute inset-0 max-h-[90vh] max-w-[90vw] object-contain select-none"
                style={{ transition: "opacity 350ms ease-out", opacity: 1 }}
                ref={(el) => {
                  if (el) {
                    requestAnimationFrame(() => { el.style.opacity = "0"; });
                  }
                }}
                onTransitionEnd={() => setLightboxFade(null)}
                draggable={false}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
