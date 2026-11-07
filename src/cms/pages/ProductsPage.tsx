import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, Pencil, SwatchBook, ShoppingBag, Loader2 } from "lucide-react";
import { useToast } from "../store/toastContext";
import { useCms } from "../store/cmsContext";
import { invalidateProducts, usePagedProducts, useProductSuggestions } from "../lib/queries";
import { isNewProduct, type CmsProduct, type ProductStatus } from "../../data/store-types";
import { ActionMenu, Badge, Button, Checkbox, ConfirmDialog, Container, Header, Input, MobileList, Select, Tabs } from "../components/ui";
import { StockAdjustModal } from "../components/StockAdjustModal";
import { formatDate } from "../lib/utils";

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
];

function isSoldOut(p: CmsProduct): boolean {
  return p.colors.every((c) =>
    (c.sizes ?? []).every((vs) => vs.stock <= 0)
  );
}

function totalStock(p: CmsProduct): number {
  return p.colors.reduce(
    (sum, c) => sum + (c.sizes ?? []).reduce((s, vs) => s + vs.stock, 0),
    0
  );
}

function statusBadge(p: CmsProduct, isNew: boolean) {
  if (isSoldOut(p)) return <Badge color="red">Sold Out</Badge>;
  if (isNew && p.status === "active") return <Badge color="blue">New</Badge>;
  switch (p.status) {
    case "draft": return <Badge color="grey">Draft</Badge>;
    default: return <Badge color="green">Active</Badge>;
  }
}

