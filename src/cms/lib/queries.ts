import { keepPreviousData, useQuery, QueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const productKeys = {
  all: ["products"] as const,
  list: (params: ProductListParams) => ["products", "list", params] as const,
  suggest: (query: string) => ["products", "suggest", query] as const,
};

export type ProductListParams = {
  page: number;
  limit?: number;
  search?: string;
  type?: string;
  category?: string;
  status?: string;
  availability?: string;
};

export function usePagedProducts(params: ProductListParams) {
  return useQuery({
    queryKey: productKeys.list(params),
    queryFn: () => api.listProductsPaged(params),
    placeholderData: keepPreviousData,
  });
}

export function useProductSuggestions(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: productKeys.suggest(trimmed),
    queryFn: () => api.listProductsPaged({ page: 1, limit: 8, search: trimmed }),
    enabled: trimmed.length > 0,
  });
}

export function invalidateProducts() {
  void queryClient.invalidateQueries({ queryKey: productKeys.all });
  invalidateDashboard();
}

export const inventoryKeys = {
  all: ["inventory"] as const,
  stats: ["inventory", "stats"] as const,
  list: (params: InventoryListParams) => ["inventory", "list", params] as const,
};

export type InventoryListParams = {
  page: number;
  search?: string;
  kind?: string;
  limit?: number;
};

export function useInventoryStats() {
  return useQuery({
    queryKey: inventoryKeys.stats,
    queryFn: () => api.getInventoryStats(),
  });
}

export function useStockMovementsPaged(params: InventoryListParams) {
  return useQuery({
    queryKey: inventoryKeys.list(params),
    queryFn: () => api.listStockMovementsPaged(params),
    placeholderData: keepPreviousData,
  });
}

export function invalidateInventory() {
  void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
}

export type SalesStatsParams = { from: string; to: string; tz: string };

const DASHBOARD_STALE_MS = 60_000;

export const dashboardKeys = {
  all: ["dashboard"] as const,
  productStats: ["dashboard", "product-stats"] as const,
  recentProducts: ["dashboard", "recent-products"] as const,
  sales: (params: SalesStatsParams) => ["dashboard", "sales", params] as const,
};

export function useDashboardProductStats() {
  return useQuery({
    queryKey: dashboardKeys.productStats,
    queryFn: () => api.getProductStats(),
    staleTime: DASHBOARD_STALE_MS,
  });
}

export function useDashboardRecentProducts() {
  return useQuery({
    queryKey: dashboardKeys.recentProducts,
    queryFn: () => api.listProductsPaged({ page: 1, limit: 6 }),
    staleTime: DASHBOARD_STALE_MS,
  });
}

export function useDashboardSalesStats(params: SalesStatsParams) {
  return useQuery({
    queryKey: dashboardKeys.sales(params),
    queryFn: () => api.getSalesStats(params),
    staleTime: DASHBOARD_STALE_MS,
  });
}

export function invalidateDashboard() {
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}
