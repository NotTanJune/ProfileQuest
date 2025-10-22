import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout(e) {
    e?.preventDefault?.();
    try { localStorage.removeItem('pq_token'); } catch {}
    try { localStorage.removeItem('pq_profile'); } catch {}
    // Use hard redirect as reliable fallback
    if (window?.location) {
      window.location.replace('/login');
    } else {
      navigate('/login', { replace: true });
    }
  }

  if (!user) return null;

  const active = ({ isActive }) =>
    `nav-link text-main hover:bg-accentAlt/30`;

  return (
    <motion.header
      className="sticky top-0 z-40 bg-transparent"
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="mx-auto w-full max-w-full md:max-w-[clamp(1200px,88vw,1600px)] px-4 py-3">
        <nav className="flex items-center justify-between glass-nav px-4 py-2" aria-label="Primary">
          <Link to="/dashboard" className="text-main font-semibold tracking-tight text-xl">
            Profile Quest
          </Link>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-1">
            <NavLink to="/dashboard" className={active}>Dashboard</NavLink>
            <NavLink to="/persona" className={active}>Persona</NavLink>
            <NavLink to="/quests" className={active}>Quests</NavLink>
            <NavLink to={`/profile`} className={active}>Profile</NavLink>
            {/* <NavLink to="/duels" className={active}>Duels</NavLink> */}
            <Link
              to="/logout"
              id="logout-button"
              className="relative z-50 ml-2 px-3 py-2 rounded-lg text-main border border-red-500/10 bg-red-500/25 hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/10 transition-colors cursor-pointer pointer-events-auto"
              aria-label="Log out"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                height="24"
                width="24"
                viewBox="0 0 24 24"
                className="h-5 w-5 pointer-events-none"
                aria-hidden="true"
              >
                <path
                  d="M17 16L21 12M21 12L17 8M21 12L7 12M13 16V17C13 18.6569 11.6569 20 10 20H6C4.34315 20 3 18.6569 3 17V7C3 5.34315 4.34315 4 6 4H10C11.6569 4 13 5.34315 13 7V8"
                  stroke="#FFDAB3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="sm:hidden inline-flex items-center justify-center p-2 rounded-lg text-main hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Open menu"
            aria-expanded={menuOpen ? 'true' : 'false'}
            onClick={() => setMenuOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="#FFDAB3" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </nav>
      </div>
      {/* Backdrop overlay */}
      {menuOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 backdrop-blur-md bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-72 glass-nav p-4 flex flex-col"
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile menu"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-main font-semibold tracking-tight text-lg">Menu</span>
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-lg text-main hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                  <path d="M6 6l12 12M18 6L6 18" stroke="#FFDAB3" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mt-2 divide-y divide-accent/20">
              <div className="py-2 flex flex-col gap-1">
                <NavLink to="/dashboard" className={active} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
                <NavLink to="/persona" className={active} onClick={() => setMenuOpen(false)}>Persona</NavLink>
                <NavLink to="/quests" className={active} onClick={() => setMenuOpen(false)}>Quests</NavLink>
                <NavLink to={`/profile`} className={active} onClick={() => setMenuOpen(false)}>Profile</NavLink>
              </div>
              <div className="pt-3">
                <Link
                  to="/logout"
                  id="logout-button-mobile"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 inline-flex w-full justify-center px-3 py-2 rounded-lg text-main border border-red-500/10 bg-red-500/25 hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/10 transition-colors"
                  aria-label="Log out"
                >
                  Log out
                </Link>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </motion.header>
  );
}


