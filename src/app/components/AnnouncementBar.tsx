import { useEffect, useMemo, useState, type FocusEvent } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import type { AnnouncementMessage } from "../../data/store-types";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const ITEM_HEIGHT = 32;
const DEFAULT_INTERVAL_SECONDS = 5;
const ALLOWED_TAGS = ["strong", "b", "em", "i", "u", "s"];

function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function isExternalLink(link: string): boolean {
  return /^(https?:|mailto:)/i.test(link);
}

export default function AnnouncementBar({
  messages,
  intervalSeconds = DEFAULT_INTERVAL_SECONDS,
}: {
  messages: AnnouncementMessage[];
  intervalSeconds?: number;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const items = useMemo(
    () =>
      (messages ?? [])
        .map((message) => ({
          ...message,
          html: DOMPurify.sanitize(message.html ?? "", {
            ALLOWED_TAGS,
            ALLOWED_ATTR: [],
          }),
        }))
        .filter((message) => textOf(message.html).length > 0),
    [messages]
  );
  const count = items.length;
  const intervalMs =
    Math.max(2, Number(intervalSeconds) || DEFAULT_INTERVAL_SECONDS) * 1000;
  const [index, setIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [animating, setAnimating] = useState(true);
  const paused = hoverPaused || focusPaused;

  useEffect(() => {
    setIndex(0);
    setAnimating(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [items, reduceMotion]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((current) =>
        reduceMotion ? (current + 1) % count : current + 1
      );
    }, intervalMs);
    return () => clearInterval(timer);
  }, [count, paused, reduceMotion, intervalMs]);

  useEffect(() => {
    if (index > count) setIndex(0);
  }, [index, count]);

  if (count === 0) return null;

  const loopItems = !reduceMotion && count > 1 ? [...items, items[0]] : items;

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocusPaused(false);
    }
  };

  const resetToStart = () => {
    setAnimating(false);
    setIndex(0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimating(true));
    });
  };

  return (
    <div
      className="relative h-8 overflow-hidden border-b border-gray-200 bg-white text-black"
      role="region"
      aria-label="Store announcement"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setFocusPaused(true)}
      onBlurCapture={handleBlur}
    >
      <div
        className={`flex flex-col ${
          animating && !reduceMotion
            ? "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            : ""
        }`}
        style={{ transform: `translateY(-${index * ITEM_HEIGHT}px)` }}
        onTransitionEnd={(event) => {
          if (event.propertyName !== "transform") return;
          if (index >= count) resetToStart();
        }}
      >
        {loopItems.map((message, i) => {
          const active = i === index;
          const className = `flex h-8 shrink-0 items-center justify-center px-6 ${
            active ? "" : "pointer-events-none"
          }`;
          const content = (
            <span
              className="block max-w-full truncate text-[11px] font-normal uppercase tracking-[0.18em] [&_em]:italic [&_strong]:font-bold [&_u]:underline [&_u]:underline-offset-2"
              dangerouslySetInnerHTML={{ __html: message.html }}
            />
          );
          const link = message.link?.trim();

          if (!link) {
            return (
              <div
                key={`${message.id}-${i}`}
                className={className}
                aria-hidden={!active}
              >
                {content}
              </div>
            );
          }

          if (isExternalLink(link)) {
            return (
              <a
                key={`${message.id}-${i}`}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
                aria-hidden={!active}
                tabIndex={active ? 0 : -1}
              >
                {content}
              </a>
            );
          }

          return (
            <Link
              key={`${message.id}-${i}`}
              to={link}
              className={className}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
