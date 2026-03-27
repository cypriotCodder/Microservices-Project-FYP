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
        <nav className="navbar" style={{ backgroundColor: 'var(--card-bg)', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 auto', maxWidth: '1200px' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)', fontWeight: 'bold', fontSize: '1.25rem', textDecoration: 'none' }}>
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
                            <button onClick={handleLogout} className="btn-outline" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', background: 'transparent', color: 'var(--text-color)' }}>
                                <LogOut size={16} /> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="btn-primary" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent-color)', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                            Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
