import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { GripVertical, Plus, X } from "lucide-react";
import { useToast } from "./toastContext";
import { useCms } from "../store/cmsContext";
import type { CmsProduct, ProductStatus } from "../store/types";
import { colorSwatchCss } from "../../data/products";
import { Button, Container, Header, Input, Label, Select, Tabs, Textarea } from "./ui";
import { UploadButton } from "./UploadButton";
import { SortableList, DndContainer, SortableItems, DragHandle } from "./SortableList";

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
  name: string;
  hexes: string[];
  images: string[];
  stockBySize: Record<string, string>;
};

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
  const [image, setImage] = useState(editing?.colors[0]?.images[0] ?? "");
  const [sizes, setSizes] = useState<string[]>(editing?.sizes ?? []);
  const [newSize, setNewSize] = useState("");
  const [status, setStatus] = useState<ProductStatus>(editing?.status ?? "active");
  const [activeTab, setActiveTab] = useState("general");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [colors, setColors] = useState<ColorInput[]>(
    editing?.colors.length
      ? editing.colors.map((c) => {
          const stockBySize: Record<string, string> = {};
          (c.sizes ?? []).forEach((vs) => {
            stockBySize[vs.size] = vs.stock === 0 ? "" : String(vs.stock);
          });
          const hexes =
            c.hexes && c.hexes.length > 0 ? [...c.hexes] : [c.hex];
          return { name: c.name, hexes, images: c.images.length > 0 ? [...c.images] : [""], stockBySize };
        })
      : [{ name: "Default", hexes: ["#e5e7eb"], images: [""], stockBySize: {} }]
  );

  const typeInfo = types.find((t) => t.slug === type);
  const categories = useMemo(() => typeInfo?.categories ?? [], [typeInfo]);
  const isEditing = Boolean(editing);
  const hasSizes = sizes.length > 0;

  const setColor = (index: number, patch: Partial<ColorInput>) => {
    setColors((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const setStockBySize = (colorIndex: number, size: string, value: string) => {
    setColors((prev) => prev.map((c, i) => i === colorIndex ? { ...c, stockBySize: { ...c.stockBySize, [size]: value } } : c));
  };

  const addColor = () => {
    setColors((prev) => [...prev, { name: "", hexes: ["#e5e7eb"], images: [""], stockBySize: {} }]);
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
    const next = colors.filter((_, i) => i !== index);
    setColors(next);
    if (index === 0) setImage(next[0]?.images[0] ?? "");
  };

  const removeImageFromColor = (colorIndex: number, imageIndex: number) => {
    setColors((prev) => prev.map((c, i) => {
      if (i !== colorIndex) return c;
      if (c.images.length <= 1) return c;
      return { ...c, images: c.images.filter((_, j) => j !== imageIndex) };
    }));
  };

  const updateColorImage = (colorIndex: number, imageIndex: number, value: string) => {
    setColors((prev) => prev.map((c, i) => {
      if (i !== colorIndex) return c;
      const images = [...c.images];
      images[imageIndex] = value;
      if (colorIndex === 0 && imageIndex === 0) setImage(value);
      return { ...c, images };
    }));
  };

  const updateMainImage = (value: string) => {
    setImage(value);
    setColors((prev) => prev.map((c, i) => i === 0 ? { ...c, images: [value, ...c.images.slice(1)] } : c));
  };

  const addSize = () => {
    const trimmed = newSize.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    setSizes((prev) => [...prev, trimmed]);
    setNewSize("");
  };

  const removeSize = (size: string) => {
    setSizes((prev) => prev.filter((s) => s !== size));
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
      : [{ name: "Default", hexes: ["#e5e7eb"], images: [image], stockBySize: {} }];

    const parseStock = (raw: string | undefined): number => {
      const trimmed = (raw ?? "").trim();
      const parsed = Number(trimmed);
      return trimmed === "" || Number.isNaN(parsed) ? 0 : Math.max(0, Math.floor(parsed));
    };

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
      .map((s) => ({ title: s.title.trim(), body: s.body }));

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
      sizes: sizes.length > 0 ? sizes : undefined,
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
      .catch(() => showToast("Couldn't save the product. Please try again."))
      .finally(() => setSaving(false));
  };

  const tabs = [
    { key: "general", label: "General" },
    { key: "sizes", label: "Sizes", count: sizes.length || undefined },
    { key: "colors", label: "Colors & Variants", count: colors.length },
    { key: "status", label: "Status" },
  ];

  if (productId && !editing) {
    return null;
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title={isEditing ? "Edit Product" : "Add Product"}
        subtitle={isEditing ? editing?.id : "Create a new product"}
        actions={
          <>
            <Link to="/cms-admin/products"><Button variant="secondary" size="small">Cancel</Button></Link>
            <Button variant="primary" size="small" form="product-form" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </>
        }
      />

      <form id="product-form" onSubmit={handleSubmit} className="flex flex-col gap-y-3">
        <Container>
          <div className="px-6 pt-2">
            <Tabs items={tabs} active={activeTab} onChange={setActiveTab} />
          </div>

          {activeTab === "general" && (
            <div className="grid grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-2">
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="image">Main Image</Label>
                </div>
                <Input id="image" value={image} onChange={(e) => updateMainImage(e.target.value)} placeholder="https://... (or upload below)" />
                <UploadButton label="Upload Main Image" onUploaded={updateMainImage} />
              </div>
              <div className="flex flex-col gap-2 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Content Sections</Label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSectionsOpen((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${sectionsOpen ? "bg-[var(--bg-interactive)]" : "bg-[var(--bg-disabled)]"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${sectionsOpen ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
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
                  Formatting: # heading, - bullet, **text** = bold, | col1 | col2 | = table, blank line = new paragraph.
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
                        <Textarea
                          value={s.body}
                          onChange={(e) =>
                            setSections((prev) => prev.map((sec, i) => (i === idx ? { ...sec, body: e.target.value } : sec)))
                          }
                          placeholder="Section content... (use | col1 | col2 | for tables)"
                          rows={3}
                        />
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "sizes" && (
            <div className="flex flex-col gap-3 px-6 py-4">
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
                <Input value={newSize} onChange={(e) => setNewSize(e.target.value)} placeholder="e.g. 37, 40mm, M, L" className="w-48"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }} />
                <Button variant="secondary" size="small" type="button" onClick={addSize} disabled={!newSize.trim() || sizes.includes(newSize.trim())}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          )}

          {activeTab === "colors" && (
            <div className="flex flex-col gap-3 px-6 py-4">
              <DndContainer
                onDragEnd={(activeId, overId) => {
                  // Color reorder: IDs are "color-{index}"
                  if (activeId.startsWith("color-") && overId.startsWith("color-")) {
                    const oldIndex = parseInt(activeId.split("-")[1], 10);
                    const newIndex = parseInt(overId.split("-")[1], 10);
                    if (isNaN(oldIndex) || isNaN(newIndex)) return;
                    setColors((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(oldIndex, 1);
                      const insertAt = oldIndex < newIndex ? newIndex - 1 : newIndex;
                      next.splice(insertAt, 0, moved);
                      return next;
                    });
                  }
                  // Image reorder: IDs are "img-{colorIndex}-{imageIndex}"
                  if (activeId.startsWith("img-") && overId.startsWith("img-")) {
                    const [, aColorIdx, aImgIdx] = activeId.split("-").map(Number);
                    const [, oColorIdx, oImgIdx] = overId.split("-").map(Number);
                    if (isNaN(aColorIdx) || isNaN(aImgIdx) || isNaN(oColorIdx) || isNaN(oImgIdx)) return;
                    if (aColorIdx !== oColorIdx) return; // can't drag across colors
                    setColors((prev) => prev.map((col, ci) => {
                      if (ci !== aColorIdx) return col;
                      const nextImages = [...col.images];
                      const [moved] = nextImages.splice(aImgIdx, 1);
                      const insertAt = aImgIdx < oImgIdx ? oImgIdx - 1 : oImgIdx;
                      nextImages.splice(insertAt, 0, moved);
                      return { ...col, images: nextImages };
                    }));
                  }
                }}
              >
                <SortableItems
                  items={colors}
                  keyExtractor={(_c, index) => `color-${index}`}
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
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`color-hex-${index}`}>Color(s)</Label>
                            {c.hexes.length < 3 && (
                              <Button variant="ghost" size="small" type="button" onClick={() => addColorToVariant(index)} className="h-6 text-xs">
                                <Plus className="h-3 w-3" /> Add color
                              </Button>
                            )}
                          </div>
                          <div className="flex items-start gap-2.5">
                            <span
                              className="mt-0.5 h-9 w-9 shrink-0 rounded-full border border-[var(--border-base)]"
                              style={{ background: colorSwatchCss(c.hexes.map(normalizeHex)) }}
                            />
                            <div className="flex flex-col gap-1.5">
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
                                    className="w-32"
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
                        <div className="flex items-center justify-between">
                          <Label>Images</Label>
                          <div className="flex items-center gap-1">
                            <UploadButton
                              label="Upload"
                              onUploaded={(url) => {
                                setColors((prev) =>
                                  prev.map((c, i) => (i === index ? { ...c, images: [...c.images, url] } : c))
                                );
                              }}
                            />

                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <SortableItems
                            items={c.images}
                            keyExtractor={(_img, imgIdx) => `img-${index}-${imgIdx}`}
                            renderItem={(img, imgIdx, imageDragHandleProps) => (
                              <div className="flex items-center gap-2">
                                <DragHandle handleProps={imageDragHandleProps} />
                                <Input value={img} onChange={(e) => updateColorImage(index, imgIdx, e.target.value)} placeholder={`Image URL ${imgIdx + 1}${imgIdx === 0 ? " (main)" : ""}`} className="flex-1" />
                                {img && <img src={img} alt="" className="h-8 w-8 shrink-0 rounded object-cover bg-[var(--bg-base)]" />}

                                {c.images.length > 1 && (
                                  <Button variant="ghost" size="small" type="button" onClick={() => removeImageFromColor(index, imgIdx)} aria-label="Remove image">
                                    <X className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          />
                        </div>
                      </div>

                      {hasSizes ? (
                        <div className="flex flex-col gap-2">
                          <Label>Stock by Size</Label>
                          <div className="overflow-x-auto rounded-md border border-[var(--border-subtle)]">
                            <table className="w-full text-left text-sm">
                              <thead>
                                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs text-[var(--fg-muted)]">
                                  <th className="px-3 py-2 font-medium">Size</th>
                                  <th className="px-3 py-2 font-medium">Stock</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-base)]">
                                {sizes.map((s) => {
                                  const val = c.stockBySize[s] ?? "";
                                  return (
                                    <tr key={s}>
                                      <td className="px-3 py-1.5 text-sm font-medium text-[var(--fg-base)]">{s}</td>
                                      <td className="px-3 py-1.5">
                                        <Input type="number" min={0} value={val} onChange={(e) => setStockBySize(index, s, e.target.value)} placeholder="0" className="h-8 w-24" />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <p className="text-xs text-[var(--fg-muted)]">Set 0 to mark that size sold out.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`color-stock-${index}`}>Stock</Label>
                          <Input id={`color-stock-${index}`} type="number" min={0} value={c.stockBySize["One Size"] ?? ""} onChange={(e) => setStockBySize(index, "One Size", e.target.value)} placeholder="e.g. 25" className="w-40" />
                        </div>
                      )}
                    </div>
                  )}
                />
              </DndContainer>
              <Button variant="secondary" size="small" type="button" onClick={addColor} className="w-fit">
                <Plus className="h-4 w-4" /> Add Color
              </Button>
            </div>
          )}

          {activeTab === "status" && (
            <div className="flex flex-col gap-4 px-6 py-4">
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
    </div>
  );
}
