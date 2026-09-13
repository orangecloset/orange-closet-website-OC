import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, Printer, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCms } from "../store/cmsContext";
import type { CmsProduct, RecentSale } from "../store/types";
import { api } from "../lib/api";
import type { PagedSales } from "../lib/api";
import { parsePrice, printReceipt, downloadReceiptPdf, type ReceiptData } from "../lib/receipt";
import { Badge, Button, Container, Header } from "../components/ui";

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesHistoryPage() {
  const { settings } = useCms();
  const navigate = useNavigate();

  const [items, setItems] = useState<RecentSale[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: PagedSales = await api.listSalesPaged(page, PAGE_SIZE);
      setItems(res.data);
      setTotalItems(res.totalItems);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error("[cms] failed to load sales history", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const buildReceiptData = async (sale: RecentSale): Promise<ReceiptData> => {
    let product: CmsProduct | null = null;
    if (sale.productId) {
      try {
        product = await api.getProduct(sale.productId);
      } catch {
        product = null;
      }
    }
    return {
      storeName: settings.storeName || "Store",
      logoUrl: settings.faviconUrl || undefined,
      sale,
      productContent: product
        ? { sections: product.sections }
        : undefined,
    };
  };

  const handlePrint = async (sale: RecentSale) => {
    printReceipt(await buildReceiptData(sale));
  };

  const handleDownload = async (sale: RecentSale) => {
    try {
      await downloadReceiptPdf(await buildReceiptData(sale));
    } catch (err) {
      console.error("[cms] failed to generate receipt pdf", err);
    }
  };

  return (
    <div className="flex flex-col gap-y-3">
      <Header
        title="Sales History"
        subtitle={`${totalItems} sale${totalItems === 1 ? "" : "s"} recorded`}
        actions={
          <Button variant="secondary" size="small" onClick={() => navigate("/cms-admin")}>
            Back to Dashboard
          </Button>
        }
      />

      <Container>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-xs text-[var(--fg-muted)]">
                <th className="px-6 py-2.5 font-medium">Receipt #</th>
                <th className="px-6 py-2.5 font-medium">Product</th>
                <th className="w-36 px-6 py-2.5 font-medium">Variant</th>
                <th className="w-16 px-6 py-2.5 font-medium">Qty</th>
                <th className="w-28 px-6 py-2.5 font-medium">Total</th>
                <th className="w-32 px-6 py-2.5 font-medium">Date Sold</th>
                <th className="w-32 px-6 py-2.5 font-medium">Sold By</th>
                <th className="w-24 px-6 py-2.5 font-medium"></th>
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
                    No sales recorded yet.
                  </td>
                </tr>
              ) : (
                items.map((s) => {
                  const total = parsePrice(s.price) * s.quantity;
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--border-subtle)] transition-colors last:border-b-0 hover:bg-[var(--bg-subtle-hover)]"
                    >
                      <td className="whitespace-nowrap px-6 py-3 text-xs font-medium text-[var(--fg-base)]">
                        {s.receiptNo ? <Badge color="grey">{s.receiptNo}</Badge> : <span className="text-[var(--fg-muted)]">—</span>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          {s.productImage ? (
                            <img
                              src={s.productImage}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded object-cover bg-[var(--bg-subtle)]"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--bg-subtle)]">
                              <ShoppingBag className="h-4 w-4 text-[var(--fg-disabled)]" />
                            </div>
                          )}
                          <p className="truncate text-sm font-medium text-[var(--fg-base)]">{s.productName}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-base)]">
                        {s.colorName} · {s.size}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-base)]">{s.quantity}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-base)]">{formatMoney(total)}</td>
                      <td className="whitespace-nowrap px-6 py-3 text-sm text-[var(--fg-muted)]">{formatDate(s.soldAt ?? s.createdAt)}</td>
                      <td className="max-w-[7rem] truncate px-6 py-3 text-sm text-[var(--fg-muted)]">{s.soldBy || "—"}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handlePrint(s)}
                            title="Print receipt"
                            aria-label={`Print receipt ${s.receiptNo || s.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDownload(s)}
                            title="Download PDF receipt"
                            aria-label={`Download PDF receipt ${s.receiptNo || s.id}`}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-subtle)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
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
            {loading
              ? "Loading…"
              : `Page ${page} of ${totalPages} · ${totalItems} record(s)`}
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
