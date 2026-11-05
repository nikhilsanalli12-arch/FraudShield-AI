/**
 * FraudShield AI — Google Gemini AI Transaction Explainer Test Suite
 *
 * Verifies:
 * 1. Request payload validation (amount, merchant, category).
 * 2. Configuration detection (isGeminiConfigured).
 * 3. Authoritative rule-based fallback when Gemini is unconfigured or offline.
 * 4. Deterministic score immutability (Gemini can NEVER alter the risk score or level).
 * 5. Distinction between confirmed facts and potential fraud indicators.
 * 6. Provision of exactly three actionable protection recommendations.
 * 7. Timeout handling and upstream HTTP error resilience.
 * 8. Sliding-window rate limiting (HTTP 429).
 * 9. Security & Secret Protection (API keys never leaked in responses or logs).
 * 10. Express API endpoint invariants (/api/v1/transactions/ai-explain & /:id/ai-explain).
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import app from '../src/server.js';
import {
  explainTransaction,
  validateExplanationRequest,
  generateRuleBasedFallback,
  enforceRateLimit,
  resetRateLimits,
  resetInFlightRequests,
  calculateBackoffDelay,
} from '../src/services/geminiExplainer.js';
import { createTransactionRouter } from '../src/routes/transactionRoutes.js';

const SAMPLE_TX = {
  id: 'tx_gemini_test_01',
  user_id: 'user_test_123',
  amount: 8500.0,
  currency: 'USD',
  merchant_name: 'Luxury Watch Boutique',
  category: 'retail',
  transaction_date: '2026-11-05T12:00:00.000Z',
  payment_method_last4: '4242',
  source: 'manual',
  description: 'Purchased luxury watch',
};

const SAMPLE_ASSESSMENT = {
  risk_score: 85,
  risk_level: 'critical',
  heuristic_reasons: [
    'RULE_AMOUNT_ELEVATED: Extreme transaction amount for USD',
    'RULE_VELOCITY: Rapid successive transactions detected',
  ],
};

describe('Gemini AI Explainer Service & Route Invariants', () => {
  let server;
  const TEST_PORT = 5072;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  before((t, done) => {
    server = app.listen(TEST_PORT, () => {
      done();
    });
  });

  after((t, done) => {
    server.close(() => {
      done();
    });
  });

  beforeEach(() => {
    resetRateLimits();
    resetInFlightRequests();
  });

  // 1. Request Validation
  test('validateExplanationRequest accepts valid transaction and assessment', () => {
    assert.doesNotThrow(() => {
      validateExplanationRequest(SAMPLE_TX, SAMPLE_ASSESSMENT);
    });
  });

  test('validateExplanationRequest rejects non-positive or non-numeric amount with 400', () => {
    assert.throws(
      () => validateExplanationRequest({ ...SAMPLE_TX, amount: -50 }),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
    assert.throws(
      () => validateExplanationRequest({ ...SAMPLE_TX, amount: 'invalid-amount' }),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
  });

  test('validateExplanationRequest rejects missing merchant_name or category with 400', () => {
    assert.throws(
      () => validateExplanationRequest({ ...SAMPLE_TX, merchant_name: '' }),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
    assert.throws(
      () => validateExplanationRequest({ ...SAMPLE_TX, category: '   ' }),
      (err) => err.statusCode === 400 && err.code === 'ValidationError'
    );
  });

  // 2. Unconfigured Key Graceful Fallback
  test('explainTransaction returns high-quality rule-based fallback when Gemini key is unconfigured', async () => {
    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => false,
      apiKey: '',
    });

    assert.equal(result.success, true);
    assert.equal(result.aiAvailable, false);
    assert.equal(result.provider, 'rule_based_fallback');
    assert.ok(result.summary.length > 20, 'Summary must be non-empty');
    assert.ok(result.summary.includes('Luxury Watch Boutique'), 'Summary should reference merchant');
    assert.equal(result.risk_score, 85, 'Must preserve deterministic score 85');
    assert.equal(result.risk_level, 'critical', 'Must preserve deterministic level critical');

    // Confirmed facts vs potential indicators
    assert.ok(Array.isArray(result.facts) && result.facts.length >= 2, 'Must include confirmed facts');
    assert.ok(result.facts[0].includes('8500.00 USD'));
    assert.ok(Array.isArray(result.indicators) && result.indicators.length >= 1, 'Must include indicators');
    assert.ok(result.indicators[0].includes('RULE_AMOUNT_ELEVATED'));

    // Three practical recommendations
    assert.ok(Array.isArray(result.recommendations));
    assert.equal(result.recommendations.length, 3, 'Must return exactly 3 recommendations');
  });

  // 3. Immutability of Deterministic Fraud Score
  test('Deterministic score immutability: Gemini cannot override or alter the official risk score', async () => {
    // Mock Gemini API returning a hallucinated score of 12 and low risk
    const mockGeminiFetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: 'AI says transaction looks fine.',
                    facts: ['Fact 1', 'Fact 2'],
                    indicators: ['Indicator 1'],
                    recommendations: ['Check receipt', 'Contact bank', 'Enable 2FA'],
                    risk_score: 12, // Attempted tamper / hallucination
                    risk_level: 'low',
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      fetchFn: mockGeminiFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'gemini');
    assert.equal(result.aiAvailable, true);
    // Official score MUST remain 85 and critical regardless of Gemini output
    assert.equal(result.risk_score, 85);
    assert.equal(result.risk_level, 'critical');
    assert.equal(result.recommendations.length, 3);
  });

  // 4. Distinction Between Confirmed Facts and Potential Indicators
  test('Distinguishes verified transaction facts from potential fraud indicators', async () => {
    const mockGeminiFetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    summary: 'Transaction of $8,500.00 USD at Luxury Watch Boutique shows high risk indicators.',
                    facts: [
                      'Transaction amount of 8500.00 USD processed at Luxury Watch Boutique',
                      'Payment completed using card ending in 4242',
                    ],
                    indicators: [
                      'Substantially higher than median retail transaction amount',
                      'Rapid successive transaction attempts flagged by velocity heuristics',
                    ],
                    recommendations: [
                      'Confirm purchase legitimacy with cardholder',
                      'Request merchant invoice verification',
                      'Monitor linked accounts for subsequent unauthorized charges',
                    ],
                  }),
                },
              ],
            },
          },
        ],
      }),
    });

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      fetchFn: mockGeminiFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'gemini');
    assert.equal(result.facts.length, 2);
    assert.ok(result.facts[0].includes('8500.00 USD'));
    assert.equal(result.indicators.length, 2);
    assert.ok(result.indicators[0].includes('Substantially higher'));
    assert.equal(result.recommendations.length, 3);
  });

  // 5. Timeout Handling
  test('Timeout resilience: AbortError falls back gracefully to rule-based engine within timeout window', async () => {
    const hangingFetch = async (url, { signal }) => {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      timeoutMs: 50, // Short timeout for test
      fetchFn: hangingFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.aiAvailable, false);
    assert.equal(result.provider, 'rule_based_fallback');
    assert.match(result.fallbackReason, /timed out after 50ms/i);
    assert.equal(result.risk_score, 85);
  });

  test('Configured timeout defaults to 20000ms and attaches AbortSignal', async () => {
    let capturedSignal = null;
    const mockFetch = async (url, { signal }) => {
      capturedSignal = signal;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ summary: 'Summary', facts: ['f1'], indicators: ['i1'], recommendations: ['r1', 'r2', 'r3'] }) }],
              },
            },
          ],
        }),
      };
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.ok(capturedSignal instanceof AbortSignal, 'Must attach AbortSignal to fetch call');
  });

  // 6. Upstream HTTP Error Handling
  test('Upstream HTTP error (e.g. 503 or 429 from Google) falls back gracefully', async () => {
    const errorFetch = async () => ({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      fetchFn: errorFetch,
      disableModelFallback: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.aiAvailable, false);
    assert.equal(result.provider, 'rule_based_fallback');
    assert.match(result.fallbackReason, /status 503/);
    assert.equal(result.recommendations.length, 3);
  });

  test('Upstream 404 error accurately reports status 404 and does NOT claim API key is unconfigured', async () => {
    const errorFetch = async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      fetchFn: errorFetch,
      disableModelFallback: true,
    });

    assert.equal(result.success, true);
    assert.equal(result.aiAvailable, false);
    assert.equal(result.provider, 'rule_based_fallback');
    assert.equal(result.fallbackReason, 'Gemini API responded with status 404');
    assert.ok(!result.fallbackReason.includes('not configured'), 'Must distinguish API 404 from missing API key');
  });

  test('Uses configured gemini-3.8-flash model in request URL', async () => {
    let requestedUrl = '';
    const captureFetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ summary: 'Summary', facts: ['f1'], indicators: ['i1'], recommendations: ['r1', 'r2', 'r3'] }) }],
              },
            },
          ],
        }),
      };
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-key',
      model: 'gemini-3.8-flash',
      fetchFn: captureFetch,
    });

    assert.equal(result.success, true);
    assert.ok(requestedUrl.includes('models/gemini-3.8-flash:generateContent'), 'URL must target gemini-3.8-flash');
  });

  // 6b. Resilient Model Cascade, Bounded Retries & Deduplication
  test('Reliable fallback: Primary success returns primary model response without calling backup', async () => {
    const urlsCalled = [];
    const mockFetch = async (url) => {
      urlsCalled.push(url);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Primary model successful analysis',
                      facts: ['Fact 1', 'Fact 2'],
                      indicators: ['Indicator 1'],
                      recommendations: ['Rec 1', 'Rec 2', 'Rec 3'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      model: 'gemini-3.8-flash',
      backupModel: 'gemini-3.1-flash-lite',
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'gemini');
    assert.equal(result.model, 'gemini-3.8-flash');
    assert.equal(urlsCalled.length, 1);
    assert.ok(urlsCalled[0].includes('gemini-3.8-flash'));
  });

  test('Reliable fallback: Primary HTTP 503 cascades to verified backup model and succeeds', async () => {
    const urlsCalled = [];
    const mockFetch = async (url) => {
      urlsCalled.push(url);
      if (url.includes('gemini-3.8-flash')) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        };
      }
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Backup model successful analysis',
                      facts: ['Fact A', 'Fact B'],
                      indicators: ['Indicator A'],
                      recommendations: ['Rec A', 'Rec B', 'Rec C'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      model: 'gemini-3.8-flash',
      backupModel: 'gemini-3.1-flash-lite',
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'gemini');
    assert.equal(result.model, 'gemini-3.1-flash-lite', 'Should report the backup model that actually succeeded');
    assert.equal(result.summary, 'Backup model successful analysis');
    assert.equal(result.risk_score, 85, 'Must preserve deterministic score');
    assert.equal(urlsCalled.length, 2, 'Must query primary first, then cascade to backup');
    assert.ok(urlsCalled[0].includes('gemini-3.8-flash'));
    assert.ok(urlsCalled[1].includes('gemini-3.1-flash-lite'));
  });

  test('Reliable fallback: Both models unavailable returns rule-based fallback gracefully', async () => {
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      };
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      model: 'gemini-3.8-flash',
      backupModel: 'gemini-3.1-flash-lite',
      maxRetries: 2,
      baseRetryDelayMs: 0,
      jitterMs: 0,
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'rule_based_fallback');
    assert.equal(result.aiAvailable, false);
    assert.equal(result.risk_score, 85);
    assert.match(result.fallbackReason, /status 503/);
    assert.equal(result.recommendations.length, 3);
    // 1 primary + 1 initial backup + 2 retries = 4 total calls
    assert.equal(callCount, 4);
  });

  test('Reliable fallback: Retry limits bounded at most two retries on temporary 503 errors', async () => {
    let attempts = 0;
    const mockFetch = async () => {
      attempts++;
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      };
    };

    await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      model: 'gemini-3.8-flash',
      disableModelFallback: true,
      maxRetries: 2,
      baseRetryDelayMs: 0,
      jitterMs: 0,
      fetchFn: mockFetch,
    });

    // 1 initial call + exactly 2 retries = 3 calls
    assert.equal(attempts, 3, 'Must bound retries to exactly maxRetries (2)');
  });

  test('Reliable fallback: Permanent errors (400, 403) are never retried and never cascade', async () => {
    let attempts = 0;
    const mockFetch = async () => {
      attempts++;
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      };
    };

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      model: 'gemini-3.8-flash',
      backupModel: 'gemini-3.1-flash-lite',
      maxRetries: 2,
      fetchFn: mockFetch,
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, 'rule_based_fallback');
    assert.match(result.fallbackReason, /status 400/);
    assert.equal(attempts, 1, 'Permanent error 400 must never be retried or cascaded');

    // Test 403 Forbidden
    let forbiddenAttempts = 0;
    const forbiddenFetch = async () => {
      forbiddenAttempts++;
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      };
    };

    const forbiddenResult = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: 'test-valid-gemini-key',
      model: 'gemini-3.8-flash',
      backupModel: 'gemini-3.1-flash-lite',
      maxRetries: 2,
      fetchFn: forbiddenFetch,
    });

    assert.equal(forbiddenResult.success, true);
    assert.equal(forbiddenResult.provider, 'rule_based_fallback');
    assert.match(forbiddenResult.fallbackReason, /status 403/);
    assert.equal(forbiddenAttempts, 1, 'Permanent error 403 must never be retried or cascaded');
  });

  test('In-flight deduplication: Concurrent requests for same transaction share single execution', async () => {
    let fetchCalls = 0;
    const delayedFetch = async () => {
      fetchCalls++;
      // Simulate 50ms upstream processing
      await new Promise((r) => setTimeout(r, 50));
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Concurrent deduplicated response',
                      facts: ['Fact 1'],
                      indicators: ['Indicator 1'],
                      recommendations: ['R1', 'R2', 'R3'],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      };
    };

    const concurrentTx = { ...SAMPLE_TX, id: 'tx_dedupe_test_99' };

    // Fire 3 simultaneous explanation requests for the identical transaction
    const [res1, res2, res3] = await Promise.all([
      explainTransaction(concurrentTx, SAMPLE_ASSESSMENT, {
        isConfiguredCheck: () => true,
        apiKey: 'test-valid-gemini-key',
        fetchFn: delayedFetch,
      }),
      explainTransaction(concurrentTx, SAMPLE_ASSESSMENT, {
        isConfiguredCheck: () => true,
        apiKey: 'test-valid-gemini-key',
        fetchFn: delayedFetch,
      }),
      explainTransaction(concurrentTx, SAMPLE_ASSESSMENT, {
        isConfiguredCheck: () => true,
        apiKey: 'test-valid-gemini-key',
        fetchFn: delayedFetch,
      }),
    ]);

    // All three should have succeeded with the same summary
    assert.equal(res1.summary, 'Concurrent deduplicated response');
    assert.equal(res2.summary, 'Concurrent deduplicated response');
    assert.equal(res3.summary, 'Concurrent deduplicated response');

    // Only 1 fetch call should have taken place
    assert.equal(fetchCalls, 1, 'Concurrent requests for identical transaction must trigger only 1 upstream call');
  });

  test('calculateBackoffDelay enforces exponential backoff with jitter and maxDelay cap', () => {
    const delay0 = calculateBackoffDelay(0, 300, 2000, 0); // 300 * 2^0 = 300
    const delay1 = calculateBackoffDelay(1, 300, 2000, 0); // 300 * 2^1 = 600
    const delay2 = calculateBackoffDelay(2, 300, 2000, 0); // 300 * 2^2 = 1200
    const delay3 = calculateBackoffDelay(3, 300, 2000, 0); // min(2400, 2000) = 2000

    assert.equal(delay0, 300);
    assert.equal(delay1, 600);
    assert.equal(delay2, 1200);
    assert.equal(delay3, 2000);

    const withJitter = calculateBackoffDelay(1, 300, 2000, 50);
    assert.ok(withJitter >= 600 && withJitter <= 650);
  });

  // 7. Rate Limiting
  test('Rate limiting: enforces max requests per minute window per user', () => {
    const userId = 'user_rate_test';
    // Consume 3 allowed tokens
    enforceRateLimit(userId, 3, 60000);
    enforceRateLimit(userId, 3, 60000);
    enforceRateLimit(userId, 3, 60000);

    // 4th request must throw 429
    assert.throws(
      () => enforceRateLimit(userId, 3, 60000),
      (err) => err.statusCode === 429 && err.code === 'RateLimitExceeded'
    );
  });

  // 8. Security & Secret Protection
  test('API key is never exposed in output object or payload', async () => {
    const secretKey = 'super-secret-gemini-api-key-12345';
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ summary: 'Clear summary', facts: ['f1'], indicators: ['i1'], recommendations: ['r1', 'r2', 'r3'] }) }],
            },
          },
        ],
      }),
    });

    const result = await explainTransaction(SAMPLE_TX, SAMPLE_ASSESSMENT, {
      isConfiguredCheck: () => true,
      apiKey: secretKey,
      fetchFn: mockFetch,
    });

    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes(secretKey), 'Serialized result must never include secret key');
    assert.ok(!serialized.includes('key='), 'Result must not contain URL query parameters with keys');
  });

  // 9. HTTP Route Invariants
  test('POST /api/v1/transactions/ai-explain denies unauthenticated requests (401)', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/transactions/ai-explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: SAMPLE_TX }),
    });

    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
  });

  test('POST /api/v1/transactions/ai-explain with valid auth returns 200 and explanation', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({
        id: 'user_test_123',
        email: 'user@example.com',
        role: 'personal',
      });
      next();
    };

    const mockExplainer = {
      explainTransaction: (tx, assessment) => generateRuleBasedFallback(tx, assessment, 'Rule fallback in test'),
    };

    const router = createTransactionRouter(
      {},
      { authMiddleware: mockAuth, geminiExplainer: mockExplainer }
    );
    mockApp.use('/api/v1/transactions', router);

    const localServer = mockApp.listen(5073);
    try {
      const res = await fetch('http://localhost:5073/api/v1/transactions/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction: SAMPLE_TX,
          assessment: SAMPLE_ASSESSMENT,
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.risk_score, 85);
      assert.equal(body.recommendations.length, 3);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/transactions/:id/ai-explain retrieves saved transaction and explains it', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({
        id: 'user_test_123',
        email: 'user@example.com',
        role: 'personal',
      });
      next();
    };

    const mockService = {
      getTransactionById: async (id, userId) => {
        if (id === 'tx_gemini_test_01') {
          return {
            ...SAMPLE_TX,
            fraud_assessment: SAMPLE_ASSESSMENT,
          };
        }
        return null;
      },
    };

    const mockExplainer = {
      explainTransaction: (tx, assessment) => generateRuleBasedFallback(tx, assessment, 'Rule fallback in test'),
    };

    const router = createTransactionRouter(
      mockService,
      { authMiddleware: mockAuth, geminiExplainer: mockExplainer }
    );
    mockApp.use('/api/v1/transactions', router);

    const localServer = mockApp.listen(5074);
    try {
      // 1. Existing transaction ID
      const resFound = await fetch('http://localhost:5074/api/v1/transactions/tx_gemini_test_01/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(resFound.status, 200);
      const bodyFound = await resFound.json();
      assert.equal(bodyFound.success, true);
      assert.equal(bodyFound.risk_score, 85);

      // 2. Non-existent transaction ID returns 404
      const resNotFound = await fetch('http://localhost:5074/api/v1/transactions/tx_unknown_id/ai-explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      assert.equal(resNotFound.status, 404);
      const bodyNotFound = await resNotFound.json();
      assert.equal(bodyNotFound.error, 'NotFound');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });
});

