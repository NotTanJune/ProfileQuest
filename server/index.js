import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Groq from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

const app = express();
const BASE_PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Supabase server client (service role for server-side DB ops if needed)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';
const googleAI = GOOGLE_API_KEY ? new GoogleGenAI({ apiKey: GOOGLE_API_KEY }) : null;

// Optional direct Postgres connection for automatic table creation
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
let dbPool = null;
if (dbUrl) {
  try {
    dbPool = new Pool({
      connectionString: dbUrl,
      max: 2,
      ssl: { rejectUnauthorized: false }, // required for Supabase
    });
  } catch (e) {
    console.warn('Failed to init Postgres pool', e?.message || e);
  }
}

async function ensureTables() {
  if (!dbPool) return false;
  let client;
  try {
    client = await dbPool.connect();
    // profiles table with progress columns
    await client.query(`
      create table if not exists public.profiles (
        id uuid primary key,
        email text,
        name text,
        level integer default 1,
        xp integer default 0,
        next_level_xp integer default 100,
        updated_at timestamptz default now()
      );
    `);
    await client.query(`alter table public.profiles add column if not exists level integer default 1;`);
    await client.query(`alter table public.profiles add column if not exists xp integer default 0;`);
    await client.query(`alter table public.profiles add column if not exists next_level_xp integer default 100;`);
    await client.query(`alter table public.profiles add column if not exists updated_at timestamptz default now();`);
    // personas table
    await client.query(`
      create table if not exists public.personas (
        user_id text primary key,
        persona_type text not null,
        attributes jsonb not null,
        avatar text,
        updated_at timestamptz default now()
      );
    `);
    // add avatar column if missing
    await client.query(`alter table public.personas add column if not exists avatar text;`);
    // quests table
    await client.query(`
      create table if not exists public.quests (
        id bigserial primary key,
        user_id text not null,
        title text not null,
        description text,
        category text,
        xp_reward integer default 100,
        status text default 'available',
        created_at timestamptz default now()
      );
    `);
    // unique constraint for upsert support
    await client.query(`
      create unique index if not exists quests_user_id_title_key on public.quests (user_id, title);
    `);
    return true;
  } catch (e) {
    console.warn('ensureTables skipped:', errorToString(e));
    return false;
  } finally {
    try { client?.release?.(); } catch {}
  }
}

function isMissingTableError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('could not find the table') || msg.includes('relation') && msg.includes('does not exist');
}

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

function isMissingColumnError(err) {
  const code = err?.code || err?.original?.code;
  const msg = String(err?.message || err || '').toLowerCase();
  return code === '42703' || msg.includes('column') && msg.includes('does not exist');
}

function isNotNullViolation(err) {
  const code = err?.code || err?.original?.code;
  return code === '23502';
}

