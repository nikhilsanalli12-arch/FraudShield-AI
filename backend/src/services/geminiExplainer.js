/**
 * FraudShield AI — Google Gemini AI Transaction Explainer Service
 *
 * Generates natural-language fraud explanations, practical protection recommendations,
 * and clear fact/indicator breakdowns using the official Google Gemini API.
 *
 * Security & Reliability Invariants:
 * 1. Backend-Only: Gemini API key is never exposed to frontend code or client payloads.
 * 2. Deterministic Score Integrity: Gemini NEVER alters or overrides the deterministic risk score.
 * 3. Graceful Fallback: If Gemini is unconfigured, times out, or fails, high-quality rule-based analysis is returned.
 * 4. Rate Limiting & Timeouts: In-memory sliding-window limiter and strict 20-second request timeouts.
 * 5. Sanitized Logging: API keys and authorization tokens are strictly scrubbed from all logs.
 */

import { config, isGeminiConfigured } from '../config/environment.js';

// In-memory rate limiting store: userId -> array of timestamps
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15; // 15 requests per minute per user

// In-memory in-flight deduplication store: dedupeKey -> Promise<explanationResult>
const inFlightRequests = new Map();

/**
 * Resets the in-memory rate limit store (used in automated tests).
 */
export function resetRateLimits() {
  rateLimitStore.clear();
}

/**
 * Resets the in-flight deduplication store (used in automated tests).
 */
export function resetInFlightRequests() {
  inFlightRequests.clear();
}

/**
 * Returns the current number of in-flight requests (used in automated tests).
 *
 * @returns {number}
 */
export function getInFlightRequestCount() {
  return inFlightRequests.size;
}

/**
 * Computes a unique deduplication key for a transaction to prevent duplicate concurrent calls.
 *
 * @param {Object} transaction
 * @returns {string|null}
 */
export function getTransactionDeduplicationKey(transaction) {
  if (!transaction || typeof transaction !== 'object') return null;
  if (transaction.id && String(transaction.id).trim()) {
    return `tx:${String(transaction.id).trim()}`;
  }
  const parts = [
    transaction.user_id || '',
    transaction.merchant_name || '',
    transaction.amount || '',
    transaction.transaction_date || '',
  ];
  return `tx_composite:${parts.join(':')}`;
}

/**
 * Calculates exponential backoff delay with jitter.
 *
 * @param {number} attempt - Zero-based retry attempt number (0, 1, ...)
 * @param {number} [baseDelayMs=300] - Base delay in milliseconds
 * @param {number} [maxDelayMs=2000] - Maximum cap in milliseconds
 * @param {number} [jitterMs=100] - Random jitter spread in milliseconds
 * @returns {number} Delay in milliseconds
 */
