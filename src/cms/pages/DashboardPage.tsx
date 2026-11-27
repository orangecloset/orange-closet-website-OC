import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Loader2 } from "lucide-react";
import { useCms } from "../store/cmsContext";
import type { CmsProduct } from "../../data/store-types";
import { api, type ProductStats, type SalesStats } from "../lib/api";
import { Badge, Container, Header, StatCard } from "../components/ui";
import SalesLineChart from "../components/SalesLineChart";
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
  const [sales, setSales] = useState<SalesStats | null>(null);
  const [loadingSales, setLoadingSales] = useState(true);
  const [salesError, setSalesError] = useState("");
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [showAllStats, setShowAllStats] = useState(false);

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

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const from = new Date(today);
    from.setDate(from.getDate() - 89);
    const to = new Date(today);
    to.setDate(to.getDate() + 1);
    api
      .getSalesStats({ from: from.toISOString(), to: to.toISOString(), tz })
      .then((data) => {
        if (!cancelled) setSales(data);
      })
      .catch((err) => {
        console.error("[cms] failed to load sales stats", err);
        if (!cancelled) setSalesError("Couldn't load sales data. Refresh to try again.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSales(false);
      });

    return () => { cancelled = true; };
  }, []);

  const salesDays = useMemo(() => sales?.days ?? [], [sales]);
  const lastDay = salesDays[salesDays.length - 1];
  const last7 = salesDays.slice(-7);
  const prev7 = salesDays.slice(-14, -7);
  const sumBy = (rows: SalesStats["days"], key: "revenue" | "units" | "count") =>
    rows.reduce((total, row) => total + row[key], 0);
  const revenue7 = sumBy(last7, "revenue");
  const prevRevenue7 = sumBy(prev7, "revenue");
  const sales7 = sumBy(last7, "count");
  const units7 = sumBy(last7, "units");
  const avg7 = sales7 > 0 ? revenue7 / sales7 : 0;
  const revenueDelta = prevRevenue7 > 0 ? ((revenue7 - prevRevenue7) / prevRevenue7) * 100 : null;
  const chartData = useMemo(() => salesDays.slice(-range), [salesDays, range]);
  const formatPeso = (value: number) =>
    `₱${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const recentlySold = recentSales.slice(0, 6);

  const typeLabel = (slug: string) => types.find((t) => t.slug === slug)?.label ?? slug;

  return (
    <div className="flex flex-col gap-y-3">
      <Header title="Dashboard" subtitle="Overview of your catalog" />

      <div className="flex flex-col gap-3">
      <div className={`order-2 grid grid-cols-2 gap-3 md:order-1 xl:grid-cols-4 ${showAllStats ? "" : "hidden md:grid"}`}>
        <StatCard label="Total Products" value={stats.total} />
        <StatCard label="Active" value={stats.active} hint={`${stats.draft} draft`} />
        <StatCard label="Sold Out" value={stats.soldOut} hint="All colours at 0 stock" />
        <StatCard label="Added This Week" value={stats.addedThisWeek} />
      </div>

      <div className="order-1 grid grid-cols-2 gap-3 md:order-2 xl:grid-cols-4">
        <StatCard
          label="Revenue Today"
          value={loadingSales ? "—" : formatPeso(lastDay?.revenue ?? 0)}
          hint={
            loadingSales
              ? undefined
              : lastDay && lastDay.count > 0
                ? `${lastDay.count} sale${lastDay.count === 1 ? "" : "s"} · ${lastDay.units} unit${lastDay.units === 1 ? "" : "s"}`
                : "No sales yet today"
          }
        />
        <StatCard
          label="Sales Today"
          value={loadingSales ? "—" : String(lastDay?.count ?? 0)}
          hint={
            loadingSales
              ? undefined
              : `${lastDay?.units ?? 0} unit${(lastDay?.units ?? 0) === 1 ? "" : "s"} sold`
          }
        />
        <StatCard
          label="Revenue · Last 7 Days"
          value={loadingSales ? "—" : formatPeso(revenue7)}
          hint={
            loadingSales ? undefined : revenueDelta === null ? (
              "No sales in the previous 7 days"
            ) : (
              <>
                <span
                  className={
                    revenueDelta >= 0
                      ? "font-medium text-green-600"
                      : "font-medium text-rose-600"
                  }
                >
                  {revenueDelta >= 0 ? "▲" : "▼"} {Math.abs(revenueDelta).toFixed(1)}%
                </span>{" "}
                vs previous 7 days
              </>
            )
          }
        />
        <StatCard
          label="Avg. Sale · Last 7 Days"
          value={loadingSales ? "—" : formatPeso(avg7)}
          hint={
            loadingSales
              ? undefined
              : `across ${sales7} sale${sales7 === 1 ? "" : "s"} · ${units7} units`
          }
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAllStats((value) => !value)}
        aria-expanded={showAllStats}
        className="order-3 flex items-center justify-center gap-1.5 py-0.5 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-base)] md:hidden"
      >
        {showAllStats ? "Show less" : "Show more"}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${showAllStats ? "rotate-180" : ""}`}
        />
      </button>
      </div>

      <div className="w-full rounded-lg bg-[var(--bg-base)] shadow-[var(--elevation-card-rest)]">
        <Header
          title="Sales"
          subtitle={`Revenue · last ${range} days`}
          actions={
            <div className="inline-flex items-center gap-0.5 rounded-md border border-[var(--border-base)] bg-[var(--bg-subtle)] p-0.5">
              {([7, 30, 90] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={range === value}
                  onClick={() => setRange(value)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    range === value
                      ? "bg-[var(--bg-base)] text-[var(--fg-base)] shadow-[var(--borders-base)]"
                      : "text-[var(--fg-muted)] hover:text-[var(--fg-base)]"
                  }`}
                >
                  {value}D
                </button>
              ))}
            </div>
          }
        />
        <div className="px-2 pb-3 sm:px-4">
          {loadingSales ? (
            <div className="flex h-[280px] items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : salesError ? (
            <div className="flex h-[280px] items-center justify-center px-4 text-center text-sm text-[var(--fg-muted)]">
              {salesError}
            </div>
          ) : (
            <SalesLineChart data={chartData} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-start">
        <Container className="w-full">
          <Header title="Recently Added" subtitle="Latest additions to the catalog" />
          {loadingRecent ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {recentlyAdded.length === 0 && (
              <p className="px-4 py-4 sm:px-6 text-sm text-[var(--fg-muted)]">No products yet.</p>
            )}
            {recentlyAdded.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
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
              />
          {loadingStats ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {recentSales.length === 0 && (
              <p className="px-4 py-4 sm:px-6 text-sm text-[var(--fg-muted)]">No sales recorded yet.</p>
            )}
            {recentlySold.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
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
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--fg-muted)]" />
            </div>
          ) : (
          <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
            {stats.soldOutProducts.length === 0 && (
              <p className="px-4 py-4 sm:px-6 text-sm text-[var(--fg-muted)]">No out of stock products.</p>
            )}
            {stats.soldOutProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate("/cms-admin/products")}
                className="flex items-center gap-3 px-4 py-3 sm:px-6 text-left transition-colors hover:bg-[var(--bg-subtle-hover)]"
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
