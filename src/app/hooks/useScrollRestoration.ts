import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const prevSection = useRef("");
  const initedRef = useRef(false);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  if (!initedRef.current) {
    initedRef.current = true;
    try {
      const raw = sessionStorage.getItem("scroll-positions");
      scrollPositionsRef.current = raw ? JSON.parse(raw) : {};
    } catch {
      scrollPositionsRef.current = {};
    }
  }

  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    let timer = 0;
    const handleScroll = () => {
      scrollPositionsRef.current[location.pathname] = window.scrollY;
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        try {
          sessionStorage.setItem("scroll-positions", JSON.stringify(scrollPositionsRef.current));
        } catch {
          sessionStorage.removeItem("scroll-positions");
        }
      }, 150);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timer) clearTimeout(timer);
    };
  }, [location.pathname]);

  useLayoutEffect(() => {
    const currentSection = location.pathname.split("/")[1] || "";

    if (navigationType === "POP") {
      const saved = scrollPositionsRef.current[location.pathname] ?? 0;
      window.scrollTo(0, saved);
    } else if (prevSection.current !== currentSection) {
      window.scrollTo(0, 0);
    }
    prevSection.current = currentSection;
  }, [location, navigationType]);
}
