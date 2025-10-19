import { useState, useEffect } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabase';
import { useAuth } from '../context/AuthContext.jsx';
// No axios/network calls here; use Supabase client directly
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  async function waitForAuthedUser(timeoutMs = 6000) {
    const start = Date.now();
    // quick path
    const quick = await supabase.auth.getUser();
    if (quick?.data?.user) return quick.data.user;
    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase.auth.getUser();
      if (data?.user) return data.user;
      await new Promise((r) => setTimeout(r, 120));
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Supabase environment variables are missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
      }
      if (mode === 'login') {
        let navigated = false;
        const { data: loginRes, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // If session available immediately, proceed; otherwise wait for SIGNED_IN event
        const immediateUser = loginRes?.user || (await supabase.auth.getUser())?.data?.user;
        if (!immediateUser) {
          const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && !navigated) {
              navigated = true;
              navigate('/dashboard', { replace: true });
              sub?.subscription?.unsubscribe?.();
            }
          });
          setSuccess('Logged in! Finalizing session...');
          setTimeout(() => {
            if (!navigated) navigate('/dashboard', { replace: true });
          }, 2000);
          return;
        }
        const userId = immediateUser.id;
        const userEmail = immediateUser.email || email;
        let resolvedName = '';
        // Read existing profile (prefer existing name)
        const { data: existing } = await supabase
          .from('profiles')
          .select('name, level, xp, next_level_xp')
          .eq('id', userId)
          .maybeSingle();
        if (existing?.name?.trim()) {
          resolvedName = existing.name.trim();
        } else {
          resolvedName = immediateUser.user_metadata?.name?.trim() || email.split('@')[0];
        }
        // Upsert profile to avoid conflicts and ensure name is persisted
        await supabase.from('profiles').upsert({ id: userId, email: userEmail, name: resolvedName }, { onConflict: 'id' });
        // Update local cache with resolved name (keep any stored progress until dashboard fetch replaces it)
        const stored = localStorage.getItem('pq_profile');
        const base = stored ? JSON.parse(stored) : { level: 1, xp: 0, nextLevelXp: 100 };
        const next = {
          ...base,
          name: resolvedName,
          level: existing?.level ?? base.level ?? 1,
          xp: existing?.xp ?? base.xp ?? 0,
          nextLevelXp: existing?.next_level_xp ?? base.nextLevelXp ?? 100,
        };
        localStorage.setItem('pq_profile', JSON.stringify(next));
        setSuccess('Logged in! Redirecting...');
        navigate('/dashboard', { replace: true });
        return;
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        // Store a lightweight profile locally for demo (name, level, xp)
        const profile = { name: name || email.split('@')[0], level: 1, xp: 0, nextLevelXp: 100 };
        localStorage.setItem('pq_profile', JSON.stringify(profile));
        // Persist name to Supabase metadata at signup
        if (name?.trim()) {
          await supabase.auth.updateUser({ data: { name: name.trim() } });
        }
        // Attempt immediate login (covers cases where email confirmation is disabled)
        const { data: afterSignupLogin, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          setSuccess('Account created. Please verify your email, then log in.');
          return;
        }
        const authed = afterSignupLogin?.user || (await supabase.auth.getUser())?.data?.user;
        const newUserId = authed?.id;
        const newUserEmail = authed?.email || email;
        const resolvedName = name?.trim() || authed?.user_metadata?.name?.trim() || email.split('@')[0];
        if (newUserId) {
          await supabase.from('profiles').upsert({ id: newUserId, email: newUserEmail, name: resolvedName }, { onConflict: 'id' });
        }
        // Wait for SIGNED_IN to avoid bounce
        let navigated = false;
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN' && !navigated) {
            navigated = true;
            navigate('/dashboard', { replace: true });
            sub?.subscription?.unsubscribe?.();
          }
        });
        setSuccess('Account created successfully! Finalizing session...');
        setTimeout(() => {
          if (!navigated) navigate('/dashboard', { replace: true });
        }, 2000);
        return;
      }
      // For login mode, we returned earlier to let auth context redirect
    } catch (err) {
      const message = err?.message || 'Something went wrong';
      if (/Invalid login credentials/i.test(message) && mode === 'login') {
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="card w-full max-w-md" role="form" aria-labelledby="loginTitle">
        <h1 id="loginTitle" className="heading mb-2">Welcome to Profile Quest</h1>
        <p className="subheading mb-6">Sign in to continue your journey.</p>
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
      </div>
    </div>
  );
}


