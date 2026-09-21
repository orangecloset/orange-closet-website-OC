/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product, ProductType } from "../../data/products";
import { getSaleInfo } from "../../data/types";
import { seedHomepage, seedSettings, seedAbout, TYPES_KEY } from "../../cms/store/defaults";
import { getCatalogToken, clearCatalogToken } from "../lib/access";
import type {
  AboutPageConfig,
  CmsProduct,
  HomepageConfig,
  ProductTypeInfo,
  SettingsConfig,
} from "../../cms/store/types";

type StorefrontProduct = Omit<CmsProduct, "type"> & { type: ProductType };

type CatalogContextValue = {
  products: Product[];
  settings: SettingsConfig;
  homepage: HomepageConfig;
  about: AboutPageConfig;
  types: ProductTypeInfo[];
  loading: boolean;
  locked: boolean;
  getProduct: (id: string) => Product | undefined;
  productsByType: (type: ProductType) => Product[];
  newArrivals: Product[];
  bestSellerProducts: Product[];
  onSaleProducts: Product[];
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

const CATALOG_CACHE_KEY = "orange-catalog-cache";

type CatalogCache = {
  products?: StorefrontProduct[];
  settings?: SettingsConfig;
  homepage?: HomepageConfig;
  about?: AboutPageConfig;
  types?: ProductTypeInfo[];
};

function readCatalogCache(): CatalogCache {
  try {
    const raw = localStorage.getItem(CATALOG_CACHE_KEY);
    return raw ? (JSON.parse(raw) as CatalogCache) : {};
  } catch {
    return {};
  }
}

function writeCatalogCache(patch: CatalogCache): void {
  try {
    const current = readCatalogCache();
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    /* ignore */
  }
}

function totalStockOf(p: Product): number {
  return p.colors.reduce(
    (sum, c) => sum + (c.sizes ?? []).reduce((s, vs) => s + vs.stock, 0),
    0
  );
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const cached = readCatalogCache();
  const [rawProducts, setRawProducts] = useState<StorefrontProduct[]>(cached.products ?? []);
  const [settings, setSettings] = useState<SettingsConfig>(() => ({
    ...seedSettings(),
    ...(cached.settings ?? {}),
  }));
  const [homepage, setHomepage] = useState<HomepageConfig>(() => ({
    ...seedHomepage(),
    ...(cached.homepage ?? {}),
  }));
  const [about, setAbout] = useState<AboutPageConfig>(() => ({
    ...seedAbout(),
    ...(cached.about ?? {}),
  }));
  const [types, setTypes] = useState<ProductTypeInfo[]>(() =>
    cached.types && cached.types.length > 0 ? cached.types : []
  );
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(() => !getCatalogToken());

  useEffect(() => {
    if (locked) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const token = getCatalogToken();
    const accessHeaders: Record<string, string> = token ? { "X-Catalog-Token": token } : {};
    const handleUnauthorized = () => {
      if (cancelled) return;
      clearCatalogToken();
      setLocked(true);
      localStorage.removeItem(CATALOG_CACHE_KEY);
    };
    fetch("/api/products", { headers: accessHeaders })
      .then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        if (!r.ok) throw new Error(`products ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRawProducts(data as StorefrontProduct[]);
        writeCatalogCache({ products: data as StorefrontProduct[] });
      })
      .catch((err) => {
        if ((err as Error).message === "unauthorized") return handleUnauthorized();
        console.error("[catalog] failed to load products", err);
      });
    fetch("/api/settings", { headers: accessHeaders })
      .then((r) => {
        if (r.status === 401) throw new Error("unauthorized");
        if (!r.ok) throw new Error(`settings ${r.status}`);
        return r.json();
      })
      .then((all: Record<string, unknown>) => {
        if (cancelled) return;
        const s = all["orange-cms-settings"];
        if (s && typeof s === "object") {
          setSettings({ ...seedSettings(), ...(s as SettingsConfig) });
        }
        const h = all["orange-cms-homepage"];
        if (h && typeof h === "object") {
          setHomepage({ ...seedHomepage(), ...(h as HomepageConfig) });
        }
        const a = all["orange-cms-about"];
        if (a && typeof a === "object") {
          setAbout({ ...seedAbout(), ...(a as AboutPageConfig) });
        }
        const t = all[TYPES_KEY];
        if (Array.isArray(t) && t.length > 0) {
          setTypes(t as ProductTypeInfo[]);
        }
        writeCatalogCache({
          ...(s && typeof s === "object" ? { settings: s as SettingsConfig } : {}),
          ...(h && typeof h === "object" ? { homepage: h as HomepageConfig } : {}),
          ...(a && typeof a === "object" ? { about: a as AboutPageConfig } : {}),
          ...(Array.isArray(t) && t.length > 0 ? { types: t as ProductTypeInfo[] } : {}),
        });
      })
      .catch((err) => {
        if ((err as Error).message === "unauthorized") return handleUnauthorized();
        console.error("[catalog] failed to load settings", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locked]);

  const products = useMemo(() => {
    const days = settings.newArrivalDays ?? 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const knownTypes = new Set(types.map((t) => t.slug));
    return rawProducts
      .filter((p) => knownTypes.has(p.type))
      .map((p) => {
      const stock = p.stock ?? totalStockOf(p);
      return {
        ...p,
        isNew: Boolean(p.isNew) || new Date(p.createdAt).getTime() > cutoff,
        inStock: p.inStock ?? stock > 0,
        stock,
      };
    });
  }, [rawProducts, types, settings.newArrivalDays]);

  const getProduct = useCallback(
    (id: string) => products.find((p) => p.id === id),
    [products]
  );

  const productsByType = useCallback(
    (type: ProductType) => products.filter((p) => p.type === type),
    [products]
  );

  const newArrivals = useMemo(
    () =>
      [...products]
        .filter((p) => p.isNew)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
    [products]
  );

  const bestSellerProducts = useMemo(
    () =>
      homepage.bestSellerIds
        .map((id) => getProduct(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [homepage.bestSellerIds, getProduct]
  );

  const onSaleProducts = useMemo(
    () =>
      products
        .filter((p) => getSaleInfo(p.price, p.compareAtPrice).onSale)
        .slice(0, 8),
    [products]
  );

  const value = useMemo<CatalogContextValue>(
    () => ({
      products,
      settings,
      homepage,
      about,
      types,
      loading,
      locked,
      getProduct,
      productsByType,
      newArrivals,
      bestSellerProducts,
      onSaleProducts,
    }),
    [
      products,
      settings,
      homepage,
      about,
      types,
      loading,
      locked,
      getProduct,
      productsByType,
      newArrivals,
      bestSellerProducts,
      onSaleProducts,
    ]
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
