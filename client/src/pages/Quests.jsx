import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';
import { getApiBase } from '../utils/getApiBase.js';

export default function Quests() {
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, amount: 0, level: 1 });

useEffect(() => {
  let isMounted = true;
  async function fetchQuests() {
    try {
      if (!user?.id) return; // wait for user id
      const apiBase = getApiBase();
      const resAvail = await axios.get(`${apiBase}/api/quests`, { params: { userId: user.id, status: 'available' } });
      if (!isMounted) return;
      const available = resAvail.data?.quests || [];
      setQuests(available);
    } catch (e) {
      console.error(e);
    } finally {
      if (isMounted) setLoading(false);
    }
  }
  fetchQuests();
  return () => { isMounted = false; };
}, [user?.id]);

  async function completeQuest(q) {
    try {
      const apiBase = getApiBase();
      const userId = user?.id || 'local-user';
      const res = await axios.post(`${apiBase}/api/quests/complete`, { userId, title: q.title, xpReward: q.xp_reward });
      const prof = res.data?.profile;
      const lvl = prof?.level ?? undefined;
      // Update UI: remove from available list
      setQuests(list => list.filter(item => item.title !== q.title));
      // Show toast with server values
      setToast({ visible: true, amount: q.xp_reward || 0, level: lvl || 1 });
      window.clearTimeout(window.__xp_toast_timer__);
      window.__xp_toast_timer__ = window.setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
      // If no more available, and some completed exist, show prompt
      try {
        const resCompleted = await axios.get(`${apiBase}/api/quests`, { params: { userId, status: 'completed' } });
        setShowGeneratePrompt((resCompleted.data?.quests || []).length > 0 && (typeof window !== 'undefined'));
      } catch {}
    } catch (e) {
      console.error('complete quest failed', e);
    }
  }

  async function deleteQuest(title) {
    try {
      const apiBase = getApiBase();
      const userId = user?.id || 'local-user';
      await axios.post(`${apiBase}/api/quests/delete`, { userId, title });
      setQuests(list => list.filter(q => q.title !== title));
    } catch (e) {
      console.error('delete quest failed', e);
    }
  }

  async function generateMore() {
    try {
      // Guard: only allow generating when there are zero available quests
      if ((quests?.length || 0) !== 0) return;
      setRefreshing(true);
      const apiBase = getApiBase();
      const userId = user?.id || 'local-user';
      const personaRes = await axios.get(`${apiBase}/api/persona`, { params: { userId } });
      const personaType = personaRes.data?.persona?.persona_type || 'Software Developer';
      // Use authoritative level from /api/progress
      let level = 1;
      try {
        const prog = await axios.get(`${apiBase}/api/progress`, { params: { userId } });
        level = prog.data?.progress?.level || 1;
      } catch {}
      // Fetch all existing (available + completed) to avoid duplicates
      let allExisting = [];
      try {
        const allRes = await axios.get(`${apiBase}/api/quests`, { params: { userId, status: 'all' } });
        allExisting = allRes.data?.quests || [];
      } catch {}
      const gen = await axios.post(`${apiBase}/api/quests/generate`, {
        personaType,
        level,
        userId,
        existing: (allExisting || []).map(q => ({ title: q.title, description: q.description, category: q.category }))
      });
      let qs = gen.data?.quests || [];
      if (!Array.isArray(qs)) qs = [];
      // Filter out any already-existing titles
      const existingTitles = new Set((allExisting || []).map(q => q.title));
      const newOnes = qs.filter(q => q?.title && !existingTitles.has(q.title));
      if (newOnes.length) {
        await axios.post(`${apiBase}/api/quests/save`, { userId, quests: newOnes });
        // Reload available
        const resAvail = await axios.get(`${apiBase}/api/quests`, { params: { userId, status: 'available' } });
        setQuests(resAvail.data?.quests || []);
        setShowGeneratePrompt(false);
      }
    } catch (e) {
      console.error('generate more failed', e);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <motion.div className="mx-auto max-w-6xl px-4 py-8" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}>
      {/* XP toast */}
      <div className="xp-toast-wrapper" aria-live="polite" aria-atomic="true">
        <div className={`xp-toast-card ${toast.visible ? 'xp-show' : ''}`} role="status">
          <svg className="xp-wave" viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z" fillOpacity="1"></path>
          </svg>
          <div className="xp-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" strokeWidth="0" fill="currentColor" stroke="currentColor" className="xp-icon">
              <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z"></path>
            </svg>
          </div>
          <div className="xp-message-text-container">
            <p className="xp-message-text">Quest completed!</p>
            <p className="xp-sub-text">Gained {toast.amount} XP • Level {toast.level}</p>
          </div>
          <svg onClick={() => setToast(t => ({ ...t, visible: false }))} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" strokeWidth="0" fill="none" stroke="currentColor" className="xp-cross-icon" role="button" aria-label="Dismiss notification">
            <path fill="currentColor" d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" clipRule="evenodd" fillRule="evenodd"></path>
          </svg>
        </div>
      </div>
      <h2 className="heading mb-4">Quest Board</h2>
      {loading ? (
        <p className="subheading">Loading quests...</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-accent/80">{quests.length} quests</div>
            <button
              className={quests.length !== 0 ? 'px-4 py-2 rounded-xl bg-accentLight text-white cursor-not-allowed opacity-90' : 'btn-primary'}
              onClick={generateMore}
              disabled={refreshing || quests.length !== 0}
            >
              {refreshing
                ? 'Generating...'
                : (quests.length !== 0 ? 'Complete all tasks to generate more!' : 'Generate More')}
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {quests.map((q, i) => (
              <motion.div key={i} className="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1], delay: i * 0.03 }}>
                <h3 className="text-xl font-semibold">{q.title}</h3>
                <p className="subheading mt-1">{q.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-accent/80">{q.category}</span>
                  <span className="text-accent font-semibold">+{q.xp_reward} XP</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button className="btn-primary" onClick={() => completeQuest(q)}>Complete</button>
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
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}

