import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';

export default function Quests() {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function fetchQuests() {
      try {
        // Load saved quests from Supabase-backed API
        let apiBase = '';
        try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
        if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
        if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
        if (!apiBase) apiBase = 'http://localhost:5050';

        const userId = user?.id || 'local-user';
        const resGet = await axios.get(`${apiBase}/api/quests`, { params: { userId, status: 'available' } });
        const existing = resGet.data?.quests || [];
        if (existing.length > 0) {
          setQuests(existing);
          return;
        }

        // If none exist, generate from persona and save
        const personaRes = await axios.get(`${apiBase}/api/persona`, { params: { userId } });
        const personaType = personaRes.data?.persona?.persona_type || 'Software Developer';
        const gen = await axios.post(`${apiBase}/api/quests/generate`, { personaType, level: 1 });
        const qs = gen.data?.quests || [];
        setQuests(qs);
        if (qs.length) {
          await axios.post(`${apiBase}/api/quests/save`, { userId, quests: qs });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchQuests();
  }, []);

  function addXP(amount) {
    const stored = localStorage.getItem('pq_profile');
    const base = stored ? JSON.parse(stored) : { level: 1, xp: 0, nextLevelXp: 100 };
    let { level, xp, nextLevelXp } = base;
    xp += amount;
    while (xp >= nextLevelXp) {
      xp -= nextLevelXp;
      level += 1;
      nextLevelXp = Math.round(nextLevelXp * 1.5);
    }
    const updated = { ...base, level, xp, nextLevelXp };
    localStorage.setItem('pq_profile', JSON.stringify(updated));
    alert(`Gained ${amount} XP! You are now level ${level}.`);
  }

  async function deleteQuest(title) {
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'http://localhost:5050';
      const userId = user?.id || 'local-user';
      await axios.post(`${apiBase}/api/quests/delete`, { userId, title });
      setQuests(list => list.filter(q => q.title !== title));
    } catch (e) {
      console.error('delete quest failed', e);
    }
  }

  async function generateMore() {
    try {
      setRefreshing(true);
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'http://localhost:5050';
      const userId = user?.id || 'local-user';
      const personaRes = await axios.get(`${apiBase}/api/persona`, { params: { userId } });
      const personaType = personaRes.data?.persona?.persona_type || 'Software Developer';
      // Estimate level from local storage; server will adjust on save if needed
      const stored = localStorage.getItem('pq_profile');
      const base = stored ? JSON.parse(stored) : { level: 1 };
      const level = base.level || 1;
      const gen = await axios.post(`${apiBase}/api/quests/generate`, {
        personaType,
        level,
        userId,
        existing: quests.map(q => ({ title: q.title, description: q.description, category: q.category }))
      });
      let qs = gen.data?.quests || [];
      if (!Array.isArray(qs)) qs = [];
      // Filter out any already-existing titles
      const existingTitles = new Set((quests || []).map(q => q.title));
      const newOnes = qs.filter(q => q?.title && !existingTitles.has(q.title));
      if (newOnes.length) {
        await axios.post(`${apiBase}/api/quests/save`, { userId, quests: newOnes });
        setQuests(list => [...list, ...newOnes]);
      }
    } catch (e) {
      console.error('generate more failed', e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h2 className="heading mb-4">Quest Board</h2>
      {loading ? (
        <p className="subheading">Loading quests...</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-accent/80">{quests.length} quests</div>
            <button className="btn-primary" onClick={generateMore} disabled={refreshing}>{refreshing ? 'Generating...' : 'Generate More'}</button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {quests.map((q, i) => (
              <div key={i} className="card">
                <h3 className="text-xl font-semibold">{q.title}</h3>
                <p className="subheading mt-1">{q.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-accent/80">{q.category}</span>
                  <span className="text-accent font-semibold">+{q.xp_reward} XP</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn-primary" onClick={() => addXP(q.xp_reward || 50)}>Complete</button>
                  <button
                    type="button"
                    className="ml-2 px-3 py-2 rounded-lg text-accent border border-red-500/10 bg-red-500/10 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/10 transition-colors cursor-pointer"
                    title="Delete quest"
                    aria-label="Delete quest"
                    onClick={() => deleteQuest(q.title)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-5 w-5 pointer-events-none">
                      <path d="M9 3h6m-9 4h12m-10 0l1 12m6-12l-1 12M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12" stroke="#574964" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}