async function ensureProfileExists(userId) {
  // Ensure a profiles row with non-null email exists
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, email, name, level, xp, next_level_xp')
      .eq('id', userId)
      .maybeSingle();
    if (existing?.email) return existing;
    let email = existing?.email || '';
    let name = existing?.name || '';
    try {
      const { data: gu } = await supabase.auth.admin.getUserById(userId);
      email = gu?.user?.email || email;
      name = gu?.user?.user_metadata?.name || name;
    } catch {}
    if (!email) email = `${userId}@local`;
    if (!name) name = 'Adventurer';
    const base = {
      id: userId,
      email,
      name,
      level: existing?.level ?? 1,
      xp: existing?.xp ?? 0,
      next_level_xp: existing?.next_level_xp ?? 100,
    };
    const { error: upErr } = await supabase
      .from('profiles')
      .upsert(base, { onConflict: 'id' });
    if (upErr) throw upErr;
    return base;
  } catch (e) {
    return null;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Manually trigger table creation if needed
app.post('/api/db/bootstrap', async (_req, res) => {
  try {
    if (!dbPool) return res.status(400).json({ ok: false, error: 'Missing SUPABASE_DB_URL/DATABASE_URL' });
    const created = await ensureTables();
    if (!created) return res.status(500).json({ ok: false, error: 'Failed to create tables' });
    res.json({ ok: true });
  } catch (e) {
    console.error('bootstrap error', e);
    res.status(500).json({ ok: false, error: errorToString(e) });
  }
});

// Upsert user profile { id, email, name } into a `profiles` table for easy lookup by name/email
app.post('/api/profiles/upsert', async (req, res) => {
  try {
    const { id, email, name } = req.body || {};
    if (!id || !email || !name) {
      return res.status(400).json({ error: 'Missing id, email, or name' });
    }
    const { error } = await supabase
      .from('profiles')
      .upsert({ id, email, name }, { onConflict: 'id' });
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error('profiles upsert error', error);
    res.status(500).json({ error: 'Failed to upsert profile' });
  }
});

// Lookup profile by email or name
app.get('/api/profiles/by', async (req, res) => {
  try {
    const { email, name } = req.query;
    let query = supabase.from('profiles').select('*');
    if (email) query = query.eq('email', String(email));
    if (name) query = query.eq('name', String(name));
    const { data, error } = await query.limit(20);
    if (error) throw error;
    res.json({ data });
  } catch (error) {
    console.error('profiles lookup error', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// Minimal quests generator using Groq
app.post('/api/quests/generate', async (req, res) => {
  try {
    const { personaType = 'Software Developer', level = 1, userId, existingTitles = [], existing = [] } = req.body || {};

    // Resolve effective persona type: prefer explicit, else fetch from DB, else fallback
    let effectivePersonaType = personaType;
    if ((!effectivePersonaType || effectivePersonaType === 'Human Being') && userId) {
      try {
        const { data: personaRow } = await supabase
          .from('personas')
          .select('persona_type')
          .eq('user_id', userId)
          .maybeSingle();
        if (personaRow?.persona_type) effectivePersonaType = personaRow.persona_type;
      } catch {}
    }

    // Gather existing quests (titles + brief) either from request or DB
    let existingList = [];
    try {
      if (Array.isArray(existing) && existing.length) {
        existingList = existing.map(q => ({ title: q.title, description: q.description, category: q.category }));
      } else if (Array.isArray(existingTitles) && existingTitles.length) {
        existingList = existingTitles.map(t => ({ title: String(t) }));
      } else if (userId) {
        const { data } = await supabase
          .from('quests')
          .select('title, description, category')
          .eq('user_id', userId)
          .order('title');
        existingList = (data || []).map(q => ({ title: q.title, description: q.description, category: q.category }));
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

    res.json({ quests });
  } catch (error) {
    console.error('Groq error', error);
    res.status(500).json({ error: 'Failed to generate quests' });
  }
});

// Persist persona for a user (best-effort; succeeds even if table is missing)
app.post('/api/persona/save', async (req, res) => {
  try {
    const { userId, persona, avatar } = req.body || {};
    if (!userId || !persona) {
      return res.status(400).json({ error: 'Missing userId or persona' });
    }
    try {
      const { error } = await supabase
        .from('personas')
        .upsert({
          user_id: userId,
          persona_type: persona.persona_type,
          attributes: persona.attributes,
          avatar: avatar || null,
        }, { onConflict: 'user_id' });
      if (error) throw error;
      return res.json({ ok: true });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) {
          console.warn('persona save: tables missing and ensureTables unavailable');
          return res.status(200).json({ ok: false, note: 'Tables missing; set SUPABASE_DB_URL and call /api/db/bootstrap or create tables manually.' });
        }
        const { error: retryErr } = await supabase
          .from('personas')
          .upsert({
            user_id: userId,
            persona_type: persona.persona_type,
            attributes: persona.attributes,
          }, { onConflict: 'user_id' });
        if (retryErr) throw retryErr;
        return res.json({ ok: true, createdTables: true });
      }
      console.warn('persona save skipped (db)', dbErr?.message || dbErr);
      return res.json({ ok: false, note: 'DB error' });
    }
  } catch (error) {
    console.error('persona save error', error);
    res.status(500).json({ error: 'Failed to save persona' });
  }
});

// Persist quests for a user (best-effort)
app.post('/api/quests/save', async (req, res) => {
  try {
    const { userId, quests } = req.body || {};
    if (!userId || !Array.isArray(quests)) {
      return res.status(400).json({ error: 'Missing userId or quests' });
    }
    const rows = quests.map((q) => ({
      user_id: userId,
      title: q.title,
      description: q.description,
      category: q.category,
      xp_reward: q.xp_reward || 100,
      status: 'available',
    }));
    try {
      const { error } = await supabase
        .from('quests')
        .upsert(rows, { onConflict: 'user_id,title' });
      if (error) throw error;
      return res.json({ ok: true });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) {
          console.warn('quests save: tables missing and ensureTables unavailable');
          return res.status(200).json({ ok: false, note: 'Tables missing; set SUPABASE_DB_URL and call /api/db/bootstrap or create tables manually.' });
        }
        const { error: retryErr } = await supabase
          .from('quests')
          .upsert(rows, { onConflict: 'user_id,title' });
        if (retryErr) throw retryErr;
        return res.json({ ok: true, createdTables: true });
      }
      console.warn('quests save skipped (db)', dbErr?.message || dbErr);
      return res.json({ ok: false, note: 'DB error' });
    }
  } catch (error) {
    console.error('quests save error', error);
    res.status(500).json({ error: 'Failed to save quests' });
  }
});

// Fetch persona for a user
app.get('/api/persona', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
      const { data, error } = await supabase
        .from('personas')
        .select('persona_type, attributes, avatar')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      res.json({ persona: data || null });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) {
          console.warn('persona fetch: tables missing and ensureTables unavailable');
          return res.json({ persona: null, createdTables: false, note: 'Tables missing; set SUPABASE_DB_URL to auto-create.' });
        }
        const { data: d2, error: e2 } = await supabase
          .from('personas')
          .select('persona_type, attributes, avatar')
          .eq('user_id', userId)
          .maybeSingle();
        if (e2) throw e2;
        return res.json({ persona: d2 || null, createdTables: true });
      }
      console.warn('persona fetch skipped (db)', dbErr?.message || dbErr);
      res.json({ persona: null });
    }
  } catch (error) {
    console.error('persona fetch error', error);
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
});

