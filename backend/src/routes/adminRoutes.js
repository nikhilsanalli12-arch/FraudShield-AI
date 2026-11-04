import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { isSupabaseConfigured } from '../config/environment.js';

const router = Router();

// Protect all admin routes with authMiddleware and requireRole(['admin'])
router.use(authMiddleware);
router.use(requireRole(['admin']));

/**
 * GET /api/v1/admin/stats
 * Privileged administrative telemetry and user/role counts.
 * Strictly queries the database from backend server-side client.
 */
router.get('/stats', async (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const timestamp = new Date().toISOString();

  // Basic gateway health telemetry
  const gatewayStatus = {
    status: 'healthy',
    uptimeSeconds,
    nodeEnv: process.env.NODE_ENV || 'development',
    timestamp,
  };

  const moduleTelemetry = {
    mlInferenceEngine: 'Integration pending (Milestone 6)',
    auditLogEngine: 'Integration pending (Milestone 12)',
    latencyMetrics: 'Integration pending (Milestone 12)',
  };

  if (!isSupabaseConfigured()) {
    return res.json({
      gateway: gatewayStatus,
      database: { status: 'not_configured' },
      users: {
        total: 'Not available',
        roles: { personal: 'Not available', analyst: 'Not available', admin: 'Not available' },
        note: 'Backend Supabase credentials not configured',
      },
      modules: moduleTelemetry,
    });
  }

  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return res.json({
      gateway: gatewayStatus,
      database: { status: 'uninitialized' },
      users: {
        total: 'Not available',
        roles: { personal: 'Not available', analyst: 'Not available', admin: 'Not available' },
        note: 'Supabase admin client uninitialized',
      },
      modules: moduleTelemetry,
    });
  }

  try {
    // 1. Total profiles count
    const { count: totalCount, error: totalErr } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (totalErr) {
      return res.json({
        gateway: gatewayStatus,
        database: { status: 'error', message: totalErr.message },
        users: {
          total: 'Not available',
          roles: { personal: 'Not available', analyst: 'Not available', admin: 'Not available' },
          error: totalErr.message,
        },
        modules: moduleTelemetry,
      });
    }

    // 2. Count per role
    const [personalRes, analystRes, adminRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'personal'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'analyst'),
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    ]);

    return res.json({
      gateway: gatewayStatus,
      database: { status: 'connected' },
      users: {
        total: totalCount ?? 'Not available',
        roles: {
          personal: personalRes.count ?? 'Not available',
          analyst: analystRes.count ?? 'Not available',
          admin: adminRes.count ?? 'Not available',
        },
      },
      modules: moduleTelemetry,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'AdminTelemetryError',
      message: 'Failed to retrieve administrative statistics.',
      details: err.message,
    });
  }
});

export default router;
