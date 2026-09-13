import { useEffect, useState } from "react";

export type Viewport = "mobile" | "tablet" | "desktop";

function getViewport(): Viewport {
  return window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  useEffect(() => {
    const handleResize = () => {
      setViewport(getViewport());
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return viewport;
}
