import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2 } from "lucide-react";import { useCms } from "../store/cmsContext";
import type { CmsProduct } from "../store/types";
import { api, type ProductStats } from "../lib/api";
import { Badge, Container, Header, StatCard } from "../components/ui";
import { timeAgo } from "../lib/utils";

const CACHE_TTL_MS = 60_000;
const dashboardStatsCache = { data: null as ProductStats | null, ts: 0 };
const dashboardRecentCache = { data: null as CmsProduct[] | null, ts: 0 };

export default function DashboardPage() {
  const { types, recentSales } = useCms();
  const navigate = useNavigate();

  const statsValid = dashboardStatsCache.data && Date.now() - dashboardStatsCache.ts < CACHE_TTL_MS;
  const recentValid = dashboardRecentCache.data && Date.now() - dashboardRecentCache.ts < CACHE_TTL_MS;

  const [stats, setStats] = useState({ total: 0, active: 0, draft: 0, soldOut: 0, addedThisWeek: 0, soldOutProducts: [] as CmsProduct[], ...(statsValid ? dashboardStatsCache.data! : {}) });
  const [recentlyAdded, setRecentlyAdded] = useState<CmsProduct[]>(recentValid ? dashboardRecentCache.data! : []);
  const [loadingStats, setLoadingStats] = useState(!statsValid);
  const [loadingRecent, setLoadingRecent] = useState(!recentValid);

  useEffect(() => {
    let cancelled = false;

    if (dashboardStatsCache.data && Date.now() - dashboardStatsCache.ts < CACHE_TTL_MS) {
      setStats((prev) => ({ ...prev, ...dashboardStatsCache.data! }));
      setLoadingStats(false);
    } else {
      api
        .getProductStats()
        .then((s) => {
          if (cancelled) return;
          dashboardStatsCache.data = s;
          dashboardStatsCache.ts = Date.now();
          setStats((prev) => ({ ...prev, ...s }));
        })
        .catch((err) => console.error("[cms] failed to load product stats", err))
        .finally(() => { if (!cancelled) setLoadingStats(false); });
    }

    if (dashboardRecentCache.data && Date.now() - dashboardRecentCache.ts < CACHE_TTL_MS) {
      setRecentlyAdded(dashboardRecentCache.data!);
      setLoadingRecent(false);
    } else {
      api
        .listProductsPaged({ page: 1, limit: 6 })
        .then((res) => {
          if (cancelled) return;
          dashboardRecentCache.data = res.data ?? [];
          dashboardRecentCache.ts = Date.now();
          setRecentlyAdded(res.data ?? []);
        })
        .catch((err) => console.error("[cms] failed to load recent products", err))
        .finally(() => { if (!cancelled) setLoadingRecent(false); });
    }

    return () => { cancelled = true; };
  }, []);

  const recentlySold = recentSales.slice(0, 6);

  const typeLabel = (slug: string) => types.find((t) => t.slug === slug)?.label ?? slug;

  return (
    <div className="flex flex-col gap-y-3">
      <Header title="Dashboard" subtitle="Overview of your catalog" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Total Products" value={stats.total} />
        <StatCard label="Active" value={stats.active} hint={`${stats.draft} draft`} />
        <StatCard label="Sold Out" value={stats.soldOut} hint="All colours at 0 stock" />
        <StatCard label="Added This Week" value={stats.addedThisWeek} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
        <Container className="w-full">
          <Header title="Recently Added" subtitle="Latest additions to the catalog" />
          {loadingRecent ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {recentlyAdded.length === 0 && (
              <p className="px-6 py-4 text-sm text-[var(--fg-muted)]">No products yet.</p>
            )}
            {recentlyAdded.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-6 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-400"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--fg-base)]">{p.name}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{typeLabel(p.type)} · {timeAgo(p.createdAt)}</p>
                </div>
                <span className="text-sm text-[var(--fg-base)]">{p.price}</span>
              </div>
            ))}
          </div>
          )}
        </Container>

            <Container className="w-full">
              <Header
                title="Recently Sold"
                subtitle="Latest items sold via the Sell page"
                actions={
                  <button
                    type="button"
                    onClick={() => navigate("/cms-admin/sales-history")}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-subtle-hover)] hover:text-[var(--fg-base)]"
                  >
                    View All
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                }
              />
          {loadingStats ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {recentSales.length === 0 && (
              <p className="px-6 py-4 text-sm text-[var(--fg-muted)]">No sales recorded yet.</p>
            )}
            {recentlySold.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-6 py-3">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-orange-400"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--fg-base)]">{s.productName}</p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {s.colorName} · {s.size} · ×{s.quantity} · {timeAgo(s.createdAt)}
                  </p>
                </div>
                <Badge color="red">Sold</Badge>
              </div>
            ))}
          </div>
          )}
        </Container>

        <Container className="w-full xl:col-span-2">
          <Header title="Out of Stock" subtitle="Products with no remaining stock" />
          {loadingStats ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {stats.soldOutProducts.length === 0 && (
              <p className="px-6 py-4 text-sm text-[var(--fg-muted)]">No sold out products.</p>
            )}
            {stats.soldOutProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate("/cms-admin/products")}
                className="flex items-center gap-3 px-6 py-3 text-left transition-colors hover:bg-[var(--bg-subtle-hover)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-400"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--fg-base)]">{p.name}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{typeLabel(p.type)}</p>
                </div>
                <Badge color="red">Sold Out</Badge>
              </button>
            ))}
          </div>
          )}
        </Container>
      </div>
    </div>
  );
}