export default function ProductsPage() {
  const { types, settings, deleteProduct, bulkDeleteProducts, bulkUpdateStatus } = useCms();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const suggestionsQuery = useProductSuggestions(debouncedQuery);
  const suggestions = suggestionsQuery.data?.data ?? [];

  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  const productsQuery = usePagedProducts({
    page,
    type: typeFilter,
    status: statusFilter,
    availability: availabilityFilter,
    limit: PAGE_SIZE,
  });
  
  const items = useMemo(() => productsQuery.data?.data ?? [], [productsQuery.data]);
  const totalItems = productsQuery.data?.totalItems ?? 0;
  const totalPages = productsQuery.data?.totalPages ?? 1;
  const loading = productsQuery.isPending;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(items.map((p) => p.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (currentIds.has(id)) next.add(id);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [items]);

  const reload = invalidateProducts;

  const pageItems = items;

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [stocksTarget, setStocksTarget] = useState<CmsProduct | null>(null);

  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkStatusTarget, setBulkStatusTarget] = useState<ProductStatus>("active");
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const typeLabel = (slug: string) => types.find((t) => t.slug === slug)?.label ?? slug;

  const allPageSelected = pageItems.length > 0 && pageItems.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => { const next = new Set(prev); pageItems.forEach((p) => next.delete(p.id)); return next; });
    } else {
      setSelectedIds((prev) => { const next = new Set(prev); pageItems.forEach((p) => next.add(p.id)); return next; });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const openStocks = (product: CmsProduct) => {
    setStocksTarget(product);
  };

  const handleBulkAction = async () => {
    if (!bulkAction) return;
    const ids = Array.from(selectedIds);
    if (bulkAction === "delete") {
      setConfirmBulkDelete(true);
    } else if (bulkAction === "status") {
      await bulkUpdateStatus(ids, bulkStatusTarget);
      showToast(`Status updated for ${ids.length} product(s).`);
      setSelectedIds(new Set());
      setBulkAction(null);
      reload();
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Products"
        subtitle={loading ? "Loading products…" : `${totalItems} product(s)`}
        actions={
          <Link to="/cms-admin/products/new" className="w-full sm:w-auto">
            <Button variant="primary" size="header" className="w-full sm:w-36">
              <Plus className="h-4 w-4 shrink-0" />
              Add Product
            </Button>
          </Link>
        }
      />

      <Container>
        <div className="flex flex-col gap-3 px-4 pt-2 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 overflow-x-auto sm:overflow-visible">
            <Tabs items={STATUS_FILTERS} active={statusFilter} onChange={(key) => { setStatusFilter(key); setPage(1); }} />
          </div>
          <div className="w-full shrink-0 lg:w-44">
            <Select
              value={availabilityFilter}
              onChange={(e) => { setAvailabilityFilter(e.target.value); setPage(1); }}
            >
              <option value="all">All</option>
              <option value="available">Available</option>
              <option value="soldout">Sold Out</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-4 py-4 sm:px-6 lg:flex-row lg:items-center">
          <div className="relative z-20 flex-1">
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
                          setQuery("");
                          navigate(`/cms-admin/products/${p.id}/edit`);
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
                          <span className="block truncate text-xs text-[var(--fg-muted)]">{typeLabel(p.type)} · {p.price}</span>
                        </span>
                        {statusBadge(p, isNewProduct(p, settings.newArrivalDays))}
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">No products found</p>
                )}
              </div>
            )}
          </div>
          <div className="w-full shrink-0 lg:w-44">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All types</option>
              {types.map((t) => (<option key={t.slug} value={t.slug}>{t.label}</option>))}
            </Select>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 sm:px-6">
            <span className="text-sm text-[var(--fg-muted)]">{selectedIds.size} selected</span>
            <Select value={bulkAction ?? ""} onChange={(e) => setBulkAction(e.target.value || null)} className="w-36">
              <option value="">Bulk action...</option>
              <option value="status">Change status</option>
              <option value="delete">Delete</option>
            </Select>
            {bulkAction === "status" && (
              <Select value={bulkStatusTarget} onChange={(e) => setBulkStatusTarget(e.target.value as ProductStatus)} className="w-32">
                <option value="active">Active</option>
                <option value="draft">Draft</option>
              </Select>
            )}
            <Button variant="secondary" size="small" disabled={!bulkAction || (bulkAction === "delete" && confirmBulkDelete)} onClick={handleBulkAction}>Apply</Button>
          </div>
        )}

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[740px] text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
                <th className="w-10 px-4 py-2.5"><Checkbox checked={allPageSelected} onChange={toggleSelectAll} disabled={pageItems.length === 0} /></th>
                <th className="px-6 py-2.5 font-medium">Product</th>
                <th className="w-32 px-6 py-2.5 font-medium">Type</th>
                <th className="w-28 px-6 py-2.5 font-medium">Price</th>
                <th className="w-32 px-6 py-2.5 font-medium">Availability</th>
                <th className="w-24 px-6 py-2.5 font-medium">Stocks</th>
                <th className="w-32 px-6 py-2.5 font-medium">Updated</th>
                <th className="w-16 px-6 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--fg-muted)]" />
                  </td>
                </tr>
              )}
              {!loading && pageItems.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-sm text-[var(--fg-muted)]">No products found.</td></tr>
              )}
              {pageItems.map((p) => {
                return (
                  <tr key={p.id} className={`border-b border-[var(--border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--bg-subtle-hover)] ${selectedIds.has(p.id) ? "bg-[var(--bg-subtle)]" : ""}`}>
                    <td className="w-10 px-4 py-3"><Checkbox checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.colors[0]?.images[0]} alt="" className="h-10 w-10 shrink-0 rounded object-cover bg-[var(--bg-subtle)]" />
                        <div className="min-w-0">
                          <Link to={`/cms-admin/products/${p.id}/edit`} className="block max-w-[260px] truncate text-sm text-[var(--fg-base)] hover:underline">{p.name}</Link>
                          <p className="truncate text-xs whitespace-nowrap text-[var(--fg-muted)]">{p.brand ?? "Store"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-muted)]">{typeLabel(p.type)}</td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-base)]">
                      {p.compareAtPrice && (<span className="mr-1 text-xs text-[var(--fg-muted)] line-through">{p.compareAtPrice}</span>)}
                      {p.price}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">{statusBadge(p, isNewProduct(p, settings.newArrivalDays))}</td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <button
                        type="button"
                        onClick={() => openStocks(p)}
                        aria-label={`Adjust stock for ${p.name}`}
                        className="relative inline-flex h-[30px] w-20 shrink-0 items-center justify-center rounded-md bg-[var(--button-neutral)] text-[13px] font-medium text-[var(--fg-base)] shadow-[var(--buttons-neutral)] outline-none transition-colors hover:bg-[var(--button-neutral-hover)] active:bg-[var(--button-neutral-pressed)]"
                      >
                        <SwatchBook className="absolute left-2 h-4 w-4 shrink-0" />
                        {totalStock(p)}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-muted)]">{formatDate(p.updatedAt)}</td>
                    <td className="px-6 py-3 text-right">
                      <ActionMenu items={[
                        { label: "Edit", icon: <Pencil className="h-4 w-4" />, to: `/cms-admin/products/${p.id}/edit` },
                        { label: "Adjust Stock", icon: <SwatchBook className="h-4 w-4" />, onClick: () => openStocks(p) },
                        { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => setDeleteTarget(p.id) },
                      ]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <MobileList>
          {loading && (
            <div className="flex justify-center px-4 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" />
            </div>
          )}
          {!loading && pageItems.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-[var(--fg-muted)]">No products found.</p>
          )}
          {!loading && pageItems.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5">
              <Checkbox checked={allPageSelected} onChange={toggleSelectAll} label="Select all" />
              <span className="text-xs text-[var(--fg-muted)]">{pageItems.length} on this page</span>
            </div>
          )}
          {pageItems.map((p) => {
            const thumb = p.colors[0]?.images[0];
            return (
              <div
                key={p.id}
                className={`flex flex-col gap-2.5 p-4 transition-colors ${selectedIds.has(p.id) ? "bg-[var(--bg-subtle)]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="mt-0.5" />
                  {thumb ? (
                    <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-md object-cover bg-[var(--bg-subtle)]" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[var(--bg-subtle)]">
                      <ShoppingBag className="h-5 w-5 text-[var(--fg-disabled)]" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link to={`/cms-admin/products/${p.id}/edit`} className="block truncate text-sm font-medium text-[var(--fg-base)]">
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-[var(--fg-muted)]">
                      {p.brand ?? "Store"} · {typeLabel(p.type)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-[var(--fg-base)]">
                        {p.compareAtPrice && (<span className="mr-1 text-xs text-[var(--fg-muted)] line-through">{p.compareAtPrice}</span>)}
                        {p.price}
                      </span>
                      {statusBadge(p, isNewProduct(p, settings.newArrivalDays))}
                    </div>
                  </div>
                  <ActionMenu items={[
                    { label: "Edit", icon: <Pencil className="h-4 w-4" />, to: `/cms-admin/products/${p.id}/edit` },
                    { label: "Adjust Stock", icon: <SwatchBook className="h-4 w-4" />, onClick: () => openStocks(p) },
                    { label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, onClick: () => setDeleteTarget(p.id) },
                  ]} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openStocks(p)}
                    className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[var(--button-neutral)] px-3 text-[13px] font-medium text-[var(--fg-base)] shadow-[var(--buttons-neutral)] outline-none transition-colors hover:bg-[var(--button-neutral-hover)] active:bg-[var(--button-neutral-pressed)]"
                  >
                    <SwatchBook className="h-4 w-4 shrink-0" />
                    {totalStock(p)} in stock
                  </button>
                  <span className="text-xs text-[var(--fg-muted)]">Updated {formatDate(p.updatedAt)}</span>
                </div>
              </div>
            );
          })}
        </MobileList>

        <div className="flex flex-col gap-2 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between">
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
      </Container>

      <ConfirmDialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={async () => { const id = deleteTarget; if (!id) return; setDeleteTarget(null); try { await deleteProduct(id); showToast("Product deleted."); reload(); } catch { showToast("Couldn't delete the product. Please try again."); } }} title="Delete product" description="This permanently removes the product from the CMS. This cannot be undone." confirmLabel="Delete" />

      <StockAdjustModal
        product={stocksTarget}
        open={stocksTarget !== null}
        onClose={() => setStocksTarget(null)}
        onSaved={() => reload()}
      />

      <ConfirmDialog open={confirmBulkDelete} onClose={() => setConfirmBulkDelete(false)} onConfirm={async () => { const n = selectedIds.size; await bulkDeleteProducts(Array.from(selectedIds)); setSelectedIds(new Set()); setBulkAction(null); setConfirmBulkDelete(false); showToast(`${n} product(s) deleted.`); reload(); }} title={`Delete ${selectedIds.size} product(s)`} description="This permanently removes the selected products. This cannot be undone." confirmLabel="Delete All" />
    </div>
  );
}
