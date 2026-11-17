import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useCms } from "../store/cmsContext";
import { Button, Container, Header, Input } from "./ui";
import { ReorderButtons } from "./ReorderButtons";

export function BrandList() {
  const { homepage, updateHomepage } = useCms();
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const isDuplicate = (name: string) =>
    homepage.brands.some((b) => b.trim().toLowerCase() === name.toLowerCase());
  const canAdd = trimmed.length > 0 && !isDuplicate(trimmed);

  const addBrand = () => {
    if (!canAdd) return;
    updateHomepage({ brands: [...homepage.brands, trimmed] });
    setValue("");
  };

  const removeBrand = (index: number) => {
    updateHomepage({ brands: homepage.brands.filter((_, i) => i !== index) });
  };

  const moveBrand = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= homepage.brands.length) return;
    const next = [...homepage.brands];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    updateHomepage({ brands: next });
  };

  return (
    <Container>
      <Header title="Brands" subtitle="Brands shown in the marquee on the homepage" />
      <div className="px-4 py-4 sm:px-6">
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
          <Button variant="secondary" size="small" onClick={addBrand} disabled={!canAdd}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        <div className="mt-4 max-h-[280px] overflow-y-auto overscroll-contain slim-scrollbar">
          <div className="flex flex-col gap-2 pr-2">
            {homepage.brands.map((brand, index) => (
              <div
                key={brand}
                className="flex items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1.5"
              >
                <ReorderButtons
                  label={brand}
                  canMoveUp={index > 0}
                  canMoveDown={index < homepage.brands.length - 1}
                  onMoveUp={() => moveBrand(index, -1)}
                  onMoveDown={() => moveBrand(index, 1)}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fg-base)]">
                  {brand}
                </span>
                <button
                  type="button"
                  onClick={() => removeBrand(index)}
                  aria-label={`Remove ${brand}`}
                  className="text-[var(--fg-muted)] hover:text-[var(--tag-red-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {homepage.brands.length === 0 && (
              <p className="text-sm text-[var(--fg-muted)]">No brands yet.</p>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
