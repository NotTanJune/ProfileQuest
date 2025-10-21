import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Login() {
  const { user, loading, refreshSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const location = useLocation();
  const initialMode = (() => {
    try {
      const params = new URLSearchParams(location.search);
      const modeParam = (params.get('mode') || '').toLowerCase();
      if (modeParam === 'signup') return 'signup';
    } catch {}
    return 'signup'; // default to signup on first visit
  })();
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  function getApiBase() {
    try { return import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
    return (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const apiBase = getApiBase() || 'https://profilequest-3feeae1dd6a1.herokuapp.com';
      if (mode === 'login') {
        const r = await axios.post(`${apiBase}/api/auth/login`, { email, password });
        const token = r.data?.token;
        const u = r.data?.user;
        if (!token || !u) throw new Error('Invalid login response');
        localStorage.setItem('pq_token', token);
        const stored = localStorage.getItem('pq_profile');
        const base = stored ? JSON.parse(stored) : { level: 1, xp: 0, nextLevelXp: 100 };
        const resolvedName = u.name?.trim() || name?.trim() || email.split('@')[0];
        localStorage.setItem('pq_profile', JSON.stringify({ ...base, name: resolvedName }));
        try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('pq_auth_changed')); } catch {}
        try { await refreshSession?.(); } catch {}
        setSuccess('Logged in! Redirecting...');
        navigate('/dashboard', { replace: true });
        return;
      } else {
        const r = await axios.post(`${apiBase}/api/auth/signup`, { email, password, name: name?.trim() || '' });
        const token = r.data?.token;
        const u = r.data?.user;
        if (!token || !u) throw new Error('Signup failed');
        localStorage.setItem('pq_token', token);
        localStorage.setItem('pq_profile', JSON.stringify({ name: u.name || email.split('@')[0], level: 1, xp: 0, nextLevelXp: 100 }));
        try { if (typeof window !== 'undefined') window.dispatchEvent(new Event('pq_auth_changed')); } catch {}
        try { await refreshSession?.(); } catch {}
        setSuccess('Account created successfully! Redirecting...');
        navigate('/dashboard', { replace: true });
        return;
      }
      // For login mode, we returned earlier to let auth context redirect
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Something went wrong';
      if (/Invalid/i.test(message) && mode === 'login') {
        setMode('signup');
        setError('No account found. Create an account below.');
      } else {
        setError(message);
      }
    }
  }

  // Redirect to dashboard only when auth context confirms user is signed in
  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  return (
    <motion.div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}>
      <motion.div className="card w-full max-w-md" role="form" aria-labelledby="loginTitle" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}>
        <h1 id="loginTitle" className="heading mb-2">Welcome to Profile Quest</h1>
        <p className="subheading mb-6">{mode === 'login' ? 'Sign in to continue your journey.' : 'Create your account to begin your journey.'}</p>
        {error && <div className="text-red-400 mb-4" role="alert">{error}</div>}
        {success && <div className="text-green-600 mb-4" role="status">{success}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="name" className="block text-sm text-accent/80 mb-1">Name</label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm text-accent/80 mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'username' : 'email'}
              className="input"
              placeholder="you@domain.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-accent/80 mb-1">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="input pr-20"
                placeholder="password"
                aria-describedby="password-toggle"
              />
              <button
                id="password-toggle"
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-accent/70 hover:text-accent font-medium text-sm px-2 py-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button className="btn-primary w-full" type="button" onClick={handleSubmit}>
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>
        <div className="text-center mt-4 text-accent/80">
          {mode === 'login' ? (
            <button onClick={() => { setMode('signup'); setError(''); setSuccess(''); }} className="underline">Create an account</button>
          ) : (
            <button onClick={() => { setMode('login'); setError(''); setSuccess(''); }} className="underline">Have an account? Log in</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}


