import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from './Icon';

interface NavbarProps {
  cartCount?: number;
  onOpenCart?: () => void;
}

export function Navbar({ cartCount = 0, onOpenCart }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const userStr = localStorage.getItem('user');
  const parsedUser = userStr ? JSON.parse(userStr) : null;

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function f(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    window.addEventListener('mousedown', f);
    return () => window.removeEventListener('mousedown', f);
  }, []);

  const handleLogout = () => {
    setProfileOpen(false);
    localStorage.removeItem('user');
    navigate('/login');
  };

  const links = [
    { name: "Products", path: "/", active: location.pathname === "/" },
    { name: "Orders", path: "/orders", active: location.pathname === "/orders" },
    { name: "Content creator", path: "/content", active: location.pathname === "/content" },
  ];

  const userInitials = parsedUser?.username ? parsedUser.username.substring(0, 2).toLowerCase() : 'u';
  const userName = parsedUser?.username ? parsedUser.username.split('@')[0].toLowerCase() : 'user';

  return (
    <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        {/* logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="w-8 h-8 rounded-lg bg-ink text-paper flex items-center justify-center group-hover:bg-coral transition-colors">
            <Icon name="logo" size={16} />
          </span>
          <span className="text-[15px] font-medium tracking-tight">microshop</span>
        </Link>

        {/* nav */}
        <nav className="hidden md:flex items-center gap-1">
          {parsedUser && links.map(l => (
            <Link key={l.name} to={l.path}
              className={`px-3 py-2 text-sm rounded-full transition ${l.active ? 'text-ink' : 'text-mute hover:text-ink'} relative`}>
              {l.name.toLowerCase()}
              {l.active && <span className="absolute left-3 right-3 -bottom-[18px] h-px bg-ink" />}
            </Link>
          ))}
          {parsedUser?.role === 'ADMIN' && (
            <Link to="/admin" className={`px-3 py-2 text-sm rounded-full transition flex items-center gap-1.5 ${location.pathname === '/admin' ? 'text-coral' : 'text-mute hover:text-ink'}`}>
              <Icon name="gear" size={14} /> admin
            </Link>
          )}
        </nav>

        {/* right cluster */}
        <div className="flex items-center gap-2">
          {parsedUser ? (
            <>
              {onOpenCart && (
                <button onClick={onOpenCart}
                  className="relative h-10 w-10 grid place-items-center rounded-full hover:bg-line/60 transition text-ink"
                  aria-label="cart">
                  <Icon name="bag" size={18} />
                  {cartCount > 0 && (
                    <span className="animate-pop absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-coral text-paper text-[10px] font-medium">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(v => !v)}
                  className="flex items-center gap-2 pl-1 pr-2.5 h-10 rounded-full hover:bg-line/60 transition">
                  <span className="w-8 h-8 rounded-full bg-coralBg text-coral grid place-items-center text-xs font-medium uppercase">{userInitials}</span>
                  <span className="hidden sm:inline text-sm">{userName}</span>
                  <Icon name="chevron" size={14} className="text-mute" />
                </button>
                {profileOpen && (
                  <div className="animate-fadeIn absolute right-0 mt-2 w-56 rounded-2xl bg-paper border border-line shadow-pop p-1.5">
                    <div className="px-3 py-2.5">
                      <div className="text-sm font-medium">{userName}</div>
                      <div className="text-xs text-mute">{parsedUser.username}</div>
                    </div>
                    <div className="h-px bg-line my-1" />
                    <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-line/60 transition">account settings</button>
                    <button className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-line/60 transition" onClick={handleLogout}>sign out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link to="/login" className="h-9 px-5 rounded-full bg-ink text-paper text-sm font-medium hover:bg-coral transition flex items-center justify-center">
              login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
