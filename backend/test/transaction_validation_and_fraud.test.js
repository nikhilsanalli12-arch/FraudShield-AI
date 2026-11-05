/**
 * FraudShield AI — Step 1: Transaction Validation & Fraud Engine Unit Tests
 *
 * Test suite verifying:
 * 1. Transaction schema validation (valid inputs, edge cases, constraint rejections)
 * 2. All 6 supported ISO currencies (USD, EUR, GBP, CAD, AUD, INR)
 * 3. Metadata structure constraints matching database functions
 * 4. Individual deterministic fraud engine rules (amount, velocity, round numbers, repeated attempts)
 * 5. Compound fraud rules and risk score boundaries (low, medium, high, critical)
 * 6. Missing or incomplete historical context handling (no silent zero-risk assumptions)
 * 7. Candidate self-exclusion in history evaluation
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  manualTransactionSchema,
  csvTransactionRowSchema,
  validateManualTransaction,
  validateCsvTransactionRow,
  SUPPORTED_CURRENCIES,
  TRANSACTION_TYPES
} from '../src/validators/transactionValidator.js';
import {
  evaluateTransaction,
  mapScoreToRiskLevel,
  CURRENCY_THRESHOLDS,
  MODEL_VERSION
} from '../src/services/fraudEngine.js';

describe('FraudShield AI — Transaction Validation Suite', () => {
  const validBaseTx = {
    amount: 150.25,
    currency: 'USD',
    transaction_type: 'debit',
    merchant_name: 'Stripe Payments Inc',
    category: 'Software & Cloud Services',
    description: 'Monthly cloud hosting fee',
    payment_method_last4: '4242',
    transaction_date: '2026-11-05T12:00:00.000Z',
    source: 'manual',
    is_synthetic: false,
    metadata: {
      account_tier: 'enterprise',
      is_test_fixture: false
    }
  };

  test('Valid manual transaction passes validation with all fields populated', () => {
    const result = validateManualTransaction(validBaseTx);
    assert.equal(result.success, true);
    assert.equal(result.data.amount, 150.25);
    assert.equal(result.data.currency, 'USD');
    assert.equal(result.data.transaction_type, 'debit');
    assert.equal(result.data.merchant_name, 'Stripe Payments Inc');
    assert.equal(result.data.category, 'Software & Cloud Services');
    assert.equal(result.data.description, 'Monthly cloud hosting fee');
    assert.equal(result.data.payment_method_last4, '4242');
    assert.equal(result.data.is_synthetic, false);
    assert.equal(result.errors, null);
  });

  test('Minimal manual transaction applies database-compatible defaults', () => {
    const minimalTx = {
      amount: 45,
      currency: 'USD',
      merchant_name: 'Metro Transit',
      category: 'Transportation',
      transaction_date: '2026-11-05T08:30:00Z'
    };
    const result = validateManualTransaction(minimalTx);
    assert.equal(result.success, true);
    assert.equal(result.data.amount, 45);
    assert.equal(result.data.transaction_type, 'debit');
    assert.equal(result.data.source, 'manual');
    assert.equal(result.data.description, null);
    assert.equal(result.data.payment_method_last4, null);
    assert.equal(result.data.is_synthetic, false);
    assert.deepEqual(result.data.metadata, {});
  });

  test('Coerces numeric string amounts and trims text fields', () => {
    const raw = {
      amount: '99.99',
      currency: ' usd ',
      merchant_name: '  Acme Supermarket  ',
      category: '  Groceries  ',
      transaction_date: '2026-11-05T10:15:00Z'
    };
    const result = validateManualTransaction(raw);
    assert.equal(result.success, true);
    assert.equal(result.data.amount, 99.99);
    assert.equal(result.data.currency, 'USD');
    assert.equal(result.data.merchant_name, 'Acme Supermarket');
    assert.equal(result.data.category, 'Groceries');
  });

  test('Supports all 6 approved ISO 4217 currencies and rejects others', () => {
    for (const curr of ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR']) {
      const res = validateManualTransaction({
        ...validBaseTx,
        currency: curr
      });
      assert.equal(res.success, true, `Currency ${curr} should be accepted`);
    }

    const invalidCurrencies = ['JPY', 'CHF', 'CNY', 'BTC', 'XYZ', ''];
    for (const curr of invalidCurrencies) {
      const res = validateManualTransaction({
        ...validBaseTx,
        currency: curr
      });
      assert.equal(res.success, false, `Currency ${curr} should be rejected`);
      assert.ok(
        res.errors.some((e) => e.field === 'currency'),
        `Error must point to currency field for ${curr}`
      );
    }
  });

  test('Enforces transaction amount numeric constraints (numeric(14,2) > 0)', () => {
    // Negative amount
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: -10 }).success, false);
    // Zero amount
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: 0 }).success, false);
    // > 2 decimal places
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: 10.999 }).success, false);
    // Non-numeric string
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: 'one-hundred' }).success, false);
    // Exceeds numeric(14,2) max (10^12)
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: 1000000000000 }).success, false);
    // Valid 2 decimals
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: 10.99 }).success, true);
    // Valid whole number
    assert.equal(validateManualTransaction({ ...validBaseTx, amount: 100 }).success, true);
  });

  test('Enforces merchant_name and category non-empty constraints', () => {
    // Empty merchant
    assert.equal(validateManualTransaction({ ...validBaseTx, merchant_name: '' }).success, false);
    // Whitespace-only merchant
    assert.equal(validateManualTransaction({ ...validBaseTx, merchant_name: '   ' }).success, false);
    // Excessively long merchant (> 200 chars)
    assert.equal(validateManualTransaction({ ...validBaseTx, merchant_name: 'A'.repeat(201) }).success, false);
    // Empty category
    assert.equal(validateManualTransaction({ ...validBaseTx, category: '' }).success, false);
    // Excessively long category (> 100 chars)
    assert.equal(validateManualTransaction({ ...validBaseTx, category: 'C'.repeat(101) }).success, false);
  });

  test('Validates payment_method_last4 format strictly (4 digits or null)', () => {
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: '0000' }).success, true);
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: '9999' }).success, true);
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: null }).success, true);
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: '' }).success, true);
    // Invalid last4 values
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: '123' }).success, false);
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: '12345' }).success, false);
    assert.equal(validateManualTransaction({ ...validBaseTx, payment_method_last4: 'abcd' }).success, false);
  });

  test('Validates transaction_date parses to valid calendar date between 2000-2100', () => {
    assert.equal(validateManualTransaction({ ...validBaseTx, transaction_date: 'invalid' }).success, false);
    assert.equal(validateManualTransaction({ ...validBaseTx, transaction_date: '1999-12-31T23:59:59Z' }).success, false);
    assert.equal(validateManualTransaction({ ...validBaseTx, transaction_date: '2101-01-01T00:00:00Z' }).success, false);
    assert.equal(validateManualTransaction({ ...validBaseTx, transaction_date: '2026-11-05T14:30:00Z' }).success, true);
    assert.equal(validateManualTransaction({ ...validBaseTx, transaction_date: new Date('2026-11-05T14:30:00Z') }).success, true);
  });

  test('Validates metadata against database validate_transaction_metadata_structure constraints', () => {
    // Valid custom flat scalars
    const validMeta = {
      ip_country: 'US',
      terminal_id: 104,
      is_flagged_client_side: false
    };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: validMeta }).success, true);

    // Valid reserved system fields
    const validSystemMeta = {
      test_run_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      is_test_fixture: true,
      policy_tag: 'STANDARD_COMPLIANCE_HOLD',
      deidentified_at: '2026-11-05T10:00:00.000Z'
    };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: validSystemMeta }).success, true);

    // Invalid: Nested object (disallowed by DB function)
    const nestedObjMeta = { nested: { disallowed: true } };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: nestedObjMeta }).success, false);

    // Invalid: Nested array (disallowed by DB function)
    const nestedArrMeta = { tags: ['retail', 'weekend'] };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: nestedArrMeta }).success, false);

    // Invalid: Invalid UUID for test_run_id
    const badUuidMeta = { test_run_id: 'not-a-uuid' };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: badUuidMeta }).success, false);

    // Invalid: Non-boolean for is_test_fixture
    const badBoolMeta = { is_test_fixture: 'yes' };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: badBoolMeta }).success, false);

    // Invalid: Unknown policy_tag
    const badTagMeta = { policy_tag: 'CUSTOM_UNKNOWN_TAG' };
    assert.equal(validateManualTransaction({ ...validBaseTx, metadata: badTagMeta }).success, false);
  });

  test('CSV transaction row validation helper assigns source=csv_import', () => {
    const csvRow = {
      amount: '500.00',
      currency: 'CAD',
      merchant_name: 'Nordic Hardware',
      category: 'Supplies',
      transaction_date: '2026-11-05T09:00:00Z'
    };
    const result = validateCsvTransactionRow(csvRow);
    assert.equal(result.success, true);
    assert.equal(result.data.amount, 500);
    assert.equal(result.data.source, 'csv_import');
  });
});

describe('FraudShield AI — Deterministic Fraud Engine Suite', () => {
  const baseTime = new Date('2026-11-05T12:00:00.000Z');

  test('Baseline normal transaction returns score 0 and low risk', () => {
    const candidate = {
      amount: 45.50,
      currency: 'USD',
      merchant_name: 'Downtown Bakery',
      transaction_date: baseTime.toISOString()
    };
    const assessment = evaluateTransaction(candidate, []);
    assert.equal(assessment.risk_score, 0);
    assert.equal(assessment.risk_level, 'low');
    assert.deepEqual(assessment.heuristic_reasons, []);
    assert.equal(assessment.model_version, MODEL_VERSION);
    assert.equal(assessment.metadata.historical_context_present, false);
  });

  test('Single weak signal alone does not flag transaction as high/medium risk', () => {
    // Round number alone ($1,000) adds 15 points -> remains low risk (0-29)
    const roundTx = {
      amount: 1000,
      currency: 'USD',
      merchant_name: 'Office Supplies Inc',
      transaction_date: baseTime.toISOString()
    };
    const res1 = evaluateTransaction(roundTx, []);
    assert.equal(res1.risk_score, 15);
    assert.equal(res1.risk_level, 'low');
    assert.equal(res1.heuristic_reasons.length, 1);

    // Elevated amount alone ($6,123.45 in USD) adds 25 points -> remains low risk (0-29)
    const elevatedTx = {
      amount: 6123.45,
      currency: 'USD',
      merchant_name: 'Tech Equipment Wholesale',
      transaction_date: baseTime.toISOString()
    };
    const res2 = evaluateTransaction(elevatedTx, []);
    assert.equal(res2.risk_score, 25);
    assert.equal(res2.risk_level, 'low');
    assert.equal(res2.heuristic_reasons.length, 1);
  });

  test('Rule 1: Currency-aware elevated and extreme amount thresholds', () => {
    // USD tests
    const usdElevated = evaluateTransaction(
      { amount: 5000.50, currency: 'USD', merchant_name: 'Supplier', transaction_date: baseTime },
      []
    );
    assert.ok(usdElevated.heuristic_reasons[0].includes('Elevated transaction amount'));

    const usdExtreme = evaluateTransaction(
      { amount: 10000.50, currency: 'USD', merchant_name: 'Supplier', transaction_date: baseTime },
      []
    );
    assert.ok(usdExtreme.heuristic_reasons[0].includes('High transaction amount'));
    assert.ok(usdExtreme.heuristic_reasons[0].includes('extreme threshold'));

    // INR tests (Elevated >= ₹400,000, Extreme >= ₹800,000)
    const inrNormal = evaluateTransaction(
      { amount: 350000, currency: 'INR', merchant_name: 'Jewellery Emporium', transaction_date: baseTime },
      []
    );
    assert.equal(inrNormal.metadata.rules_triggered.includes('HIGH_AMOUNT_ELEVATED'), false);

    const inrElevated = evaluateTransaction(
      { amount: 450000.50, currency: 'INR', merchant_name: 'Jewellery Emporium', transaction_date: baseTime },
      []
    );
    assert.ok(inrElevated.metadata.rules_triggered.includes('HIGH_AMOUNT_ELEVATED'));

    const inrExtreme = evaluateTransaction(
      { amount: 850000.50, currency: 'INR', merchant_name: 'Jewellery Emporium', transaction_date: baseTime },
      []
    );
    assert.ok(inrExtreme.metadata.rules_triggered.includes('HIGH_AMOUNT_EXTREME'));
  });

  test('Rule 2: Transaction velocity (> 3 transactions within 5 minutes)', () => {
    const candidate = {
      amount: 50,
      currency: 'EUR',
      merchant_name: 'Coffee Shop A',
      transaction_date: '2026-11-05T12:04:00.000Z'
    };

    // 2 transactions in past 4 minutes -> not breached (< 3 prior)
    const historyTwo = [
      { id: '1', amount: 10, currency: 'EUR', merchant_name: 'Shop 1', transaction_date: '2026-11-05T12:01:00.000Z' },
      { id: '2', amount: 15, currency: 'EUR', merchant_name: 'Shop 2', transaction_date: '2026-11-05T12:02:00.000Z' }
    ];
    const resTwo = evaluateTransaction(candidate, historyTwo);
    assert.equal(resTwo.metadata.rules_triggered.includes('VELOCITY_SPIKE'), false);

    // 3 transactions in past 4 minutes -> breached (3 prior, 4th total in 5 mins)
    const historyThree = [
      ...historyTwo,
      { id: '3', amount: 20, currency: 'EUR', merchant_name: 'Shop 3', transaction_date: '2026-11-05T12:03:00.000Z' }
    ];
    const resThree = evaluateTransaction(candidate, historyThree);
    assert.ok(resThree.metadata.rules_triggered.includes('VELOCITY_SPIKE'));
    assert.equal(resThree.risk_score, 35);
    assert.equal(resThree.risk_level, 'medium');
    assert.ok(resThree.heuristic_reasons.some((r) => r.includes('High transaction velocity')));

    // Transactions outside 5-minute window are ignored
    const historySpaced = [
      { id: '1', amount: 10, currency: 'EUR', merchant_name: 'Shop 1', transaction_date: '2026-11-05T11:40:00.000Z' },
      { id: '2', amount: 15, currency: 'EUR', merchant_name: 'Shop 2', transaction_date: '2026-11-05T11:45:00.000Z' },
      { id: '3', amount: 20, currency: 'EUR', merchant_name: 'Shop 3', transaction_date: '2026-11-05T11:50:00.000Z' }
    ];
    const resSpaced = evaluateTransaction(candidate, historySpaced);
    assert.equal(resSpaced.metadata.rules_triggered.includes('VELOCITY_SPIKE'), false);
  });

  test('Rule 3: Unusual round-number transaction amounts across currencies', () => {
    // Moderate round number in USD: $2,000 (+15 pts)
    const usdMod = evaluateTransaction(
      { amount: 2000, currency: 'USD', merchant_name: 'Vendor', transaction_date: baseTime },
      []
    );
    assert.ok(usdMod.metadata.rules_triggered.includes('ROUND_NUMBER_MODERATE'));
    assert.equal(usdMod.risk_score, 15);

    // Major round number in USD: $5,000 (+25 pts for elevated + 25 pts for major round = 50 pts)
    const usdMajor = evaluateTransaction(
      { amount: 5000, currency: 'USD', merchant_name: 'Vendor', transaction_date: baseTime },
      []
    );
    assert.ok(usdMajor.metadata.rules_triggered.includes('ROUND_NUMBER_MAJOR'));
    assert.ok(usdMajor.metadata.rules_triggered.includes('HIGH_AMOUNT_ELEVATED'));
    assert.equal(usdMajor.risk_score, 50);
    assert.equal(usdMajor.risk_level, 'medium');

    // Non-round amount in USD: $2,001.50 (no round number triggered)
    const usdNonRound = evaluateTransaction(
      { amount: 2001.50, currency: 'USD', merchant_name: 'Vendor', transaction_date: baseTime },
      []
    );
    assert.equal(usdNonRound.metadata.rules_triggered.includes('ROUND_NUMBER_MODERATE'), false);
    assert.equal(usdNonRound.metadata.rules_triggered.includes('ROUND_NUMBER_MAJOR'), false);

    // INR moderate round number: ₹100,000 (+15 pts)
    const inrMod = evaluateTransaction(
      { amount: 100000, currency: 'INR', merchant_name: 'Vendor', transaction_date: baseTime },
      []
    );
    assert.ok(inrMod.metadata.rules_triggered.includes('ROUND_NUMBER_MODERATE'));

    // INR major round number: ₹200,000 (+25 pts)
    const inrMajor = evaluateTransaction(
      { amount: 200000, currency: 'INR', merchant_name: 'Vendor', transaction_date: baseTime },
      []
    );
    assert.ok(inrMajor.metadata.rules_triggered.includes('ROUND_NUMBER_MAJOR'));
  });

  test('Rule 4: Repeated transaction attempts within 60 minutes', () => {
    const candidate = {
      amount: 199.99,
      currency: 'GBP',
      merchant_name: 'Electronics Direct',
      transaction_date: '2026-11-05T14:30:00.000Z'
    };

    // 1 repeated transaction within 20 minutes -> single repeat (+30 pts)
    const historySingle = [
      {
        id: 'tx-prior-1',
        amount: 199.99,
        currency: 'GBP',
        merchant_name: 'electronics direct',
        transaction_date: '2026-11-05T14:10:00.000Z'
      }
    ];
    const resSingle = evaluateTransaction(candidate, historySingle);
    assert.ok(resSingle.metadata.rules_triggered.includes('REPEATED_ATTEMPTS_SINGLE'));
    assert.equal(resSingle.risk_score, 30);
    assert.equal(resSingle.risk_level, 'medium');
    assert.ok(resSingle.heuristic_reasons[0].includes('Repeated transaction attempt'));

    // 2 repeated transactions within 45 minutes -> multiple repeats (+45 pts)
    const historyMultiple = [
      ...historySingle,
      {
        id: 'tx-prior-2',
        amount: 199.99,
        currency: 'GBP',
        merchant_name: 'ELECTRONICS DIRECT',
        transaction_date: '2026-11-05T14:15:00.000Z'
      }
    ];
    const resMulti = evaluateTransaction(candidate, historyMultiple);
    assert.ok(resMulti.metadata.rules_triggered.includes('REPEATED_ATTEMPTS_MULTIPLE'));
    assert.equal(resMulti.risk_score, 45);
    assert.equal(resMulti.risk_level, 'medium');

    // Repeated transaction beyond 60 minutes is not flagged
    const historyExpired = [
      {
        id: 'tx-old',
        amount: 199.99,
        currency: 'GBP',
        merchant_name: 'Electronics Direct',
        transaction_date: '2026-11-05T13:00:00.000Z' // 90 mins prior
      }
    ];
    const resExpired = evaluateTransaction(candidate, historyExpired);
    assert.equal(resExpired.metadata.rules_triggered.includes('REPEATED_ATTEMPTS_SINGLE'), false);

    // Same merchant but different amount is not a repeat
    const historyDiffAmount = [
      {
        id: 'tx-diff',
        amount: 299.99,
        currency: 'GBP',
        merchant_name: 'Electronics Direct',
        transaction_date: '2026-11-05T14:20:00.000Z'
      }
    ];
    const resDiff = evaluateTransaction(candidate, historyDiffAmount);
    assert.equal(resDiff.metadata.rules_triggered.includes('REPEATED_ATTEMPTS_SINGLE'), false);
  });

  test('Risk score boundaries map cleanly to low, medium, high, and critical levels', () => {
    assert.equal(mapScoreToRiskLevel(0), 'low');
    assert.equal(mapScoreToRiskLevel(29), 'low');
    assert.equal(mapScoreToRiskLevel(30), 'medium');
    assert.equal(mapScoreToRiskLevel(69), 'medium');
    assert.equal(mapScoreToRiskLevel(70), 'high');
    assert.equal(mapScoreToRiskLevel(89), 'high');
    assert.equal(mapScoreToRiskLevel(90), 'critical');
    assert.equal(mapScoreToRiskLevel(100), 'critical');
  });

  test('Multiple rules combine into high risk (70–89)', () => {
    // Extreme amount (45 pts) + Major round number (25 pts) = 70 pts -> HIGH
    const candidate = {
      amount: 10000,
      currency: 'USD',
      merchant_name: 'Wholesale Metals',
      transaction_date: baseTime.toISOString()
    };
    const res = evaluateTransaction(candidate, []);
    assert.equal(res.risk_score, 70);
    assert.equal(res.risk_level, 'high');
    assert.equal(res.heuristic_reasons.length, 2);
    assert.ok(res.metadata.rules_triggered.includes('HIGH_AMOUNT_EXTREME'));
    assert.ok(res.metadata.rules_triggered.includes('ROUND_NUMBER_MAJOR'));
  });

  test('Multiple rules combine into critical risk (90–100) and clamp to 100 max', () => {
    // Extreme amount (45 pts) + Velocity spike (35 pts) + Multiple repeated attempts (45 pts) = 125 pts -> capped at 100
    const candidateTime = new Date('2026-11-05T12:04:00.000Z');
    const candidate = {
      amount: 10000,
      currency: 'USD',
      merchant_name: 'Rapid Transfer Hub',
      transaction_date: candidateTime.toISOString()
    };
    const history = [
      { id: '1', amount: 10000, currency: 'USD', merchant_name: 'Rapid Transfer Hub', transaction_date: '2026-11-05T12:01:00.000Z' },
      { id: '2', amount: 10000, currency: 'USD', merchant_name: 'Rapid Transfer Hub', transaction_date: '2026-11-05T12:02:00.000Z' },
      { id: '3', amount: 50, currency: 'USD', merchant_name: 'Coffee Shop', transaction_date: '2026-11-05T12:03:00.000Z' }
    ];

    const res = evaluateTransaction(candidate, history);
    assert.equal(res.risk_score, 100);
    assert.equal(res.risk_level, 'critical');
    assert.ok(res.heuristic_reasons.length >= 3);
  });

  test('Missing or incomplete historical context does NOT assume zero risk', () => {
    // Even with null or empty history, intrinsic signals evaluate accurately
    const highValueColdStart = {
      amount: 15000,
      currency: 'USD',
      merchant_name: 'High Roller Casino',
      transaction_date: baseTime.toISOString()
    };

    const resEmpty = evaluateTransaction(highValueColdStart, []);
    assert.equal(resEmpty.risk_score, 70);
    assert.equal(resEmpty.risk_level, 'high');
    assert.equal(resEmpty.metadata.historical_context_present, false);

    const resNull = evaluateTransaction(highValueColdStart, null);
    assert.equal(resNull.risk_score, 70);
    assert.equal(resNull.risk_level, 'high');
    assert.equal(resNull.metadata.historical_context_present, false);

    const resUndefined = evaluateTransaction(highValueColdStart, undefined, { historicalContextAvailable: false });
    assert.equal(resUndefined.risk_score, 70);
    assert.equal(resUndefined.metadata.historical_context_present, false);
  });

  test('Candidate transaction is excluded from counting against itself if passed in history', () => {
    const candidate = {
      id: 'tx-same-id',
      amount: 100,
      currency: 'CAD',
      merchant_name: 'Canadian Tire',
      transaction_date: baseTime.toISOString()
    };
    const historyWithSelf = [
      {
        id: 'tx-same-id',
        amount: 100,
        currency: 'CAD',
        merchant_name: 'Canadian Tire',
        transaction_date: baseTime.toISOString()
      }
    ];

    const res = evaluateTransaction(candidate, historyWithSelf);
    // Should NOT flag repeated attempt or velocity because the only history item is the candidate itself
    assert.equal(res.metadata.rules_triggered.includes('REPEATED_ATTEMPTS_SINGLE'), false);
    assert.equal(res.metadata.rules_triggered.includes('VELOCITY_SPIKE'), false);
    assert.equal(res.risk_score, 0);
  });

  test('Rejects malformed input objects gracefully with informative errors', () => {
    assert.throws(
      () => evaluateTransaction(null),
      /Invalid candidate transaction/
    );
    assert.throws(
      () => evaluateTransaction({ amount: -50, transaction_date: '2026-11-05T12:00:00Z' }),
      /amount must be a positive finite number/
    );
    assert.throws(
      () => evaluateTransaction({ amount: 'bad', transaction_date: '2026-11-05T12:00:00Z' }),
      /amount must be a positive finite number/
    );
    assert.throws(
      () => evaluateTransaction({ amount: 100, transaction_date: 'invalid-date' }),
      /transaction_date must be a valid timestamp/
    );
  });
});

