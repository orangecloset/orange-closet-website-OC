import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import type { Product } from "../../data/products";
import ProductCard from "../components/ProductCard";
import { usePageTitle } from "../hooks/usePageTitle";

import type { ProductCardVariant } from "../components/ProductCard";

type CollectionPageProps = {
  title: string;
  products: Product[];
  variant?: ProductCardVariant;
};

export default function CollectionPage({ title, products, variant = "full" }: CollectionPageProps) {
  usePageTitle(title);
  const navigate = useNavigate();
  return (
    <>
      <section className="border-b border-gray-100">
        <div className="px-2.5 sm:px-3.5 lg:pl-16 lg:pr-10 py-5 sm:py-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-xs uppercase tracking-widest text-gray-500 hover:text-black transition-colors mb-2"
           
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-wide">{title}</h1>
        </div>
      </section>

      <section className="mt-4 mb-16 px-2.5 sm:px-3.5 lg:px-10">
        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} variant={variant} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-500">
            <p className="text-sm">No products found.</p>
          </div>
        )}
      </section>
    </>
  );
}
