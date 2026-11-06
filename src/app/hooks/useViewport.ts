import { useEffect, useState } from "react";

export type Viewport = "mobile" | "tablet" | "desktop";

function getViewport(): Viewport {
  return window.innerWidth < 640 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop";
}

export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(getViewport);

  useEffect(() => {
    const mobileMq = window.matchMedia("(max-width: 639px)");
    const tabletMq = window.matchMedia("(min-width: 640px) and (max-width: 1023px)");

    const update = () => {
      if (mobileMq.matches) setViewport("mobile");
      else if (tabletMq.matches) setViewport("tablet");
      else setViewport("desktop");
    };

    update();
    mobileMq.addEventListener("change", update);
    tabletMq.addEventListener("change", update);
    return () => {
      mobileMq.removeEventListener("change", update);
      tabletMq.removeEventListener("change", update);
    };
  }, []);

  return viewport;
}
