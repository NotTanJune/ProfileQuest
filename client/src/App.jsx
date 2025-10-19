import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Persona from './pages/Persona.jsx';
import Quests from './pages/Quests.jsx';
import Profile from './pages/Profile.jsx';
import Duels from './pages/Duels.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useEffect } from 'react';
import { supabase } from './lib/supabase';

function Protected({ children }) {
  const { user, loading } = useAuth();
  // Render children during loading to prevent blank/loader lock; redirect after loading if not authed
  if (loading) return children;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const hideNavbar = location.pathname === '/' || location.pathname.startsWith('/login') || location.pathname === '/logout';
  return (
    <AuthProvider>
      <div className="min-h-screen">
        {!hideNavbar && <Navbar />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
          <Route path="/persona" element={<Protected><Persona /></Protected>} />
          <Route path="/quests" element={<Protected><Quests /></Protected>} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/duels" element={<Protected><Duels /></Protected>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
function Logout() {
  const navigate = useNavigate();
  useEffect(() => {
    const goLogin = () => {
      if (typeof window !== 'undefined' && window.location) {
        window.location.replace('/login');
      } else {
        navigate('/login', { replace: true });
      }
    };

    // Aggressively clear Supabase auth storage to avoid stale sessions
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (/^(sb-|supabase\.|gotrue)/i.test(k)) {
          localStorage.removeItem(k);
        }
      }
      localStorage.removeItem('pq_profile');
    } catch {}

    // Fire signOut in background, then redirect immediately
    try { supabase.auth.signOut(); } catch {}
    goLogin();
  }, [navigate]);
  return null;
}


