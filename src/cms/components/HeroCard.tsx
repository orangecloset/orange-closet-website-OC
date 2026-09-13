import type { HomepageHero } from "../store/types";
import { useCms } from "../store/cmsContext";
import { Badge, Button, Input, Label, Select } from "./ui";
import { UploadButton } from "./UploadButton";
import { Trash2, X } from "lucide-react";

export function HeroCard({ hero }: { hero: HomepageHero }) {
  const { homepage, updateHomepage, types } = useCms();
  const index = homepage.heroes.findIndex((h) => h.id === hero.id);

  const patchHero = (patch: Partial<HomepageHero>) => {
    updateHomepage({
      heroes: homepage.heroes.map((h) => (h.id === hero.id ? { ...h, ...patch } : h)),
    });
  };

  const removeHero = () => {
    updateHomepage({ heroes: homepage.heroes.filter((h) => h.id !== hero.id) });
  };

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex-1 text-[13px] font-medium text-[var(--fg-base)]">
          Hero {index + 1}
        </span>
        <button
          type="button"
          onClick={removeHero}
          aria-label={`Remove hero ${index + 1}`}
          title="Remove this hero"
          className="rounded-sm p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--tag-red-text)]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Title</Label>
            <Input value={hero.label} onChange={(e) => patchHero({ label: e.target.value })} placeholder="e.g. Timeless Watches" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Subtitle</Label>
            <Input value={hero.subtitle} onChange={(e) => patchHero({ subtitle: e.target.value })} placeholder="e.g. Discover more" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Navigate To</Label>
            <Select value={hero.to} onChange={(e) => patchHero({ to: e.target.value })}>
              {types.map((t) => (
                <option key={t.route} value={t.route}>
                  {t.route}
                </option>
              ))}
              {!types.some((t) => t.route === hero.to) && (
                <option value={hero.to}>{hero.to}</option>
              )}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label>Image</Label>
            <div className="flex flex-wrap items-center gap-3">
              {hero.src && (
                <img
                  src={hero.src}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                />
              )}
              <UploadButton
                onUploaded={(url) => patchHero({ src: url })}
                label={hero.src ? "Replace" : "Upload"}
                preset="hero"
              />
              {hero.src && (
                <Button
                  variant="ghost"
                  size="small"
                  type="button"
                  onClick={() => patchHero({ src: "" })}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>
          {hero.wide && (
            <div className="flex flex-col gap-2">
              <Label>Mobile Image (Portrait)</Label>
              <div className="flex flex-wrap items-center gap-3">
                {hero.mobileSrc && (
                  <img
                    src={hero.mobileSrc}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                  />
                )}
                <UploadButton
                  onUploaded={(url) => patchHero({ mobileSrc: url })}
                  label={hero.mobileSrc ? "Replace" : "Upload"}
                  preset="hero"
                />
                {hero.mobileSrc && (
                  <Button
                    variant="ghost"
                    size="small"
                    type="button"
                    onClick={() => patchHero({ mobileSrc: "" })}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        {hero.src && (
          <img
            src={hero.src}
            alt=""
            className="h-64 w-full rounded-md object-cover bg-[var(--bg-subtle)]"
          />
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--fg-muted)]">Full-width banner</span>
            <Badge color={hero.wide ? "blue" : "grey"}>
              {hero.wide ? "Wide" : "Half"}
            </Badge>
          </div>
          <button
            type="button"
            onClick={() => patchHero({ wide: !hero.wide })}
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
          >
            Toggle
          </button>
        </div>
      </div>
    </div>
  );
}
