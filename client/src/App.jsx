import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
const Home = lazy(() => import('./pages/Home.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Persona = lazy(() => import('./pages/Persona.jsx'));
const Quests = lazy(() => import('./pages/Quests.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
// const Duels = lazy(() => import('./pages/Duels.jsx'));
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { useEffect } from 'react';

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
  const Page = ({ children }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
  return (
    <AuthProvider>
      <div className="min-h-screen">
        {!hideNavbar && <Navbar />}
        <Suspense fallback={null}>
          <AnimatePresence mode="wait" initial={false}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Page><Home /></Page>} />
              <Route path="/login" element={<Page><Login /></Page>} />
              <Route path="/logout" element={<Logout />} />
              <Route path="/dashboard" element={<Protected><Page><Dashboard /></Page></Protected>} />
              <Route path="/persona" element={<Protected><Page><Persona /></Page></Protected>} />
              <Route path="/quests" element={<Protected><Page><Quests /></Page></Protected>} />
              <Route path="/profile" element={<Protected><Page><Profile /></Page></Protected>} />
              {/* <Route path="/duels" element={<Protected><Page><Duels /></Page></Protected>} /> */}
            </Routes>
          </AnimatePresence>
        </Suspense>
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

    // Aggressively clear any auth storage to avoid stale sessions
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (/^(sb-|supabase\.|gotrue)/i.test(k)) localStorage.removeItem(k);
      }
      localStorage.removeItem('pq_token');
      localStorage.removeItem('pq_profile');
    } catch {}

    goLogin();
  }, [navigate]);
  return null;
}


