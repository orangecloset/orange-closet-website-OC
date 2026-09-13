import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import type { MouseEvent } from "react";

type ProductCardImageProps = {
  images: string[];
  alt: string;
  className?: string;
  hoverIndex?: number;
};

export default function ProductCardImage({ images, alt, className, hoverIndex }: ProductCardImageProps) {
  const [failed, setFailed] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [slide, setSlide] = useState<{ src: string; dir: number; key: number } | null>(null);
  const slideTimerRef = useRef<number | undefined>(undefined);
  const slideKeyRef = useRef(0);
  const [isFinePointer, setIsFinePointer] = useState(false);
  const hoverSwapUsedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsFinePointer(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsFinePointer(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const validImages = useMemo(
    () => images.filter((src) => !failed.includes(src)),
    [images, failed]
  );

  useEffect(() => {
    setIndex(0);
    setSlide(null);
    setHovered(false);
  }, [images]);

  const hasHoverSwap =
    isFinePointer &&
    index === 0 &&
    hoverIndex !== undefined &&
    hoverIndex !== 0 &&
    hoverIndex < validImages.length &&
    !hoverSwapUsedRef.current;

  const currentSrc = validImages[Math.min(index, validImages.length - 1)];
  const hoverSrc = hasHoverSwap ? validImages[hoverIndex as number] : undefined;

  if (!currentSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <ShoppingBag className="w-8 h-8 text-gray-300" />
      </div>
    );
  }

  const hasNav = validImages.length > 1;

  const clearSlide = () => {
    if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current);
    slideTimerRef.current = undefined;
    setSlide(null);
  };

  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => {
    setHovered(false);
    hoverSwapUsedRef.current = false;
  };

  const goTo = (direction: number) => {
    let nextIndex = (index + direction + validImages.length) % validImages.length;

    if (hasHoverSwap && hovered && direction > 0 && !hoverSwapUsedRef.current) {
      hoverSwapUsedRef.current = true;
      nextIndex = Math.max(1, (hoverIndex as number) + 1);
      if (nextIndex >= validImages.length) nextIndex = 0;
    }

    if (nextIndex === index) return;

    slideKeyRef.current += 1;
    setSlide({ src: currentSrc, dir: direction, key: slideKeyRef.current });
    setIndex(nextIndex);

    if (slideTimerRef.current) window.clearTimeout(slideTimerRef.current);
    slideTimerRef.current = window.setTimeout(() => setSlide(null), 420);
  };

  const handleArrowClick = (e: MouseEvent, direction: number) => {
    e.preventDefault();
    e.stopPropagation();
    goTo(direction);
  };

  const slideClasses = "duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] fill-mode-forwards";

  return (
    <div
      className="product-card-img-wrap relative w-full h-full"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {slide ? (
        <>
          <img
            key={`slide-in-${slide.key}`}
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
            src={validImages[Math.min(index, validImages.length - 1)]}
            alt={alt}
            className={`absolute inset-0 w-full h-full object-cover animate-in ${
              slide.dir === 1 ? "slide-in-from-right-full" : "slide-in-from-left-full"
            } fade-in-40 ${slideClasses}`}
            onError={() => {
              const s = validImages[Math.min(index, validImages.length - 1)];
              setFailed((prev) => (prev.includes(s) ? prev : [...prev, s]));
            }}
          />
          <img
            key={`slide-out-${slide.key}`}
            src={slide.src}
            crossOrigin="anonymous"
            alt={alt}
            className={`absolute inset-0 w-full h-full object-cover animate-out ${
              slide.dir === 1 ? "slide-out-to-left" : "slide-out-to-right"
            } fade-out-60 ${slideClasses}`}
            onAnimationEnd={clearSlide}
          />
        </>
      ) : (
        <>
          <img
            key={`base-${currentSrc}`}
            loading="lazy"
            decoding="async"
            crossOrigin="anonymous"
            src={currentSrc}
            alt={alt}
            className={`absolute inset-0 w-full h-full object-cover ${className ?? ""}`}
            onError={() => setFailed((prev) => (prev.includes(currentSrc) ? prev : [...prev, currentSrc]))}
          />
          {hasHoverSwap && hoverSrc && (
            <img
              key={`hover-${hoverSrc}`}
              loading="lazy"
              decoding="async"
              crossOrigin="anonymous"
              src={hoverSrc}
              alt={alt}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out ${
                hovered ? "opacity-100" : "opacity-0"
              }`}
              onError={() => setFailed((prev) => (prev.includes(hoverSrc) ? prev : [...prev, hoverSrc]))}
            />
          )}
        </>
      )}

      <div
        aria-hidden="true"
        className={`absolute inset-0 pointer-events-none transition-opacity duration-150 ease-out ${
          hovered ? "opacity-100" : "opacity-0"
        }`}
        style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)" }}
      />

      {hasNav && (
        <>
          <button
            type="button"
            aria-label="Previous image"
            data-drag-ignore="true"
            onClick={(e) => handleArrowClick(e, -1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto hover:text-white z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            aria-label="Next image"
            data-drag-ignore="true"
            onClick={(e) => handleArrowClick(e, 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto hover:text-white z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
}