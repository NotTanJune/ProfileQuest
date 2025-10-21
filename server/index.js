import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import mongoSanitize from 'express-mongo-sanitize';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const BASE_PORT = parseInt(process.env.PORT || '5000', 10);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/profilequest';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_EMAILS = new Set(String(process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// Basic CORS (tune origin in production)
app.use(cors({ origin: true, credentials: true }));
// Prevent HTTP parameter pollution
app.use(hpp());
// Sanitize Mongo query operators
app.use(mongoSanitize());

// Body parsing
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Global rate limit (per IP) to reduce DDoS impact
const globalLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

// Speed limiter for expensive endpoints
const expensiveSpeed = slowDown({ windowMs: 60 * 1000, delayAfter: 20, delayMs: (hits) => Math.min(2000, hits * 50) });

// Targeted rate limiter for generation endpoints
const genLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// MongoDB connection
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error', err));

// Schemas & Models
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  name: { type: String, default: '' },
}, { timestamps: true });

const ProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
  email: { type: String, default: '' },
  name: { type: String, default: 'Adventurer' },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 0 },
  next_level_xp: { type: Number, default: 100 },
}, { timestamps: true });

const PersonaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
  persona_type: { type: String, required: true },
  attributes: { type: mongoose.Schema.Types.Mixed, required: true },
  avatar: { type: String, default: '' },
}, { timestamps: true });

const QuestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  category: { type: String, default: '' },
  xp_reward: { type: Number, default: 100 },
  status: { type: String, default: 'available' },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
QuestSchema.index({ userId: 1, title: 1 }, { unique: true });

const User = mongoose.model('User', UserSchema);
const Profile = mongoose.model('Profile', ProfileSchema);
const Persona = mongoose.model('Persona', PersonaSchema);
const Quest = mongoose.model('Quest', QuestSchema);

// Generation logs for rate limiting
const GenLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  ip: { type: String, index: true },
  kind: { type: String, enum: ['persona', 'avatar'], index: true },
  created_at: { type: Date, default: Date.now, index: true },
});
const GenLog = mongoose.model('GenLog', GenLogSchema);

// Helpers
function errorToString(e) {
  try {
    if (!e) return 'Unknown error';
    if (typeof e === 'string') return e;
    if (e.message) return e.message;
    if (e.stack) return String(e.stack);
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

function toObjectId(id) {
  try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
}

function signToken(user) {
  return jwt.sign({ userId: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, _res, next) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
    } catch {}
  }
  next();
}

app.use(authMiddleware);

function isAdminReq(req) {
  try {
    const email = String(req?.user?.email || '').toLowerCase();
    return email && ADMIN_EMAILS.has(email);
  } catch {
    return false;
  }
}

async function enforceGenerationLimit(req, kind) {
  // Returns null if allowed, or an error object { status, error }
  try {
    if (isAdminReq(req)) return null;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const uid = toObjectId(req?.user?.userId || null);
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || '').slice(0, 100);
    const match = uid ? { userId: uid } : { ip };
    // Combined limit across persona+avatar: do not filter on kind
    const recentCount = await GenLog.countDocuments({ ...match, created_at: { $gte: since } });
    if (recentCount >= 3) {
      return { status: 429, error: 'Daily generation limit reached (3). Please try again in 24 hours.' };
    }
    return null;
  } catch (e) {
    // On error, fail open but log
    console.warn('rate-limit check failed', e?.message || e);
    return null;
  }
}

async function logGeneration(req, kind) {
  try {
    const uid = toObjectId(req?.user?.userId || null);
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || '').slice(0, 100);
    await GenLog.create({ userId: uid || undefined, ip, kind });
  } catch {}
}

// Groq / Google AI clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const googleAI = GOOGLE_API_KEY ? new GoogleGenAI({ apiKey: GOOGLE_API_KEY }) : null;

// Sanitize AI outputs: remove tool citation markers like  or [3†L12-L13]
function stripCitations(txt) {
  if (txt === undefined || txt === null) return '';
  let s = String(txt);
  // Remove fullwidth citation brackets used by some web-search tools
  s = s.replace(/【[^】]*】/g, '');
  // Remove ASCII-bracketed citations that contain a dagger, weird encoding, or L<digits>
  s = s.replace(/\[[^\]]*(?:†|ﾃ‘|L\d+)[^\]]*\]/g, '');
  // Collapse repeated whitespace
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

