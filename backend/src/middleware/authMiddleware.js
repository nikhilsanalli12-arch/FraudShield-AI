import { getSupabaseAdmin } from '../config/supabase.js';
import { isSupabaseConfigured } from '../config/environment.js';

export function createAuthMiddleware(adminClientGetter = getSupabaseAdmin, isConfigCheck = isSupabaseConfigured) {
  return async function authMiddleware(req, res, next) {
    try {
      // 1. Check if backend Supabase credentials are configured
      if (!isConfigCheck()) {
        return res.status(503).json({
          error: 'ServiceUnavailable',
          message: 'Backend authentication service is not configured. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.',
        });
      }

      // 2. Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token missing. Please provide a valid Bearer token in the Authorization header.',
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token || token.trim() === '') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication token is empty.',
        });
      }

      const supabaseAdmin = adminClientGetter();
      if (!supabaseAdmin) {
        return res.status(503).json({
          error: 'ServiceUnavailable',
          message: 'Supabase admin client is uninitialized.',
        });
      }

      // 3. Validate token with Supabase Auth (server-side verification)
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (authError || !authData?.user) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid, malformed, or expired authentication token.',
        });
      }

      const authUser = authData.user;

      // 4. Retrieve verified user role strictly from trusted database source (public.profiles)
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, role, created_at, updated_at')
        .eq('id', authUser.id)
        .single();

      if (profileError || !profile) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User profile not found in database.',
        });
      }

      // 5. Attach authenticated user details to request as an immutable frozen object
      // (Protects against downstream in-memory role tampering)
      req.user = Object.freeze({
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role, // strictly database-verified: 'personal' | 'analyst' | 'admin'
        createdAt: profile.created_at,
      });

      next();
    } catch (error) {
      console.error('Authentication middleware unexpected error:', error.message);
      return res.status(500).json({
        error: 'InternalServerError',
        message: 'Failed to authenticate request.',
      });
    }
  };
}

export const authMiddleware = createAuthMiddleware();
