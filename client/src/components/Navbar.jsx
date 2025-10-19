import { Link, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout(e) {
    e?.preventDefault?.();
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('signOut error', err);
    } finally {
      try { localStorage.removeItem('pq_profile'); } catch {}
      // Use hard redirect as reliable fallback
      if (window?.location) {
        window.location.replace('/login');
      } else {
        navigate('/login', { replace: true });
      }
    }
  }

  if (!user) return null;

  const active = ({ isActive }) =>
    `nav-link text-accent`;

  return (
    <header className="sticky top-0 z-40 bg-transparent">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <nav className="flex items-center justify-between rounded-2xl bg-main border border-accentAlt/20 shadow-glass px-4 py-2" aria-label="Primary">
          <Link to="/dashboard" className="text-accent font-semibold tracking-tight text-xl">
            Profile Quest
          </Link>
          <div className="flex items-center gap-1">
          <NavLink to="/dashboard" className={active}>Dashboard</NavLink>
          <NavLink to="/persona" className={active}>Persona</NavLink>
          <NavLink to="/quests" className={active}>Quests</NavLink>
          <NavLink to={`/profile`} className={active}>Profile</NavLink>
          <NavLink to="/duels" className={active}>Duels</NavLink>
          <Link
            to="/logout"
            id="logout-button"
            className="relative z-50 ml-2 px-3 py-2 rounded-lg text-accent border border-red-500/10 bg-red-500/10 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/10 transition-colors cursor-pointer pointer-events-auto"
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
                stroke="#574964"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}