function sanitizeQuest(q) {
  if (!q || typeof q !== 'object') return q;
  return {
    ...q,
    title: stripCitations(q.title),
    description: stripCitations(q.description),
  };
}

// Authoritative progress computation based on completed quests
async function computeProgressFromQuests(uid) {
  const rows = await Quest.find({ userId: uid, status: 'completed' }).select('xp_reward').lean();
  const totalXp = (rows || []).reduce((acc, r) => acc + (r?.xp_reward || 0), 0);
  let level = 1;
  let next = 100;
  let remaining = totalXp;
  while (remaining >= next) {
    remaining -= next;
    level += 1;
    next = Math.round(next * 1.5);
  }
  return { level, xp: remaining, next_level_xp: next, total_xp: totalXp };
}

// Build time buckets for XP history
function buildXpBuckets(range, now = new Date()) {
  const buckets = [];
  const clampToMidnight = (d) => { const x = new Date(d); x.setMinutes(0, 0, 0); x.setHours(0); return x; };
  const startOfMonth = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0); return x; };
  const endOfMonth = (d) => { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); return x; };
  if (range === 'daily') {
    const end = new Date(now);
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    let cursor = new Date(start);
    for (let i = 0; i < 12; i++) {
      const binStart = new Date(cursor);
      const binEnd = new Date(binStart.getTime() + 2 * 60 * 60 * 1000);
      const label = `${binStart.getHours().toString().padStart(2, '0')}:00`;
      buckets.push({ start: binStart, end: binEnd, label, xp: 0 });
      cursor = binEnd;
    }
    return buckets;
  }
  if (range === 'weekly') {
    const end = clampToMidnight(now);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    for (let i = 0; i < 7; i++) {
      const binStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 0, 0, 0, 0);
      const binEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1, 0, 0, 0, 0);
      const label = binStart.toLocaleDateString('en-US', { weekday: 'short' });
      buckets.push({ start: binStart, end: binEnd, label, xp: 0 });
    }
    return buckets;
  }
  if (range === 'monthly') {
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weekBoundaries = [
      { day: 1, label: 'W1' },
      { day: 8, label: 'W2' },
      { day: 15, label: 'W3' },
      { day: 22, label: 'W4' },
    ];
    for (let i = 0; i < 4; i++) {
      const startDay = weekBoundaries[i].day;
      const endDay = i < 3 ? weekBoundaries[i + 1].day : (monthEnd.getDate() + 1);
      const binStart = new Date(monthStart.getFullYear(), monthStart.getMonth(), startDay, 0, 0, 0, 0);
      const binEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), endDay, 0, 0, 0, 0);
      buckets.push({ start: binStart, end: binEnd, label: weekBoundaries[i].label, xp: 0 });
    }
    return buckets;
  }
  // yearly
  const year = now.getFullYear();
  for (let m = 0; m < 12; m++) {
    const binStart = new Date(year, m, 1, 0, 0, 0, 0);
    const binEnd = new Date(year, m + 1, 1, 0, 0, 0, 0);
    const label = binStart.toLocaleDateString('en-US', { month: 'short' });
    buckets.push({ start: binStart, end: binEnd, label, xp: 0 });
  }
  return buckets;
}

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const existing = await User.findOne({ email: String(email).toLowerCase() }).lean();
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const passwordHash = await bcrypt.hash(String(password), 10);
    const user = await User.create({ email: String(email).toLowerCase(), passwordHash, name: name || '' });
    await Profile.create({ userId: user._id, email: user.email, name: name?.trim() || (email.split('@')[0]) || 'Adventurer' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name || '' } });
  } catch (e) {
    res.status(500).json({ error: errorToString(e) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id.toString(), email: user.email, name: user.name || '' } });
  } catch (e) {
    res.status(500).json({ error: errorToString(e) });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const uid = req.user?.userId;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const user = await User.findById(uid).lean();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ user: { id: user._id.toString(), email: user.email, name: user.name || '' } });
  } catch (e) {
    res.status(500).json({ error: errorToString(e) });
  }
});

