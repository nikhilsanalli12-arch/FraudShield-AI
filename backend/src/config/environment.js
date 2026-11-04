import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
};

export function isSupabaseConfigured() {
  const isPlaceholderUrl = !config.supabaseUrl || config.supabaseUrl.includes('your-project.supabase.co');
  const isPlaceholderKey = !config.supabaseServiceRoleKey || config.supabaseServiceRoleKey.includes('your-supabase-service-role-key');
  return !isPlaceholderUrl && !isPlaceholderKey;
}
