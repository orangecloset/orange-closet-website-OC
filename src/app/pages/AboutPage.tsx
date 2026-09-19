import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AboutPageConfig } from "../../cms/store/types";
import { useCatalog } from "../data/CatalogContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { useViewport } from "../hooks/useViewport";

type Section = AboutPageConfig["sections"][number];

function Paragraphs({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
      {items.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}

function IconCards({
  section,
  stepStyle = false,
}: {
  section: Section;
  stepStyle?: boolean;
}) {
  if (section.cards.length === 0) return null;
  return (
    <div
      className={`grid gap-6 ${
        section.cards.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
      } ${stepStyle ? "" : "mt-8"}`}
    >
      {section.cards.map((card, i) => (
        <div key={card.title || i} className="border border-gray-100 p-4">
          {stepStyle && (
            <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">
              Step {i + 1}
            </p>
          )}
          <h3 className="text-xs uppercase tracking-widest font-semibold mb-1.5">{card.title}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{card.description}</p>
        </div>
      ))}
    </div>
  );
}

function ImageStack({ images }: { images: string[] }) {
  const clean = images.filter((i) => i.trim());
  if (clean.length === 0) return null;
  return (
    <div className={`grid gap-2 ${clean.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {clean.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover aspect-[3/4]"
        />
      ))}
    </div>
  );
}

function CtaButton({ section }: { section: Section }) {
  if (!section.ctaLabel || !section.ctaUrl) return null;
  const external = section.ctaUrl.startsWith("http");
  return (
    <a
      href={section.ctaUrl}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="inline-block border border-black text-xs uppercase tracking-widest px-8 py-2.5 hover:bg-black hover:text-white transition-colors mt-8"
    >
      {section.ctaLabel}
    </a>
  );
}

function SectionBody({ section }: { section: Section }) {
  switch (section.id) {
    case "brand-profile":
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-wide mb-6">{section.heading}</h2>
            <Paragraphs items={section.body} />
            <IconCards section={section} />
            {section.closingText && (
              <p className="text-sm text-gray-600 leading-relaxed mt-8 max-w-2xl">{section.closingText}</p>
            )}
          </div>
          <ImageStack images={section.images.slice(0, 2)} />
        </div>
      );

    case "sustainability":
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {section.images[0]?.trim() && (
            <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden order-2 lg:order-1">
              <img src={section.images[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/8" />
            </div>
          )}
          <div className={section.images[0]?.trim() ? "order-1 lg:order-2" : ""}>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-wide mb-6">{section.heading}</h2>
            <Paragraphs items={section.body} />
            <IconCards section={section} />
          </div>
        </div>
      );

    case "franchising":
      return (
        <>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-wide mb-6">{section.heading}</h2>
          <IconCards section={section} stepStyle />
          {(section.body[0] || section.closingText) && (
            <p className="text-sm text-gray-600 leading-relaxed mt-8 max-w-2xl">
              {section.body[0] || section.closingText}
            </p>
          )}
        </>
      );

    case "affiliates":
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-wide mb-6">{section.heading}</h2>
            <Paragraphs items={section.body} />
            <CtaButton section={section} />
          </div>
          <ImageStack images={section.images.slice(0, 4)} />
        </div>
      );

    default:
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-wide mb-6">{section.heading}</h2>
            <Paragraphs items={section.body} />
            <IconCards section={section} />
            {section.closingText && (
              <p className="text-sm text-gray-600 leading-relaxed mt-8 max-w-2xl">{section.closingText}</p>
            )}
            <CtaButton section={section} />
          </div>
          <ImageStack images={section.images} />
        </div>
      );
  }
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <section
      id={section.id}
      className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 sm:pt-8 sm:pb-3 scroll-mt-16"
    >
      <div className="border-t border-gray-100 pt-6 sm:pt-8 first:border-t-0 first:pt-0">
        {section.label && (
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">{section.label}</p>
        )}
        <SectionBody section={section} />
      </div>
    </section>
  );
}

export default function AboutPage() {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const { about, loading } = useCatalog();
  const viewport = useViewport();
  usePageTitle(about.heroSubtitle?.trim() || undefined);

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, pathname]);

  const handleSectionNav = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (location.hash !== `#${id}`) navigate(`/about#${id}`);
  };

  const enabledSections = about.sections.filter(
    (s) =>
      s.enabled &&
      (s.heading.trim() ||
        s.body.length > 0 ||
        s.cards.length > 0 ||
        s.closingText.trim() ||
        s.images.some((i) => i.trim()))
  );

  const sectionScrollRef = useRef<HTMLDivElement>(null);
  const [sectionHasMore, setSectionHasMore] = useState(false);

  const checkSectionScroll = useCallback(() => {
    const el = sectionScrollRef.current;
    if (!el) return;
    setSectionHasMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkSectionScroll();
    const el = sectionScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkSectionScroll, { passive: true });
    window.addEventListener("resize", checkSectionScroll);
    return () => {
      el.removeEventListener("scroll", checkSectionScroll);
      window.removeEventListener("resize", checkSectionScroll);
    };
  }, [checkSectionScroll, enabledSections]);

  const useMobileHero = viewport === "mobile" && !!about.mobileHeroImage;
  const heroSrc = useMobileHero ? about.mobileHeroImage : about.heroImage;

  return (
    <>

      <section className="relative w-full">
        <div className={`relative w-full bg-gray-200 overflow-hidden ${useMobileHero ? "" : "aspect-[1920/900]"}`}>
          {heroSrc && (
            <img
              src={heroSrc}
              alt=""
              loading="eager"
              decoding="async"
              ref={(el) => {
                if (el) el.setAttribute("fetchpriority", "high");
              }}
              className={useMobileHero ? "w-full h-auto" : "w-full h-full object-cover"}
            />
          )}
          <div className="absolute inset-0 bg-black/15" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 text-white text-left">
              {about.heroSubtitle && (
                <p className="text-xs uppercase tracking-widest mb-3 border-b border-white pb-0.5 inline-block">
                  {about.heroSubtitle}
                </p>
              )}
              {about.heroHeading && (
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-normal tracking-wide hero-title-shadow">
                  {about.heroHeading}
                </h1>
              )}
            </div>
          </div>
        </div>
      </section>

      {enabledSections.length > 0 && (
        <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6">
          <div className="relative">
            <div ref={sectionScrollRef} className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 pr-8">
              {enabledSections.map((s) => (
                <a
                  key={s.id}
                  href={`/about#${s.id}`}
                  onClick={(e) => handleSectionNav(e, s.id)}
                  className="text-xs uppercase tracking-widest font-medium whitespace-nowrap px-4 py-2 border border-gray-300 hover:bg-black hover:text-white hover:border-black transition-colors"
                >
                  {s.label || s.heading}
                </a>
              ))}
            </div>
            {sectionHasMore && (
              <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
            )}
          </div>
        </section>
      )}

      {!loading && enabledSections.length === 0 ? (
        <section className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <p className="text-sm text-gray-500">Our story is coming soon.</p>
        </section>
      ) : (
        enabledSections.map((section) => <SectionBlock key={section.id} section={section} />)
      )}

      <div className="pb-8 sm:pb-12" />
    </>
  );
}
