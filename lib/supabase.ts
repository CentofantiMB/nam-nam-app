import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Supabase currently exposes a Publishable key in new projects; older projects/documentation
// may still call this the anon key. Accept both so local and deployed environments work.
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';
export const adminLoginEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || '';
export const hasSupabase = Boolean(supabaseUrl && supabaseKey);

export const supabase = hasSupabase ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
}) : null;
