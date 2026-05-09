import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { TrafficControl } from './pages/TrafficControl';
import ContentControl from './pages/ContentControl';
import ProductDetails from './pages/ProductDetails';
import { Admin } from './pages/Admin';
import { PublishProduct } from './pages/PublishProduct';
import { CartProvider } from './context/CartContext';
import { Layout } from './components/Layout';
import './styles/main.css';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = localStorage.getItem('user');
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/traffic" element={<ProtectedRoute><TrafficControl /></ProtectedRoute>} />
          <Route path="/content" element={<ProtectedRoute><ContentControl /></ProtectedRoute>} />
          <Route path="/product/:id" element={<ProtectedRoute><ProductDetails /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
          <Route path="/publish" element={<ProtectedRoute><PublishProduct /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
