// Storefront hook (src/app). If the CMS also needs it, move it to src/hooks/.
import { useEffect, type DependencyList, type RefObject } from "react";
import type { Options } from "qr-code-styling";

export function useQrCode(
  containerRef: RefObject<HTMLElement | null>,
  options: Options | null,
  deps: DependencyList
): void {
  useEffect(() => {
    if (!options) return;
    let cancelled = false;
    import("qr-code-styling").then(({ default: QRCodeStyling }) => {
      const el = containerRef.current;
      if (cancelled || !el) return;
      el.innerHTML = "";
      new QRCodeStyling(options).append(el);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
