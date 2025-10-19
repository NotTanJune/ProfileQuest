import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';

function XPBar({ currentXP, nextLevelXP }) {
  const pct = Math.max(0, Math.min(100, Math.round((currentXP / nextLevelXP) * 100)));
  return (
    <div>
      <div className="w-full h-3 bg-complementary/40 rounded-full" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="XP progress">
        <div className="h-3 rounded-full bg-accentAlt smooth-width" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm mt-1 text-accent/80">{currentXP} XP / {nextLevelXP} XP</p>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [recentQuests, setRecentQuests] = useState([]);
  const [loadingQuests, setLoadingQuests] = useState(true);
  const [xpState, setXpState] = useState({ level: profile?.level ?? 1, xp: profile?.xp ?? 0, nextLevelXp: profile?.nextLevelXp ?? 100 });
  const [progressLoadedFromServer, setProgressLoadedFromServer] = useState(false);
  const [persona, setPersona] = useState(null);
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const DASH_LIMIT = 5;

  useEffect(() => {
    let isMounted = true;
    async function loadQuests() {
      if (!user?.id) { setLoadingQuests(false); return; }
      try {
        let apiBase = '';
        try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
        if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
        if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
        if (!apiBase) apiBase = 'http://localhost:5050';
        const res = await axios.get(`${apiBase}/api/quests`, { params: { userId: user.id, status: 'available' } });
        if (!isMounted) return;
        const qs = (res.data?.quests || []).slice(0, DASH_LIMIT);
        setRecentQuests(qs);
      } catch (e) {
        console.warn('loadQuests failed', e?.message || e);
      } finally {
        if (isMounted) setLoadingQuests(false);
      }
    }
    loadQuests();
    return () => { isMounted = false; };
  }, [user?.id]);

  useEffect(() => {
    // Only apply local/profile values if server progress hasn't loaded yet
    if (!progressLoadedFromServer) {
      setXpState({ level: profile?.level ?? 1, xp: profile?.xp ?? 0, nextLevelXp: profile?.nextLevelXp ?? 100 });
    }
  }, [profile?.level, profile?.xp, profile?.nextLevelXp, progressLoadedFromServer]);

  useEffect(() => {
    let isMounted = true;
    async function loadPersona() {
      if (!user?.id) return;
      try {
        let apiBase = '';
        try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
        if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
        if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
        if (!apiBase) apiBase = 'http://localhost:5050';
        const res = await axios.get(`${apiBase}/api/persona`, { params: { userId: user.id } });
        if (!isMounted) return;
        setPersona(res.data?.persona || null);
        setAvatar(res.data?.persona?.avatar || '');
      } catch (e) {
        // ignore
      }
    }
    loadPersona();
    return () => { isMounted = false; };
  }, [user?.id]);

  // Load authoritative progress from server first, fallback to local if fails
  useEffect(() => {
    let isMounted = true;
    async function loadProgress() {
      if (!user?.id) return;
      try {
        let apiBase = '';
        try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
        if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
        if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
        if (!apiBase) apiBase = 'http://localhost:5050';
        const res = await axios.get(`${apiBase}/api/progress`, { params: { userId: user.id } });
        if (!isMounted) return;
        const p = res.data?.progress || {};
        setXpState({
          level: p.level ?? profile?.level ?? 1,
          xp: p.xp ?? profile?.xp ?? 0,
          nextLevelXp: p.next_level_xp ?? p.nextLevelXp ?? profile?.nextLevelXp ?? 100,
        });
        if (p?.name) setDisplayName(String(p.name));
        setProgressLoadedFromServer(true);
      } catch (e) {
        // On error, keep current/local values
        if (!isMounted) return;
        setProgressLoadedFromServer(true);
      }
    }
    loadProgress();
    return () => { isMounted = false; };
  }, [user?.id]);

  async function completeQuestInline(q) {
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'http://localhost:5050';
      const res = await axios.post(`${apiBase}/api/quests/complete`, { userId: user?.id, title: q.title, xpReward: q.xp_reward });
      const newProf = res.data?.profile;
      if (newProf) {
        setXpState({ level: newProf.level, xp: newProf.xp, nextLevelXp: newProf.nextLevelXp });
      }
    } catch {}
    // Animate: mark the quest as completed quickly in place
    setRecentQuests(list => list.map(item => item.title === q.title ? { ...item, _completed: true } : item));
    // Remove after short delay
    const willBeEmpty = recentQuests.filter(item => item.title !== q.title).length === 0;
    setTimeout(async () => {
      setRecentQuests(list => list.filter(item => item.title !== q.title));
      if (willBeEmpty) await refillRecent();
    }, 650);
  }

  async function refillRecent() {
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'http://localhost:5050';
      const res = await axios.get(`${apiBase}/api/quests`, { params: { userId: user?.id, status: 'available' } });
      const next = (res.data?.quests || []).slice(0, DASH_LIMIT);
      setRecentQuests(next);
    } catch {}
  }

  async function deleteQuestInline(q) {
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'http://localhost:5050';
      await axios.post(`${apiBase}/api/quests/delete`, { userId: user?.id, title: q.title });
      setRecentQuests(list => list.filter(item => item.title !== q.title));
      const remaining = recentQuests.filter(item => item.title !== q.title).length;
      if (remaining === 0) await refillRecent();
    } catch {}
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <h2 className="heading">Welcome {displayName}</h2>
      {/* Full-width XP bar aligned with navbar/container */}
      <div className="card p-4" role="region" aria-label="Level and XP">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Level {xpState.level}</div>
          <div className="text-sm text-accent/70">{xpState.xp} XP / {xpState.nextLevelXp} XP</div>
        </div>
        <XPBar currentXP={xpState.xp} nextLevelXP={xpState.nextLevelXp} />
        {persona && (
          <div className="text-sm mt-2 text-accent/70">{persona.persona_type} • Level {xpState.level}</div>
        )}
      </div>
      {(!loadingQuests && recentQuests.length > 0) && (
        <div className="card mt-6">
          <h3 className="text-xl font-semibold">Quests</h3>
          <ul className="mt-2 space-y-2">
            {recentQuests.map((q, i) => (
              <li key={i} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{q.title}</div>
                  <div className="text-accent/70 text-sm">{q.category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`text-accent font-semibold ${q._completed ? 'rise-fade' : ''}`}>+{q.xp_reward} XP</div>
                  <button className={`btn-primary ${q._completed ? 'fade-green' : ''}`} onClick={() => completeQuestInline(q)} disabled={q._completed}>Complete</button>
                  <button
                    type="button"
                    className="ml-1 px-3 py-2 rounded-lg text-accent border border-red-500/10 bg-red-500/10 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/10 transition-colors cursor-pointer"
                    title="Delete quest"
                    aria-label="Delete quest"
                    onClick={() => deleteQuestInline(q)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-5 w-5 pointer-events-none">
                      <path d="M9 3h6m-9 4h12m-10 0l1 12m6-12l-1 12M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" stroke="#574964" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/quests" className="btn-primary mt-4 inline-block">Open Quest Board</Link>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-semibold">Your Journey</h3>
          <p className="subheading mt-1">{user?.email}</p>
          <p className="subheading mt-2">Complete quests to earn XP and level up.</p>
          {persona && (
            <p className="subheading mt-2">Persona: {persona.persona_type}</p>
          )}
          {avatar && (
            <div className="mt-4 flex justify-center">
              <img src={avatar} alt="Avatar" width="128" height="128" className="w-24 h-24 rounded-xl object-cover border border-black/10" />
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="text-xl font-semibold">Your Persona</h3>
          <p className="subheading mt-1">Set up your persona to get tailored quests.</p>
          <Link to="/persona" className="btn-primary mt-4 inline-block">Create Persona</Link>
        </div>
      </div>

      
    </div>
  );
}


