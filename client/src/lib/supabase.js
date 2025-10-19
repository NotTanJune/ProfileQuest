import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  process.env.VITE_SUPABASE_URL ||
  (typeof window !== 'undefined' && (window.VITE_SUPABASE_URL || window.SUPABASE_URL)) ||
  ''
);

export const SUPABASE_ANON_KEY = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' && (window.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY)) ||
  ''
);

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// Expose in browser console for debugging
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}


