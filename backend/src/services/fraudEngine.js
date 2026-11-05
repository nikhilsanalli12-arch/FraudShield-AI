/**
 * FraudShield AI — Deterministic Rule-Based Fraud Engine
 *
 * Provides transparent, explainable, rule-based fraud risk scoring for transactions.
 * Designed to be strictly deterministic, testable, and independent of Express and Supabase.
 *
 * Scoring Scale: 0 – 100
 * Risk Levels:
 *   - 0 – 29   : low
 *   - 30 – 69  : medium
 *   - 70 – 89  : high
 *   - 90 – 100 : critical
 *
 * Evaluation Rules:
 *   1. Unusually high transaction amount (currency-aware thresholds)
 *   2. Transaction velocity (> 3 transactions within 5 minutes)
 *   3. Unusual round-number transaction amounts
 *   4. Repeated transaction attempts (identical merchant & amount within 60 minutes)
 */

export const MODEL_VERSION = 'rule-engine-v1';

/**
 * Currency-aware transaction thresholds for elevated and extreme amounts.
 */
export const CURRENCY_THRESHOLDS = Object.freeze({
  USD: { elevated: 5000, extreme: 10000 },
  EUR: { elevated: 5000, extreme: 10000 },
  GBP: { elevated: 4000, extreme: 8000 },
  CAD: { elevated: 6500, extreme: 13000 },
  AUD: { elevated: 7500, extreme: 15000 },
  INR: { elevated: 400000, extreme: 800000 }
});

/**
 * Maps a numeric score (0-100) to a standardized risk level category.
 *
 * @param {number} score
 * @returns {'low' | 'medium' | 'high' | 'critical'}
 */
