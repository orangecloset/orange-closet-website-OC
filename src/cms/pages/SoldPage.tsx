import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, ShoppingBag, ArrowLeft, ListFilter, Loader2 } from "lucide-react";
import { useToast } from "../store/toastContext";
import { useCms } from "../store/cmsContext";
import type { CmsProduct } from "../store/types";
import { randomString } from "../lib/utils";
import { invalidateProducts, usePagedProducts, useProductSuggestions } from "../lib/queries";
import { parsePrice, downloadReceiptPdf } from "../lib/receipt";
import { getCmsSession } from "../store/auth";
import { productColorCss } from "../../data/products";
import { Badge, Button, Container, Header, Input, Label, Modal, Select } from "../components/ui";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const AVAILABILITY_FILTERS: { key: string; label: string; apiValue?: string }[] = [
  { key: "sold", label: "Sold", apiValue: "soldout" },
  { key: "available", label: "Available", apiValue: "available" },
  { key: "all", label: "All" },
];

function stockBadge(stock: number) {
  if (stock <= 0) return <Badge color="red">Sold out</Badge>;
  return <Badge color={stock <= 3 ? "orange" : "grey"}>{stock} in stock</Badge>;
}

function totalStock(p: CmsProduct): number {
  return p.colors.reduce(
    (sum, c) => sum + (c.sizes ?? []).reduce((s, vs) => s + vs.stock, 0),
    0
  );
}

