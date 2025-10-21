import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';

export default function Persona() {
  const { user } = useAuth();
  const [currentRole, setCurrentRole] = useState('');
  const [proficiency, setProficiency] = useState(3); // 1..5 discrete
  const [interests, setInterests] = useState('');
  const [strengths, setStrengths] = useState('');
  const [goals, setGoals] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [avatarTries, setAvatarTries] = useState(0); // max 3 (initial + 2)
  const [refImage, setRefImage] = useState(''); // data URL

  async function generatePersona() {
    // Count only regenerations when a result already exists
    if (result && avatarTries >= 2) return;
    if (result) setAvatarTries(n => n + 1);
    setLoading(true);
    setResult(null);
    try {
      let apiBase = '';
      try {
        apiBase = import.meta?.env?.VITE_API_BASE_URL || '';
      } catch {}
      if (!apiBase) {
        apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      }
      if (!apiBase && typeof window !== 'undefined') {
        apiBase = window.__API_BASE_URL__ || '';
      }
      if (!apiBase) {
        apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
      }
      const res = await axios.post(`${apiBase}/api/persona/generate`, {
        currentRole,
        proficiency,
        interests,
        strengths,
        goals,
        imageBase64: refImage || ''
      });
      const persona = res.data?.persona || { persona_type: 'Adventurer', attributes: { logic: 5, creativity: 5, communication: 5 } };
      const starting_quests = Array.isArray(res.data?.quests) ? res.data.quests.slice(0, 3) : [];

      setResult({ persona_type: persona.persona_type, attributes: persona.attributes, starting_quests });
      if (res.data?.avatar) setAvatar(res.data.avatar);
      if (res.data?.avatar) setAvatar(res.data.avatar);

      // Save persona and starter quests to server (Supabase-backed)
      try {
        const userId = user?.id || 'local-user';
        await axios.post(`${apiBase}/api/persona/save`, { userId, persona, avatar: res.data?.avatar || null });
        if (starting_quests.length) {
          await axios.post(`${apiBase}/api/quests/save`, { userId, quests: starting_quests });
        }
      } catch (e) {
        // Ignore server persistence errors in UI flow
        console.warn('save persona/quests skipped', e?.message || e);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateAvatar() {
    if (avatarTries >= 3) return;
    try {
      let apiBase = '';
      try { apiBase = import.meta?.env?.VITE_API_BASE_URL || ''; } catch {}
      if (!apiBase) apiBase = (typeof process !== 'undefined' ? process?.env?.VITE_API_BASE_URL : '') || '';
      if (!apiBase && typeof window !== 'undefined') apiBase = window.__API_BASE_URL__ || '';
      if (!apiBase) apiBase = 'https://profilequest-3feeae1dd6a1.herokuapp.com';
      const promptMeta = { currentRole, proficiency, interests, strengths, goals };
      const r = await axios.post(`${apiBase}/api/persona/generate`, {
        currentRole,
        proficiency,
        interests,
        strengths,
        goals,
        imageBase64: refImage || ''
      });
      const img = r.data?.image || '';
      const avatarImg = r.data?.avatar || img;
      if (avatarImg) setAvatar(avatarImg);
      setAvatarTries(n => n + 1);
    } catch {}
  }

  function onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRefImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  return (
    <motion.div className="mx-auto max-w-6xl px-4 py-8" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}>
      <h2 className="heading mb-4">Persona Builder</h2>
      {!result ? (
        <div className="card p-6">
          <div>
            <label htmlFor="currentRole" className="block text-base text-accent/80 mb-1">Current Role</label>
            <input
              id="currentRole"
              type="text"
              className="input text-sm"
              placeholder="e.g., Frontend Developer, Student, Product Manager"
              value={currentRole}
              onChange={(e)=>setCurrentRole(e.target.value)}
            />
          </div>
          

          <div className="mt-6">
            <label className="block text-base text-accent/80 mb-1">Interests/Expertise</label>
            <p className="text-xs text-accent/60 mb-2">Topics, domains or technologies you enjoy or want to explore.</p>
            <textarea
              className="input h-24 text-sm"
              rows="3"
              placeholder="e.g., Web development, AI/ML, UI/UX design, open-source"
              value={interests}
              onChange={e=>setInterests(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label htmlFor="proficiency" className="block text-base text-accent/80">Proficiency</label>
              <span className="text-accent/70 text-base">{proficiency} / 5</span>
            </div>
            <input
              id="proficiency"
              type="range"
              min="1"
              max="5"
              step="1"
              value={proficiency}
              onChange={(e)=>setProficiency(Number(e.target.value))}
              className="w-full mt-2 accent-accentLight"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={proficiency}
            />
            <div className="flex justify-between text-xs text-accent/60 mt-1">
              <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-base text-accent/80 mb-1">Strengths</label>
            <p className="text-xs text-accent/60 mb-2">Skills or traits you’re confident in.</p>
            <textarea
              className="input h-24 text-sm"
              rows="3"
              placeholder="e.g., JavaScript, problem solving, communication, system design"
              value={strengths}
              onChange={e=>setStrengths(e.target.value)}
            />
          </div>

          <div className="mt-4">
            <label className="block text-base text-accent/80 mb-1">Goals</label>
            <p className="text-xs text-accent/60 mb-2">What you want to achieve in the next 3–6 months.</p>
            <textarea
              className="input h-24 text-sm"
              rows="3"
              placeholder="e.g., land a frontend role, contribute to OSS, master React"
              value={goals}
              onChange={e=>setGoals(e.target.value)}
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm text-accent/80 mb-1">Reference Image (optional)</label>
            <p className="text-xs text-accent/60 mb-2">Uses your reference image and creates an avatar based on your persona details.</p>
            <input id="refImage" type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
            <label htmlFor="refImage" className="file-btn inline-flex mt-2">
              <svg
                aria-hidden="true"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeWidth="2"
                  stroke="currentColor"
                  d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H11M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                ></path>
                <path
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2"
                  stroke="currentColor"
                  d="M17 15V18M17 21V18M17 18H14M17 18H20"
                ></path>
              </svg>
              Add File
            </label>
            {refImage && <img src={refImage} alt="Reference" className="mt-2 w-24 h-24 rounded-lg object-cover border border-black/10" />}
            {avatar && (
              <div className="mt-3">
                <div className="text-sm text-accent/70 mb-1">Preview</div>
                <img src={avatar} alt="Avatar" width="256" height="256" className="w-32 h-32 md:w-40 md:h-40 rounded-xl object-cover border border-black/10" />
              </div>
            )}
            <div className="mt-4">
              <button type="button" className="btn" onClick={generatePersona} disabled={loading}>
                <svg height="20" width="20" fill="#FFFFFF" viewBox="0 0 24 24" data-name="Layer 1" id="Layer_1" className="sparkle">
                  <path d="M10,21.236,6.755,14.745.264,11.5,6.755,8.255,10,1.764l3.245,6.491L19.736,11.5l-6.491,3.245ZM18,21l1.5,3L21,21l3-1.5L21,18l-1.5-3L18,18l-3,1.5ZM19.333,4.667,20.5,7l1.167-2.333L24,3.5,21.667,2.333,20.5,0,19.333,2.333,17,3.5Z"></path>
                </svg>
                <span className="text">{loading ? 'GENERATING...' : 'GENERATE PERSONA & AVATAR'}</span>
              </button>
            </div>
            {loading && (
              <div className="flex flex-col items-center justify-center py-4" role="status" aria-live="polite">
                <svg className="animate-spin h-8 w-8 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p className="mt-2 text-accent/70">Hold on, this may take a while...</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <div className="card p-8 text-center">
            <h3 className="text-xl font-semibold">Your Persona & Avatar</h3>
            <div className="mt-3 space-y-2">
            {avatar && (
              <div className="mt-3 flex flex-col items-center justify-center">
                <img src={avatar} alt="Avatar" width="512" height="512" className="w-64 h-64 md:w-80 md:h-80 rounded-xl object-cover border border-black/10" />
                <a
                  href={avatar}
                  download="avatar.png"
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white hover:bg-accentDark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  Download Avatar
                </a>
              </div>
            )}
            <div className="text-2xl font-semibold">{result.persona_type}</div>
            <div className="text-accent/80">Logic {result.attributes.logic} • Creativity {result.attributes.creativity} • Communication {result.attributes.communication}</div>
            
            <div className="mt-3 text-left flex items-center justify-between">
              <div className="text-accent font-medium mb-1">Starting Quests</div>
              <a href="/dashboard" className="btn-primary">Begin your Journey!</a>
            </div>
            <div>
              <ul className="list-disc pl-5 text-accent/80 text-left">
                {(result.starting_quests || []).map((q, i)=> (
                  <li key={i}>{q.title || 'Quest'}</li>
                ))}
              </ul>
            </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="btn-primary" onClick={()=>setResult(null)}>Edit Inputs</button>
              <button className="btn-primary" onClick={generatePersona} disabled={avatarTries >= 2}>{avatarTries >= 2 ? 'Regen limit reached' : 'Regenerate Persona & Avatar'}</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}


