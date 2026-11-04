import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured() {
  const isPlaceholderUrl = !supabaseUrl || supabaseUrl.includes('your-project.supabase.co');
  const isPlaceholderKey = !supabaseAnonKey || supabaseAnonKey.includes('your-supabase-public-anon-key');
  return !isPlaceholderUrl && !isPlaceholderKey;
}

export function getMissingConfigDetails() {
  const missing = [];
  if (!supabaseUrl || supabaseUrl.includes('your-project.supabase.co')) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes('your-supabase-public-anon-key')) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }
  return missing;
}

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

