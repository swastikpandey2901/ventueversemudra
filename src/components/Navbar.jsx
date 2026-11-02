import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../supabase/auth';
import { subscribeNews } from '../supabase/api';

const Navbar = () => {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [news, setNews] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const unsub = subscribeNews(setNews);
    return unsub;
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    setMenuOpen(false);
    navigate('/');
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 bg-mudra-card/95 backdrop-blur border-b border-mudra-border">
      {/* Main Nav */}
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2.5 group">
          <img
            src="/mudra-coin.png"
            alt="Mudra Coin"
            className="w-9 h-9 object-contain group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]"
          />
          <span className="text-2xl font-black text-white tracking-tight">
            M<span className="text-mudra-accent">U</span>DRA
          </span>
          <span className="text-xs text-mudra-muted font-mono">v7.0</span>
        </Link>

        {/* Desktop Nav */}
        {user && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/market" className="text-mudra-muted hover:text-white transition-colors">Market</Link>
            <Link to="/finance" className="text-mudra-muted hover:text-white transition-colors flex items-center gap-1">
              <span>Finance</span>
              <span className="text-[10px] bg-mudra-accent/20 text-mudra-accent px-1.5 py-0.2 rounded font-bold">NEW</span>
            </Link>
            <Link to="/shop" className="text-mudra-muted hover:text-white transition-colors flex items-center gap-1">
              <span>Shop</span>
              <span className="text-[10px] bg-amber-500/20 text-mudra-gold px-1.5 py-0.2 rounded font-bold">PERKS</span>
            </Link>
            <Link to="/portfolio" className="text-mudra-muted hover:text-white transition-colors">Portfolio</Link>
            <Link to="/leaderboard" className="text-mudra-muted hover:text-white transition-colors">Leaderboard</Link>
            <Link to="/news" className="text-mudra-muted hover:text-white transition-colors">News</Link>
            {userData?.role === 'admin' && (
              <Link to="/admin" className="text-mudra-gold font-semibold hover:text-amber-300 transition-colors">
                ⚡ God Panel
              </Link>
            )}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user && userData ? (
            <>
              <div className="flex flex-col items-end text-xs">
                <span className="text-white font-semibold hidden sm:inline">{userData.name}</span>
                <span className="text-mudra-green font-mono flex items-center gap-1">
                  <img src="/mudra-coin.png" alt="Mudra" className="w-3.5 h-3.5 object-contain" />
                  {Number(userData.cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <button onClick={handleLogout} className="hidden sm:inline-block btn-outline text-xs px-3 py-1.5">
                Logout
              </button>
            </>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="btn-primary text-xs px-4 py-1.5 font-bold shadow-md shadow-mudra-accent/20">
                Sign In 🚀
              </Link>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          {user && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 rounded-lg bg-mudra-bg border border-mudra-border text-white hover:text-mudra-accent transition-colors"
              aria-label="Toggle navigation"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {user && menuOpen && (
        <div className="md:hidden bg-mudra-card border-b border-mudra-border px-4 py-4 space-y-3 animate-fadeIn">
          <div className="flex flex-col gap-2.5 text-sm font-medium">
            <Link
              to="/market"
              onClick={closeMenu}
              className="px-3 py-2 rounded-lg bg-mudra-bg/60 text-white hover:bg-mudra-bg"
            >
              📊 Market Watch
            </Link>
            <Link
              to="/finance"
              onClick={closeMenu}
              className="px-3 py-2 rounded-lg bg-mudra-bg/60 text-white hover:bg-mudra-bg flex items-center justify-between"
            >
              <span>🏦 Finance Hub (Savings, Gold, Funds)</span>
              <span className="text-[10px] bg-mudra-accent/20 text-mudra-accent px-1.5 py-0.5 rounded font-bold">NEW</span>
            </Link>
            <Link
              to="/shop"
              onClick={closeMenu}
              className="px-3 py-2 rounded-lg bg-mudra-bg/60 text-white hover:bg-mudra-bg flex items-center justify-between"
            >
              <span>🛍️ Mudra Rewards Shop</span>
              <span className="text-[10px] bg-amber-500/20 text-mudra-gold px-1.5 py-0.5 rounded font-bold">PERKS</span>
            </Link>
            <Link
              to="/portfolio"
              onClick={closeMenu}
              className="px-3 py-2 rounded-lg bg-mudra-bg/60 text-white hover:bg-mudra-bg"
            >
              💼 My Portfolio
            </Link>
            <Link
              to="/leaderboard"
              onClick={closeMenu}
              className="px-3 py-2 rounded-lg bg-mudra-bg/60 text-white hover:bg-mudra-bg"
            >
              🏆 Leaderboard
            </Link>
            <Link
              to="/news"
              onClick={closeMenu}
              className="px-3 py-2 rounded-lg bg-mudra-bg/60 text-white hover:bg-mudra-bg"
            >
              📰 Market News
            </Link>
            {userData?.role === 'admin' && (
              <Link
                to="/admin"
                onClick={closeMenu}
                className="px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-mudra-gold font-bold"
              >
                ⚡ God Panel
              </Link>
            )}

            <div className="pt-2 border-t border-mudra-border flex justify-between items-center">
              <span className="text-xs text-mudra-muted">{userData?.name}</span>
              <button
                onClick={handleLogout}
                className="btn-outline text-xs px-3 py-1.5 text-mudra-red"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
