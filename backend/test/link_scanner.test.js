/**
 * FraudShield AI — Suspicious Link Scanner Test Suite
 *
 * Verifies:
 * 1. Static input validation (length limits, control characters, null bytes).
 * 2. Protocol checks (unencrypted HTTP flagged, dangerous schemes blocked).
 * 3. IP-address hostnames (IPv4, IPv6, hex/octal).
 * 4. Lookalike brand domains & typosquatting.
 * 5. Deceptive brand subdomains (e.g. brand in subdomain, unfamiliar SLD).
 * 6. URL shortener detection.
 * 7. Excessive subdomain nesting depth.
 * 8. Dangerous file download extensions (.exe, .scr, .apk).
 * 9. Safe URL defanging (hxxp/hxxps and [.]).
 * 10. Separation of verified facts from heuristic threat indicators.
 * 11. Immutability of deterministic risk score against AI tampering.
 * 12. Provision of exactly 3 practical safety recommendations.
 * 13. Graceful fallback when Gemini is offline or unconfigured.
 * 14. Sliding-window rate limiting (HTTP 429).
 * 15. Zero-fetch / Anti-SSRF invariant: No outgoing HTTP/DNS requests made for target URL.
 * 16. Express API route invariants (/api/v1/links/scan).
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import app from '../src/server.js';
import {
  analyzeUrlStatic,
  defangUrl,
  isIpAddressHostname,
  detectLookalikeBrand,
  generateLinkRuleBasedFallback,
  scanLink,
  enforceLinkScannerRateLimit,
  resetLinkScannerRateLimits,
} from '../src/services/linkScanner.js';
import { createLinkRouter } from '../src/routes/linkRoutes.js';

describe('Suspicious Link Scanner — Static Analysis & Service Invariants', () => {
  let server;
  const TEST_PORT = 5082;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  before((t, done) => {
    server = app.listen(TEST_PORT, () => done());
  });

  after((t, done) => {
    server.close(() => done());
  });

  beforeEach(() => {
    resetLinkScannerRateLimits();
  });

  // 1. Input Validation
  test('Rejects empty or non-string URL input with 400', () => {
    assert.throws(
      () => analyzeUrlStatic(''),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
    assert.throws(
      () => analyzeUrlStatic('   '),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
  });

  test('Rejects URLs exceeding 2048 characters with 400', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2050);
    assert.throws(
      () => analyzeUrlStatic(longUrl),
      (err) => err.statusCode === 400 && err.message.includes('maximum allowable length')
    );
  });

  test('Rejects binary control characters and null bytes with 400', () => {
    assert.throws(
      () => analyzeUrlStatic('https://example.com/login\x00malicious'),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
  });

  test('Blocks dangerous execution schemes (javascript:, file:, data:) with 100 critical risk', () => {
    const result = analyzeUrlStatic('javascript:alert(document.cookie)');
    assert.equal(result.isValidUrl, false);
    assert.equal(result.isBlockedScheme, true);
    assert.equal(result.riskScore, 100);
    assert.equal(result.riskLevel, 'critical');
    assert.ok(result.indicators[0].includes('RULE_DANGEROUS_SCHEME'));
  });

  // 2. Defanging
  test('defangUrl neutralizes protocols and dots properly', () => {
    assert.equal(defangUrl('https://malicious.example.com/path'), 'hxxps[://]malicious[.]example[.]com/path');
    assert.equal(defangUrl('http://insecure.test/file'), 'hxxp[://]insecure[.]test/file');
  });

  // 3. Protocol Security
  test('Unencrypted HTTP protocol triggers RULE_HTTP_INSECURE indicator and increases risk score', () => {
    const result = analyzeUrlStatic('http://example.com/login');
    assert.equal(result.isValidUrl, true);
    assert.equal(result.scheme, 'http');
    assert.ok(result.heuristicCodes.includes('RULE_HTTP_INSECURE'));
    assert.ok(result.riskScore >= 25);
  });

  // 4. IP-Address Hostname Detection
  test('Identifies IPv4 dot-decimal hostnames as high risk', () => {
    const result = analyzeUrlStatic('http://192.168.1.1/admin/login');
    assert.ok(result.heuristicCodes.includes('RULE_IP_HOSTNAME'));
    assert.ok(result.riskScore >= 70);
    assert.ok(['high', 'critical'].includes(result.riskLevel));
  });

  test('isIpAddressHostname helper accurately detects IPv4 and IPv6 variants', () => {
    assert.equal(isIpAddressHostname('192.168.1.1'), true);
    assert.equal(isIpAddressHostname('10.0.0.254'), true);
    assert.equal(isIpAddressHostname('2001:0db8:85a3:0000:0000:8a2e:0370:7334'), true);
    assert.equal(isIpAddressHostname('[::1]'), true);
    assert.equal(isIpAddressHostname('legitimate-bank.com'), false);
  });

  // 5. Lookalike Brand / Typosquatting Detection
  test('Detects brand typosquatting in domain names', () => {
    const result = analyzeUrlStatic('https://paypa1-security-check.com/login');
    assert.ok(result.heuristicCodes.includes('RULE_BRAND_TYPOSQUAT'));
    assert.ok(result.indicators.some((i) => i.includes('paypal')));
    assert.ok(result.riskScore >= 45);
  });

  // 6. Deceptive Brand Subdomains
  test('Detects reputable brand names nested within deceptive subdomains', () => {
    // "paypal" in subdomain, but real destination is "verify-login.xyz"
    const result = analyzeUrlStatic('https://paypal.com.verify-login.xyz/account');
    assert.ok(result.heuristicCodes.includes('RULE_DECEPTIVE_BRAND_SUBDOMAIN'));
    assert.ok(result.riskScore >= 70);
    assert.equal(result.riskLevel, 'high');
  });

  // 7. URL Shorteners
  test('Identifies known URL shorteners (bit.ly, tinyurl.com)', () => {
    const result = analyzeUrlStatic('https://bit.ly/3xY8abc');
    assert.ok(result.heuristicCodes.includes('RULE_URL_SHORTENER'));
    assert.ok(result.riskScore >= 30);
  });

  // 8. Excessive Subdomains
  test('Flags excessive subdomain nesting depth', () => {
    const result = analyzeUrlStatic('https://a.b.c.d.e.suspicious-domain.com/index');
    assert.ok(result.heuristicCodes.includes('RULE_EXCESSIVE_SUBDOMAINS'));
  });

  // 9. Dangerous Payload Extensions
  test('Flags executable and script download extensions in path (.exe, .apk, .scr)', () => {
    const result = analyzeUrlStatic('https://updates-center.net/security-patch.exe');
    assert.ok(result.heuristicCodes.includes('RULE_DANGEROUS_DOWNLOAD'));
    assert.ok(result.riskScore >= 55);
  });

  // 10. Clean Baseline URL
  test('Clean baseline HTTPS website receives low risk score and no threat flags', () => {
    const result = analyzeUrlStatic('https://docs.github.com/en/rest');
    assert.equal(result.isValidUrl, true);
    assert.equal(result.riskScore, 0);
    assert.equal(result.riskLevel, 'low');
    assert.equal(result.heuristicCodes.length, 0);
  });

  // 11. Facts vs Indicators Distinction
  test('Strictly separates verified structural facts from heuristic threat indicators', () => {
    const result = analyzeUrlStatic('http://192.168.1.50:8080/portal?token=abc');
    // Facts contain canonical protocol, hostname, path, port
    assert.ok(result.facts.some((f) => f.includes('Canonical Protocol: HTTP')));
    assert.ok(result.facts.some((f) => f.includes('192.168.1.50')));
    assert.ok(result.facts.some((f) => f.includes('Port: 8080')));

    // Indicators contain heuristic observations
    assert.ok(result.indicators.some((i) => i.includes('RULE_IP_HOSTNAME')));
    assert.ok(result.indicators.some((i) => i.includes('RULE_HTTP_INSECURE')));
  });

  // 12. Rule-Based Fallback
  test('generateLinkRuleBasedFallback returns 3 recommendations and advisory disclaimer', () => {
    const analysis = analyzeUrlStatic('https://paypal.com.verify-login.xyz/login');
    const fallback = generateLinkRuleBasedFallback('https://paypal.com.verify-login.xyz/login', analysis);

    assert.equal(fallback.success, true);
    assert.equal(fallback.aiAvailable, false);
    assert.equal(fallback.provider, 'rule_based_fallback');
    assert.equal(fallback.recommendations.length, 3);
    assert.ok(fallback.disclaimer.includes('does NOT guarantee safety'));
    assert.equal(fallback.risk_score, analysis.riskScore);
    assert.equal(fallback.risk_level, analysis.riskLevel);
  });

  // 13. Gemini Explainer Integration & Score Immutability
  test('scanLink preserves deterministic score even if Gemini returns hallucinated score', async () => {
    const mockGeminiFetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: 'AI thinks this is safe.',
                    facts: ['Fact 1', 'Fact 2'],
                    indicators: ['Indicator 1'],
                    recommendations: ['R1', 'R2', 'R3'],
                    risk_score: 5, // Attempted tamper / hallucination
                    risk_level: 'low',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const maliciousUrl = 'https://paypal.com.verify-login.xyz/login';
    const result = await scanLink(maliciousUrl, {
      isConfiguredCheck: () => true,
      apiKey: 'test-key',
      fetchFn: mockGeminiFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'gemini');
    assert.equal(result.aiAvailable, true);
    // Official deterministic score for deceptive subdomain must remain high/critical
    assert.ok(result.risk_score >= 70, `Score must not be tampered by AI (was ${result.risk_score})`);
    assert.notEqual(result.risk_level, 'low', 'Risk level must not be downgraded by AI');
    assert.equal(result.recommendations.length, 3);
    assert.ok(result.disclaimer.includes('does NOT guarantee safety'));
  });

  // 14. Rate Limiting
  test('Rate limiting enforces max scans per window per user', () => {
    const userId = 'user_link_scanner_test';
    enforceLinkScannerRateLimit(userId, 2, 60000);
    enforceLinkScannerRateLimit(userId, 2, 60000);

    assert.throws(
      () => enforceLinkScannerRateLimit(userId, 2, 60000),
      (err) => err.statusCode === 429 && err.code === 'RateLimitExceeded'
    );
  });

  // 15. Zero-Fetch / Anti-SSRF Invariant
  test('Zero-Fetch Anti-SSRF Invariant: scanLink never executes fetch on the analyzed target URL', async () => {
    const fetchedUrls = [];
    const trackingFetch = async (url) => {
      fetchedUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ summary: 'AI summary', facts: ['f1'], indicators: ['i1'], recommendations: ['r1', 'r2', 'r3'] }) }],
              },
            },
          ],
        }),
      };
    };

    const targetUrl = 'http://169.254.169.254/latest/meta-data/'; // Classic AWS metadata SSRF target
    await scanLink(targetUrl, {
      isConfiguredCheck: () => true,
      apiKey: 'test-key',
      fetchFn: trackingFetch,
    });

    // Verify that the target URL was NEVER fetched! Only Google Gemini API was called
    for (const calledUrl of fetchedUrls) {
      assert.ok(
        calledUrl.includes('googleapis.com'),
        `Outgoing call must ONLY target Gemini API. Found illegal fetch: ${calledUrl}`
      );
      assert.ok(!calledUrl.includes('169.254.169.254'), 'Must NEVER fetch target URL');
    }
  });

  // 16. Express HTTP API Route Invariants
  test('POST /api/v1/links/scan denies unauthenticated requests with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/links/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
  });

  test('POST /api/v1/links/scan rejects missing url body with 400', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({ id: 'user_test', email: 'user@test.com', role: 'personal' });
      next();
    };

    const router = createLinkRouter({}, { authMiddleware: mockAuth });
    mockApp.use('/api/v1/links', router);

    const localServer = mockApp.listen(5083);
    try {
      const res = await fetch('http://localhost:5083/api/v1/links/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'ValidationError');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/links/scan succeeds with valid auth and returns complete analysis', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({ id: 'user_test', email: 'user@test.com', role: 'personal' });
      next();
    };

    const mockScanner = {
      scanLink: async (url) => {
        const staticAnalysis = analyzeUrlStatic(url);
        return generateLinkRuleBasedFallback(url, staticAnalysis, 'Mock test scan');
      },
    };

    const router = createLinkRouter(mockScanner, { authMiddleware: mockAuth });
    mockApp.use('/api/v1/links', router);

    const localServer = mockApp.listen(5084);
    try {
      const res = await fetch('http://localhost:5084/api/v1/links/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://paypal.com.verify-login.xyz' }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.risk_score >= 70);
      assert.equal(body.recommendations.length, 3);
      assert.ok(body.defanged_url.includes('hxxps[://]'));
      assert.ok(body.disclaimer.includes('does NOT guarantee safety'));
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });
});
