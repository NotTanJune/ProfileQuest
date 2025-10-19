import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // {name, level, xp}

  useEffect(() => {
    async function hydrateFromAuth(s) {
      if (!s?.user) {
        setProfile(null);
        return;
      }
      let authUser = null;
      try {
        const { data: userData } = await supabase.auth.getUser();
        authUser = userData?.user;
      } catch (e) {
        console.error('getUser failed', e);
      }
      // Fetch profile row from Supabase (name/level/xp) if available
      let remoteProfile = null;
      try {
        if (authUser?.id) {
          const { data: profRow } = await supabase
            .from('profiles')
            .select('name, level, xp, next_level_xp')
            .eq('id', authUser.id)
            .maybeSingle();
          remoteProfile = profRow || null;
        }
      } catch (_) {}
      const storedProfileRaw = localStorage.getItem('pq_profile');
      const storedProfile = storedProfileRaw ? JSON.parse(storedProfileRaw) : {};
      const resolvedName = (remoteProfile?.name && String(remoteProfile.name)) || (authUser?.user_metadata?.name && String(authUser.user_metadata.name)) || storedProfile.name || (authUser?.email ? authUser.email.split('@')[0] : '') || 'Adventurer';
      const merged = {
        name: resolvedName,
        level: (remoteProfile?.level ?? storedProfile.level) || 1,
        xp: (remoteProfile?.xp ?? storedProfile.xp) || 0,
        nextLevelXp: (remoteProfile?.next_level_xp ?? storedProfile.nextLevelXp) || 100,
      };
      setProfile(merged);
      localStorage.setItem('pq_profile', JSON.stringify(merged));
    }

    let isMounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(data.session);
        await hydrateFromAuth(data.session);
      } catch (e) {
        console.error('getSession failed', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!isMounted) return;
      setSession(s);
      await hydrateFromAuth(s);
    });
    return () => {
      isMounted = false;
      sub.subscription?.unsubscribe?.();
    };
  }, []);

  const value = { session, user: session?.user || null, profile, setProfile, loading };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}