// Fetch quests for a user
app.get('/api/quests', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    const statusFilter = req.query.status ? String(req.query.status) : 'available';
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
      let query = supabase
        .from('quests')
        .select('title, description, category, xp_reward, status')
        .eq('user_id', userId);
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const { data, error } = await query.order('title');
      if (error) throw error;
      res.json({ quests: data || [] });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) {
          console.warn('quests fetch: tables missing and ensureTables unavailable');
          return res.json({ quests: [], createdTables: false, note: 'Tables missing; set SUPABASE_DB_URL to auto-create.' });
        }
        let q2 = supabase
          .from('quests')
          .select('title, description, category, xp_reward, status')
          .eq('user_id', userId);
        if (statusFilter && statusFilter !== 'all') q2 = q2.eq('status', statusFilter);
        const { data: d2, error: e2 } = await q2.order('title');
        if (e2) throw e2;
        return res.json({ quests: d2 || [], createdTables: true });
      }
      console.warn('quests fetch skipped (db)', dbErr?.message || dbErr);
      res.json({ quests: [] });
    }
  } catch (error) {
    console.error('quests fetch error', error);
    res.status(500).json({ error: 'Failed to fetch quests' });
  }
});

// Delete a quest for a user
app.post('/api/quests/delete', async (req, res) => {
  try {
    const { userId, title } = req.body || {};
    if (!userId || !title) return res.status(400).json({ error: 'Missing userId or title' });
    try {
      const { error } = await supabase
        .from('quests')
        .delete()
        .eq('user_id', userId)
        .eq('title', title);
      if (error) throw error;
      return res.json({ ok: true });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) return res.status(500).json({ error: 'Tables missing; set SUPABASE_DB_URL' });
        const { error: retryErr } = await supabase
          .from('quests')
          .delete()
          .eq('user_id', userId)
          .eq('title', title);
        if (retryErr) throw retryErr;
        return res.json({ ok: true, createdTables: true });
      }
      console.error('quests delete error', dbErr);
      return res.status(500).json({ error: 'Failed to delete quest' });
    }
  } catch (error) {
    console.error('quests delete error', error);
    res.status(500).json({ error: 'Failed to delete quest' });
  }
});

