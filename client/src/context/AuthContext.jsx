import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // {name, level, xp}

  useEffect(() => {
    function getApiBase() {
      try { return import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      return (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
    }
    async function loadMe(token) {
      try {
        const apiBase = getApiBase() || 'https://profilequest-3feeae1dd6a1.herokuapp.com';
        const res = await axios.get(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const u = res.data?.user || null;
        if (!u) return null;
        const storedProfileRaw = localStorage.getItem('pq_profile');
        const storedProfile = storedProfileRaw ? JSON.parse(storedProfileRaw) : {};
        const merged = {
          name: u.name || storedProfile.name || (u.email ? u.email.split('@')[0] : 'Adventurer'),
          level: storedProfile.level || 1,
          xp: storedProfile.xp || 0,
          nextLevelXp: storedProfile.nextLevelXp || 100,
        };
        setProfile(merged);
        localStorage.setItem('pq_profile', JSON.stringify(merged));
        return u;
      } catch { return null; }
    }

    async function refreshFromToken() {
      const token = localStorage.getItem('pq_token');
      if (token) {
        const me = await loadMe(token);
        if (me) {
          setSession({ user: { id: me.id, email: me.email, name: me.name } });
          return me;
        }
      }
      setSession(null);
      return null;
    }

    let isMounted = true;
    (async () => {
      try {
        if (!isMounted) return;
        await refreshFromToken();
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    function onAuthChanged() { void refreshFromToken(); }
    function onStorage(e) { if (e?.key === 'pq_token') void refreshFromToken(); }
    if (typeof window !== 'undefined') {
      window.addEventListener('pq_auth_changed', onAuthChanged);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pq_auth_changed', onAuthChanged);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  async function refreshSession() {
    const token = localStorage.getItem('pq_token');
    if (!token) { setSession(null); return null; }
    const apiBase = (typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_API_BASE_URL || '') : '') || (typeof process !== 'undefined' ? (process.env?.VITE_API_BASE_URL || '') : '') || 'https://profilequest-3feeae1dd6a1.herokuapp.com';
    try {
      const res = await axios.get(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const u = res.data?.user || null;
      if (u) setSession({ user: { id: u.id, email: u.email, name: u.name } });
      return u;
    } catch {
      setSession(null);
      return null;
    }
  }

  const value = { session, user: session?.user || null, profile, setProfile, loading, refreshSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}


