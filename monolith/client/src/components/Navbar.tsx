import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, Package, Home, FileText } from 'lucide-react';
import '../styles/main.css';

export function Navbar() {
    const navigate = useNavigate();
    const user = localStorage.getItem('user');

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <nav style={{
            borderBottom: '1px solid var(--border-color)',
            padding: '1rem 0',
            marginBottom: '2rem',
            backgroundColor: 'rgba(26, 26, 26, 0.8)',
            backdropFilter: 'blur(10px)',
            position: 'sticky',
            top: 0,
            zIndex: 100
        }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to="/" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Package /> MicroShop
                </Link>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    {user ? (
                        <>
                            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                <Home size={18} /> Products
                            </Link>
                            <Link to="/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                <ShoppingCart size={18} /> Orders
                            </Link>
                            <Link to="/traffic" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                <span>🚦</span> Traffic
                            </Link>
                            <Link to="/content" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                <FileText size={18} /> Content Creator
                            </Link>
                            <button onClick={handleLogout} className="btn-outline" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <LogOut size={16} /> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
