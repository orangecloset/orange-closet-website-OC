import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GripVertical, Plus, SwatchBook, X } from "lucide-react";
import { arrayMove } from "@dnd-kit/sortable";
import { useToast } from "../store/toastContext";
import { useCms } from "../store/cmsContext";
import { apiErrorMessage } from "../lib/api";
import type { CmsProduct, ProductStatus } from "../../data/store-types";
import { colorSwatchCss } from "../../data/products";
import { Button, Container, Header, Input, Label, Select, Switch, Tabs } from "./ui";
import { UploadButton } from "./UploadButton";
import { StockAdjustModal } from "./StockAdjustModal";
import { SortableList, DndContainer, SortableItems, DragHandle } from "./SortableList";
import { RichTextEditor } from "./RichTextEditor";
import { isEmptyHtml } from "../../lib/richText";

function normalizeHex(value: string): string {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(value.trim());
  if (!m) return "#e5e7eb";
  let digits = m[1];
  if (digits.length === 3) {
    digits = digits.split("").map((d) => d + d).join("");
  }
  return `#${digits.toLowerCase()}`;
}

type ColorInput = {
  id: string;
  name: string;
  hexes: string[];
  images: string[];
  stockBySize: Record<string, string>;
};

const MAX_STOCK = 500_000;

let nextColorId = 0;
const makeColorId = () => `color-${++nextColorId}`;

function parseStockValue(raw: string | undefined): number {
  const trimmed = (raw ?? "").trim();
  const parsed = Number(trimmed);
  return trimmed === "" || !Number.isFinite(parsed)
    ? 0
    : Math.min(MAX_STOCK, Math.max(0, Math.floor(parsed)));
}

