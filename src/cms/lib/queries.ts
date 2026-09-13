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
}
