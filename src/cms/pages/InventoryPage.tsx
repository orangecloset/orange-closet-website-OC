import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, Boxes } from "lucide-react";
import { api } from "../lib/api";
import type { InventoryStats, PagedStockMovements, StockMovement } from "../lib/api";
import { openReceiptTab, openReceiptPdfTab, type ReceiptData } from "../lib/receipt";
import { useCms } from "../store/cmsContext";
import { Badge, Button, Container, Header, Input, Select } from "../components/ui";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

const KIND_BADGES: Record<StockMovement["kind"], { label: string; color: "green" | "blue" | "grey" }> = {
  sale: { label: "Sale", color: "green" },
  edit: { label: "Edit", color: "blue" },
  create: { label: "Created", color: "grey" },
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function InventoryPage() {
  const { settings } = useCms();
  const [stats, setStats] = useState<InventoryStats | null>(null);
  const [items, setItems] = useState<StockMovement[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, kindFilter]);

  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    api
      .getInventoryStats()
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch((err) => console.error("[cms] failed to load inventory stats", err))
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listStockMovementsPaged({ page, search: debouncedQuery, kind: kindFilter, limit: PAGE_SIZE })
      .then((res: PagedStockMovements) => {
        if (cancelled) return;
        setItems(res.data);
        setTotalItems(res.totalItems);
        setTotalPages(res.totalPages);
      })
      .catch((err) => console.error("[cms] failed to load stock history", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, debouncedQuery, kindFilter]);

  const handleOpenReceipt = (movement: StockMovement) => {
    if (!movement.ref || movement.kind !== "sale") return;
    const win = openReceiptTab();
    if (!win) return;
    (async () => {
      const sale = await api.getSaleByReceipt(movement.ref!);
      let productContent: ReceiptData["productContent"];
      if (sale.productId) {
        try {
          const product = await api.getProduct(sale.productId);
          productContent = { sections: product.sections };
        } catch {
          productContent = undefined;
        }
      }
      return {
        storeName: settings.storeName || "Store",
        logoUrl: settings.faviconUrl || undefined,
        sale,
        productContent,
      } satisfies ReceiptData;
    })()
      .then((data) => openReceiptPdfTab(win, data))
      .catch((err) => {
        console.error("[cms] failed to open receipt from inventory", err);
        win.close();
      });
  };

  const statCards = useMemo(
    () => [
      { label: "Total units in stock", value: stats ? String(stats.totalUnits) : "—" },
      {
        label: "Inventory value",
        value: stats ? `₱${formatMoney(stats.totalValue)}` : "—",
      },
      { label: "Products with stock", value: stats ? String(stats.productsWithStock) : "—" },
      { label: "Out of stock", value: stats ? String(stats.soldOut) : "—" },
    ],
    [stats]
  );

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Inventory"
        subtitle={`${totalItems} stock change${totalItems === 1 ? "" : "s"} recorded`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <Container key={card.label}>
            <div className="px-5 py-4">
              <p className="text-xs text-[var(--fg-muted)]">{card.label}</p>
              {statsLoading ? (
                <Loader2 className="mt-2 h-4 w-4 animate-spin text-[var(--fg-muted)]" />
              ) : (
                <p className="mt-1 truncate text-xl font-semibold text-[var(--fg-base)]">{card.value}</p>
              )}
            </div>
          </Container>
        ))}
      </div>

      <Container>
        <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] px-6 py-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setQuery("");
              }}
              placeholder="Search by product name..."
              className="pl-8"
            />
          </div>
          <div className="w-full shrink-0 sm:w-44">
            <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
              <option value="all">All types</option>
              <option value="sale">Sale</option>
              <option value="edit">Edit</option>
              <option value="create">Created</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
                <th className="w-[15%] px-6 py-2.5 font-medium">Date</th>
                <th className="w-[21%] px-6 py-2.5 font-medium">Product</th>
                <th className="w-[12%] px-6 py-2.5 font-medium">Variant</th>
                <th className="w-[8%] px-6 py-2.5 font-medium">Change</th>
                <th className="w-[8%] px-6 py-2.5 font-medium">Type</th>
                <th className="w-[13%] px-6 py-2.5 font-medium">Reason</th>
                <th className="w-[14%] px-6 py-2.5 font-medium">By</th>
                <th className="w-[9%] px-6 py-2.5 font-medium">Receipt #</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--fg-muted)]" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-[var(--fg-muted)]">
                    <Boxes className="mx-auto mb-2 h-6 w-6" />
                    No stock changes recorded yet.
                  </td>
                </tr>
              ) : (
                items.map((m) => {
                  const kind = KIND_BADGES[m.kind] ?? KIND_BADGES.edit;
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--bg-subtle-hover)]"
                    >
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-muted)]">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-[var(--fg-base)]">
                        <span className="block max-w-[240px] truncate">{m.productName}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-muted)]">
                        {m.colorName} · {m.size}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-base)]">
                        {m.prevStock} → {m.newStock}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3">
                        <Badge color={kind.color}>{kind.label}</Badge>
                      </td>
                      <td className="px-6 py-3 text-sm text-[var(--fg-base)]">
                        <span className="block max-w-[180px] truncate">{m.reason || "—"}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-[var(--fg-muted)]">
                        {m.changedBy || "—"}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-xs text-[var(--fg-muted)]">
                        {m.ref ? (
                          m.kind === "sale" ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(m)}
                              title="Open receipt"
                              className="focus:outline-none"
                            >
                              <Badge color="grey">{m.ref}</Badge>
                            </button>
                          ) : (
                            <Badge color="grey">{m.ref}</Badge>
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <span className="text-xs text-[var(--fg-muted)]">
            {loading ? "Loading…" : `Page ${page} of ${totalPages} · ${totalItems} record(s)`}
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
    </div>
  );
}
