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
        <nav className="navbar" style={{ backgroundColor: 'white', padding: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 auto', maxWidth: '1200px' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-color)', fontWeight: 'bold', fontSize: '1.25rem', textDecoration: 'none' }}>
                    <Package size={24} />
                    <span>MicroShop</span>
                </Link>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    {user ? (
                        <>
                            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                <Home size={18} /> Products
                            </Link>
                            <Link to="/orders" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                <ShoppingCart size={18} /> Orders
                            </Link>
                            <Link to="/traffic" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                <span>🚦</span> Traffic
                            </Link>
                            <Link to="/content" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                <FileText size={18} /> Content Creator
                            </Link>
                            <button onClick={handleLogout} className="btn-outline" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}>
                                <LogOut size={16} /> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn-primary" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--primary-color)', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