// Profiles upsert (optional, kept for compatibility)
app.post('/api/profiles/upsert', async (req, res) => {
  try {
    const { id, email, name } = req.body || {};
    const userId = toObjectId(id);
    if (!userId || !email || !name) return res.status(400).json({ error: 'Missing id, email, or name' });
    await Profile.updateOne({ userId }, { $set: { email, name } }, { upsert: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to upsert profile' });
  }
});

// Lookup profile by email or name
app.get('/api/profiles/by', async (req, res) => {
  try {
    const email = req.query.email ? String(req.query.email).toLowerCase() : '';
    const name = req.query.name ? String(req.query.name) : '';
    const filter = {};
    if (email) filter.email = email;
    if (name) filter.name = name;
    const data = await Profile.find(filter).limit(20).lean();
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Minimal quests generator using Groq
app.post('/api/quests/generate', async (req, res) => {
  try {
    const { personaType = 'Software Developer', level = 1, userId, existingTitles = [], existing = [] } = req.body || {};

    // Resolve effective persona type
    let effectivePersonaType = personaType;
    if ((!effectivePersonaType || effectivePersonaType === 'Human Being') && userId) {
      try {
        const uid = toObjectId(userId);
        if (uid) {
          const personaRow = await Persona.findOne({ userId: uid }).select('persona_type').lean();
        if (personaRow?.persona_type) effectivePersonaType = personaRow.persona_type;
        }
      } catch {}
    }

    // Gather existing quests (titles + brief)
    let existingList = [];
    try {
      if (Array.isArray(existing) && existing.length) {
        existingList = existing.map(q => ({ title: q.title, description: q.description, category: q.category }));
      } else if (Array.isArray(existingTitles) && existingTitles.length) {
        existingList = existingTitles.map(t => ({ title: String(t) }));
      } else if (userId) {
        const uid = toObjectId(userId);
        if (uid) {
          const rows = await Quest.find({ userId: uid }).select('title description category').sort({ title: 1 }).lean();
          existingList = (rows || []).map(q => ({ title: q.title, description: q.description, category: q.category }));
        }
      }
    } catch {}

    const existingJson = JSON.stringify(existingList || []).slice(0, 8000); // cap to keep prompt reasonable

    const prompt = `Generate 5 career quests for a ${effectivePersonaType} at level ${level}.
Categories: Skill Development, Portfolio Building, Networking, Thought Leadership

Return JSON array:
[
  {"title":"...","description":"...","category":"...","xp_reward":100}
]

Rules:
- Read these existing quests and DO NOT generate duplicates or near-duplicates (no paraphrases, no same intent):
${existingJson}
- Prefer fresh, more advanced tasks appropriate for level ${level} and the persona ${effectivePersonaType}.
- Keep titles unique, concise, and actionable.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = completion?.choices?.[0]?.message?.content ?? '[]';
    let quests = [];
    const tryParse = (txt) => {
      try { const parsed = JSON.parse(txt); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    };
    quests = tryParse(content);
    if (!quests.length) {
      // try to extract first JSON array substring
      const m = content.match(/\[[\s\S]*\]/);
      if (m) quests = tryParse(m[0]);
    }
    if (!quests.length) {
      // deterministic fallback
      const cats = ['Skill Development', 'Portfolio Building', 'Networking', 'Thought Leadership', 'Skill Development'];
      quests = Array.from({ length: 5 }, (_, i) => ({
        title: `${effectivePersonaType} L${level} Quest ${i + 1}`,
        description: `A level ${level} task to advance as a ${effectivePersonaType}.`,
        category: cats[i % cats.length],
        xp_reward: Math.max(50, Math.round(100 * Math.pow(1.15, level - 1)))
      }));
    }

    // Final dedup against existing titles (exact/normalized) as a safety net
    const existingSet = new Set((existingList || []).map(q => String(q.title || '').trim().toLowerCase()).filter(Boolean));
    const seenNew = new Set();
    quests = quests.filter(q => {
      const key = String(q?.title || '').trim().toLowerCase();
      if (!key) return false;
      if (existingSet.has(key) || seenNew.has(key)) return false;
      seenNew.add(key);
      return true;
    });

    // Final sanitation pass
    quests = (quests || []).map(sanitizeQuest);
    res.json({ quests });
  } catch (error) {
    console.error('Groq error', error);
    res.status(500).json({ error: 'Failed to generate quests' });
  }
});

// Persist persona for a user
app.post('/api/persona/save', async (req, res) => {
  try {
    const { userId, persona, avatar } = req.body || {};
    const uid = toObjectId(userId);
    if (!uid || !persona) return res.status(400).json({ error: 'Missing userId or persona' });
    await Persona.updateOne(
      { userId: uid },
      { $set: { persona_type: persona.persona_type, attributes: persona.attributes, avatar: avatar || '' } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('persona save error', e);
    res.status(500).json({ error: 'Failed to save persona' });
  }
});

// Persist quests for a user
app.post('/api/quests/save', async (req, res) => {
  try {
    const { userId, quests } = req.body || {};
    const uid = toObjectId(userId);
    if (!uid || !Array.isArray(quests)) return res.status(400).json({ error: 'Missing userId or quests' });
    const ops = quests.map((q) => ({
      updateOne: {
        filter: { userId: uid, title: q.title },
        update: { $set: {
          userId: uid,
      title: q.title,
          description: q.description || '',
          category: q.category || '',
      xp_reward: q.xp_reward || 100,
      status: 'available',
        } },
        upsert: true,
      }
    }));
    if (ops.length) await Quest.bulkWrite(ops);
    res.json({ ok: true });
  } catch (e) {
    console.error('quests save error', e);
    res.status(500).json({ error: 'Failed to save quests' });
  }
});

// Fetch persona for a user
app.get('/api/persona', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const uid = toObjectId(userId);
    if (!uid) return res.status(400).json({ error: 'Missing userId' });
    const data = await Persona.findOne({ userId: uid }).select('persona_type attributes avatar').lean();
      res.json({ persona: data || null });
  } catch (e) {
    console.error('persona fetch error', e);
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
});

// Fetch quests for a user
app.get('/api/quests', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const statusFilter = req.query.status ? String(req.query.status) : 'available';
    const uid = toObjectId(userId);
    if (!uid) return res.status(400).json({ error: 'Missing userId' });
    const filter = { userId: uid };
    if (statusFilter && statusFilter !== 'all') filter.status = statusFilter;
    const data = await Quest.find(filter).select('title description category xp_reward status').sort({ title: 1 }).lean();
      res.json({ quests: data || [] });
  } catch (e) {
    console.error('quests fetch error', e);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// Delete a quest for a user
app.post('/api/quests/delete', async (req, res) => {
  try {
    const { userId, title } = req.body || {};
    const uid = toObjectId(userId);
    if (!uid || !title) return res.status(400).json({ error: 'Missing userId or title' });
    await Quest.deleteOne({ userId: uid, title });
    // Recompute progress and store
    const computed = await computeProgressFromQuests(uid);
    const prof = await Profile.findOne({ userId: uid }).lean();
    const email = prof?.email || `${userId}@local`;
    const name = prof?.name || 'Adventurer';
    await Profile.updateOne({ userId: uid }, { $set: { email, name, level: computed.level, xp: computed.xp, next_level_xp: computed.next_level_xp } }, { upsert: true });
    res.json({ ok: true, profile: { level: computed.level, xp: computed.xp, nextLevelXp: computed.next_level_xp } });
  } catch (e) {
    console.error('quests delete error', e);
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});

// Fetch progress summary
app.get('/api/progress', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const uid = toObjectId(userId);
    if (!uid) return res.status(400).json({ error: 'Missing userId' });
    // Authoritative compute from completed quests
    const computed = await computeProgressFromQuests(uid);
    const data = await Profile.findOne({ userId: uid }).select('email name').lean();
    const email = data?.email || `${userId}@local`;
    const name = data?.name || 'Adventurer';
    // Persist the computed values to keep DB in sync, even if quests were edited manually
    await Profile.updateOne(
      { userId: uid },
      { $set: { email, name, level: computed.level, xp: computed.xp, next_level_xp: computed.next_level_xp } },
      { upsert: true }
    );
    res.json({ progress: { email, name, level: computed.level, xp: computed.xp, next_level_xp: computed.next_level_xp, total_xp: computed.total_xp } });
  } catch (e) {
    console.error('progress fetch error', e);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// XP history aggregated by time range
app.get('/api/xp/history', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const uid = toObjectId(userId);
    if (!uid) return res.status(400).json({ error: 'Missing userId' });
    const rangeRaw = String(req.query.range || 'weekly').toLowerCase();
    const allowed = new Set(['daily', 'weekly', 'monthly', 'yearly']);
    const range = allowed.has(rangeRaw) ? rangeRaw : 'weekly';
    const now = new Date();
    const buckets = buildXpBuckets(range, now);
    if (!buckets.length) return res.json({ range, buckets: [] });
    const windowStart = buckets[0].start;
    const windowEnd = buckets[buckets.length - 1].end;
    const rows = await Quest.find({
      userId: uid,
      status: 'completed',
      updated_at: { $gte: windowStart, $lt: windowEnd },
    })
      .select('xp_reward updated_at')
      .sort({ updated_at: 1 })
      .lean();

    for (const r of rows || []) {
      const t = new Date(r.updated_at).getTime();
      for (const b of buckets) {
        const bs = b.start.getTime();
        const be = b.end.getTime();
        if (t >= bs && t < be) { b.xp += Number(r.xp_reward || 0); break; }
      }
    }

    const out = (buckets || []).map(b => ({
      label: b.label,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
      xp: b.xp,
    }));
    res.json({ range, buckets: out });
  } catch (e) {
    console.error('xp history error', e);
    res.status(500).json({ error: 'Failed to fetch XP history' });
  }
});

// Mark a quest as completed for a user
app.post('/api/quests/complete', async (req, res) => {
  try {
    const { userId, title, xpReward = 0 } = req.body || {};
    const uid = toObjectId(userId);
    if (!uid || !title) return res.status(400).json({ error: 'Missing userId or title' });
    const data = await Quest.findOneAndUpdate(
      { userId: uid, title },
      { $set: { status: 'completed' } },
      { new: true }
    ).lean();
    const computed = await computeProgressFromQuests(uid);
    const prof = await Profile.findOne({ userId: uid }).lean();
    const email = prof?.email || `${userId}@local`;
    const name = prof?.name || 'Adventurer';
    await Profile.updateOne({ userId: uid }, { $set: { email, name, level: computed.level, xp: computed.xp, next_level_xp: computed.next_level_xp } }, { upsert: true });
    res.json({ ok: true, quest: data || null, profile: { level: computed.level, xp: computed.xp, nextLevelXp: computed.next_level_xp } });
  } catch (e) {
    console.error('quests complete error', e);
    res.status(500).json({ error: 'Failed to complete quest' });
  }
});

// Persona + quests generator using Groq based on user inputs
app.post('/api/persona/generate', async (req, res) => {
  try {
    const limitErr = await enforceGenerationLimit(req, 'persona');
    if (limitErr) return res.status(limitErr.status).json({ error: limitErr.error });
    // Apply endpoint-specific rate limiting and slowdown
    // Note: middleware-style usage inside handler for simplicity in this file
    // (would normally be app.post('/api/persona/generate', genLimiter, expensiveSpeed, handler))
    const { interests = '', strengths = '', goals = '', currentRole = '', proficiency = 3, imageBase64 = '' } = req.body || {};
    const prompt = `Analyze this user profile and create a career persona with quests. Use web search for current industry trends.

USER PROFILE:
Current Role: ${currentRole}
Proficiency: ${proficiency}/5 (1=beginner, 5=expert)
Interests: ${interests}
Strengths: ${strengths}
Goals: ${goals}

INSTRUCTIONS:
1. Choose the best-fit persona: Software Developer, Data Scientist, Product Manager, UX Designer, Researcher, or Marketing Specialist
2. Score 5 persona-specific attributes (1-10) based on proficiency level ${proficiency}/5
3. Generate 5 actionable quests using current 2024-2025 industry practices

OUTPUT FORMAT (JSON only, no markdown):
{
  "persona": {
    "persona_type": "exact persona name",
    "description": "why this fits the user (2-3 sentences)",
    "attributes": {
      "attr1_name": score,
      "attr2_name": score,
      "attr3_name": score,
      "attr4_name": score,
      "attr5_name": score
    }
  },
  "quests": [
    {
      "title": "specific action",
      "description": "what to do, how to do it, success criteria",
      "category": "Skill Development | Portfolio Building | Networking | Thought Leadership",
      "xp_reward": 100-300,
      "estimated_time": "time range"
    }
  ]
}

ATTRIBUTE NAMES BY PERSONA:
- Software Developer: Code Quality, Problem Solving, System Design, Debugging Skills, Collaboration
- Data Scientist: Statistical Thinking, Programming Proficiency, Data Storytelling, ML Expertise, Business Acumen
- Product Manager: Strategic Vision, User Empathy, Stakeholder Management, Data-Driven Decision Making, Execution Excellence
- UX Designer: User Research, Visual Design, Interaction Design, Prototyping Speed, Design Thinking
- Researcher: Critical Analysis, Research Methodology, Academic Writing, Domain Expertise, Intellectual Curiosity
- Marketing Specialist: Content Creation, Audience Insight, Campaign Strategy, Analytics Proficiency, Creative Thinking

SCORING GUIDE (based on proficiency ${proficiency}/5):
Proficiency 1: scores 2-4 | Proficiency 2: scores 3-5 | Proficiency 3: scores 4-6
Proficiency 4: scores 5-7 | Proficiency 5: scores 6-9

QUEST DISTRIBUTION:
- 2 Skill Development quests (100-150 XP each)
- 1 Portfolio Building quest (200-250 XP)
- 1 Networking quest (100-150 XP)
- 1 Thought Leadership quest (200-300 XP)

QUEST QUALITY CHECKLIST:
✓ Specific and actionable (not vague)
✓ Appropriate for proficiency level ${proficiency}/5
✓ Uses current tools/platforms (2024-2025)
✓ Clear success criteria
✓ Realistic time estimates
✓ Relevant to persona type and user goals`;

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
      reasoning_effort: 'medium',
      tools: [{ "type": "browser_search" }]
    });

    const content = completion?.choices?.[0]?.message?.content ?? '{}';
    let payload = {};
    try {
      payload = JSON.parse(content);
    } catch {
      payload = {};
    }

    const persona = payload?.persona ?? {
      persona_type: 'Adventurer',
      attributes: { logic: 5, creativity: 5, communication: 5 },
    };
    let quests = Array.isArray(payload?.quests) ? payload.quests : [];
    // Clean citation artifacts from model outputs
    quests = (quests || []).map(sanitizeQuest);
    const personaClean = {
      ...persona,
      persona_type: stripCitations(persona?.persona_type || ''),
      description: stripCitations(persona?.description || ''),
    };

    // Also attempt avatar via Gemini if configured
    let avatarDataUrl = '';
    if (googleAI) {
      try {
        const model = 'gemini-2.5-flash-image';
        const parts = [];
        const styleHints = ['cartoon', 'anime', 'pixel', 'vintage', 'modern'];
        const chosenStyle = styleHints[Math.floor(Math.random() * styleHints.length)];
        const avatarPrompt = `Create a 1024x1024 square avatar in ${chosenStyle} style based on this persona: ${JSON.stringify(persona)}. Consider role=${currentRole}, proficiency=${proficiency}/5, interests=${interests}, strengths=${strengths}, goals=${goals}.`;
        parts.push({ text: avatarPrompt });
        if (imageBase64) {
          const commaIdx = imageBase64.indexOf(',');
          const b64 = commaIdx >= 0 ? imageBase64.slice(commaIdx + 1) : imageBase64;
          const mime = imageBase64.includes('image/jpeg') ? 'image/jpeg' : 'image/png';
          parts.push({ inlineData: { data: b64, mimeType: mime } });
        }
        const resp = await googleAI.models.generateContent({ model, contents: [{ role: 'user', parts }] });
        const cand = resp?.candidates?.[0]?.content?.parts || [];
        for (const part of cand) {
          if (part?.inlineData?.data) {
            avatarDataUrl = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
      } catch {}
    }
    if (!avatarDataUrl) {
      // fallback dicebear
      const seed = encodeURIComponent((currentRole || strengths || goals || 'seed').slice(0, 50));
      const diceUrl = `https://api.dicebear.com/7.x/thumbs/png?seed=${seed}&size=256&shapeColor=9F8383&backgroundColor=FFDAB3`;
      try {
        const r = await fetch(diceUrl);
        const buf = await r.arrayBuffer();
        const b64 = Buffer.from(buf).toString('base64');
        avatarDataUrl = `data:image/png;base64,${b64}`;
      } catch {}
    }

    try { await logGeneration(req, 'persona'); } catch {}
    res.json({ persona: personaClean, quests, avatar: avatarDataUrl });
  } catch (error) {
    console.error('Groq persona error', error);
    res.status(500).json({ error: 'Failed to generate persona' });
  }
});

// Avatar generation using Nano Banana (optional). Falls back to DiceBear if not configured.
app.post('/api/avatar/generate', async (req, res) => {
  try {
    const limitErr = await enforceGenerationLimit(req, 'avatar');
    if (limitErr) return res.status(limitErr.status).json({ error: limitErr.error });
    const { userId = '', promptMeta = {}, imageBase64 = '', style } = req.body || {};
    const { currentRole = '', proficiency = 3, interests = '', strengths = '', goals = '' } = promptMeta || {};

    const chosenStyle = 'unicode emoji';
    const prompt = `Create a 1024x1024 square picture in ${chosenStyle} style. Imagine that this is a badge and the picture is the identity of the user, let your imagination run wild.
Use these details: role=${currentRole}, proficiency=${proficiency}/5, interests=${interests}, strengths=${strengths}, goals=${goals}.
Return only the image based on the face likeness if a reference image is provided. Do not include any text in the image at all.
Make sure it looks like a unicode emoji`;

    // Prefer Google Gemini image generation if configured
    if (googleAI) {
      try {
        const model = 'gemini-2.5-flash-image';
        const parts = [];
        parts.push({ text: `${prompt}\nGenerate exactly 256x256 square.` });
        if (imageBase64) {
          const commaIdx = imageBase64.indexOf(',');
          const b64 = commaIdx >= 0 ? imageBase64.slice(commaIdx + 1) : imageBase64;
          // Best-effort mime guess
          const mime = imageBase64.includes('image/jpeg') ? 'image/jpeg' : 'image/png';
          parts.push({ inlineData: { data: b64, mimeType: mime } });
        }
        const response = await googleAI.models.generateContent({ model, contents: [{ role: 'user', parts }] });
        const cand = response?.candidates?.[0]?.content?.parts || [];
        for (const part of cand) {
          if (part?.inlineData?.data) {
            const data = part.inlineData.data;
            return res.json({ image: `data:image/png;base64,${data}` , used: 'gemini', style: chosenStyle });
          }
        }
        // If the model responds with text URL or similar, attempt to return empty to fallback
      } catch (e) {
        console.warn('Gemini image gen failed, falling back', e?.message || e);
      }
    }

    // Fallback: use DiceBear avatar, return as data URL
    const seed = encodeURIComponent((userId || currentRole || strengths || goals || 'seed').slice(0, 50));
    const diceUrl = `https://api.dicebear.com/7.x/thumbs/png?seed=${seed}&size=256&shapeColor=9F8383&backgroundColor=FFDAB3`;
    try {
      const r = await fetch(diceUrl);
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      try { await logGeneration(req, 'avatar'); } catch {}
      return res.json({ image: `data:image/png;base64,${b64}`, used: 'dicebear', style: chosenStyle });
    } catch {
      return res.json({ image: '', used: 'none', style: chosenStyle });
    }
  } catch (error) {
    console.error('avatar generate error', error);
    res.status(500).json({ error: 'Failed to generate avatar' });
  }
});

function attemptListen(port, maxAttempts = 5) {
  const server = app
    .listen(port, () => {
      console.log(`ProfileQuest API listening on https://profilequest-3feeae1dd6a1.herokuapp.com:${port}`);
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE' && maxAttempts > 0) {
        const next = port + 1;
        console.warn(`Port ${port} in use, retrying on ${next}...`);
        setTimeout(() => attemptListen(next, maxAttempts - 1), 300);
      } else {
        console.error('Server failed to start:', err);
      }
    });
  return server;
}

// Serve client build (SPA) in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// Fallback to index.html for client-side routed paths
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  try {
    return res.sendFile(path.join(clientDist, 'index.html'));
  } catch {
    return res.status(404).send('Not found');
  }
});

attemptListen(BASE_PORT);


