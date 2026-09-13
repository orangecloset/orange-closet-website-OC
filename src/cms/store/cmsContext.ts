import { createContext, useContext } from "react";
import type {
  AboutPageConfig,
  CmsProduct,
  CmsProductInput,
  CatalogLink,
  HomepageConfig,
  ProductStatus,
  ProductTypeInfo,
  RecentSale,
  SettingsConfig,
} from "./types";
import type { SaleInput } from "../lib/api";

export type CmsContextValue = {
  recentSales: RecentSale[];
  links: CatalogLink[];
  homepage: HomepageConfig;
  types: ProductTypeInfo[];
  settings: SettingsConfig;
  about: AboutPageConfig;
  configDirty: string[];
  updateHomepage: (patch: Partial<HomepageConfig>) => void;
  updateAbout: (patch: Partial<AboutPageConfig>) => void;
  addType: (input: Omit<ProductTypeInfo, "builtin">) => void;
  updateType: (slug: string, patch: Partial<ProductTypeInfo>) => void;
  reorderTypes: (next: ProductTypeInfo[]) => void;
  deleteType: (slug: string) => Promise<void>;
  updateSettings: (patch: Partial<SettingsConfig>) => void;
  flushSaves: () => Promise<void>;
  addProduct: (input: CmsProductInput) => Promise<CmsProduct>;
  updateProduct: (id: string, input: Partial<CmsProductInput>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  recordSale: (sale: SaleInput) => Promise<RecentSale>;
  bulkDeleteProducts: (ids: string[]) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: ProductStatus) => Promise<void>;
  createCatalogLink: () => void;
  revokeCatalogLink: (uid: string) => void;
  deleteCatalogLink: (uid: string) => void;
};

export const CmsContext = createContext<CmsContextValue | null>(null);

export function useCms(): CmsContextValue {
  const ctx = useContext(CmsContext);
  if (!ctx) throw new Error("useCms must be used within CmsProvider");
  return ctx;
}
