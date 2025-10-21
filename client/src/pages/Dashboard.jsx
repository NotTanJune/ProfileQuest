import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

function XPBar({ pct, currentXP, nextLevelXP, noAnim }) {
  const renderPct = Math.max(0, Math.min(100, Number(pct || 0)));
  return (
    <div>
      <div className={`w-full h-3 rounded-full bg-complementary/40`} role="progressbar" aria-valuenow={renderPct} aria-valuemin={0} aria-valuemax={100} aria-label="XP progress">
        <div className={`h-3 rounded-full bg-accent ${noAnim ? '' : 'smooth-width'}`} style={{ width: `${renderPct}%` }} />
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
  const [showGeneratePrompt, setShowGeneratePrompt] = useState(false);
  const [displayPct, setDisplayPct] = useState(0);
  const [noAnim, setNoAnim] = useState(false);
  const [personaLoaded, setPersonaLoaded] = useState(false);
  const [xpRange, setXpRange] = useState('weekly'); // 'daily' | 'weekly' | 'monthly' | 'yearly'
  const [xpSeries, setXpSeries] = useState([]);
  const [xpLoading, setXpLoading] = useState(false);
  const prevProgressRef = useRef(null);
  const timersRef = useRef([]);
  const initialLoadRef = useRef(true);
  const DASH_LIMIT = 5;
  const noQuests = !loadingQuests && (recentQuests?.length ?? 0) === 0;

  useEffect(() => {
    let isMounted = true;
    async function loadQuests() {
      if (!user?.id) { setLoadingQuests(false); return; }
      try {
        let apiBase = '';
        try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
        if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
        if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
        if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
        const res = await axios.get(`${apiBase}/api/quests`, { params: { userId: user.id, status: 'available' } });
        if (!isMounted) return;
        const qs = (res.data?.quests || []).slice(0, DASH_LIMIT);
        setRecentQuests(qs);
        if ((res.data?.quests || []).length === 0) {
          try {
            const rc = await axios.get(`${apiBase}/api/quests`, { params: { userId: user.id, status: 'completed' } });
            setShowGeneratePrompt((rc.data?.quests || []).length > 0);
          } catch {}
        } else {
          setShowGeneratePrompt(false);
        }
      } catch (e) {
        console.warn('loadQuests failed', e?.message || e);
      } finally {
        if (isMounted) setLoadingQuests(false);
      }
    }
    loadQuests();
    return () => { isMounted = false; };
  }, [user?.id]);

  // XP history fetcher for chart
  useEffect(() => {
    let isMounted = true;
    async function loadXpHistory() {
      if (!user?.id) return;
      setXpLoading(true);
      try {
        let apiBase = '';
        try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
        if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
        if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
        if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
        const res = await axios.get(`${apiBase}/api/xp/history`, { params: { userId: user.id, range: xpRange } });
        if (!isMounted) return;
        const buckets = Array.isArray(res.data?.buckets) ? res.data.buckets : [];
        setXpSeries(buckets.map(b => ({ name: b.label, xp: Number(b.xp || 0) })));
      } catch {
        if (!isMounted) return;
        setXpSeries([]);
      } finally {
        if (isMounted) setXpLoading(false);
      }
    }
    loadXpHistory();
    return () => { isMounted = false; };
  }, [user?.id, xpRange]);

  // Drive forward-only animation on level-up with overflow handling
  useEffect(() => {
    const prev = prevProgressRef.current;
    const newPct = Math.max(0, Math.min(100, Math.round((Number(xpState.xp || 0) / Math.max(1, Number(xpState.nextLevelXp || 0))) * 100)));
    // Initial mount or first server sync -> set without animation
    if (!prev || initialLoadRef.current) {
      setNoAnim(true);
      setDisplayPct(newPct);
      prevProgressRef.current = { ...xpState };
      if (progressLoadedFromServer) initialLoadRef.current = false;
      return;
    }
    // If level increased, animate to 100, reset, then to newPct
    if (xpState.level > prev.level) {
      // clear pending timers
      (timersRef.current || []).forEach((t) => clearTimeout(t));
      timersRef.current = [];
      const fillMs = 650;
      const resetMs = 80;
      let delay = 0;
      const gainedLevels = Math.max(1, xpState.level - prev.level);
      // For all full levels except the last, animate full fill + reset cycles
      for (let i = 0; i < gainedLevels - 1; i++) {
        const tFill = setTimeout(() => { setNoAnim(false); setDisplayPct(100); }, delay);
        delay += fillMs;
        const tReset = setTimeout(() => { setNoAnim(true); setDisplayPct(0); }, delay);
        delay += resetMs;
        timersRef.current.push(tFill, tReset);
      }
      // Final level: go to 100, bounce to 0, then go to remainder newPct
      const tFillLast = setTimeout(() => { setNoAnim(false); setDisplayPct(100); }, delay);
      delay += fillMs;
      const tResetLast = setTimeout(() => { setNoAnim(true); setDisplayPct(0); }, delay);
      delay += resetMs;
      const tRemainder = setTimeout(() => { setNoAnim(false); setDisplayPct(newPct); }, delay);
      timersRef.current.push(tFillLast, tResetLast, tRemainder);
    } else {
      // Normal forward change
      setNoAnim(false);
      setDisplayPct(newPct);
    }
    prevProgressRef.current = { ...xpState };
  }, [xpState.level, xpState.xp, xpState.nextLevelXp, progressLoadedFromServer]);

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
        if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
        const res = await axios.get(`${apiBase}/api/persona`, { params: { userId: user.id } });
        if (!isMounted) return;
        setPersona(res.data?.persona || null);
        setAvatar(res.data?.persona?.avatar || '');
        setPersonaLoaded(true);
      } catch (e) {
        // ignore
        if (isMounted) setPersonaLoaded(true);
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
        if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
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
      if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
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
      if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
      const res = await axios.get(`${apiBase}/api/quests`, { params: { userId: user?.id, status: 'available' } });
      const next = (res.data?.quests || []).slice(0, DASH_LIMIT);
      setRecentQuests(next);
      if ((res.data?.quests || []).length === 0) {
        try {
          const rc = await axios.get(`${apiBase}/api/quests`, { params: { userId: user?.id, status: 'completed' } });
          setShowGeneratePrompt((rc.data?.quests || []).length > 0);
        } catch {}
      } else {
        setShowGeneratePrompt(false);
      }
    } catch {}
  }

  async function generateMoreFromDashboard() {
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
      const personaRes = await axios.get(`${apiBase}/api/persona`, { params: { userId: user?.id } });
      const personaType = personaRes.data?.persona?.persona_type || 'Software Developer';
      let level = 1;
      try {
        const prog = await axios.get(`${apiBase}/api/progress`, { params: { userId: user?.id } });
        level = prog.data?.progress?.level || 1;
      } catch {}
      let allExisting = [];
      try {
        const allRes = await axios.get(`${apiBase}/api/quests`, { params: { userId: user?.id, status: 'all' } });
        allExisting = allRes.data?.quests || [];
      } catch {}
      const gen = await axios.post(`${apiBase}/api/quests/generate`, {
        personaType,
        level,
        userId: user?.id,
        existing: (allExisting || []).map(q => ({ title: q.title, description: q.description, category: q.category }))
      });
      const qs = Array.isArray(gen.data?.quests) ? gen.data.quests : [];
      if (qs.length) {
        await axios.post(`${apiBase}/api/quests/save`, { userId: user?.id, quests: qs });
        await refillRecent();
      }
    } catch {}
  }

  async function deleteQuestInline(q) {
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
      await axios.post(`${apiBase}/api/quests/delete`, { userId: user?.id, title: q.title });
      setRecentQuests(list => list.filter(item => item.title !== q.title));
      const remaining = recentQuests.filter(item => item.title !== q.title).length;
      if (remaining === 0) await refillRecent();
    } catch {}
  }
  return (
    <motion.div
      className="mx-auto w-full max-w-[clamp(1200px,88vw,1600px)] px-4 py-8"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className={noQuests ? 'flex flex-col items-stretch justify-center min-h-[60vh] gap-6' : 'flex flex-col gap-6'}>
        <h2 className="heading">Welcome {displayName}</h2>
        {/* Full-width XP bar aligned with navbar/container */}
        <div className="card p-4" role="region" aria-label="Level and XP">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2">
            <img src="/trophy.svg" alt="" aria-hidden="true" width="20" height="20" className="h-5 w-5" />
            <span>Level {xpState.level}</span>
          </div>
          <div className="text-sm text-accent/70">{xpState.xp} XP / {xpState.nextLevelXp} XP</div>
        </div>
        <XPBar pct={displayPct} currentXP={xpState.xp} nextLevelXP={xpState.nextLevelXp} noAnim={noAnim} />
        <p className="text-sm mt-2 text-accent/70">Earn XP from quests to level up and unlock milestones.</p>
        {persona && (
          <div className="text-sm mt-2 text-accent/70 flex items-center gap-2">
            <img src="/sparkles.svg" alt="" aria-hidden="true" width="16" height="16" className="h-4 w-4" />
            <span>{persona.persona_type} • Level {xpState.level}</span>
          </div>
        )}
        </div>
        {showGeneratePrompt && (
        <div className="card p-4 flex items-center justify-between">
          <div>
            <div className="font-semibold text-accent">All quests completed</div>
            <div className="text-accent/70 text-sm">Generate more tailored to your persona?</div>
          </div>
          <button className="btn-primary" onClick={generateMoreFromDashboard}>Generate More</button>
        </div>
        )}
        {(!loadingQuests && recentQuests.length > 0) && (
        <div className="card">
          <h3 className="text-xl font-semibold flex items-center gap-2"><img src="/bullseye.svg" alt="" aria-hidden="true" width="20" height="20" className="h-5 w-5" />Quests</h3>
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
        {personaLoaded && persona ? (
          <div className="card">
            <div className="md:grid md:grid-cols-[auto,minmax(0,260px),1fr] md:items-start md:gap-6">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2"><img src="/journey.svg" alt="" aria-hidden="true" width="20" height="20" className="h-5 w-5" />{displayName}'s Journey</h3>
                <p className="subheading mt-2 md:hidden">Complete quests to earn XP and level up. Your journey charts progress and milestones as you grow.</p>
                {avatar && (
                  <div className="mt-4">
                    <img src={avatar} alt="Avatar" width="256" height="256" className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover border border-black/10" />
                  </div>
                )}
                <p className="subheading mt-2">{persona.persona_type}</p>
              </div>
              <div className="hidden md:block md:px-2">
                <p className="subheading">Complete quests to earn XP and level up. Your journey charts progress and milestones as you grow.</p>
              </div>
              <div className="mt-6 md:mt-0">
                <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                  <div className="text-sm text-accent/70">XP over time</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['daily','weekly','monthly','yearly'].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setXpRange(r)}
                        disabled={xpLoading}
                        className={(xpRange === r ? 'bg-accent text-white ' : 'bg-accent/20 text-accent hover:bg-accent/30 ') + 'px-3 py-1 rounded-lg transition-colors'}
                        aria-pressed={xpRange === r}
                      >
                        {r[0].toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={xpSeries} margin={{ top: 10, right: 24, bottom: 12, left: 28 }}>
                      <CartesianGrid stroke="rgba(87,73,100,0.25)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#574964', fontSize: 12 }} tickMargin={8} interval={0} padding={{ left: 8, right: 8 }} />
                      <YAxis tick={{ fill: '#574964', fontSize: 12 }} tickMargin={8} allowDecimals={false} width={46} />
                      <Tooltip
                        cursor={{ stroke: 'rgba(255,218,179,0.35)', strokeWidth: 1 }}
                        contentStyle={{ background: '#221B29', border: '1px solid rgba(255,218,179,0.15)', borderRadius: 12, color: '#E0C9C9' }}
                        labelStyle={{ color: '#E0C9C9' }}
                        itemStyle={{ color: '#E0C9C9' }}
                      />
                      <Line type="monotone" dataKey="xp" name="XP" stroke="#3E334B" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <div className="md:grid md:grid-cols-[auto,minmax(0,260px),1fr] md:items-start md:gap-6">
                <div>
                  <h3 className="text-xl font-semibold flex items-center gap-2"><img src="/journey.svg" alt="" aria-hidden="true" width="20" height="20" className="h-5 w-5" />{displayName}'s Journey</h3>
                  <p className="subheading mt-2 md:hidden">Complete quests to earn XP and level up. Your journey charts progress and milestones as you grow.</p>
                  {avatar && (
                    <div className="mt-4">
                      <img src={avatar} alt="Avatar" width="256" height="256" className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover border border-black/10" />
                    </div>
                  )}
                  {persona && (
                    <p className="subheading mt-2">{persona.persona_type}</p>
                  )}
                </div>
                <div className="hidden md:block md:px-2">
                  <p className="subheading">Complete quests to earn XP and level up. Your journey charts progress and milestones as you grow.</p>
                </div>
                <div className="mt-6 md:mt-0">
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <div className="text-sm text-accent/70">XP over time</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {['daily','weekly','monthly','yearly'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setXpRange(r)}
                          disabled={xpLoading}
                          className={(xpRange === r ? 'bg-accent text-white ' : 'bg-accent/20 text-accent hover:bg-accent/30 ') + 'px-3 py-1 rounded-lg transition-colors'}
                          aria-pressed={xpRange === r}
                        >
                          {r[0].toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={xpSeries} margin={{ top: 10, right: 24, bottom: 12, left: 28 }}>
                        <CartesianGrid stroke="rgba(87,73,100,0.25)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#574964', fontSize: 12 }} tickMargin={8} interval={0} padding={{ left: 8, right: 8 }} />
                        <YAxis tick={{ fill: '#574964', fontSize: 12 }} tickMargin={8} allowDecimals={false} width={46} />
                      <Tooltip
                        cursor={{ stroke: 'rgba(255,218,179,0.35)', strokeWidth: 1 }}
                        contentStyle={{ background: '#221B29', border: '1px solid rgba(255,218,179,0.15)', borderRadius: 12, color: '#E0C9C9' }}
                        labelStyle={{ color: '#E0C9C9' }}
                        itemStyle={{ color: '#E0C9C9' }}
                      />
                        <Line type="monotone" dataKey="xp" name="XP" stroke="#3E334B" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <h3 className="text-xl font-semibold flex items-center gap-2"><img src="/sparkles.svg" alt="" aria-hidden="true" width="20" height="20" className="h-5 w-5" />Your Persona</h3>
              <p className="subheading mt-1">Set up your persona to get tailored quests.</p>
              <p className="subheading mt-2">Your persona shapes the quests to match your interests and goals.</p>
              <Link to="/persona" className="btn-primary mt-4 inline-block">Create Persona</Link>
            </div>
          </div>
        )}
      </div>

      
    </motion.div>
  );
}


