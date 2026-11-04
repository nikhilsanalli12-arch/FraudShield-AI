import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from './environment.js';

let supabaseAdmin = null;

if (isSupabaseConfigured()) {
  supabaseAdmin = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseAdmin() {
  return supabaseAdmin;
}

export { supabaseAdmin };

