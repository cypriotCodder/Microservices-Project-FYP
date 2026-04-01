import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, LogOut, Package, Home, FileText, User, Settings, ChevronDown } from 'lucide-react';
import '../styles/main.css';

export function Navbar() {
    const navigate = useNavigate();
    const user = localStorage.getItem('user');
    const parsedUser = user ? JSON.parse(user) : null;
    
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        setIsDropdownOpen(false);
        localStorage.removeItem('user');
        navigate('/login');
    };

    return (
        <nav className="navbar" style={{ backgroundColor: 'var(--card-bg)', padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 auto', maxWidth: '1200px' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)', fontWeight: 'bold', fontSize: '1.25rem', textDecoration: 'none' }}>
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

                            <Link to="/content" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                                <FileText size={18} /> Content Creator
                            </Link>

                            {parsedUser?.role === 'ADMIN' && (
                                <Link to="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)', fontWeight: 'bold', textDecoration: 'none' }}>
                                    <span>⚙️</span> Admin
                                </Link>
                            )}
                            
                            {/* Profile Dropdown */}
                            <div className="dropdown-container" ref={dropdownRef}>
                                <button 
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)} 
                                    className="btn-outline" 
                                    style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', background: isDropdownOpen ? 'rgba(255, 255, 255, 0.05)' : 'transparent', color: 'var(--text-color)' }}
                                >
                                    <User size={16} /> 
                                    {parsedUser?.name || 'Profile'}
                                    <ChevronDown size={14} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                                </button>

                                {isDropdownOpen && (
                                    <div className="dropdown-menu">
                                        <div className="dropdown-header">
                                            <div className="dropdown-header-name">{parsedUser?.name || 'User'}</div>
                                            <div className="dropdown-header-email">{parsedUser?.email || 'user@example.com'}</div>
                                        </div>
                                        
                                        <button className="dropdown-item" onClick={() => { setIsDropdownOpen(false); alert('Profile settings coming soon!'); }}>
                                            <Settings size={16} /> Settings
                                        </button>
                                        
                                        <div className="dropdown-divider"></div>
                                        
                                        <button className="dropdown-item danger" onClick={handleLogout}>
                                            <LogOut size={16} /> Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <Link to="/login" className="btn-primary" style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--accent-color)', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
}
