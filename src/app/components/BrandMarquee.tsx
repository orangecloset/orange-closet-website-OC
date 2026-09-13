import { useCallback, useEffect, useRef, useState } from "react";

const SPEED_PX_PER_SEC = 75;

function BrandMarquee({ brands }: { brands: string[] }) {
  const copyRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(1);
  const [duration, setDuration] = useState(0);

  const recalc = useCallback(() => {
    const width = copyRef.current?.scrollWidth ?? 0;
    if (!width) return;
    setCopies(Math.max(1, Math.ceil((window.innerWidth * 2) / width)));
    setDuration(width * Math.max(1, Math.ceil((window.innerWidth * 2) / width)) / SPEED_PX_PER_SEC);
  }, []);

  useEffect(() => {
    recalc();
    window.addEventListener("resize", recalc);
    return () => window.removeEventListener("resize", recalc);
  }, [recalc, brands]);

  if (brands.length === 0) return null;

  const half = Array.from({ length: copies }, () => brands).flat();

  const renderHalf = (prefix: string) =>
    half.map((brand, i) => (
      <span
        key={`${prefix}-${i}`}
        className="flex items-center gap-6 pr-6 text-sm sm:text-base uppercase tracking-[0.3em] text-gray-600 whitespace-nowrap"
        style={{ fontFamily: "futura-pt, sans-serif", fontWeight: 400 }}
      >
        {brand}
        <span className="w-1 h-1 rounded-full bg-gray-300" aria-hidden="true" />
      </span>
    ));

  return (
    <div className="border-y border-gray-200 py-6 overflow-hidden">
      <div
        className="flex w-max animate-[brand-marquee_linear_infinite]"
        style={duration > 0 ? { animationDuration: `${duration}s` } : undefined}
      >
        <div ref={copyRef} className="flex w-max shrink-0">
          {renderHalf("a")}
        </div>
        <div className="flex w-max shrink-0" aria-hidden="true">
          {renderHalf("b")}
        </div>
      </div>
    </div>
  );
}

export default BrandMarquee;
