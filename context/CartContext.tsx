"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trackAddToCart, trackRemoveFromCart } from "@/lib/analytics";

export interface CartComboIncludedItem {
  title: string;
  subtitle?: string;
}

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
  courseCode?: string;

  availability?: string;
  canPurchase?: boolean;

  itemType?: "product" | "combo";
  comboSlug?: string;
  comboCategorySlug?: string;
  comboBadge?: string;
  comboSaveLabel?: string;
  comboMediumLabel?: string;
  comboSessionLabel?: string;
  comboItems?: CartComboIncludedItem[];

  comboBuilderProductIds?: string[];
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  cartReady: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function safeText(x: any) {
  return String(x ?? "").trim().toLowerCase();
}

function safeStr(x: any) {
  return String(x ?? "").trim();
}

function uniqueStringArray(arr: any) {
  if (!Array.isArray(arr)) return [];
  return Array.from(
    new Set(
      arr
        .map((x: any) => safeStr(x))
        .filter(Boolean)
    )
  );
}

function isBlockedForCart(product: CartItem) {
  const a = safeText(product?.availability);
  if (product?.canPurchase === false) return true;
  return a === "out_of_stock" || a === "outofstock" || a === "out-of-stock";
}

function normalizeCartItem(product: CartItem): CartItem {
  return {
    id: String(product?.id || "").trim(),
    title: String(product?.title || "").trim(),
    price: Number(product?.price || 0),
    image: String(product?.image || "").trim(),
    quantity: Number(product?.quantity || 1),
    category: String(product?.category || "Product").trim(),
    courseCode: String(product?.courseCode || "").trim() || undefined,
    availability: String(product?.availability || "").trim() || undefined,
    canPurchase: product?.canPurchase !== false,

    itemType: product?.itemType === "combo" ? "combo" : "product",
    comboSlug: String(product?.comboSlug || "").trim() || undefined,
    comboCategorySlug: String(product?.comboCategorySlug || "").trim() || undefined,
    comboBadge: String(product?.comboBadge || "").trim() || undefined,
    comboSaveLabel: String(product?.comboSaveLabel || "").trim() || undefined,
    comboMediumLabel: String(product?.comboMediumLabel || "").trim() || undefined,
    comboSessionLabel: String(product?.comboSessionLabel || "").trim() || undefined,
    comboItems: Array.isArray(product?.comboItems)
      ? product.comboItems
          .map((x: any) => ({
            title: String(x?.title || "").trim(),
            subtitle: String(x?.subtitle || "").trim() || undefined,
          }))
          .filter((x: any) => x.title)
      : undefined,

    comboBuilderProductIds: uniqueStringArray(product?.comboBuilderProductIds),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("ignou_cart");
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCart(parsed.map(normalizeCartItem));
        } else {
          setCart([]);
        }
      } else {
        setCart([]);
      }
    } catch {
      setCart([]);
    } finally {
      setCartReady(true);
    }
  }, []);

  useEffect(() => {
    if (!cartReady) return;
    localStorage.setItem("ignou_cart", JSON.stringify(cart));
  }, [cart, cartReady]);

  const addToCart = (product: CartItem) => {
    const normalized = normalizeCartItem(product);

    if (!normalized.id) return;
    if (isBlockedForCart(normalized)) return;

    const qtyChange = Number(normalized.quantity || 0);

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === normalized.id);

      if (existingItem) {
        const nextQty = existingItem.quantity + qtyChange;

        const updatedCart = prevCart.map((item) =>
          item.id === normalized.id
            ? {
                ...item,
                quantity: nextQty,
                comboBuilderProductIds:
                  normalized.itemType === "combo" && normalized.comboBuilderProductIds?.length
                    ? normalized.comboBuilderProductIds
                    : item.comboBuilderProductIds,
              }
            : item
        );

        return updatedCart;
      }

      return [...prevCart, normalized];
    });

    if (qtyChange > 0) {
      trackAddToCart({
        id: normalized.id,
        title: normalized.title,
        category: normalized.category,
        price: normalized.price,
        quantity: qtyChange,
        itemType: normalized.itemType,
        comboSlug: normalized.comboSlug,
        comboCategorySlug: normalized.comboCategorySlug,
      });
    }
  };

  const removeFromCart = (id: string) => {
    const existingItem = cart.find((item) => item.id === id);

    if (existingItem) {
      trackRemoveFromCart({
        id: existingItem.id,
        title: existingItem.title,
        category: existingItem.category,
        price: existingItem.price,
        quantity: existingItem.quantity,
        itemType: existingItem.itemType,
        comboSlug: existingItem.comboSlug,
        comboCategorySlug: existingItem.comboCategorySlug,
      });
    }

    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ cart, addToCart, removeFromCart, clearCart, cartCount, cartTotal, cartReady }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}