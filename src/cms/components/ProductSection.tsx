import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Search, X } from "lucide-react";
import { useCms } from "../store/cmsContext";
import type { CmsProduct } from "../store/types";
import { api } from "../lib/api";
import { Badge, Container, Header, Input } from "./ui";
import { SortableList, DragHandle } from "./SortableList";

function isSoldOutProduct(p: CmsProduct): boolean {
  return p.colors.every((c) =>
    (c.sizes ?? []).every((vs) => vs.stock <= 0)
  );
}

export function ProductSection({
  title,
  subtitle,
  ids,
  field,
}: {
  title: string;
  subtitle: string;
  ids: string[];
  field: "featuredIds" | "bestSellerIds";
}) {
  const { updateHomepage } = useCms();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [matches, setMatches] = useState<CmsProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<CmsProduct[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .listProductsPaged({
        page: 1,
        limit: 6,
        search: debounced,
        availability: "available",
      })
      .then((res) => {
        if (cancelled) return;
        setMatches(res.data.filter((p) => !ids.includes(p.id)));
      })
      .catch((err) => console.error("[cms] failed to search products", err));
    return () => {
      cancelled = true;
    };
  }, [open, debounced, ids]);

  useEffect(() => {
    if (ids.length === 0) {
      setSelectedProducts([]);
      return;
    }
    let cancelled = false;
    api
      .getProductsByIds(ids)
      .then((res) => !cancelled && setSelectedProducts(res.data))
      .catch((err) => console.error("[cms] failed to load selected products", err));
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const updatePos = useCallback(() => {
    const el = inputWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const openDropdown = () => {
    if (open) return;
    updatePos();
    setPortalTarget(
      (inputWrapRef.current?.closest(".cms-admin") as HTMLElement) ?? document.body
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rowRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
      setSelected([]);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSelected([]);
      }
    };
    const reposition = () => updatePos();
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, updatePos]);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addSelected = () => {
    if (selected.length === 0) return;
    updateHomepage({ [field]: [...ids, ...selected] });
    setSearch("");
    setSelected([]);
    setOpen(false);
  };

  const remove = (id: string) => {
    updateHomepage({ [field]: ids.filter((x) => x !== id) });
  };

  return (
    <Container>
      <Header title={title} subtitle={subtitle} />
      <div className="px-6 py-4">
        <div className="flex items-center gap-2" ref={rowRef}>
          <div className="relative flex-1" ref={inputWrapRef}>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                openDropdown();
              }}
              onFocus={openDropdown}
              placeholder="Search available products to feature..."
              className="pl-8"
            />
          </div>
          <button
            type="button"
            onClick={addSelected}
            disabled={selected.length === 0}
            title="Add selected products to featured"
            className="inline-flex h-[30px] w-28 shrink-0 items-center justify-center gap-x-1.5 rounded-md bg-[var(--button-inverted)] px-3 text-[13px] font-medium text-[var(--contrast-fg-primary)] shadow-[var(--buttons-inverted)] outline-none transition-colors hover:bg-[var(--button-inverted-hover)] active:bg-[var(--button-inverted-pressed)] disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)] disabled:text-[var(--fg-disabled)] disabled:shadow-none"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {selected.length > 0 ? `Add (${selected.length})` : "Add"}
          </button>
        </div>

        {open &&
          portalTarget &&
          createPortal(
            <div
              ref={popRef}
              className="fixed z-[60] flex max-h-[288px] flex-col overflow-hidden rounded-md border border-[var(--border-base)] bg-[var(--bg-base)] shadow-[var(--elevation-flyout)]"
              style={{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }}
            >
              <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {matches.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-[var(--fg-muted)]">
                    No matching available products.
                  </p>
                ) : (
                  matches.map((p) => {
                    const isSelected = selected.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleSelect(p.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-[var(--bg-subtle-hover)] ${
                          isSelected ? "bg-[var(--bg-subtle)]" : ""
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected
                              ? "border-[var(--bg-interactive)] bg-[var(--bg-interactive)] text-white"
                              : "border-[var(--border-base)] bg-transparent"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </span>
                        <img
                          src={p.colors[0]?.images[0]}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-[var(--fg-base)]">{p.name}</p>
                          <p className="text-xs text-[var(--fg-muted)]">{p.price}</p>
                        </div>
                        <Badge color="green" size="2xsmall">Available</Badge>
                      </button>
                    );
                  }                  )
                )}
              </div>
            </div>,
            portalTarget
          )}

        <div className="mt-4 flex flex-col divide-y divide-[var(--border-subtle)]">
          {ids.length === 0 && (
            <p className="py-3 text-sm text-[var(--fg-muted)]">No products selected.</p>
          )}
          <SortableList
            items={ids}
            onReorder={(next) => updateHomepage({ [field]: next })}
            keyExtractor={(id) => id}
            renderItem={(id, _index, dragHandleProps) => {
              const product = selectedProducts.find((p) => p.id === id);
              const soldOut = product ? isSoldOutProduct(product) : false;
              return (
                <div className="flex items-center gap-3 py-2">
                  <DragHandle handleProps={dragHandleProps} />
                  <img
                    src={product?.colors[0]?.images[0]}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--fg-base)]">{product?.name ?? id}</p>
                    <p className="text-xs text-[var(--fg-muted)]">{id}</p>
                  </div>
                  {soldOut && <Badge color="red" size="xsmall">Sold out</Badge>}
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    aria-label="Remove product"
                    className="rounded-sm p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--tag-red-text)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            }}
          />
        </div>
      </div>
    </Container>
  );
}
