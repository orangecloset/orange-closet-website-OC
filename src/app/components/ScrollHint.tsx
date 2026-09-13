import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

export default function ScrollHint() {
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowScrollHint(window.scrollY < 80);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] hidden sm:flex flex-col items-center gap-1 transition-all duration-300 ${
        showScrollHint ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <span
        className="text-xs uppercase tracking-widest text-white"
       
      >
        Scroll
      </span>
      <ChevronDown className="w-7 h-7 text-white animate-[scroll-hint_1.6s_ease-in-out_infinite]" />
    </div>
  );
}
