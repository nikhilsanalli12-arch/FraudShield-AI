/**
 * FraudShield AI — Role-Based Navigation & Route Invariants Test Suite
 *
 * Verifies:
 * 1. getRoleDashboardPath returns the clean service landing page (/dashboard) for returning users.
 * 2. Navigation items provide prominent "Dashboard" entry matching each user's verified database role.
 * 3. Dedicated "Bank Transactions" and "Link Scanner" are accessible to all authenticated roles.
 * 4. Strict role boundary isolation: Personal users cannot access analyst or admin triage paths.
 * 5. Analyst users cannot access administrator platform health.
 * 6. Verification of clickable logo links and return-to-dashboard capabilities in JSX components.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getRoleDashboardPath,
  getNavItemsConfig,
} from '../../frontend/src/utils/navigation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendSrc = path.join(__dirname, '..', '..', 'frontend', 'src');

describe('FraudShield AI — Navigation & Role Routing Invariants', () => {
  // 1. Service Landing Page Dashboard Routing
  test('getRoleDashboardPath routes users to clean service landing page /dashboard', () => {
    assert.equal(getRoleDashboardPath('personal'), '/dashboard');
    assert.equal(getRoleDashboardPath('analyst'), '/dashboard');
    assert.equal(getRoleDashboardPath('admin'), '/dashboard');
    assert.equal(getRoleDashboardPath(undefined), '/dashboard');
    assert.equal(getRoleDashboardPath(null), '/dashboard');
  });

  // 2. Personal User Navigation Items
  test('Personal user receives "Dashboard", "Bank Transactions", and "Link Scanner" without analyst/admin paths', () => {
    const allItems = getNavItemsConfig('personal');
    const personalItems = allItems.filter((i) => i.allowedRoles.includes('personal'));

    assert.equal(personalItems.length, 3);
    // First item must be clearly named Dashboard pointing to /dashboard
    assert.equal(personalItems[0].name, 'Dashboard');
    assert.equal(personalItems[0].path, '/dashboard');

    // Second item must be Bank Transactions
    assert.equal(personalItems[1].name, 'Bank Transactions');
    assert.equal(personalItems[1].path, '/dashboard/transactions');

    // Third item must be Link Scanner
    assert.equal(personalItems[2].name, 'Link Scanner');
    assert.equal(personalItems[2].path, '/dashboard/link-scanner');

    // Strict boundary: Must NOT leak privileged paths to personal users
    const paths = personalItems.map((i) => i.path);
    assert.ok(!paths.includes('/analyst/dashboard'), 'Personal role must not include /analyst/dashboard');
    assert.ok(!paths.includes('/admin/dashboard'), 'Personal role must not include /admin/dashboard');
  });

  // 3. Financial Analyst Navigation Items
  test('Analyst user receives "Analyst Dashboard" with Transactions, Link Scanner and Dashboard access', () => {
    const allItems = getNavItemsConfig('analyst');
    const analystItems = allItems.filter((i) => i.allowedRoles.includes('analyst'));

    assert.equal(analystItems.length, 4);
    const paths = analystItems.map((i) => i.path);

    // Has access to Analyst Dashboard, Dashboard, Transactions, and Link Scanner
    assert.ok(paths.includes('/analyst/dashboard'));
    assert.ok(paths.includes('/dashboard'));
    assert.ok(paths.includes('/dashboard/transactions'));
    assert.ok(paths.includes('/dashboard/link-scanner'));

    // Analyst Dashboard is clearly labeled
    const analystDashboard = analystItems.find((i) => i.path === '/analyst/dashboard');
    assert.equal(analystDashboard?.name, 'Analyst Dashboard');

    // Strict boundary: Must NOT leak admin platform health to analyst
    assert.ok(!paths.includes('/admin/dashboard'), 'Analyst role must not include /admin/dashboard');
  });

  // 4. Administrator Navigation Items
  test('Admin user receives "Admin Dashboard" and has full workspace access', () => {
    const allItems = getNavItemsConfig('admin');
    const adminItems = allItems.filter((i) => i.allowedRoles.includes('admin'));

    assert.equal(adminItems.length, 5);
    const paths = adminItems.map((i) => i.path);

    // Has access to Admin Dashboard, Analyst Triage, Dashboard, Transactions, and Link Scanner
    assert.ok(paths.includes('/admin/dashboard'), 'Admin must have access to Admin Dashboard');
    assert.ok(paths.includes('/analyst/dashboard'), 'Admin must have access to Analyst Triage');
    assert.ok(paths.includes('/dashboard'), 'Admin must have access to Dashboard');
    assert.ok(paths.includes('/dashboard/transactions'), 'Admin must have access to Transactions');
    assert.ok(paths.includes('/dashboard/link-scanner'), 'Admin must have access to Link Scanner');

    // Admin Dashboard is clearly labeled
    const adminDashboard = adminItems.find((i) => i.path === '/admin/dashboard');
    assert.equal(adminDashboard?.name, 'Admin Dashboard');
  });

  // 5. Clickable Logo Verification in Navbar.jsx
  test('Navbar.jsx brand logo links to dashboard when authenticated, and / when unauthenticated', () => {
    const navbarCode = fs.readFileSync(
      path.join(frontendSrc, 'components', 'navigation', 'Navbar.jsx'),
      'utf-8'
    );

    // Must use conditional navigation: to={user ? getDashboardPath() : '/'}
    assert.ok(
      navbarCode.includes('user ? getDashboardPath() : \'/\''),
      'Navbar logo must navigate to dashboard when authenticated, or landing page when unauthenticated'
    );
  });

  // 6. Clickable Logo Verification in DashboardSidebar.jsx
  test('DashboardSidebar.jsx brand logo is a clickable link to role dashboard', () => {
    const sidebarCode = fs.readFileSync(
      path.join(frontendSrc, 'components', 'dashboard', 'DashboardSidebar.jsx'),
      'utf-8'
    );

    assert.ok(
      sidebarCode.includes('<Link') && sidebarCode.includes('to={getRoleDashboardPath(effectiveRole)}'),
      'DashboardSidebar logo must be wrapped in a Link navigating to the role dashboard'
    );
  });

  // 7. Return to Dashboard Verification on Sub-pages
  test('LinkScannerPage.jsx and TransactionsPage.jsx provide clear return-to-dashboard navigation links', () => {
    const scannerCode = fs.readFileSync(
      path.join(frontendSrc, 'pages', 'dashboard', 'LinkScannerPage.jsx'),
      'utf-8'
    );
    const txCode = fs.readFileSync(
      path.join(frontendSrc, 'pages', 'dashboard', 'TransactionsPage.jsx'),
      'utf-8'
    );

    assert.ok(
      scannerCode.includes('Back to Dashboard'),
      'LinkScannerPage must include a visible "Back to Dashboard" navigation link'
    );
    assert.ok(
      txCode.includes('Back to Dashboard'),
      'TransactionsPage must include a visible "Back to Dashboard" navigation link'
    );
  });

  // 8. Topbar Breadcrumb Navigation Verification
  test('DashboardTopbar.jsx provides breadcrumb and dashboard navigation for sub-pages', () => {
    const topbarCode = fs.readFileSync(
      path.join(frontendSrc, 'components', 'dashboard', 'DashboardTopbar.jsx'),
      'utf-8'
    );

    assert.ok(
      topbarCode.includes('isLinkScanner') || topbarCode.includes('/link-scanner'),
      'DashboardTopbar must detect link-scanner subpage'
    );
    assert.ok(
      topbarCode.includes('isTransactions') || topbarCode.includes('/transactions'),
      'DashboardTopbar must detect transactions subpage'
    );
    assert.ok(
      topbarCode.includes('to={getRoleDashboardPath(effectiveRole)}'),
      'DashboardTopbar must provide navigation to role dashboard'
    );
  });
});
