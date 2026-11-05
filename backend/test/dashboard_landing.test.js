/**
 * FraudShield AI — Service Landing Page & Dashboard Simplification Test Suite
 *
 * Verifies:
 * 1. The main Dashboard is strictly a clean SERVICE LANDING PAGE, NOT a bank transaction monitoring dashboard.
 * 2. Welcome section introduces FraudShield AI with a short platform introduction.
 * 3. Shows ONLY an "Our Features" or "What We Offer" section with attractive feature cards:
 *    - Bank Transaction Fraud Detection
 *    - CSV Transaction Analysis
 *    - Suspicious Link Scanner
 *    - AI-Powered Fraud Explanations
 *    - PDF Security Reports
 *    - Analyst Investigation & Case Management (only for authorized roles)
 * 4. Every card has a working button that opens its respective feature page or workflow.
 * 5. REMOVED from the main Dashboard landing page:
 *    - Bank transaction details & history tables
 *    - Bank account information
 *    - Transaction statistics (MetricWidget)
 *    - Fraud alert lists
 *    - Account security details
 *    - Investigation data
 * 6. Dedicated TransactionsPage.jsx exists at /dashboard/transactions to retain all transaction functionality.
 * 7. Security message or footer is present on the landing page.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const frontendSrc = path.join(rootDir, 'frontend', 'src');
const personalDashboardPath = path.join(frontendSrc, 'pages', 'dashboard', 'PersonalDashboard.jsx');
const transactionsPagePath = path.join(frontendSrc, 'pages', 'dashboard', 'TransactionsPage.jsx');

describe('FraudShield AI — Clean Service Landing Page Invariants', () => {
  const code = fs.readFileSync(personalDashboardPath, 'utf-8');

  // 1. Welcome & Introduction Section Verification
  test('Dashboard landing page features clean welcome and platform introduction', () => {
    assert.ok(
      code.includes('Welcome to FraudShield AI'),
      'Must include "Welcome to FraudShield AI" title'
    );
    assert.ok(
      code.includes('intelligent financial fraud detection and digital safety platform') ||
        code.includes('AI-powered financial fraud detection'),
      'Must include short platform introduction explaining purpose'
    );
    assert.ok(
      code.includes('Supabase Auth Connected'),
      'Must surface active authentication status'
    );
  });

  // 2. Our Features Section Verification
  test('Shows Our Features section with all 6 required feature cards', () => {
    assert.ok(
      code.includes('Our Features') || code.includes('What We Offer'),
      'Must feature "Our Features" or "What We Offer" section header'
    );

    // Feature 1: Bank Transaction Fraud Detection
    assert.ok(
      code.includes('Bank Transaction Fraud Detection'),
      'Must include Bank Transaction Fraud Detection card'
    );

    // Feature 2: CSV Transaction Analysis
    assert.ok(
      code.includes('CSV Transaction Analysis'),
      'Must include CSV Transaction Analysis card'
    );

    // Feature 3: Suspicious Link Scanner
    assert.ok(
      code.includes('Suspicious Link Scanner'),
      'Must include Suspicious Link Scanner card'
    );

    // Feature 4: AI-Powered Fraud Explanations
    assert.ok(
      code.includes('AI-Powered Fraud Explanations'),
      'Must include AI-Powered Fraud Explanations card'
    );

    // Feature 5: PDF Security Reports
    assert.ok(
      code.includes('PDF Security Reports'),
      'Must include PDF Security Reports card'
    );

    // Feature 6: Analyst Investigation & Case Management (only for authorized roles)
    assert.ok(
      code.includes('Analyst Investigation & Case Management'),
      'Must include Analyst Investigation & Case Management card'
    );
    assert.ok(
      code.includes("effectiveRole === 'analyst'") || code.includes("effectiveRole === 'admin'"),
      'Analyst card must be restricted to authorized roles'
    );
  });

  // 3. Every Card Has Working Action Buttons
  test('Every card has a working button navigating to its existing feature page or workflow', () => {
    assert.ok(
      code.includes("navigate('/dashboard/transactions')"),
      'Must navigate to /dashboard/transactions for bank transactions and AI insights'
    );
    assert.ok(
      code.includes("navigate('/dashboard/transactions?action=import')") ||
        code.includes("navigate('/dashboard/transactions')"),
      'Must navigate to CSV statement workflow'
    );
    assert.ok(
      code.includes("navigate('/dashboard/link-scanner')"),
      'Must navigate to /dashboard/link-scanner for link scanner and PDF reports'
    );
    assert.ok(
      code.includes("navigate('/analyst/dashboard')"),
      'Must navigate to /analyst/dashboard for analyst investigation'
    );
  });

  // 4. Strict Removal of Unwanted Transaction Widgets from Landing Page
  test('Main Dashboard landing page strictly removes all bank transaction widgets and history tables', () => {
    // No bank transaction table
    assert.ok(
      !code.includes('<table') && !code.includes('<tbody>'),
      'Main dashboard must NOT contain any bank transaction tables'
    );
    // No transaction history mapping
    assert.ok(
      !code.includes('transactions.map'),
      'Main dashboard must NOT render transaction records or history lists'
    );
    // No metric widgets on landing page
    assert.ok(
      !code.includes('<MetricWidget') && !code.includes('Monitored Transactions'),
      'Main dashboard must NOT render transaction statistics or MetricWidgets'
    );
    // No active fraud alerts list
    assert.ok(
      !code.includes('Active High-Risk Fraud Alerts'),
      'Main dashboard must NOT render fraud alert lists'
    );
    // No account security card embedded on landing page
    assert.ok(
      !code.includes('<AccountSecurityCard'),
      'Main dashboard must NOT render account security details card'
    );
  });

  // 5. Dedicated Transactions Page Retains Removed Functionality
  test('Dedicated TransactionsPage.jsx retains complete bank transaction monitoring functionality', () => {
    assert.ok(
      fs.existsSync(transactionsPagePath),
      'Dedicated TransactionsPage.jsx must exist at frontend/src/pages/dashboard/TransactionsPage.jsx'
    );

    const txCode = fs.readFileSync(transactionsPagePath, 'utf-8');
    assert.ok(
      txCode.includes('Monitored Transactions & Deterministic Scoring') ||
        txCode.includes('Bank Transaction Fraud Monitoring'),
      'TransactionsPage must retain monitored transactions header'
    );
    assert.ok(
      txCode.includes('<table') && txCode.includes('transactions.map'),
      'TransactionsPage must retain live transaction history table'
    );
    assert.ok(
      txCode.includes('<MetricWidget'),
      'TransactionsPage must retain transaction telemetry widgets'
    );
    assert.ok(
      txCode.includes('ManualTransactionModal') &&
        txCode.includes('CsvImportModal') &&
        txCode.includes('TransactionDetailModal'),
      'TransactionsPage must retain manual, CSV import, and detail inspection modals'
    );
    assert.ok(
      txCode.includes('<AccountSecurityCard'),
      'TransactionsPage must retain account security card under verification tab'
    );
  });

  // 6. Security Message & Footer
  test('Dashboard landing page includes a short security message and footer', () => {
    assert.ok(
      code.includes('FraudShield AI Security Guarantee') ||
        code.includes('Security Notice') ||
        code.includes('Security message'),
      'Must include clean security advisory footer'
    );
  });
});
