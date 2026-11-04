/**
 * Service to fetch live administrative statistics and health telemetry
 * from the Express backend gateway (which verifies the admin role and
 * queries Supabase securely server-side).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export async function fetchAdminStats(accessToken) {
  if (!accessToken) {
    return {
      success: false,
      error: 'No active session token provided',
      gateway: { status: 'Unauthenticated' },
      users: { total: 'Not available', roles: { personal: 'Not available', analyst: 'Not available', admin: 'Not available' } },
      modules: {
        mlInferenceEngine: 'Integration pending (Milestone 6)',
        auditLogEngine: 'Integration pending (Milestone 12)',
        latencyMetrics: 'Integration pending (Milestone 12)',
      },
    };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/admin/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return {
        success: false,
        status: res.status,
        error: errBody.message || `HTTP ${res.status}`,
        gateway: { status: 'Error' },
        users: { total: 'Not available', roles: { personal: 'Not available', analyst: 'Not available', admin: 'Not available' } },
        modules: {
          mlInferenceEngine: 'Integration pending (Milestone 6)',
          auditLogEngine: 'Integration pending (Milestone 12)',
          latencyMetrics: 'Integration pending (Milestone 12)',
        },
      };
    }

    const data = await res.json();
    return {
      success: true,
      gateway: data.gateway || { status: 'healthy' },
      database: data.database || { status: 'connected' },
      users: data.users || { total: 'Not available', roles: {} },
      modules: data.modules || {},
    };
  } catch (_err) {
    return {
      success: false,
      error: 'Backend gateway unreachable',
      gateway: { status: 'Offline / Unreachable' },
      database: { status: 'Unknown' },
      users: {
        total: 'Not available',
        roles: { personal: 'Not available', analyst: 'Not available', admin: 'Not available' },
      },
      modules: {
        mlInferenceEngine: 'Integration pending (Milestone 6)',
        auditLogEngine: 'Integration pending (Milestone 12)',
        latencyMetrics: 'Integration pending (Milestone 12)',
      },
    };
  }
}
