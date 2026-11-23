"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { CART_STORAGE_KEY, type CartItem } from "@/lib/cart-types";

type AddToCartInput = Omit<CartItem, "quantity"> & { quantity?: number };

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  itemCount: number;
  totalPln: number;
  addItem: (item: AddToCartInput) => void;
  setQuantity: (partId: string, quantity: number) => void;
  removeItem: (partId: string) => void;
  syncPrices: (updatedPrices: Record<string, number>) => void;
  clearCart: () => void;
};

const MAX_QUANTITY = 99;
const EMPTY_CART: CartItem[] = [];
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined = undefined;
let cachedItems: CartItem[] = EMPTY_CART;
let storageUnavailable = false;

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(value)));
}

function parseStoredCart(raw: string | null): CartItem[] {
  if (!raw) {
    return EMPTY_CART;
  }
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) {
      return EMPTY_CART;
    }
    const valid = parsed
      .filter(
        (item) =>
          item &&
          typeof item.partId === "string" &&
          typeof item.name === "string" &&
          typeof item.pricePln === "number" &&
          Number.isFinite(item.pricePln) &&
          typeof item.quantity === "number" &&
          item.quantity > 0,
      )
      .map((item) => ({
        ...item,
        quantity: clampQuantity(item.quantity),
      }));
    return valid.length > 0 ? valid : EMPTY_CART;
  } catch {
    return EMPTY_CART;
  }
}

function getSnapshot(): CartItem[] {
  if (typeof window === "undefined") {
    return EMPTY_CART;
  }
  if (storageUnavailable) {
    return cachedItems;
  }
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedItems;
    }
    cachedRaw = raw;
    cachedItems = parseStoredCart(raw);
    return cachedItems;
  } catch {
    storageUnavailable = true;
    return cachedItems;
  }
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_CART;
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function writeCart(next: CartItem[]) {
  cachedItems = next;
  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(next);
      window.localStorage.setItem(CART_STORAGE_KEY, serialized);
      cachedRaw = serialized;
      storageUnavailable = false;
    } catch {
      storageUnavailable = true;
    }
  }
  emitChange();
}

function updateCart(updater: (prev: CartItem[]) => CartItem[]) {
  const prev = getSnapshot();
  const next = updater(prev);
  if (next === prev) {
    return;
  }
  writeCart(next);
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === CART_STORAGE_KEY) {
    cachedRaw = undefined;
    storageUnavailable = false;
    emitChange();
  }
}

function subscribe(listener: () => void): () => void {
  if (typeof window !== "undefined" && listeners.size === 0) {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined" && listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

const emptySubscribe = () => () => {};
const getClientReady = () => true;
const getServerReady = () => false;

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    emptySubscribe,
    getClientReady,
    getServerReady,
  );

  const addItem = useCallback((item: AddToCartInput) => {
    const delta = clampQuantity(item.quantity ?? 1);
    updateCart((prev) => {
      const existing = prev.find((entry) => entry.partId === item.partId);
      if (existing) {
        return prev.map((entry) =>
          entry.partId === item.partId
            ? {
                ...entry,
                pricePln: item.pricePln,
                quantity: clampQuantity(entry.quantity + delta),
              }
            : entry,
        );
      }
      return [
        ...prev,
        {
          partId: item.partId,
          name: item.name,
          pricePln: item.pricePln,
          quantity: delta,
          brandName: item.brandName,
          modelName: item.modelName,
          generationName: item.generationName,
          imageUrl: item.imageUrl,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((partId: string, quantity: number) => {
    updateCart((prev) => {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return prev.filter((entry) => entry.partId !== partId);
      }
      const nextQuantity = clampQuantity(quantity);
      return prev.map((entry) =>
        entry.partId === partId ? { ...entry, quantity: nextQuantity } : entry,
      );
    });
  }, []);

  const removeItem = useCallback((partId: string) => {
    updateCart((prev) => prev.filter((entry) => entry.partId !== partId));
  }, []);

  const syncPrices = useCallback((updatedPrices: Record<string, number>) => {
    updateCart((prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        const latest = updatedPrices[entry.partId];
        if (
          typeof latest === "number" &&
          Number.isFinite(latest) &&
          Math.abs(latest - entry.pricePln) > 0.005
        ) {
          changed = true;
          return { ...entry, pricePln: latest };
        }
        return entry;
      });
      return changed ? next : prev;
    });
  }, []);

  const clearCart = useCallback(() => {
    writeCart(EMPTY_CART);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPln = items.reduce(
      (sum, item) => sum + item.pricePln * item.quantity,
      0,
    );
    return {
      items,
      ready,
      itemCount,
      totalPln,
      addItem,
      setQuantity,
      removeItem,
      syncPrices,
      clearCart,
    };
  }, [items, ready, addItem, setQuantity, removeItem, syncPrices, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart musi być użyty wewnątrz CartProvider");
  }
  return ctx;
}
