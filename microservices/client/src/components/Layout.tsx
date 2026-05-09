import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { useCart } from '../context/CartContext';
import type { Product } from '../context/CartContext';
import { fetchFromAPI } from '../api/client';

export function Layout({ children }: { children: React.ReactNode }) {
  const [cartOpen, setCartOpen] = useState(false);
  const { cart, cartCount, incQty, decQty, removeFromCart, clearCart } = useCart();
  const [productsCache, setProductsCache] = useState<Product[]>([]);

  // Fetch product details for items in the cart
  useEffect(() => {
    const fetchCartProducts = async () => {
      const productIds = Object.keys(cart);
      if (productIds.length === 0) return;

      const toFetch = productIds.filter(id => !productsCache.some(p => String(p.id) === id));
      if (toFetch.length === 0) return;

      try {
        const newProducts = await Promise.all(toFetch.map(async id => {
          return await fetchFromAPI(`/products/${id}`);
        }));
        setProductsCache(prev => [...prev, ...newProducts]);
      } catch (e) {
        console.error("Failed to fetch cart products", e);
      }
    };
    fetchCartProducts();
  }, [cart, productsCache]);

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const product = productsCache.find(p => String(p.id) === id);
    if (!product) return null;
    return { ...product, qty };
  }).filter(Boolean) as any[];

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    
    try {
      const userStr = localStorage.getItem('user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const currentUserId = currentUser?.userId || "1";

      const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const orderProducts = cartItems.map(item => ({ productId: item.id, quantity: item.qty }));

      await fetchFromAPI('/orders', {
        method: 'POST',
        body: JSON.stringify({
          userId: currentUserId,
          totalAmount,
          products: orderProducts
        })
      });

      clearCart();
      setCartOpen(false);
      alert('Order placed successfully!');
    } catch (e) {
      alert('Failed to checkout');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar cartCount={cartCount} onOpenCart={() => setCartOpen(true)} />
      
      <main className="flex-1">
        {children}
      </main>

      <Footer />

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        inc={incQty}
        dec={decQty}
        remove={removeFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
}
