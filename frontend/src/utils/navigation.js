/**
 * FraudShield AI — Navigation & Routing Helpers
 */

/**
 * Returns the main dashboard landing page route for a given user role.
 * Clicking the logo or Dashboard returns to the clean service landing page.
 *
 * @param {string} [role='personal'] - User role from verified Supabase session
 * @returns {string} Route path
 */
export function getRoleDashboardPath(role) {
  return '/dashboard';
}

/**
 * Returns role-appropriate navigation items with clear Dashboard visibility.
 *
 * @param {string} effectiveRole
 * @returns {Array<{ name: string, path: string, iconName: string, allowedRoles: string[], exact?: boolean }>}
 */
export function getNavItemsConfig(effectiveRole = 'personal') {
  return [
    {
      name: 'Dashboard',
      path: '/dashboard',
      iconName: 'LayoutDashboard',
      allowedRoles: ['personal', 'analyst', 'admin'],
      exact: true,
    },
    {
      name: 'Bank Transactions',
      path: '/dashboard/transactions',
      iconName: 'CreditCard',
      allowedRoles: ['personal', 'analyst', 'admin'],
    },
    {
      name: 'Link Scanner',
      path: '/dashboard/link-scanner',
      iconName: 'Link2',
      allowedRoles: ['personal', 'analyst', 'admin'],
    },
    {
      name: effectiveRole === 'analyst' ? 'Analyst Dashboard' : 'Analyst Triage',
      path: '/analyst/dashboard',
      iconName: 'Activity',
      allowedRoles: ['analyst', 'admin'],
    },
    {
      name: effectiveRole === 'admin' ? 'Admin Dashboard' : 'Platform Health',
      path: '/admin/dashboard',
      iconName: 'Server',
      allowedRoles: ['admin'],
    },
  ];
}
