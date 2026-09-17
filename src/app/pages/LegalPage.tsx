import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import { ArrowLeft } from "lucide-react";
import { useCatalog } from "../data/CatalogContext";
import { usePageTitle } from "../hooks/usePageTitle";

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useCatalog();

  const page = settings.legalLinks.find((l) => {
    const derived = l.label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return derived === slug;
  });

  usePageTitle(page?.label ?? "Legal");

  if (!page || !page.body?.trim()) {
    return (
      <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-3xl sm:text-5xl font-semibold mb-3">Page Not Found</h1>
        <p className="text-sm text-gray-500 mb-8">
          The page you are looking for could not be found.
        </p>
        <Link
          to="/"
          onClick={() => window.scrollTo(0, 0)}
          className="inline-block border border-black px-8 py-3 text-xs uppercase tracking-widest transition-colors hover:bg-black hover:text-white"
        >
          Back to Home
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 lg:py-16">
      <Link
        to="#"
        onClick={(e) => {
          e.preventDefault();
          window.history.back();
        }}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <h1 className="text-2xl sm:text-3xl font-semibold mb-8">{page.label}</h1>

      <div className="legal-markdown max-w-none text-sm leading-relaxed text-gray-700">
        <Markdown>{page.body}</Markdown>
      </div>
    </section>
  );
}
