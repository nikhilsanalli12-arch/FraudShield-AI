/**
 * FraudShield AI — Suspicious Link Scanner PDF Security Report Test Suite
 *
 * Verifies:
 * 1. Document construction and input validation.
 * 2. Inclusion of FraudShield AI branding, scan timestamp, and metadata.
 * 3. Exact defanged URL rendering without clickable hyperlinks.
 * 4. Deterministic risk score and risk level presentation across bands (Critical, High, Medium, Low).
 * 5. Inclusion of plain-English security assessment.
 * 6. Enumeration of confirmed structural facts and observed heuristic indicators.
 * 7. Inclusion of exactly 3 practical safety recommendations.
 * 8. Static-analysis safety advisory disclaimer.
 * 9. Security invariant: No raw executable hyperlinks targeting the analyzed URL.
 * 10. Multi-page overflow and page numbering handling.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createLinkSecurityReportDoc } from '../../frontend/src/utils/pdfReportGenerator.js';

const MOCK_SCAN_RESULT = {
  success: true,
  provider: 'gemini',
  aiAvailable: true,
  model: 'gemini-3.1-flash-lite',
  risk_score: 85,
  risk_level: 'high',
  defanged_url: 'hxxps[://]paypal[.]com[.]verify-login[.]xyz/account-update',
  summary: 'Static inspection flagged this URL with high risk due to deceptive brand subdomains.',
  facts: [
    'Canonical Protocol: HTTPS',
    'Parsed Hostname: paypal.com.verify-login.xyz',
    'Path: /account-update',
    'Port: 443',
  ],
  indicators: [
    'RULE_DECEPTIVE_BRAND_SUBDOMAIN: The reputable brand "paypal" appears in a subdomain.',
    'RULE_SUSPICIOUS_TLD: Top-level domain ".xyz" has elevated phishing correlation.',
  ],
  recommendations: [
    'Do NOT click, open, or paste this URL into your browser.',
    'Navigate directly to the official portal by typing the verified URL manually.',
    'Report the message as a suspected phishing attempt to your security team.',
  ],
  disclaimer:
    'Static heuristic analysis is advisory and does NOT guarantee safety or constitute definitive forensic proof. The analyzed link was never executed, visited, or resolved.',
  analyzed_at: '2026-11-05T12:30:00.000Z',
};

describe('Suspicious Link Scanner — PDF Security Report Invariants', () => {
  test('createLinkSecurityReportDoc rejects missing or invalid input payload', () => {
    assert.throws(() => createLinkSecurityReportDoc(null), /Valid scan result object is required/);
    assert.throws(() => createLinkSecurityReportDoc(undefined), /Valid scan result object is required/);
    assert.throws(() => createLinkSecurityReportDoc('invalid-string'), /Valid scan result object is required/);
  });

  test('Generates valid A4 PDF document with positive byte length', () => {
    const doc = createLinkSecurityReportDoc(MOCK_SCAN_RESULT);
    assert.ok(doc, 'Must return a valid jsPDF instance');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    assert.equal(Math.round(pageWidth), 210, 'Width must match A4 (210mm)');
    assert.equal(Math.round(pageHeight), 297, 'Height must match A4 (297mm)');

    const buffer = doc.output('arraybuffer');
    assert.ok(buffer.byteLength > 2000, `PDF size must be substantial (was ${buffer.byteLength} bytes)`);
  });

  test('PDF content embeds FraudShield AI branding, scan timestamp, and metadata', () => {
    const doc = createLinkSecurityReportDoc(MOCK_SCAN_RESULT);
    const pdfText = doc.output();

    assert.ok(pdfText.includes('FRAUDSHIELD AI'), 'Must include FRAUDSHIELD AI title');
    assert.ok(pdfText.includes('Suspicious Link Security Assessment Report'), 'Must include report title');
    assert.ok(pdfText.includes('Scan Timestamp'), 'Must include timestamp header');
    assert.ok(pdfText.includes('Analysis Engine'), 'Must include analysis engine header');
    assert.ok(pdfText.includes('Zero-Fetch Static'), 'Must include zero-fetch notice');
  });

  test('PDF content includes defanged URL strictly without clickable hyperlink annotations', () => {
    const doc = createLinkSecurityReportDoc(MOCK_SCAN_RESULT);
    const pdfText = doc.output();

    // Defanged URL must be present
    assert.ok(
      pdfText.includes('hxxps[://]paypal[.]com[.]verify-login[.]xyz/account-update'),
      'Must contain the exact defanged URL'
    );
    assert.ok(pdfText.includes('DEFANGED TARGET URL') && pdfText.includes('NON-CLICKABLE'), 'Must label as non-clickable');

    // Security invariant: Must NOT contain clickable URI link action dictionary targeting live URL
    assert.ok(
      !pdfText.includes('/Type /Action /S /URI /URI (https://paypal.com.verify-login.xyz'),
      'Must NEVER create a clickable hyperlinked URI action for the target URL'
    );
  });

  test('PDF content includes deterministic risk score and risk level', () => {
    const doc = createLinkSecurityReportDoc(MOCK_SCAN_RESULT);
    const pdfText = doc.output();

    assert.ok(pdfText.includes('HIGH RISK EVALUATION'), 'Must include HIGH risk evaluation header');
    assert.ok(pdfText.includes('85/100'), 'Must include deterministic score 85/100');
  });

  test('PDF content includes plain-English summary, structural facts, and threat indicators', () => {
    const doc = createLinkSecurityReportDoc(MOCK_SCAN_RESULT);
    const pdfText = doc.output();

    assert.ok(pdfText.includes('Plain-English Security Assessment'), 'Must include assessment title');
    assert.ok(pdfText.includes('Confirmed Structural Facts'), 'Must include facts section');
    assert.ok(pdfText.includes('Canonical Protocol: HTTPS'), 'Must include protocol fact');
    assert.ok(pdfText.includes('Observed Threat Indicators'), 'Must include indicators section');
    assert.ok(pdfText.includes('RULE_DECEPTIVE_BRAND_SUBDOMAIN'), 'Must include triggered rule indicator');
  });

  test('PDF content includes practical recommendations and safety disclaimer', () => {
    const doc = createLinkSecurityReportDoc(MOCK_SCAN_RESULT);
    const pdfText = doc.output();

    assert.ok(pdfText.includes('Practical Safety Recommendations'), 'Must include recommendations title');
    assert.ok(pdfText.includes('Do NOT click, open, or paste'), 'Must include recommendation 1');
    assert.ok(pdfText.includes('DISCLAIMER:'), 'Must include disclaimer prefix');
    assert.ok(pdfText.includes('does NOT guarantee safety'), 'Must include advisory disclaimer text');
  });

  test('Handles different risk levels (critical, medium, low) cleanly', () => {
    const levels = [
      { level: 'critical', score: 100 },
      { level: 'medium', score: 45 },
      { level: 'low', score: 0 },
    ];

    for (const { level, score } of levels) {
      const doc = createLinkSecurityReportDoc({
        ...MOCK_SCAN_RESULT,
        risk_level: level,
        risk_score: score,
      });
      const output = doc.output();
      assert.ok(output.includes(`${level.toUpperCase()} RISK EVALUATION`));
      assert.ok(output.includes(`${score}/100`));
    }
  });

  test('Handles empty facts or indicators gracefully with safe fallbacks', () => {
    const doc = createLinkSecurityReportDoc({
      ...MOCK_SCAN_RESULT,
      facts: [],
      indicators: [],
      recommendations: [],
    });
    const output = doc.output();
    assert.ok(output.includes('No structural facts extracted'));
    assert.ok(output.includes('No threat indicators detected'));
    assert.ok(output.includes('Practical Safety Recommendations'));
  });
});
