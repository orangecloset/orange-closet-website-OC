import { useState } from "react";
import { ShoppingBag } from "lucide-react";

type ImageWithFallbackProps = {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
};

function ImageWithFallback({ src, alt, className, priority = false }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <ShoppingBag className="w-12 h-12 text-gray-300" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      crossOrigin="anonymous"
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      ref={(el) => {
        if (el && priority) el.setAttribute("fetchpriority", "high");
      }}
      onError={() => setFailed(true)}
    />
  );
}

export default ImageWithFallback;
