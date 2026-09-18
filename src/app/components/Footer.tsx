import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import QRCodeStyling from "qr-code-styling";
import {
  Facebook, Instagram, Youtube, Twitter, type LucideIcon,
} from "lucide-react";
import { useCatalog } from "../data/CatalogContext";

const SOCIAL_ICONS = [
  { label: "Facebook", Icon: Facebook },
  { label: "Instagram", Icon: Instagram },
  { label: "YouTube", Icon: Youtube },
  { label: "Twitter", Icon: Twitter },
];

export default function Footer() {
  const facebookQrContainerRef = useRef<HTMLDivElement>(null);
  const { settings, about } = useCatalog();

  const facebookUrl = settings.facebookUrl?.trim() ?? "";
  const messengerUrl = settings.messengerUrl?.trim() ?? "";

  const aboutLinks = about.sections
    .filter((s) => s.enabled && s.label.trim())
    .map((s) => ({ label: s.label, to: `/about#${s.id}` }));
  const aboutTitle = about.heroSubtitle?.trim() || "";

  useEffect(() => {
    const el = facebookQrContainerRef.current;
    if (!el || !facebookUrl) return;
    const qr = new QRCodeStyling({
      width: 120,
      height: 120,
      margin: 0,
      data: facebookUrl,
      imageOptions: { hideBackgroundDots: false, imageSize: 0, margin: 0 },
      dotsOptions: {
        type: "dots",
        color: "#1a1a1a",
      },
      cornersSquareOptions: {
        type: "extra-rounded",
        color: "#1a1a1a",
      },
      cornersDotOptions: {
        type: "dot",
        color: "#1a1a1a",
      },
      backgroundOptions: {
        color: "white",
      },
    });
    el.innerHTML = "";
    qr.append(el);
  }, [facebookUrl]);

  const activeSocials = (settings.socials ?? [])
    .map((s) => {
      const Icon = SOCIAL_ICONS.find(
        (i) => i.label.toLowerCase() === s.label.toLowerCase()
      )?.Icon;
      const url = s.url.trim();
      if (!Icon || !url) return null;
      return { label: s.label, url, Icon };
    })
    .filter((s): s is { label: string; url: string; Icon: LucideIcon } => s !== null);

  return (
    <footer className="bg-white pt-10 pb-6 border-t border-gray-100">
      <div className="px-2.5 sm:px-3.5 lg:px-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-10 justify-center">
          {facebookUrl && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-4">Follow Us</h3>
              <p className="text-sm text-gray-600 mb-3">Scan to follow our Facebook page.</p>
              <a
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-white border border-gray-200 p-2 hover:border-black transition-colors"
              >
                <div ref={facebookQrContainerRef} className="w-[120px] h-[120px] flex items-center justify-center" />
              </a>
            </div>
          )}
          {aboutTitle && aboutLinks.length > 0 && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-4">{aboutTitle}</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {aboutLinks.map(({ label, to }) => (
                  <li key={label}><Link to={to} className="hover:text-black transition-colors">{label}</Link></li>
                ))}
              </ul>
            </div>
          )}
          {settings.branchLinks.length > 0 && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-4">Branches</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {settings.branchLinks.map(({ label, url }) => (
                  <li key={label}>
                    {url ? (
                      <a href={url} className="hover:text-black transition-colors">{label}</a>
                    ) : (
                      <span>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {settings.legalLinks.length > 0 && (
            <div>
              <h3 className="font-bold text-xs uppercase tracking-widest mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                {settings.legalLinks.map(({ label }) => {
                  const slug = label
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "");
                  return (
                    <li key={label}>
                      <Link to={`/legal/${slug}`} className="hover:text-black transition-colors">{label}</Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {(settings.conciergeHeading || settings.conciergeText || messengerUrl) && (
            <div className="col-span-2 sm:col-span-1 lg:col-span-1">
              {settings.conciergeHeading && (
                <h3 className="font-bold text-sm uppercase tracking-wide mb-2">{settings.conciergeHeading}</h3>
              )}
              {settings.conciergeText && (
                <p className="text-sm text-gray-600 mb-4">{settings.conciergeText}</p>
              )}
              {messengerUrl && (
                <a
                  href={messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block border border-black text-xs uppercase tracking-widest px-8 py-2.5 hover:bg-black hover:text-white transition-colors"
                >
                  {settings.messageButtonLabel || "Message Us"}
                </a>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-gray-100">
          {settings.locationText ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold uppercase text-xs tracking-widest">Location:</span>
              {settings.locationUrl ? (
                <a href={settings.locationUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 text-sm hover:text-black transition-colors">{settings.locationText}</a>
              ) : (
                <span className="underline underline-offset-2 text-sm">{settings.locationText}</span>
              )}
            </div>
          ) : (
            <span />
          )}
          {activeSocials.length > 0 && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-widest mb-3">Visit Us</h4>
              <div className="flex items-center gap-4">
                {activeSocials.map(({ Icon, label, url }) => (
                  <a key={label} href={url} aria-label={label} className="text-gray-600 hover:text-black transition-colors">
                    <Icon className="w-5 h-5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="text-center mt-8 pt-4 border-t border-gray-100">
          {settings.copyrightText && <p className="text-xs text-gray-500">{settings.copyrightText}</p>}
        </div>
      </div>
    </footer>
  );
}
