import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { user } = useAuth();
  const [progress, setProgress] = useState({ level: 1, xp: 0, nextLevelXp: 100, totalXp: 0 });

  useEffect(() => {
    let isMounted = true;
    async function load() {
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
        setProgress({
          level: p.level ?? 1,
          xp: p.xp ?? 0,
          nextLevelXp: p.next_level_xp ?? p.nextLevelXp ?? 100,
          totalXp: p.total_xp ?? p.totalXp ?? (p.total || 0),
        });
      } catch (e) {
        // ignore
      }
    }
    load();
    return () => { isMounted = false; };
  }, [user?.id]);

  const milestones = useMemo(() => {
    const items = [];
    const upto = Math.max(5, Math.ceil(progress.level / 5) * 5);
    for (let lvl = 5; lvl <= upto + 5; lvl += 5) {
      items.push({ level: lvl, reached: progress.level >= lvl });
    }
    return items;
  }, [progress.level]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <h2 className="heading">Your Profile</h2>
      <div className="card">
        <div className="flex items-center gap-4">
          <div className="text-5xl">🧭</div>
          <div>
            <div className="text-xl font-semibold">{user?.email}</div>
            <div className="subheading">Level {progress.level} • {progress.xp} XP</div>
            <div className="subheading">Total XP: {progress.totalXp}</div>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="text-lg font-semibold">Milestones</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {milestones.map((m, i) => (
            <div key={i} className={`rounded-xl p-3 text-center ${m.reached ? 'bg-accent text-white' : 'bg-complementary/40 text-accent'}`}>
              <div className="text-sm">Level</div>
              <div className="text-lg font-semibold">{m.level}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold">Endorsements</h3>
          <p className="subheading">Coming soon!</p>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold">Gear</h3>
          <p className="subheading">Coming soon!</p>
        </div>
      </div>
    </div>
  );
}