export function mapScoreToRiskLevel(score) {
  if (score >= 90) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Evaluates a candidate transaction against deterministic rules and historical context.
 *
 * @param {Object} candidateTx - The transaction to evaluate
 * @param {number|string} candidateTx.amount - Transaction amount
 * @param {string} candidateTx.currency - ISO currency code (USD, EUR, GBP, CAD, AUD, INR)
 * @param {string} candidateTx.merchant_name - Merchant name
 * @param {string|Date} candidateTx.transaction_date - ISO date string or Date
 * @param {string} [candidateTx.id] - Optional ID of candidate transaction
 * @param {Array<Object>} [recentHistory=[]] - Historical transactions for context
 * @param {Object} [options={}] - Optional evaluation options
 * @param {boolean} [options.historicalContextAvailable] - Flag indicating history completeness
 * @returns {Object} Consistent assessment result compatible with public.fraud_assessments
 */
export function evaluateTransaction(candidateTx, recentHistory = [], options = {}) {
  if (!candidateTx || typeof candidateTx !== 'object') {
    throw new TypeError('Invalid candidate transaction: expected an object');
  }

  const rawAmount = Number(candidateTx.amount);
  if (isNaN(rawAmount) || rawAmount <= 0) {
    throw new RangeError('Candidate transaction amount must be a positive finite number');
  }

  const currency = typeof candidateTx.currency === 'string'
    ? candidateTx.currency.trim().toUpperCase()
    : 'USD';

  const merchantName = typeof candidateTx.merchant_name === 'string'
    ? candidateTx.merchant_name.trim()
    : '';

  const candidateDate = new Date(candidateTx.transaction_date);
  if (isNaN(candidateDate.getTime())) {
    throw new RangeError('Candidate transaction_date must be a valid timestamp');
  }
  const candidateTime = candidateDate.getTime();

  // Safely normalize recent history array
  const safeHistory = Array.isArray(recentHistory) ? recentHistory : [];
  const candidateId = candidateTx.id || null;

  // Track scoring and explainable heuristic reasons
  let rawScore = 0;
  const heuristicReasons = [];
  const rulesTriggered = [];

  // ============================================================================
  // RULE 1: Unusually High Transaction Amount (Currency-Aware)
  // ============================================================================
  const thresholds = CURRENCY_THRESHOLDS[currency] || CURRENCY_THRESHOLDS.USD;

  if (rawAmount >= thresholds.extreme) {
    rawScore += 45;
    rulesTriggered.push('HIGH_AMOUNT_EXTREME');
    heuristicReasons.push(
      `High transaction amount: ${rawAmount} ${currency} exceeds extreme threshold of ${thresholds.extreme} ${currency}`
    );
  } else if (rawAmount >= thresholds.elevated) {
    rawScore += 25;
    rulesTriggered.push('HIGH_AMOUNT_ELEVATED');
    heuristicReasons.push(
      `Elevated transaction amount: ${rawAmount} ${currency} exceeds standard threshold of ${thresholds.elevated} ${currency}`
    );
  }

  // ============================================================================
  // RULE 2: Transaction Velocity (> 3 transactions within 5 minutes)
  // ============================================================================
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const priorWithinFiveMinutes = safeHistory.filter((tx) => {
    if (!tx || typeof tx !== 'object') return false;
    if (candidateId && tx.id === candidateId) return false;

    const txDate = new Date(tx.transaction_date);
    if (isNaN(txDate.getTime())) return false;

    const diff = Math.abs(candidateTime - txDate.getTime());
    return diff <= FIVE_MINUTES_MS;
  });

  // If there are 3 or more transactions within 5 minutes, velocity threshold is breached
  if (priorWithinFiveMinutes.length >= 3) {
    rawScore += 35;
    rulesTriggered.push('VELOCITY_SPIKE');
    heuristicReasons.push(
      `High transaction velocity: ${priorWithinFiveMinutes.length + 1} transactions detected within a 5-minute window`
    );
  }

  // ============================================================================
  // RULE 3: Unusual Round-Number Transaction Amounts
  // ============================================================================
  if (currency === 'INR') {
    if (rawAmount >= 50000 && rawAmount % 10000 === 0) {
      if (rawAmount >= 200000 && rawAmount % 50000 === 0) {
        rawScore += 25;
        rulesTriggered.push('ROUND_NUMBER_MAJOR');
        heuristicReasons.push(`Unusual large round-number transaction amount: ₹${rawAmount}`);
      } else {
        rawScore += 15;
        rulesTriggered.push('ROUND_NUMBER_MODERATE');
        heuristicReasons.push(`Unusual round-number transaction amount: ₹${rawAmount}`);
      }
    }
  } else {
    // USD, EUR, GBP, CAD, AUD
    if (rawAmount >= 1000 && rawAmount % 100 === 0) {
      if (rawAmount >= 5000 && rawAmount % 500 === 0) {
        rawScore += 25;
        rulesTriggered.push('ROUND_NUMBER_MAJOR');
        heuristicReasons.push(`Unusual large round-number transaction amount: ${rawAmount} ${currency}`);
      } else {
        rawScore += 15;
        rulesTriggered.push('ROUND_NUMBER_MODERATE');
        heuristicReasons.push(`Unusual round-number transaction amount: ${rawAmount} ${currency}`);
      }
    }
  }

  // ============================================================================
  // RULE 4: Repeated Transaction Attempts (Within 60 Minutes)
  // ============================================================================
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const normalizedMerchant = merchantName.toLowerCase();

  const repeatedMatches = safeHistory.filter((tx) => {
    if (!tx || typeof tx !== 'object') return false;
    if (candidateId && tx.id === candidateId) return false;

    const txDate = new Date(tx.transaction_date);
    if (isNaN(txDate.getTime())) return false;

    const diff = Math.abs(candidateTime - txDate.getTime());
    if (diff > ONE_HOUR_MS) return false;

    const txMerchant = typeof tx.merchant_name === 'string'
      ? tx.merchant_name.trim().toLowerCase()
      : '';
    const txAmount = Number(tx.amount);
    const txCurrency = typeof tx.currency === 'string'
      ? tx.currency.trim().toUpperCase()
      : 'USD';

    return (
      txMerchant === normalizedMerchant &&
      txAmount === rawAmount &&
      txCurrency === currency
    );
  });

  if (repeatedMatches.length >= 2) {
    rawScore += 45;
    rulesTriggered.push('REPEATED_ATTEMPTS_MULTIPLE');
    heuristicReasons.push(
      `Multiple repeated transaction attempts: ${repeatedMatches.length} identical prior transactions at "${merchantName}" for ${rawAmount} ${currency} within 60 minutes`
    );
  } else if (repeatedMatches.length === 1) {
    rawScore += 30;
    rulesTriggered.push('REPEATED_ATTEMPTS_SINGLE');
    heuristicReasons.push(
      `Repeated transaction attempt: identical amount of ${rawAmount} ${currency} at "${merchantName}" within 60 minutes`
    );
  }

  // ============================================================================
  // Score Normalization & Output Construction
  // ============================================================================
  const risk_score = Math.min(100, Math.max(0, Math.round(rawScore)));
  const risk_level = mapScoreToRiskLevel(risk_score);

  const historicalContextPresent = typeof options.historicalContextAvailable === 'boolean'
    ? options.historicalContextAvailable
    : safeHistory.length > 0;

  return {
    risk_score,
    risk_level,
    heuristic_reasons: heuristicReasons,
    model_version: MODEL_VERSION,
    metadata: {
      rules_triggered: rulesTriggered,
      history_records_evaluated: safeHistory.length,
      historical_context_present: historicalContextPresent,
      evaluated_at: new Date().toISOString(),
      currency,
      amount: rawAmount
    }
  };
}