export default function SoldPage() {
  const { recordSale, settings } = useCms();
  const { showToast } = useToast();

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<CmsProduct | null>(null);
  const [colorIndex, setColorIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [soldDate, setSoldDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const suggestionsQuery = useProductSuggestions(debouncedQuery);
  const suggestions = suggestionsQuery.data?.data ?? [];

  const availabilityApi =
    AVAILABILITY_FILTERS.find((f) => f.key === availabilityFilter)?.apiValue ?? "";

  const productsQuery = usePagedProducts({
    page,
    availability: availabilityApi,
    limit: PAGE_SIZE,
  });
  const items = productsQuery.data?.data ?? [];
  const totalItems = productsQuery.data?.totalItems ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 1;
  const loading = productsQuery.isPending;

  useEffect(() => {
    setPage(1);
  }, [availabilityFilter]);

  const reload = invalidateProducts;

  const product: CmsProduct | null = selectedProduct;
  const activeColor = product?.colors[colorIndex];
  const activeVariant = activeColor?.sizes?.find(
    (vs) => vs.size === selectedSize
  );
  const sizeStock = activeVariant?.stock ?? 0;
  const qty = Math.max(1, quantity || 1);

  const cycleAvailability = () => {
    const keys = AVAILABILITY_FILTERS.map((f) => f.key);
    const idx = keys.indexOf(availabilityFilter);
    setAvailabilityFilter(keys[(idx + 1) % keys.length]);
  };

  const resetSaleForm = () => {
    setSelectedProduct(null);
    setColorIndex(0);
    setSelectedSize("");
    setQuantity(1);
    setQuery("");
  };

  const handleSelect = (p: CmsProduct) => {
    setSelectedProduct(p);
    setColorIndex(0);
    setSelectedSize("");
    setQuantity(1);
    setSoldDate(todayIso());
    setPaymentMethod("Cash");
    setCustomerName("");
    setCustomerPhone("");
  };

  const handleBack = () => {
    resetSaleForm();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !activeColor || !activeVariant || activeVariant.stock <= 0)
      return;
    setShowConfirm(true);
  };

  const finalizeSale = async () => {
    if (!product || !activeColor || !activeVariant) return;
    setRecording(true);
    try {
      const sale = await recordSale({
        id: `rs-${randomString(8)}`,
        productId: product.id,
        productName: product.name,
        productImage: activeColor.images[0] || undefined,
        colorName: activeColor.name,
        size: selectedSize,
        quantity: Math.max(1, qty),
        price: product.price,
        soldAt: new Date(`${soldDate}T12:00:00`).toISOString(),
        soldBy: getCmsSession()?.user?.name,
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      showToast("Sale recorded — stock updated.");
      setShowConfirm(false);
      resetSaleForm();
      reload();
      const AUTO_DOWNLOAD_PDF = false;
      if (AUTO_DOWNLOAD_PDF) {
        try {
          await downloadReceiptPdf({
            storeName: settings.storeName || "Store",
            logoUrl: settings.faviconUrl || undefined,
            sale,
            productContent: {
              sections: product.sections,
            },
          });
        } catch (pdfErr) {
          console.error("[cms] failed to generate receipt pdf", pdfErr);
          showToast("Sale saved, but receipt download failed.");
        }
      }
    } catch (err) {
      console.error("[cms] failed to record sale", err);
      showToast("Couldn't record the sale. Please try again. (SLL_01)");
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Sell"
        subtitle="Search the sold item and deduct it from stock."
        actions={
          <>
            <button
              type="button"
              onClick={cycleAvailability}
              disabled={Boolean(product)}
              className="inline-flex h-[30px] w-36 shrink-0 items-center justify-center gap-x-1.5 rounded-md bg-[var(--button-neutral)] px-3 text-[13px] font-medium text-[var(--fg-base)] shadow-[var(--buttons-neutral)] outline-none transition-colors hover:bg-[var(--button-neutral-hover)] active:bg-[var(--button-neutral-pressed)] disabled:cursor-not-allowed disabled:bg-[var(--bg-disabled)] disabled:text-[var(--fg-disabled)]"
            >
              <ListFilter className="h-4 w-4 shrink-0" />
              {AVAILABILITY_FILTERS.find((f) => f.key === availabilityFilter)?.label}
            </button>
            {product && (
              <Button variant="secondary" size="small" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            )}
          </>
        }
      />

      <Container>
        {!product ? (
          <>
            <div className="border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="relative z-20">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setQuery("");
                  }}
                  placeholder="Search products..."
                  className="pl-8"
                />
                {query.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] shadow-[var(--elevation-flyout)]">
                    {suggestions.length > 0 ? (
                      suggestions.map((p) => {
                        const thumb = p.colors[0]?.images[0];
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handleSelect(p);
                              setQuery("");
                            }}
                            className="flex w-full items-center gap-3 border-b border-[var(--border-subtle)] px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-[var(--bg-subtle-hover)]"
                          >
                            {thumb ? (
                              <img
                                src={thumb}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                              />
                            ) : (
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[var(--bg-subtle)]">
                                <ShoppingBag className="h-4 w-4 text-[var(--fg-disabled)]" />
                              </div>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-[var(--fg-base)]">{p.name}</span>
                              <span className="block truncate text-xs text-[var(--fg-muted)]">{p.price}</span>
                            </span>
                            {stockBadge(totalStock(p))}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">No products found</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
                    <th className="px-6 py-2.5 font-medium">Product</th>
                    <th className="w-32 px-6 py-2.5 font-medium">Price</th>
                    <th className="w-28 px-6 py-2.5 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--fg-muted)]" />
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
                        No products found
                      </td>
                    </tr>
                  ) : (
                    items.map((p) => {
                      const thumb = p.colors[0]?.images[0];
                      return (
                         <tr
                           key={p.id}
                           onClick={() => handleSelect(p)}
                          className="cursor-pointer border-b border-[var(--border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--bg-subtle-hover)]"
                        >
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt=""
                                  className="h-10 w-10 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                                />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--bg-subtle)]">
                                  <ShoppingBag className="h-4 w-4 text-[var(--fg-disabled)]" />
                                </div>
                              )}
                              <p className="truncate text-sm font-medium text-[var(--fg-base)]">{p.name}</p>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-base)]">{p.price}</td>
                          <td className="whitespace-nowrap px-6 py-3">{stockBadge(totalStock(p))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-6 py-4">
              <span className="text-xs text-[var(--fg-muted)]">
                {loading
                  ? "Loading…"
                  : `Page ${page} of ${totalPages} · ${totalItems} product(s)`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label="Next page"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 p-6"
          >
            <div className="flex items-center gap-4">
              <img
                src={product.colors[0]?.images[0]}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover bg-[var(--bg-subtle)]"
              />
              <div className="min-w-0">
                <h3 className="truncate text-lg font-medium text-[var(--fg-base)]">{product.name}</h3>
                <p className="text-sm text-[var(--fg-muted)]">{product.price}</p>
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <p className="mb-3 text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">Colour</p>
              <div className="flex flex-wrap items-center gap-2.5">
                {product.colors.map((color, i) => {
                  const colorStock = (color.sizes ?? []).reduce((s, vs) => s + vs.stock, 0);
                  const empty = colorStock <= 0;
                  return (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => {
                        if (!empty) {
                          setColorIndex(i);
                          setSelectedSize("");
                          setQuantity(1);
                        }
                      }}
                      disabled={empty}
                      title={`${color.name} — ${colorStock} in stock`}
                      className={`h-8 w-8 rounded-full border transition-all ${
                        empty
                          ? "cursor-not-allowed border-[var(--border-subtle)] opacity-40"
                          : i === colorIndex
                            ? "border-[var(--fg-base)] ring-1 ring-[var(--fg-base)] ring-offset-2"
                            : "border-[var(--border-base)] hover:border-[var(--fg-base)]"
                      }`}
                      style={{ background: productColorCss(color) }}
                    />
                  );
                })}
              </div>
              {activeColor && (
                <p className="mt-2 text-xs text-[var(--fg-muted)]">
                  {activeColor.name}:{" "}
                  {(activeColor.sizes ?? []).reduce((s, vs) => s + vs.stock, 0)} in stock
                </p>
              )}
            </div>

            {activeColor && (activeColor.sizes?.length ?? 0) > 0 && (
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <p className="mb-3 text-[11px] uppercase tracking-widest text-[var(--fg-muted)]">
                  Size{selectedSize ? `: ${selectedSize}` : ""}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {(activeColor.sizes ?? []).map((vs) => {
                    const out = vs.stock <= 0;
                    const selected = vs.size === selectedSize;
                    return (
                      <button
                        key={vs.size}
                        type="button"
                        onClick={() => {
                          if (!out) {
                            setSelectedSize(vs.size);
                            setQuantity(1);
                          }
                        }}
                        disabled={out}
                        title={out ? "Sold out" : `${vs.stock} in stock`}
                        className={`min-w-[3.5rem] rounded-md border px-4 py-2.5 text-sm font-medium transition-all ${
                          out
                            ? "cursor-not-allowed border-[var(--border-subtle)] bg-[var(--bg-disabled)] text-[var(--fg-disabled)] line-through"
                            : selected
                              ? "border-[var(--fg-base)] bg-[var(--fg-base)] text-[var(--fg-on-color)]"
                              : "border-[var(--border-base)] hover:border-[var(--fg-base)]"
                        }`}
                      >
                        {vs.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeVariant && (
              <div className="border-t border-[var(--border-subtle)] pt-4">
                <Label htmlFor="sell-qty">Quantity Sold</Label>
                <Input
                  id="sell-qty"
                  type="number"
                  min={1}
                  max={sizeStock}
                  value={quantity}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuantity(v === "" ? "" : Number(v));
                  }}
                  className="mt-1.5 w-40"
                />
                <p className="mt-1.5 text-xs text-[var(--fg-muted)]">
                  Current stock: {sizeStock} → After sale:{" "}
                  {Math.max(0, sizeStock - qty)}
                </p>
              </div>
            )}

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <Label htmlFor="sell-date">Date Sold</Label>
              <Input
                id="sell-date"
                type="date"
                value={soldDate}
                max={todayIso()}
                onChange={(e) => setSoldDate(e.target.value)}
                required
                className="mt-1.5 w-52"
              />
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sell-payment">Payment Method</Label>
                  <Select
                    id="sell-payment"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1.5"
                  >
                    <option value="Cash">Cash</option>
                    <option value="GCash">GCash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sell-customer-name">Customer Name (optional)</Label>
                  <Input
                    id="sell-customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in customer"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="sell-customer-phone">Contact Number (optional)</Label>
                  <Input
                    id="sell-customer-phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--border-subtle)] pt-5">
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="base"
                  type="submit"
                  disabled={!activeVariant || sizeStock <= 0}
                >
                  Record Sale
                </Button>
              </div>
            </div>
          </form>
        )}
      </Container>

      {product && activeColor && activeVariant && (
        <Modal
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm this sale?"
          description="This will deduct stock from the product and record the sale permanently."
          footer={
            <>
              <Button variant="secondary" size="small" onClick={() => setShowConfirm(false)} disabled={recording}>
                Cancel
              </Button>
              <Button variant="primary" size="small" onClick={() => finalizeSale()} disabled={recording}>
                Confirm Sale
              </Button>
            </>
          }
        >
          <p className="mb-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--fg-muted)]">
            Confirming will record the sale and update stock.
          </p>
          <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] pb-3">
            {activeColor.images[0] ? (
              <img src={activeColor.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover bg-[var(--bg-subtle)]" />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--bg-subtle)]">
                <ShoppingBag className="h-5 w-5 text-[var(--fg-disabled)]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--fg-base)]">{product.name}</p>
              <p className="text-xs text-[var(--fg-muted)]">{activeColor.name} · {selectedSize} · ×{Math.max(1, qty)}</p>
            </div>
            <span className="ml-auto whitespace-nowrap text-sm font-medium text-[var(--fg-base)]">
              ₱{(parsePrice(product.price) * Math.max(1, qty)).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <dl className="mt-3 flex flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--fg-muted)]">Date sold</dt>
              <dd className="text-[var(--fg-base)]">{soldDate}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--fg-muted)]">Payment method</dt>
              <dd className="text-[var(--fg-base)]">{paymentMethod}</dd>
            </div>
            {customerName.trim() && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fg-muted)]">Customer</dt>
                <dd className="text-[var(--fg-base)]">{customerName.trim()}</dd>
              </div>
            )}
            {customerPhone.trim() && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--fg-muted)]">Contact no.</dt>
                <dd className="text-[var(--fg-base)]">{customerPhone.trim()}</dd>
              </div>
            )}
          </dl>
        </Modal>
      )}
    </div>
  );
}
