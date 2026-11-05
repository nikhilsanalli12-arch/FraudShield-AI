import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Explicitly anchor to backend/.env regardless of process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim(),
};

export function isSupabaseConfigured() {
  const isPlaceholderUrl = !config.supabaseUrl || config.supabaseUrl.includes('your-project.supabase.co');
  const isPlaceholderKey = !config.supabaseServiceRoleKey || config.supabaseServiceRoleKey.includes('your-supabase-service-role-key');
  return !isPlaceholderUrl && !isPlaceholderKey;
}

export function isGeminiConfigured() {
  const key = config.geminiApiKey;
  if (!key) return false;
  if (key.includes('your-gemini-api-key') || key.includes('placeholder')) return false;
  return key.length > 10;
}

