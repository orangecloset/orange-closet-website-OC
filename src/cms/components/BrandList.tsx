import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import { useCms } from "../store/cmsContext";
import { Button, Container, Header, Input } from "./ui";
import { SortableList } from "./SortableList";

export function BrandList() {
  const { homepage, updateHomepage } = useCms();
  const [value, setValue] = useState("");

  const addBrand = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    updateHomepage({ brands: [...homepage.brands, trimmed] });
    setValue("");
  };

  const removeBrand = (brand: string) => {
    updateHomepage({ brands: homepage.brands.filter((b) => b !== brand) });
  };

  return (
    <Container>
      <Header title="Brands" subtitle="Brands shown in the marquee on the homepage" />
      <div className="px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addBrand();
              }
            }}
            placeholder="Add a brand..."
          />
          <Button variant="secondary" size="base" onClick={addBrand}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <SortableList
            items={homepage.brands}
            onReorder={(next) => updateHomepage({ brands: next })}
            keyExtractor={(b) => b}
            layout="horizontal"
            renderItem={(brand, _index, dragHandleProps) => (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[13px] text-[var(--fg-base)]"
              >
                <span className="cursor-grab touch-none text-[var(--fg-muted)] hover:text-[var(--fg-base)]" {...dragHandleProps}>
                  <GripVertical className="h-3 w-3" />
                </span>
                {brand}
                <button
                  type="button"
                  onClick={() => removeBrand(brand)}
                  aria-label={`Remove ${brand}`}
                  className="text-[var(--fg-muted)] hover:text-[var(--tag-red-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )}
          />
          {homepage.brands.length === 0 && (
            <p className="text-sm text-[var(--fg-muted)]">No brands yet.</p>
          )}
        </div>
      </div>
    </Container>
  );
}
