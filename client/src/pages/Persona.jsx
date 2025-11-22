import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';
import { getApiBase } from '../utils/getApiBase.js';

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
  const [toast, setToast] = useState({ visible: false, kind: 'info', title: '', subtitle: '' });

  async function generatePersona() {
    // Count only regenerations when a result already exists
    if (result && avatarTries >= 2) return;
    if (result) setAvatarTries(n => n + 1);
    setLoading(true);
    setResult(null);
    try {
      const apiBase = getApiBase();
      let token = '';
      try { token = localStorage.getItem('pq_token') || ''; } catch {}
      const res = await axios.post(`${apiBase}/api/persona/generate`, {
        currentRole,
        proficiency,
        interests,
        strengths,
        goals,
        imageBase64: refImage || ''
      }, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
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
      const status = e?.response?.status;
      if (status === 429) {
        setToast({ visible: true, kind: 'error', title: 'Generation limit reached', subtitle: 'Please try again in 24 hours.' });
        window.clearTimeout(window.__persona_toast_timer__);
        window.__persona_toast_timer__ = window.setTimeout(() => setToast(t => ({ ...t, visible: false })), 3500);
      } else {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }

  async function generateAvatar() {
    if (avatarTries >= 3) return;
    try {
      const apiBase = getApiBase();
      const promptMeta = { currentRole, proficiency, interests, strengths, goals };
      let token = '';
      try { token = localStorage.getItem('pq_token') || ''; } catch {}
      const r = await axios.post(`${apiBase}/api/avatar/generate`, {
        userId: user?.id || 'local-user',
        promptMeta,
        imageBase64: refImage || ''
      }, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
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
      {/* Error toast for generation limits */}
      <div className="xp-toast-wrapper" aria-live="polite" aria-atomic="true">
        <div className={`xp-toast-card ${toast.visible ? 'xp-show' : ''} ${toast.kind === 'error' ? 'xp-error' : ''}`} role="status">
          <svg className="xp-wave" viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z" fillOpacity="1"></path>
          </svg>
          <div className="xp-icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" strokeWidth="0" fill="currentColor" stroke="currentColor" className="xp-icon">
              <path d="M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 272c13.3 0 24 10.7 24 24s-10.7 24-24 24s-24-10.7-24-24s10.7-24 24-24zm-32-160c0-17.7 14.3-32 32-32s32 14.3 32 32v96c0 17.7-14.3 32-32 32s-32-14.3-32-32V160z"></path>
            </svg>
          </div>
          <div className="xp-message-text-container">
            <p className="xp-message-text">{toast.title}</p>
            <p className="xp-sub-text">{toast.subtitle}</p>
          </div>
          <svg onClick={() => setToast(t => ({ ...t, visible: false }))} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" strokeWidth="0" fill="none" stroke="currentColor" className="xp-cross-icon" role="button" aria-label="Dismiss notification">
            <path fill="currentColor" d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" clipRule="evenodd" fillRule="evenodd"></path>
          </svg>
        </div>
      </div>
      <h2 className="heading mb-4">Persona Builder</h2>
      {!result ? (
        <div className="card p-6">
          <div>
            <label htmlFor="currentRole" className="block text-base text-accent/80 mb-1">Current Role</label>
            <textarea
              id="currentRole"
              rows="2"
              className="input text-sm leading-6 resize-none md:rounded-full"
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
          <div className="card p-6 md:p-8 text-center">
            <h3 className="text-xl font-semibold">Your Persona & Avatar</h3>
            <div className="mt-3 space-y-2">
            {avatar && (
              <div className="mt-3 flex flex-col items-center justify-center">
                <img src={avatar} alt="Avatar" width="512" height="512" className="w-56 h-56 md:w-80 md:h-80 rounded-xl object-cover border border-black/10" />
                <a
                  href={avatar}
                  download="avatar.png"
                  className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-accent text-main hover:bg-accentDark focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  aria-label="Download avatar"
                >
                  <img src="/download.svg" alt="" className="h-5 w-5 md:hidden" />
                  <span className="hidden md:inline">Download Avatar</span>
                </a>
              </div>
            )}
            <div className="text-2xl font-semibold">{result.persona_type}</div>
            <div className="text-accent/80">Logic {result.attributes.logic} • Creativity {result.attributes.creativity} • Communication {result.attributes.communication}</div>
            
            <div className="mt-3 text-left flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-accent font-medium mb-1 sm:mb-0">Starting Quests</div>
              <a href="/dashboard" className="btn-primary self-start">Begin your Journey!</a>
            </div>
            <div className="mt-1">
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

