import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
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
    setCart(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }));
  };

  const incQty = (p: Product) => {
    setCart(prev => ({ ...prev, [p.id]: Math.min((prev[p.id] || 0) + 1, p.stock || 99) }));
  };

  const decQty = (p: Product) => {
    setCart(prev => {
      const currentQty = prev[p.id] || 0;
      const nextQty = currentQty - 1;
      const nextCart = { ...prev };
      if (nextQty <= 0) {
        delete nextCart[p.id];
      } else {
        nextCart[p.id] = nextQty;
      }
      return nextCart;
    });
  };

  const removeFromCart = (p: Product) => {
    setCart(prev => {
      const nextCart = { ...prev };
      delete nextCart[p.id];
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
