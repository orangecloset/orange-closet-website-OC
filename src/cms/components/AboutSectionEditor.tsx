import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import type { AboutPageConfig } from "../store/types";
import { Button, Input, Label, Switch, Textarea } from "./ui";
import { UploadButton } from "./UploadButton";

export type SectionData = AboutPageConfig["sections"][number];

function ArrayInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={v}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="mt-0.5 text-[var(--fg-muted)] transition-colors hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="small"
          type="button"
          onClick={() => onChange([...values, ""])}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

function CardListInput({
  label,
  cards,
  onChange,
}: {
  label: string;
  cards: { title: string; description: string }[];
  onChange: (v: { title: string; description: string }[]) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-3">
        {cards.map((c, i) => (
          <div key={i} className="rounded-md border border-[var(--border-subtle)] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--fg-muted)]">Card {i + 1}</span>
              <button
                type="button"
                onClick={() => onChange(cards.filter((_, idx) => idx !== i))}
                className="text-[var(--fg-muted)] transition-colors hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Input
              value={c.title}
              onChange={(e) => {
                const next = [...cards];
                next[i] = { ...next[i], title: e.target.value };
                onChange(next);
              }}
              placeholder="Title"
            />
            <Textarea
              value={c.description}
              onChange={(e) => {
                const next = [...cards];
                next[i] = { ...next[i], description: e.target.value };
                onChange(next);
              }}
              placeholder="Description"
              rows={2}
            />
          </div>
        ))}
        <Button
          variant="secondary"
          size="small"
          type="button"
          onClick={() => onChange([...cards, { title: "", description: "" }])}
        >
          <Plus className="h-4 w-4" /> Add Card
        </Button>
      </div>
    </div>
  );
}

export function SectionEditor({
  section,
  index,
  onChange,
  onDelete,
}: {
  section: SectionData;
  index: number;
  onChange: (patch: Partial<SectionData>) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--fg-base)]">
              Section {index + 1}
            </span>
            {!section.enabled && (
              <span className="rounded bg-[var(--tag-orange-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tag-orange-text)]">
                Disabled
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">
            {section.heading || "No heading"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={section.enabled}
            onCheckedChange={(enabled) => onChange({ enabled })}
          />
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete section ${index + 1}`}
            title="Delete this section"
            className="rounded-sm p-1 text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--tag-red-text)]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--border-subtle)] px-4 py-4">
          <div>
            <Label>Section Label</Label>
            <Input
              value={section.label}
              onChange={(e) => onChange({ label: e.target.value })}
              placeholder="e.g. 01 — Brand Profile"
            />
          </div>
          <div>
            <Label>Heading</Label>
            <Input
              value={section.heading}
              onChange={(e) => onChange({ heading: e.target.value })}
              placeholder="Section heading"
            />
          </div>
          <ArrayInput
            label="Body Paragraphs"
            values={section.body}
            onChange={(body) => onChange({ body })}
            placeholder="Paragraph text"
          />
          <div>
            <Label>Images</Label>
            <div className="flex flex-wrap items-center gap-2">
              {section.images.map((img, i) => (
                <div key={i} className="relative">
                  <img
                    src={img}
                    alt=""
                    className="h-12 w-12 rounded object-cover bg-[var(--bg-subtle)]"
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ images: section.images.filter((_, j) => j !== i) })}
                    aria-label={`Remove image ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-base)] text-[var(--fg-muted)] shadow-[var(--borders-base)] hover:text-[var(--tag-red-text)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <UploadButton
                onUploaded={(url) => onChange({ images: [...section.images, url] })}
                label={section.images.length ? "Add Image" : "Upload"}
              />
            </div>
          </div>
          <CardListInput
            label="Feature / Step Cards"
            cards={section.cards}
            onChange={(cards) => onChange({ cards })}
          />
          <div>
            <Label>Closing Text</Label>
            <Textarea
              value={section.closingText}
              onChange={(e) => onChange({ closingText: e.target.value })}
              placeholder="Optional closing paragraph"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CTA Button Label</Label>
              <Input
                value={section.ctaLabel}
                onChange={(e) => onChange({ ctaLabel: e.target.value })}
                placeholder="e.g. Join Our Program"
              />
            </div>
            <div>
              <Label>CTA Button URL</Label>
              <Input
                value={section.ctaUrl}
                onChange={(e) => onChange({ ctaUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
