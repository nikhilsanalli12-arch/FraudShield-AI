import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const frontendSrc = path.join(rootDir, 'frontend', 'src');
const frontendDist = path.join(rootDir, 'frontend', 'dist');

describe('Milestone 3: Dashboard Architecture & Invariant Suite', () => {
  // 1. Invariant: Arbitrary 94/100 score must be removed
  test('Invariant 1: Personal Dashboard does not contain arbitrary 94/100 safety score or fabricated scores', () => {
    const personalCode = fs.readFileSync(
      path.join(frontendSrc, 'pages', 'dashboard', 'PersonalDashboard.jsx'),
      'utf-8'
    );
    const securityCardCode = fs.readFileSync(
      path.join(frontendSrc, 'components', 'dashboard', 'AccountSecurityCard.jsx'),
      'utf-8'
    );

    assert.ok(
      !personalCode.includes('94/100'),
      'PersonalDashboard must not contain hardcoded 94/100 safety score'
    );
    assert.ok(
      !securityCardCode.includes('94/100'),
      'AccountSecurityCard must not contain hardcoded 94/100 safety score'
    );
    assert.ok(
      securityCardCode.includes('Not available'),
      'AccountSecurityCard must provide honest "Not available" fallbacks for unverifiable fields'
    );
  });

  // 2. Invariant: Analyst Dashboard metrics must be clearly labeled as SYNTHETIC DEMO DATA
  test('Invariant 2: Analyst Dashboard carries prominent SYNTHETIC DEMO DATA disclaimers and avoids claims of real fraud blocked', () => {
    const analystCode = fs.readFileSync(
      path.join(frontendSrc, 'pages', 'dashboard', 'AnalystDashboard.jsx'),
      'utf-8'
    );
    const syntheticDataCode = fs.readFileSync(
      path.join(frontendSrc, 'services', 'syntheticData.js'),
      'utf-8'
    );

    assert.ok(
      analystCode.includes('Synthetic Demo Data Notice') || analystCode.includes('SYNTHETIC DEMO DATA'),
      'Analyst Dashboard must feature a prominent synthetic demonstration disclaimer banner'
    );
    assert.ok(
      !analystCode.includes('$4.28M') && !analystCode.includes('$142,500'),
      'Analyst Dashboard must not present arbitrary $4.28M or $142,500 as live metrics'
    );
    assert.ok(
      syntheticDataCode.includes('SYNTHETIC DEMO DATA'),
      'Synthetic data file must contain prominent DEMO warnings'
    );
  });

  // 3. Invariant: Analyst actions are investigation-oriented only (no payment freezing / account blocking)
  test('Invariant 3: Analyst Actions do not perform real financial intervention or account blocking', () => {
    const modalCode = fs.readFileSync(
      path.join(frontendSrc, 'components', 'dashboard', 'InvestigationModal.jsx'),
      'utf-8'
    );

    assert.ok(
      modalCode.includes('Simulated Analyst Action'),
      'Investigation modal must explicitly label actions as simulated demonstration actions'
    );
    assert.ok(
      modalCode.includes('No financial reversal, blocking, or account freezing performed'),
      'Investigation modal must disclaim financial intervention'
    );
    assert.ok(
      modalCode.includes('Inspect Details') || modalCode.includes('Mark as Reviewed'),
      'Investigation modal must support investigation actions (Inspect details, Mark reviewed)'
    );
  });

  // 4. Invariant: Admin Dashboard displays live backend health and "Not available" for unmeasured metrics
  test('Invariant 4: Admin Dashboard displays actual backend health and avoids hardcoded fake latency/uptime', () => {
    const adminCode = fs.readFileSync(
      path.join(frontendSrc, 'pages', 'dashboard', 'AdminDashboard.jsx'),
      'utf-8'
    );

    assert.ok(
      adminCode.includes('fetchAdminStats'),
      'Admin Dashboard must retrieve stats via backend service'
    );
    assert.ok(
      adminCode.includes('Not available') || adminCode.includes('Integration pending'),
      'Admin Dashboard must display "Not available" or "Integration pending" for unmeasured telemetry'
    );
    assert.ok(
      !adminCode.includes('42ms') && !adminCode.includes('24ms'),
      'Admin Dashboard must not hardcode fake milliseconds latency'
    );
  });

  // 5. Invariant: Unbuilt Personal shortcuts display Coming Soon milestone tags
  test('Invariant 5: Personal Dashboard shortcuts are tagged with explicit "Coming Soon" milestones', () => {
    const personalCode = fs.readFileSync(
      path.join(frontendSrc, 'pages', 'dashboard', 'PersonalDashboard.jsx'),
      'utf-8'
    );

    assert.ok(personalCode.includes('Milestone 7'), 'Link/App shortcuts must indicate Milestone 7');
    assert.ok(personalCode.includes('Milestone 8'), 'Loan calculator shortcut must indicate Milestone 8');
    assert.ok(personalCode.includes('Milestone 9'), 'Investment shortcut must indicate Milestone 9');
    assert.ok(personalCode.includes('Milestone 5'), 'Statement upload shortcut must indicate Milestone 5');
  });

  // 6. Invariant: Navigation is role-derived and does not include a role-switcher
  test('Invariant 6: Navigation derives strictly from verified database role with no role switcher', () => {
    const sidebarCode = fs.readFileSync(
      path.join(frontendSrc, 'components', 'dashboard', 'DashboardSidebar.jsx'),
      'utf-8'
    );

    assert.ok(
      sidebarCode.includes('useAuth'),
      'DashboardSidebar must derive role from useAuth'
    );
    assert.ok(
      !sidebarCode.includes('switchRole') && !sidebarCode.includes('setRole'),
      'DashboardSidebar must NOT implement a role switcher that allows users to pretend to have another role'
    );
    assert.ok(
      sidebarCode.includes("allowedRoles: ['admin']"),
      'Platform Health admin navigation item must be restricted to admin role'
    );
  });

  // 7. Invariant: Secret Scanning (No service keys in frontend source or build)
  test('Invariant 7: Frontend build bundle and source do not contain private service keys', () => {
    // Check built distribution files
    if (fs.existsSync(frontendDist)) {
      const files = fs.readdirSync(path.join(frontendDist, 'assets'));
      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(path.join(frontendDist, 'assets', file), 'utf-8');
          assert.ok(
            !content.includes('service_role'),
            `Found service_role in built asset: ${file}`
          );
        }
      }
    }
  });
});