// Fetch progress summary
app.get('/api/progress', async (req, res) => {
  try {
    const userId = String(req.query.userId || '');
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, name, level, xp, next_level_xp, total_xp')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw error;

      // compute total XP if not stored: base on level/xp assumption
      let total = data?.total_xp ?? null;
      if (total == null) {
        const level = data?.level ?? 1;
        const xp = data?.xp ?? 0;
        let acc = 0;
        let next = 100;
        for (let i = 1; i < level; i++) {
          acc += next;
          next = Math.round(next * 1.5);
        }
        total = acc + xp;
      }
      res.json({ progress: { ...data, total_xp: total } });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) return res.json({ progress: { level: 1, xp: 0, next_level_xp: 100, total_xp: 0 } });
        const { data: d2 } = await supabase
          .from('profiles')
          .select('id, email, name, level, xp, next_level_xp, total_xp')
          .eq('id', userId)
          .maybeSingle();
        let total = d2?.total_xp ?? 0;
        if (total == null) total = (d2?.xp ?? 0);
        return res.json({ progress: { ...d2, total_xp: total }, createdTables: true });
      }
      console.error('progress fetch error', dbErr);
      res.status(500).json({ error: 'Failed to fetch progress' });
    }
  } catch (error) {
    console.error('progress fetch error', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Mark a quest as completed for a user
app.post('/api/quests/complete', async (req, res) => {
  try {
    const { userId, title, xpReward = 0 } = req.body || {};
    if (!userId || !title) return res.status(400).json({ error: 'Missing userId or title' });
    try {
      const { data, error } = await supabase
        .from('quests')
        .update({ status: 'completed' })
        .eq('user_id', userId)
        .eq('title', title)
        .select('title, description, category, xp_reward, status')
        .maybeSingle();
      if (error) throw error;
      // Increment profile XP/level
      let prof, profErr;
      try {
        const r = await supabase
          .from('profiles')
          .select('id, email, name, level, xp, next_level_xp')
          .eq('id', userId)
          .maybeSingle();
        prof = r.data; profErr = r.error;
      } catch (e) { profErr = e; }
      if (profErr && isMissingColumnError(profErr)) {
        // attempt to add columns then retry fetch
        await ensureTables();
        const r2 = await supabase
          .from('profiles')
          .select('id, email, name, level, xp, next_level_xp')
          .eq('id', userId)
          .maybeSingle();
        prof = r2.data; profErr = r2.error;
      }
      if (profErr && isNotNullViolation(profErr) || !prof) {
        await ensureTables();
        await ensureProfileExists(userId);
        const r3 = await supabase
          .from('profiles')
          .select('id, email, name, level, xp, next_level_xp')
          .eq('id', userId)
          .maybeSingle();
        prof = r3.data; profErr = r3.error;
      }
      if (profErr && !prof) throw profErr;
      let level = prof?.level ?? 1;
      let xp = prof?.xp ?? 0;
      let nextLevelXp = prof?.next_level_xp ?? 100;
      const amount = data?.xp_reward ?? xpReward ?? 0;
      xp += amount;
      while (xp >= nextLevelXp) {
        xp -= nextLevelXp;
        level += 1;
        nextLevelXp = Math.round(nextLevelXp * 1.5);
      }
      // derive email/name for upsert to satisfy NOT NULL constraints
      let email = prof?.email || '';
      let name = prof?.name || '';
      if (!email) {
        try {
          const { data: gu } = await supabase.auth.admin.getUserById(userId);
          email = gu?.user?.email || email;
          name = name || gu?.user?.user_metadata?.name || '';
        } catch {}
      }
      if (!email) email = `${userId}@local`;
      if (!name) name = 'Adventurer';

      let updErr;
      try {
        const u = await supabase
          .from('profiles')
          .upsert({ id: userId, email, name, level, xp, next_level_xp: nextLevelXp }, { onConflict: 'id' });
        updErr = u.error;
      } catch (e) { updErr = e; }
      if (updErr && isMissingColumnError(updErr)) {
        await ensureTables();
        await ensureProfileExists(userId);
        const u2 = await supabase
          .from('profiles')
          .upsert({ id: userId, email, name, level, xp, next_level_xp: nextLevelXp }, { onConflict: 'id' });
        if (u2.error) throw u2.error;
      } else if (updErr) {
        throw updErr;
      }
      res.json({ ok: true, quest: data || null, profile: { level, xp, nextLevelXp } });
    } catch (dbErr) {
      if (isMissingTableError(dbErr)) {
        const created = await ensureTables();
        if (!created) return res.status(500).json({ error: 'Tables missing; set SUPABASE_DB_URL' });
        const { data: d2, error: e2 } = await supabase
          .from('quests')
          .update({ status: 'completed' })
          .eq('user_id', userId)
          .eq('title', title)
          .select('title, description, category, xp_reward, status')
          .maybeSingle();
        if (e2) throw e2;
        // also ensure profile row exists
        const { data: prof2 } = await supabase
          .from('profiles')
          .select('id, email, name, level, xp, next_level_xp')
          .eq('id', userId)
          .maybeSingle();
        let level = prof2?.level ?? 1;
        let xp = prof2?.xp ?? 0;
        let nextLevelXp = prof2?.next_level_xp ?? 100;
        const amount = d2?.xp_reward ?? xpReward ?? 0;
        xp += amount;
        while (xp >= nextLevelXp) {
          xp -= nextLevelXp;
          level += 1;
          nextLevelXp = Math.round(nextLevelXp * 1.5);
        }
        let email2 = prof2?.email || '';
        let name2 = prof2?.name || '';
        if (!email2) email2 = `${userId}@local`;
        if (!name2) name2 = 'Adventurer';
        const { error: updErr2 } = await supabase
          .from('profiles')
          .upsert({ id: userId, email: email2, name: name2, level, xp, next_level_xp: nextLevelXp }, { onConflict: 'id' });
        if (updErr2) throw updErr2;
        return res.json({ ok: true, quest: d2 || null, profile: { level, xp, nextLevelXp }, createdTables: true });
      }
      console.error('quests complete error', dbErr);
      res.status(500).json({ error: 'Failed to complete quest' });
    }
  } catch (error) {
    console.error('quests complete error', error);
    res.status(500).json({ error: 'Failed to complete quest' });
  }
});

// Persona + quests generator using Groq based on user inputs
app.post('/api/persona/generate', async (req, res) => {
  try {
    const { interests = '', strengths = '', goals = '', currentRole = '', proficiency = 3, imageBase64 = '' } = req.body || {};
    const prompt = `Using the following user inputs, infer a career persona and generate 5 beginner-friendly quests. Check the web
    for the latest information on the topic and how the user should upskill to achieve the goals.'

Inputs:
- Current Role: ${currentRole}
- Proficiency: ${proficiency}/5
- Interests: ${interests}
- Strengths: ${strengths}
- Goals: ${goals}

Return ONLY valid JSON with this exact shape (no extra text):
{
  "persona": {
    "persona_type": "Software Developer",
    "attributes": { "logic": 7, "creativity": 6, "communication": 5 }
  },
  "quests": [
    { "title": "...", "description": "...", "category": "Skill Development", "xp_reward": 100 }
  ]
}

Guidelines:
- attributes are integers 1-10
- Include 5 quests across categories: Skill Development, Portfolio Building, Networking, Thought Leadership
- Keep titles concise and actionable`;

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
    const quests = Array.isArray(payload?.quests) ? payload.quests : [];

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

    res.json({ persona, quests, avatar: avatarDataUrl });
  } catch (error) {
    console.error('Groq persona error', error);
    res.status(500).json({ error: 'Failed to generate persona' });
  }
});

// Avatar generation using Nano Banana (optional). Falls back to DiceBear if not configured.
app.post('/api/avatar/generate', async (req, res) => {
  try {
    const { userId = '', promptMeta = {}, imageBase64 = '', style } = req.body || {};
    const { currentRole = '', proficiency = 3, interests = '', strengths = '', goals = '' } = promptMeta || {};

    const chosenStyle = 'unicode emoji';
    const prompt = `Create a 1024x1024 square picture in ${chosenStyle} style. Imagine that this is a badge and the picture is the identity of the user, let your imagination run wild.
Use these details: role=${currentRole}, proficiency=${proficiency}/5, interests=${interests}, strengths=${strengths}, goals=${goals}.
Return only the image based on the face likeness if a reference image is provided.
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
      console.log(`ProfileQuest API listening on http://localhost:${port}`);
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

attemptListen(BASE_PORT);