export function calculateBackoffDelay(attempt, baseDelayMs = 300, maxDelayMs = 2000, jitterMs = 100) {
  if (baseDelayMs <= 0) return 0;
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep helper for backoff delays.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => (ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Checks and records rate limit for a given user or client identifier.
 *
 * @param {string} identifier - User ID or IP address
 * @param {number} [limit=MAX_REQUESTS_PER_WINDOW]
 * @param {number} [windowMs=RATE_LIMIT_WINDOW_MS]
 * @throws {Error} If rate limit is exceeded (HTTP 429)
 */
export function enforceRateLimit(
  identifier,
  limit = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_LIMIT_WINDOW_MS
) {
  if (!identifier) return;

  const now = Date.now();
  const windowStart = now - windowMs;

  const userRequests = rateLimitStore.get(identifier) || [];
  // Evict timestamps outside current sliding window
  const recentRequests = userRequests.filter((ts) => ts > windowStart);

  if (recentRequests.length >= limit) {
    const err = new Error(
      'AI explanation rate limit exceeded. Please wait a minute before requesting another analysis.'
    );
    err.statusCode = 429;
    err.code = 'RateLimitExceeded';
    throw err;
  }

  recentRequests.push(now);
  rateLimitStore.set(identifier, recentRequests);
}

/**
 * Validates transaction and assessment data prior to AI explanation processing.
 *
 * @param {Object} transaction
 * @param {Object} [assessment={}]
 */
export function validateExplanationRequest(transaction, assessment = {}) {
  if (!transaction || typeof transaction !== 'object') {
    const err = new Error('Transaction object is required for AI explanation');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  const rawAmount = transaction.amount;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);

  if (isNaN(numAmount) || numAmount <= 0) {
    const err = new Error('Transaction amount must be a positive number');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  if (!transaction.merchant_name || typeof transaction.merchant_name !== 'string' || !transaction.merchant_name.trim()) {
    const err = new Error('Transaction merchant_name is required');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  if (!transaction.category || typeof transaction.category !== 'string' || !transaction.category.trim()) {
    const err = new Error('Transaction category is required');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }
}

/**
 * Generates an authoritative rule-based fallback explanation when Gemini is unconfigured or unavailable.
 *
 * @param {Object} transaction
 * @param {Object} assessment
 * @param {string} [reason='Gemini service unconfigured']
 * @returns {Object} Structured explanation payload
 */
export function generateRuleBasedFallback(transaction, assessment = {}, reason = 'Gemini service unconfigured') {
  const amount = Number(transaction.amount || 0).toFixed(2);
  const currency = (transaction.currency || 'USD').toUpperCase();
  const merchant = transaction.merchant_name || 'Merchant';
  const category = transaction.category || 'general';
  const dateStr = transaction.transaction_date ? new Date(transaction.transaction_date).toLocaleDateString() : 'recent';
  const last4 = transaction.payment_method_last4;

  const riskScore = typeof assessment.risk_score === 'number' ? assessment.risk_score : 0;
  const riskLevel = assessment.risk_level || (riskScore >= 90 ? 'critical' : riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low');
  const heuristics = Array.isArray(assessment.heuristic_reasons) ? assessment.heuristic_reasons : [];

  // 1. Simple Explanation Summary
  let summary = '';
  if (riskLevel === 'critical' || riskLevel === 'high') {
    const reasonsText = heuristics.length > 0 ? heuristics.join(', ') : 'elevated amount and pattern flags';
    summary = `This transaction of ${amount} ${currency} at ${merchant} was flagged with ${riskLevel.toUpperCase()} risk (${riskScore}/100) due to significant anomaly indicators: ${reasonsText}. Immediate verification is strongly recommended to protect your account.`;
  } else if (riskLevel === 'medium') {
    const reasonsText = heuristics.length > 0 ? heuristics.join(', ') : 'unusual transaction timing or amount';
    summary = `This transaction of ${amount} ${currency} at ${merchant} triggered moderate monitoring flags (${reasonsText}). While it may be authorized, we recommend confirming the payment details.`;
  } else {
    summary = `This transaction of ${amount} ${currency} at ${merchant} is consistent with normal baseline activity. With a low risk score of ${riskScore}/100, no unusual velocity or threshold anomalies were detected.`;
  }

  // 2. Confirmed Facts vs Potential Fraud Indicators
  const facts = [
    `Transaction of ${amount} ${currency} billed to merchant "${merchant}".`,
    `Categorized under "${category}" on ${dateStr}.`,
    last4
      ? `Processed via registered payment card ending in •••• ${last4}.`
      : `Processed via account primary payment method (${transaction.source || 'manual'}).`,
  ];

  const indicators = heuristics.length > 0
    ? heuristics.map((h) => `Observed anomaly indicator: ${h}`)
    : ['No abnormal velocity or monetary threshold flags triggered by deterministic rule engine.'];

  // 3. Three Practical Protection Recommendations
  let recommendations = [];
  if (riskScore >= 70) {
    recommendations = [
      `Check your banking app or monthly card statement immediately to confirm you authorized this ${amount} ${currency} charge at "${merchant}".`,
      `If you do not recognize this purchase, lock your payment card in your banking portal and submit an immediate dispute with your card issuer.`,
      `Verify that multi-factor authentication (2FA) and real-time SMS/push transaction alerts are enabled for all linked financial accounts.`,
    ];
  } else if (riskScore >= 40) {
    recommendations = [
      `Review your purchase receipt or digital invoice from "${merchant}" to ensure the billed total matches the goods or services received.`,
      `If the merchant name is unfamiliar, check if "${merchant}" operates as a parent holding company or third-party billing processor.`,
      `Enable instant transaction push alerts on your mobile banking app to monitor future charges as they occur.`,
    ];
  } else {
    recommendations = [
      `Save or archive the digital receipt from "${merchant}" for personal monthly budgeting and warranty records.`,
      `Periodically review recurring subscriptions to ensure you are only billed for active and desired services.`,
      `Keep account security credentials updated and use strong, unique passwords across your financial portals.`,
    ];
  }

  return {
    success: true,
    provider: 'rule_based_fallback',
    aiAvailable: false,
    model: 'deterministic-heuristic-v1.0',
    fallbackReason: reason,
    summary,
    facts,
    indicators,
    recommendations,
    risk_score: riskScore,
    risk_level: riskLevel,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Builds the structured Google Gemini AI prompt for transaction analysis.
 *
 * @param {Object} transaction
 * @param {Object} assessment
 * @returns {string} Structured prompt
 */
function buildGeminiPrompt(transaction, assessment) {
  const amount = Number(transaction.amount).toFixed(2);
  const currency = (transaction.currency || 'USD').toUpperCase();
  const merchant = transaction.merchant_name;
  const category = transaction.category;
  const dateStr = transaction.transaction_date ? new Date(transaction.transaction_date).toISOString() : 'N/A';
  const last4 = transaction.payment_method_last4 || 'Not provided';
  const source = transaction.source || 'manual';
  const description = transaction.description || 'None provided';

  const riskScore = typeof assessment.risk_score === 'number' ? assessment.risk_score : 0;
  const riskLevel = assessment.risk_level || (riskScore >= 90 ? 'critical' : riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low');
  const heuristics = Array.isArray(assessment.heuristic_reasons) && assessment.heuristic_reasons.length > 0
    ? assessment.heuristic_reasons.join('; ')
    : 'None (Standard baseline transaction)';

  return `You are a financial fraud prevention specialist for FraudShield AI.
Your objective is to generate an objective, consumer-friendly explanation of a transaction's risk profile and provide 3 concrete security recommendations.

STRICT INVARIANTS:
1. Do NOT recalculate or modify the official risk score. The deterministic engine has verified this transaction as Risk Score: ${riskScore}/100 (${riskLevel} risk).
2. Clearly distinguish between CONFIRMED FACTS (verified transaction data) and POTENTIAL FRAUD INDICATORS (observed anomalies or triggered rules).
3. Do not make definitive accusations of criminal conduct. Use professional risk-assessment language.
4. Output exactly THREE practical, actionable recommendations for protecting the user.
5. Return ONLY a valid JSON object matching the requested schema. No markdown formatting, backticks, or preamble.

TRANSACTION DETAILS:
- Amount: ${amount} ${currency}
- Merchant: "${merchant}"
- Category: "${category}"
- Date / Time: ${dateStr}
- Card Last 4: ${last4}
- Ingestion Source: ${source}
- User Note: "${description}"
- Official Deterministic Risk Score: ${riskScore}/100 (${riskLevel} risk)
- Triggered Engine Rules: ${heuristics}

JSON OUTPUT SCHEMA:
{
  "summary": "2-3 clear, jargon-free sentences explaining why this transaction was flagged or why it is considered safe.",
  "facts": [
    "Confirmed fact 1 (e.g. verified merchant, amount, category)",
    "Confirmed fact 2 (e.g. payment method, timestamp)"
  ],
  "indicators": [
    "Potential fraud indicator 1 based on heuristics",
    "Potential fraud indicator 2 or confirmation of clean baseline"
  ],
  "recommendations": [
    "Actionable protection recommendation 1",
    "Actionable protection recommendation 2",
    "Actionable protection recommendation 3"
  ]
}`;
}

/**
 * Analyzes a transaction and fraud assessment using Google Gemini AI,
 * falling back gracefully to deterministic rule-based analysis if unconfigured or unavailable.
 *
 * @param {Object} transaction - Transaction object
 * @param {Object} [assessment={}] - Fraud assessment object
 * @param {Object} [options={}] - Options for testing / dependency injection
 * @returns {Promise<Object>} Formatted explanation payload
 */
export async function explainTransaction(transaction, assessment = {}, options = {}) {
  // 1. Request Validation
  validateExplanationRequest(transaction, assessment);

  // 2. In-flight Deduplication (Avoid duplicate concurrent requests for the same transaction)
  const dedupeKey = getTransactionDeduplicationKey(transaction);
  if (dedupeKey && inFlightRequests.has(dedupeKey) && !options.skipDeduplication) {
    return await inFlightRequests.get(dedupeKey);
  }

  const executionPromise = (async () => {
    // 3. User/Caller Rate Limiting
    const callerId = options.callerId || transaction.user_id || 'anonymous_user';
    if (!options.skipRateLimit) {
      enforceRateLimit(callerId, options.rateLimitMax, options.rateLimitWindowMs);
    }

    // 4. Extract verified deterministic risk score (Gemini is NEVER allowed to mutate this)
    const officialRiskScore = typeof assessment.risk_score === 'number'
      ? assessment.risk_score
      : (typeof transaction.fraud_assessment?.risk_score === 'number' ? transaction.fraud_assessment.risk_score : 0);

    const officialRiskLevel = assessment.risk_level ||
      transaction.fraud_assessment?.risk_level ||
      (officialRiskScore >= 90 ? 'critical' : officialRiskScore >= 70 ? 'high' : officialRiskScore >= 40 ? 'medium' : 'low');

    const normalizedAssessment = {
      ...assessment,
      risk_score: officialRiskScore,
      risk_level: officialRiskLevel,
      heuristic_reasons: assessment.heuristic_reasons || transaction.fraud_assessment?.heuristic_reasons || [],
    };

    // 5. Configuration Check: If Gemini API key is missing, return rule-based fallback immediately
    const isConfiguredCheck = options.isConfiguredCheck || isGeminiConfigured;
    const apiKey = (options.apiKey !== undefined ? options.apiKey : config.geminiApiKey)?.trim();

    if (!isConfiguredCheck() || !apiKey) {
      return generateRuleBasedFallback(
        transaction,
        normalizedAssessment,
        'Google Gemini API key is not configured in backend/.env'
      );
    }

    // 6. Build model selection & resilient retry/fallback parameters
    const primaryModel = options.model || config.geminiModel || 'gemini-3.8-flash';
    const backupModel = options.backupModel || 'gemini-3.1-flash-lite';
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
    const baseRetryDelayMs = options.baseRetryDelayMs !== undefined
      ? options.baseRetryDelayMs
      : (options.fetchFn ? 0 : 300);
    const jitterMs = options.jitterMs !== undefined ? options.jitterMs : (options.fetchFn ? 0 : 100);

    const promptText = buildGeminiPrompt(transaction, normalizedAssessment);
    const requestBody = {
      contents: [
        {
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    };

    const timeoutMs = options.timeoutMs || 20000;
    const fetchFn = options.fetchFn || fetch;

    try {
      const executeSingleCall = async (targetModel) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        try {
          return await fetchFn(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutHandle);
        }
      };

      let activeModel = primaryModel;
      let res = null;
      let primaryError = null;

      try {
        res = await executeSingleCall(primaryModel);
      } catch (err) {
        primaryError = err;
      }

      // On HTTP 503, 404, or request failure/timeout from primary model, cascade to verified backup model if eligible
      const canFallback = !options.disableModelFallback && backupModel && backupModel !== primaryModel;
      const primaryFailed = primaryError || (res && (res.status === 503 || res.status === 404));

      if (canFallback && primaryFailed) {
        const failureReason = primaryError ? primaryError.message : `HTTP ${res.status}`;
        console.warn(`[GeminiExplainer] Primary model ${primaryModel} failed (${failureReason}). Cascading to verified backup model ${backupModel}...`);
        activeModel = backupModel;
        try {
          res = await executeSingleCall(backupModel);
        } catch (backupErr) {
          console.warn(`[GeminiExplainer] Backup model ${backupModel} initial call failed:`, backupErr.message);
          throw backupErr;
        }
      } else if (primaryError) {
        throw primaryError;
      }

      // If active model returned temporary HTTP 503, perform at most two bounded retries with exponential backoff & jitter
      // Permanent errors (such as 400 or 403) are strictly never retried
      let retryCount = 0;
      while (res && res.status === 503 && retryCount < maxRetries) {
        const delay = calculateBackoffDelay(retryCount, baseRetryDelayMs, 2000, jitterMs);
        console.warn(`[GeminiExplainer] Model ${activeModel} returned 503. Retrying (${retryCount + 1}/${maxRetries}) after ${delay}ms...`);
        if (delay > 0) {
          await sleep(delay);
        }
        res = await executeSingleCall(activeModel);
        retryCount++;
      }

      if (!res.ok) {
        console.warn(`[GeminiExplainer] Gemini API returned status ${res.status}. Falling back to rule-based engine.`);
        return generateRuleBasedFallback(
          transaction,
          normalizedAssessment,
          `Gemini API responded with status ${res.status}`
        );
      }

      const data = await res.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        console.warn('[GeminiExplainer] Empty response from Gemini API. Falling back to rule-based engine.');
        return generateRuleBasedFallback(
          transaction,
          normalizedAssessment,
          'Empty candidate output from Gemini API'
        );
      }

      // Parse returned JSON safely
      let parsed;
      try {
        parsed = JSON.parse(candidateText.trim());
      } catch {
        // In case of slight markdown encapsulation e.g. ```json ... ```
        const match = candidateText.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error('Failed to parse Gemini response as JSON');
        }
      }

      // Normalize output structure
      const summary = typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : generateRuleBasedFallback(transaction, normalizedAssessment).summary;

      const facts = Array.isArray(parsed.facts) && parsed.facts.length > 0
        ? parsed.facts.map(String)
        : generateRuleBasedFallback(transaction, normalizedAssessment).facts;

      const indicators = Array.isArray(parsed.indicators) && parsed.indicators.length > 0
        ? parsed.indicators.map(String)
        : generateRuleBasedFallback(transaction, normalizedAssessment).indicators;

      let recommendations = Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations.map(String).slice(0, 3)
        : generateRuleBasedFallback(transaction, normalizedAssessment).recommendations;

      // Ensure exactly 3 recommendations
      if (recommendations.length < 3) {
        const fallbackRecs = generateRuleBasedFallback(transaction, normalizedAssessment).recommendations;
        recommendations = [...recommendations, ...fallbackRecs].slice(0, 3);
      }

      return {
        success: true,
        provider: 'gemini',
        aiAvailable: true,
        model: activeModel,
        summary,
        facts,
        indicators,
        recommendations,
        // INVARIANT: Risk score and level are strictly immutable and derived from deterministic engine
        risk_score: officialRiskScore,
        risk_level: officialRiskLevel,
        analyzed_at: new Date().toISOString(),
      };
    } catch (err) {
      const isTimeout = err.name === 'AbortError' || err.code === 20;
      const errorReason = isTimeout
        ? `Gemini API request timed out after ${timeoutMs}ms`
        : 'Gemini API communication failure';

      console.warn(`[GeminiExplainer] ${errorReason}. Falling back to rule-based assessment.`);

      return generateRuleBasedFallback(transaction, normalizedAssessment, errorReason);
    }
  })();

  if (dedupeKey && !options.skipDeduplication) {
    inFlightRequests.set(dedupeKey, executionPromise);
  }

  try {
    return await executionPromise;
  } finally {
    if (dedupeKey) {
      inFlightRequests.delete(dedupeKey);
    }
  }
}

