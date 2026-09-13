/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type CartItem = {
  productId: string;
  color: string;
  size: string;
  quantity: number;
};

type StoreContextValue = {
  cart: CartItem[];
  wishlist: string[];
  cartCount: number;
  addToCart: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;
};

const StoreContext = createContext<StoreContextValue | null>(null);

const CART_KEY = "orange-closet-cart";
const WISHLIST_KEY = "orange-closet-wishlist";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => load<CartItem[]>(CART_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() => load<string[]>(WISHLIST_KEY, []));

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
  }, [wishlist]);

  const addToCart = (item: Omit<CartItem, "quantity">, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find(
        (c) =>
          c.productId === item.productId &&
          c.color === item.color &&
          c.size === item.size
      );
      if (existing) {
        return prev.map((c) =>
          c === existing ? { ...c, quantity: c.quantity + quantity } : c
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const isInWishlist = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist]
  );

  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const value = useMemo(
    () => ({ cart, wishlist, cartCount, addToCart, toggleWishlist, isInWishlist }),
    [cart, wishlist, cartCount, isInWishlist]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a StoreProvider");
  return ctx;
}
