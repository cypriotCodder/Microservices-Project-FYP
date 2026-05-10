import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Product {
  _id?: string;
  id?: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
}

export function getProductId(p: Product): string {
  return String(p._id || p.id || '');
}

interface CartContextType {
  cart: Record<string, number>;
  cartCount: number;
  addToCart: (p: Product) => void;
  incQty: (p: Product) => void;
  decQty: (p: Product) => void;
  removeFromCart: (p: Product) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  const addToCart = (p: Product) => {
    const pid = getProductId(p);
    setCart(prev => ({ ...prev, [pid]: (prev[pid] || 0) + 1 }));
  };

  const incQty = (p: Product) => {
    const pid = getProductId(p);
    setCart(prev => ({ ...prev, [pid]: Math.min((prev[pid] || 0) + 1, p.stock || 99) }));
  };

  const decQty = (p: Product) => {
    const pid = getProductId(p);
    setCart(prev => {
      const currentQty = prev[pid] || 0;
      const nextQty = currentQty - 1;
      const nextCart = { ...prev };
      if (nextQty <= 0) {
        delete nextCart[pid];
      } else {
        nextCart[pid] = nextQty;
      }
      return nextCart;
    });
  };

  const removeFromCart = (p: Product) => {
    const pid = getProductId(p);
    setCart(prev => {
      const nextCart = { ...prev };
      delete nextCart[pid];
      return nextCart;
    });
  };

  const clearCart = () => {
    setCart({});
  };

  return (
    <CartContext.Provider value={{ cart, cartCount, addToCart, incQty, decQty, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