export function ProductFormInner({ editing }: { editing?: CmsProduct }) {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { types, settings, addProduct, updateProduct } = useCms();
  const { showToast } = useToast();

  const presetType = searchParams.get("type") ?? undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [brand, setBrand] = useState(editing?.brand ?? "BRAND X");
  const [type, setType] = useState<string>(editing?.type ?? presetType ?? "bags");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [price, setPrice] = useState(editing?.price ?? "₱");
  const [compareAtPrice, setCompareAtPrice] = useState(editing?.compareAtPrice ?? "");
  const [sections, setSections] = useState<{ id: string; title: string; body: string }[]>(() => [
    ...(editing?.sections ?? []).map((s, i) => ({ id: `sec-${Date.now()}-${i}`, title: s.title, body: s.body })),
  ]);
  const [sectionsOpen, setSectionsOpen] = useState(editing?.sectionsOpen ?? true);
  const [sizes, setSizes] = useState<string[]>(editing?.sizes ?? []);
  const [newSize, setNewSize] = useState("");
  const [status, setStatus] = useState<ProductStatus>(editing?.status ?? "active");
  const [activeTab, setActiveTab] = useState("general");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<CmsProduct | null>(editing ?? null);

  const [colors, setColors] = useState<ColorInput[]>(
    editing?.colors.length
      ? editing.colors.map((c) => {
          const stockBySize: Record<string, string> = {};
          (c.sizes ?? []).forEach((vs) => {
            const stock = Number(vs.stock);
            stockBySize[vs.size] =
              Number.isFinite(stock) && stock !== 0 ? String(stock) : "";
          });
          const hexes =
            c.hexes && c.hexes.length > 0 ? [...c.hexes] : [c.hex];
          const images = c.images.filter((img) => img.trim());
          return { id: makeColorId(), name: c.name, hexes, images: images.length > 0 ? images : [""], stockBySize };
        })
      : [{ id: makeColorId(), name: "Default", hexes: ["#e5e7eb"], images: [""], stockBySize: {} }]
  );

  const typeInfo = types.find((t) => t.slug === type);
  const categories = useMemo(() => typeInfo?.categories ?? [], [typeInfo]);
  const isEditing = Boolean(editing);
  const hasSizes = sizes.length > 0;

  const stockGroups = useMemo(() => {
    if (isEditing) {
      return (stockProduct?.colors ?? []).map((color) => ({
        name: color.name,
        hexes: (color.hexes && color.hexes.length > 0
          ? color.hexes
          : [color.hex]
        ).map(normalizeHex),
        colorIndex: -1,
        rows: (color.sizes ?? []).map((variant) => {
          const stock = Number(variant.stock);
          return {
            size: variant.size,
            value: Number.isFinite(stock) && stock !== 0 ? String(stock) : "",
          };
        }),
      }));
    }

    return colors.map((color, index) => ({
      name: color.name || `Color ${index + 1}`,
      hexes: color.hexes.map(normalizeHex),
      colorIndex: index,
      rows: (hasSizes ? sizes : ["One Size"]).map((size) => ({
        size,
        value: color.stockBySize[size] ?? "",
      })),
    }));
  }, [isEditing, stockProduct, colors, hasSizes, sizes]);

  const setColor = (index: number, patch: Partial<ColorInput>) => {
    setColors((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const setStockBySize = (colorIndex: number, size: string, value: string) => {
    setColors((prev) => prev.map((c, i) => i === colorIndex ? { ...c, stockBySize: { ...c.stockBySize, [size]: value } } : c));
  };

  const handleStockSaved = (updated: CmsProduct | null) => {
    setStockProduct(updated);
    if (!updated) return;

    setColors((prev) =>
      prev.map((color) => {
        const fresh = updated.colors.find((item) => item.name === color.name);
        if (!fresh) return color;
        const stockBySize: Record<string, string> = {};
        (fresh.sizes ?? []).forEach((variant) => {
          const stock = Number(variant.stock);
          stockBySize[variant.size] =
            Number.isFinite(stock) && stock !== 0 ? String(stock) : "";
        });
        return { ...color, stockBySize };
      })
    );
  };

  const addColor = () => {
    setColors((prev) => [...prev, { id: makeColorId(), name: "", hexes: ["#e5e7eb"], images: [""], stockBySize: {} }]);
  };

  const setVariantColor = (colorIndex: number, hexIndex: number, value: string) => {
    setColors((prev) => prev.map((c, i) => {
      if (i !== colorIndex) return c;
      const hexes = [...c.hexes];
      hexes[hexIndex] = value;
      return { ...c, hexes };
    }));
  };

  const addColorToVariant = (colorIndex: number) => {
    setColors((prev) => prev.map((c, i) =>
      i === colorIndex && c.hexes.length < 3 ? { ...c, hexes: [...c.hexes, "#e5e7eb"] } : c
    ));
  };

  const removeColorFromVariant = (colorIndex: number, hexIndex: number) => {
    if (colors[colorIndex]?.hexes.length <= 1) return;
    setColors((prev) => prev.map((c, i) =>
      i === colorIndex
        ? { ...c, hexes: c.hexes.filter((_, j) => j !== hexIndex) }
        : c
    ));
  };

  const removeColor = (index: number) => {
    if (colors.length <= 1) return;
    setColors(colors.filter((_, i) => i !== index));
  };

  const removeImageFromColor = (colorIndex: number, imageIndex: number) => {
    setColors((prev) => prev.map((c, i) => {
      if (i !== colorIndex) return c;
      const images = c.images.filter((_, j) => j !== imageIndex);
      return { ...c, images: images.length > 0 ? images : [""] };
    }));
  };

  const addSize = () => {
    const trimmed = newSize.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    if (sizes.length === 0) {
      setColors((cols) =>
        cols.map((c) => {
          const one = c.stockBySize["One Size"];
          if (!one || one.trim() === "") return c;
          return { ...c, stockBySize: { ...c.stockBySize, [trimmed]: one } };
        })
      );
    }
    setSizes((prev) => [...prev, trimmed]);
    setNewSize("");
  };

  const removeSize = (size: string) => {
    const next = sizes.filter((s) => s !== size);
    if (next.length === 0 && sizes.length > 0) {
      setColors((cols) =>
        cols.map((c) => {
          const total = sizes.reduce((sum, s) => sum + parseStockValue(c.stockBySize[s]), 0);
          if (total <= 0) return c;
          return { ...c, stockBySize: { ...c.stockBySize, "One Size": String(total) } };
        })
      );
    }
    setSizes(next);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Product name is required";
    if (!brand.trim()) newErrors.brand = "Brand is required";
    if (!price.trim()) newErrors.price = "Price is required";
    if (!type) newErrors.type = "Type is required";
    if (!category) newErrors.category = "Category is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) setActiveTab("general");
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const categoryLabel = categories.find((c) => c.slug === category)?.label ?? category ?? "";

    const hasAny = colors.some((c) => c.name.trim() || c.hexes.some((h) => h.trim()) || c.images.some((img) => img.trim()));
    const variants = hasAny
      ? colors
      : [{ id: makeColorId(), name: "Default", hexes: ["#e5e7eb"], images: [colors[0]?.images[0] ?? ""], stockBySize: {} }];

    const parseStock = parseStockValue;

    const colorVariants = variants.map((c, i) => {
      const stockBySize: Record<string, number> = {};
      if (hasSizes) {
        sizes.forEach((s) => {
          stockBySize[s] = parseStock(c.stockBySize[s]);
        });
      }
      const normalizedHexes = c.hexes
        .map((h) => normalizeHex(h))
        .filter((h, idx, arr) => arr.findIndex((x) => x === h) === idx);
      const hex = normalizedHexes[0] ?? "#e5e7eb";
      return {
        name: c.name.trim() || (i === 0 ? "Default" : `Color ${i + 1}`),
        hex,
        ...(normalizedHexes.length > 1 ? { hexes: normalizedHexes } : {}),
        images: c.images.map((img) => img.trim()).filter(Boolean),
        stockBySize: hasSizes
          ? stockBySize
          : { "One Size": parseStock(c.stockBySize["One Size"]) },
      };
    });

    const validSections = sections
      .filter((s) => s.title.trim())
      .map((s) => ({ title: s.title.trim(), body: isEmptyHtml(s.body) ? "" : s.body }));

    const input = {
      name: name.trim(),
      brand: brand.trim() || undefined,
      type,
      category,
      categoryLabel,
      price,
      compareAtPrice: isEditing ? (compareAtPrice.trim() || null) : (compareAtPrice.trim() || undefined),
      sections: validSections,
      sectionsOpen,
      colors: colorVariants,
      sizes,
      status,
    };

    setSaving(true);
    const save = isEditing && productId
      ? updateProduct(productId, input)
      : addProduct(input).then(() => undefined);
    save
      .then(() => {
        showToast(isEditing ? "Product updated." : "Product created.");
        navigate("/cms-admin/products");
      })
      .catch((err) =>
        showToast(
          apiErrorMessage(err, "Couldn't save the product. Please try again."),
          false,
          "error"
        )
      )
      .finally(() => setSaving(false));
  };

  const tabs = [
    { key: "general", label: "General" },
    { key: "sizes", label: "Sizes", count: sizes.length || undefined },
    { key: "colors", label: "Colors & Variants", count: colors.length },
    { key: "stock", label: "Stock" },
    { key: "status", label: "Status" },
  ];

  if (productId && !editing) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-3 pb-24 md:pb-0">
      <Header
        title={isEditing ? "Edit Product" : "Add Product"}
        subtitle={isEditing ? editing?.id : "Create a new product"}
        actions={
          <>
            <Link to="/cms-admin/products"><Button variant="secondary" size="header">Cancel</Button></Link>
            <Button variant="primary" size="header" form="product-form" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-y-3">
        <Container>
          <div className="px-4 pt-2 sm:px-6">
            <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === "general" && (
            <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-2">
              <div className="flex flex-col gap-2 lg:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }} placeholder="e.g. Noane Side-Pocket Bucket Bag" />
                {errors.name && <p className="text-xs text-[var(--tag-red-text)]">{errors.name}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="brand">Brand *</Label>
                <Input id="brand" value={brand} onChange={(e) => { setBrand(e.target.value.toUpperCase()); if (errors.brand) setErrors((p) => { const n = { ...p }; delete n.brand; return n; }); }} placeholder="BRAND X" />
                {errors.brand && <p className="text-xs text-[var(--tag-red-text)]">{errors.brand}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Type *</Label>
                <Select id="type" value={type} onChange={(e) => { setType(e.target.value); setCategory(""); if (errors.type) setErrors((p) => { const n = { ...p }; delete n.type; return n; }); }}>
                  {(types.length > 0 ? types : []).map((t) => (<option key={t.slug} value={t.slug}>{t.label}</option>))}
                </Select>
                {errors.type && <p className="text-xs text-[var(--tag-red-text)]">{errors.type}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="category">Category *</Label>
                <Select id="category" value={category} onChange={(e) => { setCategory(e.target.value); if (errors.category) setErrors((p) => { const n = { ...p }; delete n.category; return n; }); }}>
                  <option value="">Select a category</option>
                  {categories.map((c) => (<option key={c.slug} value={c.slug}>{c.label}</option>))}
                </Select>
                {errors.category && <p className="text-xs text-[var(--tag-red-text)]">{errors.category}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="price">Price *</Label>
                <Input id="price" value={price} onChange={(e) => { setPrice(e.target.value); if (errors.price) setErrors((p) => { const n = { ...p }; delete n.price; return n; }); }} placeholder="P79.00" />
                {errors.price && <p className="text-xs text-[var(--tag-red-text)]">{errors.price}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="compareAtPrice">Compare-at Price</Label>
                <Input id="compareAtPrice" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Optional" />
              </div>
              <div className="flex flex-col gap-2 lg:col-span-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label>Content Sections</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Switch checked={sectionsOpen} onCheckedChange={setSectionsOpen} />
                    <span className="text-xs text-[var(--fg-muted)]">Open by default</span>
                    <Button
                      variant="secondary"
                      size="small"
                      type="button"
                      onClick={() => setSections((prev) => [...prev, { id: `sec-${Date.now()}-${prev.length}`, title: "", body: "" }])}
                    >
                      <Plus className="h-4 w-4" /> Add Section
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-[var(--fg-muted)]">
                  Select text and use the toolbar to make it bold or italic, add lists, or insert a table.
                </p>
                <div className="flex flex-col gap-3">
                  <SortableList
                    items={sections}
                    onReorder={setSections}
                    keyExtractor={(s, idx) => s.id ?? `sec-fallback-${idx}`}
                    renderItem={(s, idx, dragHandleProps) => (
                      <div className="flex flex-col gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
                        <div className="flex items-center gap-2">
                          <DragHandle handleProps={dragHandleProps} />
                          <Input
                            value={s.title}
                            onChange={(e) =>
                              setSections((prev) => prev.map((sec, i) => (i === idx ? { ...sec, title: e.target.value } : sec)))
                            }
                            placeholder={`Section title${idx >= 2 ? " (e.g. Materials, Sizing Guide)" : ""}`}
                            className="flex-1"
                          />
                          {sections.length > 1 && (
                            <Button variant="ghost" size="small" type="button" onClick={() => setSections((prev) => prev.filter((_, i) => i !== idx))} aria-label="Remove section">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <RichTextEditor
                          value={s.body}
                          onChange={(html) =>
                            setSections((prev) => prev.map((sec, i) => (i === idx ? { ...sec, body: html } : sec)))
                          }
                          ariaLabel={`Content for section ${idx + 1}`}
                          className="rte-product"
                        />
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "sizes" && (
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <SortableList
                  items={sizes}
                  onReorder={setSizes}
                  keyExtractor={(s) => s}
                  layout="horizontal"
                  renderItem={(s, _index, dragHandleProps) => (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)] pl-1 pr-1.5 py-1 text-sm font-medium text-[var(--fg-base)]">
                      <span className="cursor-grab touch-none text-[var(--fg-muted)] hover:text-[var(--fg-base)]" {...dragHandleProps}>
                        <GripVertical className="h-3 w-3" />
                      </span>
                      {s}
                      <button type="button" onClick={() => removeSize(s)} className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                />
                {sizes.length === 0 && (
                  <p className="text-sm text-[var(--fg-muted)]">No sizes — this product will be shown without a size selector.</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="e.g. 37, 40mm, M, L" className="min-w-0 flex-1 sm:w-48 sm:flex-none"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }} />
                <Button variant="secondary" size="small" type="button" onClick={addSize} disabled={!newSize.trim() || sizes.includes(newSize.trim())}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          )}

          {activeTab === "colors" && (
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
              <DndContainer
                onDragEnd={(_activeId, _overId, activeData, overData) => {
                  if (activeData?.kind !== "color" || overData?.kind !== "color") return;
                  const oldIndex = Number(activeData.colorIndex);
                  const newIndex = Number(overData.colorIndex);
                  if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return;
                  setColors((prev) => arrayMove(prev, oldIndex, newIndex));
                }}
              >
                <SortableItems
                  items={colors}
                  keyExtractor={(c) => c.id}
                  getItemData={(_c, colorIndex) => ({ kind: "color", colorIndex })}
                  renderItem={(c, index, dragHandleProps) => (
                    <div className="flex flex-col gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DragHandle handleProps={dragHandleProps} />
                          <Label>{index === 0 ? "Primary Color" : `Color ${index + 1}`}</Label>
                          {index === 0 && <span className="h-4 w-4 rounded-full border border-[var(--border-base)]" style={{ background: colorSwatchCss(c.hexes.map(normalizeHex)) }} />}
                        </div>
                        {colors.length > 1 && (
                          <Button variant="ghost" size="small" type="button" onClick={() => removeColor(index)} aria-label="Remove color">
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`color-name-${index}`}>Name</Label>
                          <Input id={`color-name-${index}`} value={c.name} onChange={(e) => setColor(index, { name: e.target.value })} placeholder="e.g. Black" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <Label htmlFor={`color-hex-${index}`}>Color(s)</Label>
                            {c.hexes.length < 3 && (
                              <Button variant="ghost" size="small" type="button" onClick={() => addColorToVariant(index)} className="h-6">
                                <Plus className="h-3 w-3" /> Add color
                              </Button>
                            )}
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-[var(--border-base)]"
                              style={{ background: colorSwatchCss(c.hexes.map(normalizeHex)) }}
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                              {c.hexes.map((hex, hexIndex) => (
                                <div key={`${index}-${hexIndex}`} className="flex items-center gap-1.5">
                                  <input
                                    type="color"
                                    value={normalizeHex(hex)}
                                    onChange={(e) => setVariantColor(index, hexIndex, e.target.value)}
                                    className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-[var(--border-base)] bg-transparent p-0.5"
                                    aria-label={`Colour ${hexIndex + 1}`}
                                  />
                                  <Input
                                    id={hexIndex === 0 ? `color-hex-${index}` : undefined}
                                    value={hex}
                                    onChange={(e) => setVariantColor(index, hexIndex, e.target.value)}
                                    placeholder="#e5e7eb"
                                    className="w-full min-w-0 sm:w-32"
                                  />
                                  {c.hexes.length > 1 && (
                                    <Button variant="ghost" size="small" type="button" onClick={() => removeColorFromVariant(index, hexIndex)} aria-label={`Remove colour ${hexIndex + 1}`} className="h-7 w-7 p-0">
                                      <X className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-[var(--fg-muted)]">
                            Add up to 3 colours to display as a split swatch (e.g. Yellow/Gold).
                          </p>
                        </div>
                      </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center justify-between gap-1">
                            <Label>Images</Label>
                            <div className="flex items-center gap-1">
                              <UploadButton
                                label="Upload"
                                multiple
                                onUploaded={(url) => {
                                  setColors((prev) =>
                                    prev.map((c, i) =>
                                      i === index && !c.images.includes(url)
                                        ? { ...c, images: [...c.images.filter((img) => img.trim()), url] }
                                        : c
                                    )
                                  );
                                }}
                              />
                            </div>
                          </div>
                          {index === 0 && (
                            <p className="text-xs text-[var(--fg-muted)]">
                              The first image of the primary color is used as the main image. Drag to reorder.
                            </p>
                          )}
                          <div className="flex flex-col gap-2">
                            {c.images.some((img) => img.trim()) ? (
                              <DndContainer
                                onDragEnd={(_activeId, _overId, activeData, overData) => {
                                  if (activeData?.kind !== "image" || overData?.kind !== "image") return;
                                  if (activeData.colorIndex !== overData.colorIndex) return;
                                  const oldIndex = Number(activeData.imageIndex);
                                  const newIndex = Number(overData.imageIndex);
                                  const colorIndex = Number(activeData.colorIndex);
                                  if (
                                    Number.isNaN(oldIndex) ||
                                    Number.isNaN(newIndex) ||
                                    Number.isNaN(colorIndex)
                                  ) return;
                                  setColors((prev) =>
                                    prev.map((col, ci) =>
                                      ci === colorIndex
                                        ? { ...col, images: arrayMove(col.images, oldIndex, newIndex) }
                                        : col
                                    )
                                  );
                                }}
                              >
                                <SortableItems
                                  items={c.images}
                                  keyExtractor={(img) => `img-${index}-${img}`}
                                  getItemData={(_img, imageIndex) => ({
                                    kind: "image",
                                    colorIndex: index,
                                    imageIndex,
                                  })}
                                  renderItem={(img, imgIdx, imageDragHandleProps) => (
                                    <div className="flex items-center gap-2">
                                      <DragHandle handleProps={imageDragHandleProps} />
                                      <img
                                        src={img}
                                        alt=""
                                        className="h-20 w-20 shrink-0 rounded-md object-cover bg-[var(--bg-base)]"
                                      />
                                      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                                        {imgIdx === 0 ? "Main" : `Image ${imgIdx}`}
                                      </span>
                                      <div className="flex-1" />
                                      <Button
                                        variant="ghost"
                                        size="small"
                                        type="button"
                                        onClick={() => removeImageFromColor(index, imgIdx)}
                                        aria-label="Remove image"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                />
                              </DndContainer>
                            ) : (
                              <p className="text-xs text-[var(--fg-muted)]">No images uploaded yet.</p>
                            )}
                          </div>
                        </div>

                    </div>
                  )}
                />
              </DndContainer>
              <Button variant="secondary" size="small" type="button" onClick={addColor} className="w-fit">
                <Plus className="h-4 w-4" /> Add Color
              </Button>
            </div>
          )}

          {activeTab === "stock" && (
            <div className="flex flex-col gap-3 px-4 py-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--fg-base)]">Inventory</p>
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                    {isEditing
                      ? "Stock is read-only here. Use Adjust Stock so every change is recorded in Inventory with a reason."
                      : "Enter the initial stock for each color and size. It will be recorded as Initial stock."}
                  </p>
                </div>
                {isEditing && (
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={() => setStockModalOpen(true)}
                  >
                    <SwatchBook className="h-4 w-4" />
                    Adjust Stock
                  </Button>
                )}
              </div>

              {stockGroups.length === 0 ? (
                <p className="text-sm text-[var(--fg-muted)]">
                  No variants yet. Add a color in Colors &amp; Variants first.
                </p>
              ) : (
                stockGroups.map((group) => {
                  const total = group.rows.reduce(
                    (sum, row) => sum + parseStockValue(row.value),
                    0
                  );
                  return (
                    <div
                      key={`${group.name}-${group.colorIndex}`}
                      className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3"
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <span
                          className="h-5 w-5 shrink-0 rounded-full border border-[var(--border-base)]"
                          style={{ background: colorSwatchCss(group.hexes) }}
                        />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg-base)]">
                          {group.name}
                        </p>
                        <span className="text-xs text-[var(--fg-muted)]">
                          {total <= 0 ? "Sold out" : `${total} in stock`}
                        </span>
                      </div>
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                        {group.rows.map((row) => (
                          <div key={`${group.name}-${row.size}`} className="contents">
                            <p className="truncate text-sm text-[var(--fg-base)]">
                              {row.size}
                            </p>
                            <Input
                              type="number"
                              min={0}
                              max={MAX_STOCK}
                              aria-label={`${group.name} ${row.size} stock`}
                              value={row.value}
                              disabled={isEditing}
                              onChange={(e) => {
                                if (group.colorIndex >= 0) {
                                  setStockBySize(group.colorIndex, row.size, e.target.value);
                                }
                              }}
                              placeholder="0"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}

              {isEditing && (
                <p className="text-xs text-[var(--fg-muted)]">
                  Newly added colors or sizes start at 0 stock when you save. Add them
                  first, then use Adjust Stock.
                </p>
              )}
            </div>
          )}

          {activeTab === "status" && (
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-2">
                <Label>Product Status</Label>
                <div className="flex flex-wrap gap-2">
                  {(["draft", "active"] as ProductStatus[]).map((s) => (
                    <button key={s} type="button" onClick={() => setStatus(s)}
                      className={`rounded-md border px-4 py-2 text-[13px] font-medium transition-colors ${status === s ? "border-[var(--bg-interactive)] bg-[var(--bg-interactive)] text-[var(--fg-on-color)]" : "border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--fg-base)] hover:bg-[var(--bg-subtle-hover)]"}`}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--fg-muted)]">
                  {status === "draft" && "Draft products are hidden from the storefront."}
                  {status === "active" && "Active products are visible on the storefront."}
                </p>
                <p className="text-xs text-[var(--fg-muted)]">
                  A product shows as "Sold Out" automatically when every colour has 0 stock.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>New Arrival</Label>
                <p className="text-xs text-[var(--fg-muted)]">
                  Automatic: products are shown as "New" for{" "}
                  {settings.newArrivalDays} day{settings.newArrivalDays === 1 ? "" : "s"} after
                  they are added. Change this in Settings.
                </p>
              </div>
            </div>
          )}
        </Container>
      </form>

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-[var(--border-base)] bg-[var(--bg-base)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--elevation-flyout)] md:hidden">
        <Link to="/cms-admin/products" className="flex-1">
          <Button variant="secondary" size="base" className="w-full">
            Cancel
          </Button>
        </Link>
        <Button
          variant="primary"
          size="base"
          form="product-form"
          type="submit"
          disabled={saving}
          className="flex-1"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <StockAdjustModal
        product={stockProduct}
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        onSaved={handleStockSaved}
      />
    </div>
  );
}
