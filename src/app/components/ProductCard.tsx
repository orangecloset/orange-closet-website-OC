import { Link } from "react-router-dom";
import { primaryColor } from "../../data/products";
import type { Product } from "../../data/products";
import { getSaleInfo } from "../../data/types";
import ProductCardImage from "./ProductCardImage";

export type ProductCardVariant = "full" | "simple" | "compact" | "sale" | "home";

type ProductCardProps = {
  product: Product;
  variant?: ProductCardVariant;
};

function CardMedia({ product, variant }: { product: Product; variant: ProductCardVariant }) {
  const color = primaryColor(product);
  const soldOut = product.inStock === false;
  const hasSecondImage = color.images.length > 1;
  const saleInfo = getSaleInfo(product.price, product.compareAtPrice);
  const image = (
    <ProductCardImage
      images={color.images}
      alt={`${product.name} - ${color.name}`}
      className="w-full h-full object-cover"
      hoverIndex={hasSecondImage ? 1 : undefined}
    />
  );

  if (variant === "compact") {
    return (
      <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
        {image}
        {soldOut ? (
          <span className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="bg-red-800/90 text-white text-[8px] uppercase tracking-widest font-semibold px-2 py-[3px] whitespace-nowrap border border-red-800/90 leading-none">
              Sold Out
            </span>
          </span>
        ) : saleInfo.onSale ? (
          <span className="absolute top-2 left-2 text-[8px] uppercase tracking-widest font-semibold bg-black text-white px-2 py-[3px] pointer-events-none whitespace-nowrap z-10 border border-black leading-none">
            {saleInfo.label}
          </span>
        ) : product.isNew ? (
          <span className="absolute top-2 left-2 text-[8px] uppercase tracking-widest font-semibold bg-white border border-black text-black px-2 py-[3px] pointer-events-none whitespace-nowrap z-10 leading-none">
            New
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] bg-gray-100 overflow-hidden">
      <div className="w-full h-full">{image}</div>
      {soldOut ? (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <span className="bg-red-800/90 text-white text-[8px] sm:text-[10px] uppercase tracking-widest font-semibold px-2 py-[3px] whitespace-nowrap border border-red-800/90 leading-none">
            Sold Out
          </span>
        </span>
      ) : saleInfo.onSale ? (
        <span className="absolute top-2 left-2 text-[8px] sm:text-[10px] uppercase tracking-widest font-semibold bg-black text-white px-2 py-[3px] pointer-events-none whitespace-nowrap z-10 border border-black leading-none">
          {saleInfo.label}
        </span>
      ) : product.isNew ? (
        <span className="absolute top-2 left-2 text-[8px] sm:text-[10px] uppercase tracking-widest font-semibold bg-white border border-black text-black px-2 py-[3px] pointer-events-none whitespace-nowrap z-10 leading-none">
          New
        </span>
      ) : null}
    </div>
  );
}

function CardBody({ product, variant }: { product: Product; variant: ProductCardVariant }) {
  const color = primaryColor(product);

  if (variant === "home") {
    return (
      <div className="mt-2 text-center text-xs sm:text-sm leading-snug pl-3 pr-1">
        <p className="text-gray-800 whitespace-nowrap overflow-hidden text-ellipsis">
          {product.name} <span className="text-gray-500 capitalize">{color.name}</span>
        </p>
      </div>
    );
  }

  const cardText = (
    <>
      <p className="text-gray-900 text-[10px] sm:text-xs">{product.brand}</p>
      <p className="text-gray-800 text-xs sm:text-sm truncate">{product.name}</p>
      <p className="text-gray-500 text-xs sm:text-sm capitalize">{color.name}</p>
    </>
  );

  return (
    <div className="mt-2 mb-2 text-center text-xs sm:text-sm leading-snug pl-3 pr-1">
      {cardText}
      <div className="flex items-center justify-center gap-1.5 mt-1">
        <span className="text-gray-900 font-medium text-xs sm:text-sm">{product.price}</span>
        {product.compareAtPrice && (
          <span className="text-gray-400 line-through text-[10px] sm:text-xs">{product.compareAtPrice}</span>
        )}
      </div>
    </div>
  );
}

export default function ProductCard({ product, variant = "full" }: ProductCardProps) {
  return (
    <Link to={`/products/${product.id}`} className="block group">
      <CardMedia product={product} variant={variant} />
      <CardBody product={product} variant={variant} />
    </Link>
  );
}
