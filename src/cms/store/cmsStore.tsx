import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProductColor } from "../../data/products";
import { randomString } from "../lib/utils";
import { api, type SaleInput } from "../lib/api";
import { invalidateProducts } from "../lib/queries";
import {
  ABOUT_KEY,
  HOMEPAGE_KEY,
  LINK_KEY,
  SETTINGS_KEY,
  TYPES_KEY,
  applyBranding,
  createCatalogLinkValue,
  loadLinks,
  seedAbout,
  seedHomepage,
  seedSettings,
} from "./defaults";
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
import { CmsContext } from "./cmsContext";

export function CmsProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<CatalogLink[]>(() => loadLinks());
  const [homepage, setHomepage] = useState<HomepageConfig>(() => seedHomepage());
  const [types, setTypes] = useState<ProductTypeInfo[]>([]);
  const [settings, setSettings] = useState<SettingsConfig>(() => seedSettings());
  const [about, setAbout] = useState<AboutPageConfig>(() => seedAbout());
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listSales()
      .then((sales) => {
        if (!cancelled) setRecentSales(sales);
      })
      .catch((err) => console.error("[cms] failed to load sales", err));
    api
      .listLinks()
      .then((ls) => {
        if (!cancelled) {
          setLinks((prev) =>
            ls.map((server) => {
              const local = prev.find((l) => l.uid === server.uid);
              return { ...server, pin: server.pin ?? local?.pin };
            })
          );
        }
      })
      .catch((err) => console.error("[cms] failed to load catalog links", err));
    api
      .loadSettings()
      .then((all) => {
        if (cancelled) return;
        const storedSettings = all[SETTINGS_KEY];
        if (storedSettings && typeof storedSettings === "object") {
          setSettings({ ...seedSettings(), ...(storedSettings as SettingsConfig) });
        }
        const storedHomepage = all[HOMEPAGE_KEY];
        if (storedHomepage && typeof storedHomepage === "object") {
          setHomepage({ ...seedHomepage(), ...(storedHomepage as HomepageConfig) });
        }
        const storedTypes = all[TYPES_KEY];
        if (Array.isArray(storedTypes)) {
          setTypes(storedTypes as ProductTypeInfo[]);
        }
        const storedAbout = all[ABOUT_KEY];
        if (storedAbout && typeof storedAbout === "object") {
          setAbout({ ...seedAbout(), ...(storedAbout as AboutPageConfig) });
        }
      })
      .catch((err) => console.error("[cms] failed to load settings", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LINK_KEY, JSON.stringify(links));
    } catch {
      /* ignore storage errors */
    }
  }, [links]);

  const latestValuesRef = useRef<Record<string, unknown>>({});
  const dirtyKeysRef = useRef<Set<string>>(new Set());
  const [configDirty, setConfigDirty] = useState<string[]>([]);

  const markDirty = useCallback((key: string) => {
    if (dirtyKeysRef.current.has(key)) return;
    dirtyKeysRef.current.add(key);
    setConfigDirty([...dirtyKeysRef.current]);
  }, []);

  const clearDirty = useCallback((key: string) => {
    if (!dirtyKeysRef.current.has(key)) return;
    dirtyKeysRef.current.delete(key);
    setConfigDirty([...dirtyKeysRef.current]);
  }, []);

  useEffect(() => {
    latestValuesRef.current[SETTINGS_KEY] = settings;
  }, [settings]);
  useEffect(() => {
    latestValuesRef.current[HOMEPAGE_KEY] = homepage;
  }, [homepage]);
  useEffect(() => {
    latestValuesRef.current[TYPES_KEY] = types;
  }, [types]);
  useEffect(() => {
    latestValuesRef.current[ABOUT_KEY] = about;
  }, [about]);

  const flushSaves = useCallback(async () => {
    const targets = [...dirtyKeysRef.current];
    await Promise.all(
      targets.map(async (key) => {
        const value = latestValuesRef.current[key];
        if (value === undefined) {
          clearDirty(key);
          return;
        }
        try {
          await api.saveSetting(key, value);
          clearDirty(key);
        } catch (err) {
          console.error(`[cms] failed to save ${key}`, err);
          throw err;
        }
      })
    );
  }, [clearDirty]);

  useEffect(() => {
    applyBranding(settings);
  }, [settings]);

  const addProduct = useCallback((input: CmsProductInput) => {
    const now = new Date().toISOString();
    const colorInputs =
      input.colors && input.colors.length > 0
        ? input.colors
        : [
            {
              name: "Default",
              hex: "#e5e7eb",
              images: [],
            },
          ];
    const sizeList = input.sizes ?? [];
    const hasSizes = sizeList.length > 0;
    const colors: ProductColor[] = colorInputs.map((c) => {
      const stocks = c.stockBySize ?? {};
      return {
        name: c.name,
        hex: c.hex,
        ...(c.hexes?.length ? { hexes: c.hexes.slice(0, 3) } : {}),
        images: c.images,
        sizes: hasSizes
          ? sizeList.map((s) => ({ size: s, stock: Math.max(0, Math.floor(stocks[s] ?? 0)) }))
          : [{ size: "One Size", stock: Math.max(0, Math.floor(stocks["One Size"] ?? 0)) }],
      };
    });
    const totalStock = colors.reduce(
      (sum, c) => sum + c.sizes.reduce((s, vs) => s + vs.stock, 0),
      0
    );
    const status: ProductStatus = input.status ?? (totalStock > 0 ? "active" : "draft");
    const product: CmsProduct = {
      id: randomString(8),
      name: input.name,
      brand: input.brand ?? "Orange Closet",
      type: input.type,
      category: input.category,
      categoryLabel: input.categoryLabel,
      price: input.price,
      compareAtPrice: input.compareAtPrice ?? undefined,
      colors,
      sizes: hasSizes ? sizeList : [],
      sections: input.sections ?? [],
      sectionsOpen: input.sectionsOpen ?? false,
      status,
      createdAt: now,
      updatedAt: now,
    };
    return api
      .createProduct(product)
      .then(() => {
        invalidateProducts();
        return product;
      })
      .catch((err) => {
        console.error("[cms] failed to create product", err);
        throw err;
      });
  }, []);

  const updateProduct = useCallback(
    async (id: string, input: Partial<CmsProductInput>) => {
      const current = await api.getProduct(id);
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = { updatedAt: now };
      if (input.name !== undefined) patch.name = input.name;
      if (input.brand !== undefined) patch.brand = input.brand;
      if (input.type !== undefined) patch.type = input.type;
      if (input.category !== undefined) patch.category = input.category;
      if (input.categoryLabel !== undefined) patch.categoryLabel = input.categoryLabel;
      if (input.price !== undefined) patch.price = input.price;
      if (input.compareAtPrice !== undefined) patch.compareAtPrice = input.compareAtPrice ?? null;
      if (input.sections !== undefined) patch.sections = input.sections;
      if (input.sectionsOpen !== undefined) patch.sectionsOpen = input.sectionsOpen;
      if (input.colors !== undefined) {
        const sizeList = input.sizes ?? current.sizes;
        const hasSizes = sizeList.length > 0;
        patch.colors = input.colors.map((c) => {
          const existing = current.colors.find((pc) => pc.name === c.name);
          const stocks = c.stockBySize;
          if (stocks) {
            return {
              name: c.name,
              hex: c.hex,
              ...(c.hexes?.length ? { hexes: c.hexes.slice(0, 3) } : {}),
              images: c.images,
              sizes: hasSizes
                ? sizeList.map((s) => ({
                    size: s,
                    stock: Math.max(0, Math.floor(stocks[s] ?? 0)),
                  }))
                : [
                    {
                      size: "One Size",
                      stock: Math.max(0, Math.floor(stocks["One Size"] ?? 0)),
                    },
                  ],
            };
          }
          return {
            name: c.name,
            hex: c.hex,
            ...(c.hexes?.length ? { hexes: c.hexes.slice(0, 3) } : {}),
            images: c.images,
            sizes:
              existing?.sizes ??
              (hasSizes
                ? sizeList.map((s) => ({ size: s, stock: 0 }))
                : [{ size: "One Size", stock: 0 }]),
          };
        }) as ProductColor[];
        patch.sizes = hasSizes ? sizeList : [];
      }
      const colors = (patch.colors as ProductColor[] | undefined) ?? current.colors;
      patch.stock = colors.reduce(
        (sum, c) => sum + c.sizes.reduce((s, vs) => s + vs.stock, 0),
        0
      );
      if (input.status !== undefined) patch.status = input.status;
      const updated = { ...current, ...patch } as CmsProduct;
      await api.updateProduct(id, updated);
      invalidateProducts();
    },
    []
  );

  const deleteProduct = useCallback((id: string) => {
    return api.deleteProduct(id).then(
      () => invalidateProducts(),
      (err) => {
        console.error("[cms] failed to delete product", err);
        throw err;
      }
    );
  }, []);

  const bulkDeleteProducts = useCallback(async (ids: string[]) => {
    await Promise.all(
      ids.map((id) =>
        api.deleteProduct(id).then(
          () => invalidateProducts(),
          (err) => {
            console.error("[cms] failed to delete product", err);
            throw err;
          }
        )
      )
    );
  }, []);

  const recordSale = useCallback(async (sale: SaleInput): Promise<RecentSale> => {
    const created = await api.recordSale(sale);
    setRecentSales((prev) => [created, ...prev]);
    invalidateProducts();
    return created;
  }, []);

  const bulkUpdateStatus = useCallback(
    async (ids: string[], status: ProductStatus) => {
      await Promise.all(
        ids.map((id) =>
          api.patchProduct(id, { status }).then(
            () => invalidateProducts(),
            (err) => {
              console.error("[cms] failed to update product", err);
              throw err;
            }
          )
        )
      );
    },
    []
  );

  const createCatalogLink = useCallback(() => {
    const link = createCatalogLinkValue();
    setLinks((prev) => [link, ...prev]);
    api
      .createCatalogLink(link)
      .catch((err) => console.error("[cms] failed to create catalog link", err));
  }, []);

  const revokeCatalogLink = useCallback((uid: string) => {
    setLinks((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, active: false } : l))
    );
    api
      .setCatalogLinkActive(uid, false)
      .catch((err) => console.error("[cms] failed to revoke catalog link", err));
  }, []);

  const deleteCatalogLink = useCallback((uid: string) => {
    setLinks((prev) => prev.filter((l) => l.uid !== uid));
    api
      .deleteCatalogLink(uid)
      .catch((err) => console.error("[cms] failed to delete catalog link", err));
  }, []);

  const updateHomepage = useCallback((patch: Partial<HomepageConfig>) => {
    setHomepage((prev) => {
      const next = { ...prev, ...patch };
      latestValuesRef.current[HOMEPAGE_KEY] = next;
      return next;
    });
    markDirty(HOMEPAGE_KEY);
  }, [markDirty]);

  const addType = useCallback((input: Omit<ProductTypeInfo, "builtin">) => {
    const next = [
      ...types,
      { ...input, builtin: false, categories: [...input.categories] },
    ];
    latestValuesRef.current[TYPES_KEY] = next;
    setTypes(next);
    markDirty(TYPES_KEY);
  }, [markDirty, types]);

  const updateType = useCallback((slug: string, patch: Partial<ProductTypeInfo>) => {
    const next = types.map((t) =>
      t.slug === slug
        ? {
            ...t,
            ...patch,
            categories: patch.categories ? [...patch.categories] : t.categories,
          }
        : t
    );
    latestValuesRef.current[TYPES_KEY] = next;
    setTypes(next);
    markDirty(TYPES_KEY);
  }, [markDirty, types]);

  const reorderTypes = useCallback((next: ProductTypeInfo[]) => {
    latestValuesRef.current[TYPES_KEY] = next;
    setTypes(next);
    markDirty(TYPES_KEY);
  }, [markDirty]);

  const deleteType = useCallback(
    async (slug: string) => {
      const next = types.filter((t) => t.slug !== slug);
      latestValuesRef.current[TYPES_KEY] = next;
      setTypes(next);
      await api
        .saveSetting(TYPES_KEY, next);
      await api
        .deleteProductsByType(slug);
    },
    [types]
  );

  const updateSettings = useCallback((patch: Partial<SettingsConfig>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      latestValuesRef.current[SETTINGS_KEY] = next;
      return next;
    });
    markDirty(SETTINGS_KEY);
  }, [markDirty]);

  const updateAbout = useCallback((patch: Partial<AboutPageConfig>) => {
    setAbout((prev) => {
      const next = { ...prev, ...patch };
      latestValuesRef.current[ABOUT_KEY] = next;
      return next;
    });
    markDirty(ABOUT_KEY);
  }, [markDirty]);

  const value = useMemo(
    () => ({
      recentSales,
      links,
      homepage,
      types,
      settings,
      about,
      configDirty,
      updateHomepage,
      updateAbout,
      addType,
      updateType,
      reorderTypes,
      deleteType,
      updateSettings,
      flushSaves,
      addProduct,
      updateProduct,
      deleteProduct,
      recordSale,
      bulkDeleteProducts,
      bulkUpdateStatus,
      createCatalogLink,
      revokeCatalogLink,
      deleteCatalogLink,
    }),
    [
      recentSales,
      links,
      homepage,
      types,
      settings,
      about,
      configDirty,
      updateHomepage,
      updateAbout,
      addType,
      updateType,
      reorderTypes,
      deleteType,
      updateSettings,
      flushSaves,
      addProduct,
      updateProduct,
      deleteProduct,
      recordSale,
      bulkDeleteProducts,
      bulkUpdateStatus,
      createCatalogLink,
      revokeCatalogLink,
      deleteCatalogLink,
    ]
  );

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}
