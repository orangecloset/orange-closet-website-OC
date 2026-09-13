import { authHeaders, logout } from "../store/auth";
import type { CatalogLink, CmsProduct, RecentSale } from "../store/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      logout();
      window.location.replace("/admin");
      throw new Error("Your session has ended. Please sign in again.");
    }
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export type SaleInput = {
  id: string;
  productId: string;
  productName: string;
  productImage?: string;
  colorName: string;
  size: string;
  quantity: number;
  price: string;
  soldAt?: string;
  soldBy?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
};

export type SettingsMap = Record<string, unknown>;

export type PagedProducts = {
  data: CmsProduct[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ProductStats = {
  total: number;
  active: number;
  draft: number;
  soldOut: number;
  addedThisWeek: number;
  soldOutProducts: CmsProduct[];
};

export type PagedSales = {
  data: RecentSale[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export const api = {
  getProduct: (id: string) => request<CmsProduct>(`/api/products/${id}`),

  getProductsByIds: (ids: string[]) =>
    request<PagedProducts>(
      `/api/products?ids=${encodeURIComponent(ids.join(","))}&limit=${Math.max(1, ids.length)}`
    ),

  getProductStats: () => request<ProductStats>("/api/products?stats=1"),

  patchProduct: (id: string, patch: Record<string, unknown>) =>
    request<{ ok: true }>(`/api/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteProductsByType: (type: string) =>
    request<{ ok: true; deletedIds: string[] }>(`/api/products?type=${encodeURIComponent(type)}`, {
      method: "DELETE",
    }),

  listProductsPaged: (params: {
    page: number;
    search?: string;
    type?: string;
    status?: string;
    availability?: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams({
      page: String(params.page),
      limit: String(params.limit ?? 30),
    });
    if (params.search?.trim()) q.set("search", params.search.trim());
    if (params.type && params.type !== "all") q.set("type", params.type);
    if (params.status && params.status !== "all") q.set("status", params.status);
    if (params.availability && params.availability !== "all") {
      q.set("availability", params.availability);
    }
    return request<PagedProducts>(`/api/products?${q}`);
  },

  createProduct: (product: CmsProduct) =>
    request<{ ok: true }>("/api/products", { method: "POST", body: JSON.stringify(product) }),

  updateProduct: (id: string, product: CmsProduct) =>
    request<{ ok: true }>(`/api/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(product),
    }),

  deleteProduct: (id: string) =>
    request<{ ok: true }>(`/api/products/${id}`, { method: "DELETE" }),

  listSales: () => request<RecentSale[]>("/api/sales?limit=50"),

  listSalesPaged: (page: number, limit = 50) =>
    request<PagedSales>(`/api/sales?page=${page}&limit=${limit}`),

  recordSale: (sale: SaleInput) =>
    request<RecentSale>("/api/sales", { method: "POST", body: JSON.stringify(sale) }),

  loadSettings: () => request<SettingsMap>("/api/settings"),

  saveSetting: (key: string, value: unknown) =>
    request<{ ok: true }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    }),

  listLinks: () => request<CatalogLink[]>("/api/catalog-links"),

  createCatalogLink: (link: CatalogLink) =>
    request<{ ok: true }>("/api/catalog-links", {
      method: "POST",
      body: JSON.stringify(link),
    }),

  setCatalogLinkActive: (uid: string, active: boolean) =>
    request<{ ok: true }>(`/api/catalog-links/${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),

  deleteCatalogLink: (uid: string) =>
    request<{ ok: true }>(`/api/catalog-links/${uid}`, { method: "DELETE" }),

  listUsers: () =>
    request<CmsUser[]>("/api/users"),

  updateOwnProfile: (input: { name?: string; email?: string }) =>
    request<{ ok: true }>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  createUser: (input: { name: string; email: string; password: string }) =>
    request<{ ok: true }>("/api/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  setUserRole: (id: string, role: "staff" | "pending") =>
    request<{ ok: true }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  updateAccount: (id: string, input: { name?: string; email?: string }) =>
    request<{ ok: true }>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteUser: (id: string) =>
    request<{ ok: true }>(`/api/users/${id}`, { method: "DELETE" }),
};

export type CmsUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
};
