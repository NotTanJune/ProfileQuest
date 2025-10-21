import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';

export default function Profile() {
  const { user,profile } = useAuth();
  const [progress, setProgress] = useState({ level: 1, xp: 0, nextLevelXp: 100, totalXp: 0 });
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const [persona, setPersona] = useState(null);
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
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
      } catch {}
    }
    loadPersona();
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
    <motion.div className="mx-auto max-w-4xl px-4 py-8 space-y-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}>
      <h2 className="heading">Your Profile</h2>
      <div className="card">
        <div className="flex items-center gap-4">
          <div>
            {avatar ? (
              <img src={avatar} alt="Avatar" width="128" height="128" className="w-24 h-24 md:w-32 md:h-32 rounded-xl object-cover border border-black/10" />
            ) : (
              <div className="text-5xl">🧭</div>
            )}
          </div>
          <div>
            <div className="text-xl font-semibold">{displayName}</div>
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
    </motion.div>
  );
}


