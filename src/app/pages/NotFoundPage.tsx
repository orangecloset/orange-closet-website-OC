import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("Page Not Found");
  return (
    <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="text-3xl sm:text-5xl font-semibold mb-3">404</h1>
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
