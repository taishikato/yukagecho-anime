import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
// Misconfiguration must never prevent guest exploration or expose an admin key.
export const supabase =
  typeof url === 'string' &&
  /^https?:\/\//.test(url) &&
  typeof key === 'string' &&
  key.startsWith('sb_publishable_')
    ? createClient(url, key, { auth: { detectSessionInUrl: true } })
    : null;
