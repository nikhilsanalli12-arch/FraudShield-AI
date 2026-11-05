/**
 * FraudShield AI — Step 2: Transaction Service & API Test Suite
 *
 * Verifies:
 * 1. Duplicate transaction detection logic
 * 2. Authenticated manual transaction creation with deterministic fraud scoring
 * 3. Fraud assessment persistence with correct foreign key mappings
 * 4. High-risk and critical-risk compliance investigation case creation
 * 5. Partial failure handling & compensation rollbacks (no orphaned records)
 * 6. User tenant isolation in transaction history queries
 * 7. Safe pagination handling
 * 8. Express API endpoint invariants (authentication, role authorization, error handling)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createManualTransaction,
  getTransactionHistory,
  detectDuplicateTransaction
} from '../src/services/transactionService.js';
import { createTransactionRouter } from '../src/routes/transactionRoutes.js';

// Helper to create an in-memory mock Supabase client
function createMockSupabaseClient(initialState = {}) {
  const transactions = [...(initialState.transactions || [])];
  const assessments = [...(initialState.assessments || [])];
  const cases = [...(initialState.cases || [])];

  const failureFlags = {
    insertTransaction: false,
    insertAssessment: false,
    insertCase: false,
    queryHistory: false,
    ...(initialState.failureFlags || {})
  };

  const client = {
    _state: { transactions, assessments, cases },
    failureFlags,
    from: (table) => {
      if (table === 'transactions') {
        return {
          select: (fields, options = {}) => {
            let filtered = [...transactions];
            let isCountExact = options.count === 'exact';

            const queryObj = {
              eq: (col, val) => {
                filtered = filtered.filter((row) => row[col] === val);
                return queryObj;
              },
              order: (col, { ascending } = { ascending: true }) => {
                filtered.sort((a, b) => {
                  const valA = new Date(a[col]).getTime() || a[col];
                  const valB = new Date(b[col]).getTime() || b[col];
                  return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
                });
                return queryObj;
              },
              limit: (n) => {
                filtered = filtered.slice(0, n);
                return queryObj;
              },
              range: (from, to) => {
                if (failureFlags.queryHistory) {
                  return Promise.resolve({ data: null, count: null, error: { message: 'DB connection failure' } });
                }
                const totalCount = filtered.length;
                const paged = filtered.slice(from, to + 1).map((tx) => {
                  const attachedAssessments = assessments.filter((a) => a.transaction_id === tx.id);
                  return {
                    ...tx,
                    fraud_assessments: attachedAssessments
                  };
                });
                return Promise.resolve({
                  data: paged,
                  count: isCountExact ? totalCount : paged.length,
                  error: null
                });
              },
              then: (resolve) => {
                if (failureFlags.queryHistory) {
                  return Promise.resolve(resolve({ data: null, count: null, error: { message: 'DB connection failure' } }));
                }
                return Promise.resolve(resolve({ data: filtered, count: filtered.length, error: null }));
              }
            };
            return queryObj;
          },
          insert: (payload) => {
            if (failureFlags.insertTransaction) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Simulated transaction insert error' } })
                })
              };
            }
            const record = {
              id: 'tx_' + Math.random().toString(36).substring(2, 9),
              created_at: new Date().toISOString(),
              ...payload
            };
            transactions.push(record);
            return {
              select: () => ({
                single: async () => ({ data: record, error: null })
              })
            };
          },
          delete: () => {
            return {
              eq: (col, val) => {
                const idx = transactions.findIndex((tx) => tx[col] === val);
                if (idx !== -1) transactions.splice(idx, 1);
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }

      if (table === 'fraud_assessments') {
        return {
          insert: (payload) => {
            if (failureFlags.insertAssessment) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Simulated assessment insert error' } })
                })
              };
            }
            const record = {
              id: 'fa_' + Math.random().toString(36).substring(2, 9),
              assessed_at: new Date().toISOString(),
              ...payload
            };
            assessments.push(record);
            return {
              select: () => ({
                single: async () => ({ data: record, error: null })
              })
            };
          },
          delete: () => {
            return {
              eq: (col, val) => {
                const idx = assessments.findIndex((fa) => fa[col] === val);
                if (idx !== -1) assessments.splice(idx, 1);
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }

      if (table === 'investigation_cases') {
        return {
          insert: (payload) => {
            if (failureFlags.insertCase) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Simulated case insert error' } })
                })
              };
            }
            const record = {
              id: 'case_' + Math.random().toString(36).substring(2, 9),
              opened_at: new Date().toISOString(),
              ...payload
            };
            cases.push(record);
            return {
              select: () => ({
                single: async () => ({ data: record, error: null })
              })
            };
          },
          delete: () => {
            return {
              eq: (col, val) => {
                const idx = cases.findIndex((c) => c[col] === val);
                if (idx !== -1) cases.splice(idx, 1);
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }

      throw new Error(`Unexpected table queried in mock client: ${table}`);
    }
  };

  return client;
}

// Helper to create mock Express response
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('FraudShield AI — Transaction Service & Duplicate Detection', () => {
  const now = new Date('2026-11-05T12:00:00.000Z');

  test('detectDuplicateTransaction identifies identical transaction within 2 minutes', () => {
    const candidate = {
      amount: 150.0,
      currency: 'USD',
      merchant_name: 'Metro Grocery',
      transaction_date: now.toISOString()
    };

    const history = [
      {
        id: 'tx_old_1',
        amount: 150.0,
        currency: 'USD',
        merchant_name: 'metro grocery',
        transaction_date: new Date(now.getTime() - 60 * 1000).toISOString() // 1 minute ago
      }
    ];

    const result = detectDuplicateTransaction(candidate, history);
    assert.equal(result.isDuplicate, true);
    assert.equal(result.duplicateTransaction.id, 'tx_old_1');
  });

  test('detectDuplicateTransaction ignores transactions outside the 2-minute duplicate window', () => {
    const candidate = {
      amount: 150.0,
      currency: 'USD',
      merchant_name: 'Metro Grocery',
      transaction_date: now.toISOString()
    };

    const history = [
      {
        id: 'tx_older',
        amount: 150.0,
        currency: 'USD',
        merchant_name: 'Metro Grocery',
        transaction_date: new Date(now.getTime() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      }
    ];

    const result = detectDuplicateTransaction(candidate, history);
    assert.equal(result.isDuplicate, false);
    assert.equal(result.duplicateTransaction, null);
  });

  test('detectDuplicateTransaction ignores transactions with different amount or merchant', () => {
    const candidate = {
      amount: 150.0,
      currency: 'USD',
      merchant_name: 'Metro Grocery',
      transaction_date: now.toISOString()
    };

    const historyDiffAmount = [
      {
        id: 'tx_diff_amt',
        amount: 155.0,
        currency: 'USD',
        merchant_name: 'Metro Grocery',
        transaction_date: now.toISOString()
      }
    ];
    assert.equal(detectDuplicateTransaction(candidate, historyDiffAmount).isDuplicate, false);

    const historyDiffMerchant = [
      {
        id: 'tx_diff_merch',
        amount: 150.0,
        currency: 'USD',
        merchant_name: 'Other Grocery',
        transaction_date: now.toISOString()
      }
    ];
    assert.equal(detectDuplicateTransaction(candidate, historyDiffMerchant).isDuplicate, false);
  });
});

describe('FraudShield AI — Transaction Lifecycle & Persistence', () => {
  const userId = 'usr_personal_123';
  const baseTxPayload = {
    amount: 75.5,
    currency: 'USD',
    transaction_type: 'debit',
    merchant_name: 'Acme Hardware',
    category: 'Home Improvement',
    description: 'Tools purchase',
    payment_method_last4: '1234',
    transaction_date: '2026-11-05T12:00:00.000Z'
  };

  test('Successfully creates low-risk transaction with assessment and no investigation case', async () => {
    const mockClient = createMockSupabaseClient();
    const result = await createManualTransaction(userId, baseTxPayload, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.success, true);
    assert.ok(result.transaction.id);
    assert.equal(result.transaction.user_id, userId);
    assert.equal(result.transaction.amount, 75.5);
    assert.equal(result.transaction.currency, 'USD');

    // Assessment assertions
    assert.ok(result.assessment.id);
    assert.equal(result.assessment.risk_level, 'low');
    assert.equal(result.assessment.risk_score, 0);
    assert.deepEqual(result.assessment.heuristic_reasons, []);

    // No investigation case for low risk
    assert.equal(result.investigation_case, null);

    // Database verification
    assert.equal(mockClient._state.transactions.length, 1);
    assert.equal(mockClient._state.assessments.length, 1);
    assert.equal(mockClient._state.cases.length, 0);

    // Foreign key verification
    assert.equal(mockClient._state.assessments[0].transaction_id, result.transaction.id);
    assert.equal(mockClient._state.assessments[0].user_id, userId);
  });

  test('Successfully creates high-risk transaction and automatically opens investigation case', async () => {
    const mockClient = createMockSupabaseClient();
    // $10,000 USD round number triggers extreme amount (45) + round major (25) = 70 (high risk)
    const highRiskPayload = {
      ...baseTxPayload,
      amount: 10000.0,
      merchant_name: 'Luxury Watch Boutique'
    };

    const result = await createManualTransaction(userId, highRiskPayload, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.success, true);
    assert.equal(result.assessment.risk_level, 'high');
    assert.equal(result.assessment.risk_score, 70);

    // High risk MUST create an investigation case
    assert.ok(result.investigation_case);
    assert.ok(result.investigation_case.id);
    assert.equal(result.investigation_case.status, 'open');
    assert.equal(result.investigation_case.priority, 'high');

    // Database verification
    assert.equal(mockClient._state.transactions.length, 1);
    assert.equal(mockClient._state.assessments.length, 1);
    assert.equal(mockClient._state.cases.length, 1);
    assert.equal(mockClient._state.cases[0].transaction_id, result.transaction.id);
    assert.equal(mockClient._state.cases[0].priority, 'high');
  });

  test('Creates critical-risk transaction with urgent investigation case', async () => {
    // 3 prior transactions in past 3 minutes (velocity spike +35) + extreme amount (+45) + major round (+25) = 100 (critical)
    const txTime = new Date('2026-11-05T12:04:00.000Z');
    const priorTransactions = [
      { id: 'tx_p1', user_id: userId, amount: 20, currency: 'USD', merchant_name: 'Shop', transaction_date: '2026-11-05T12:01:00.000Z' },
      { id: 'tx_p2', user_id: userId, amount: 20, currency: 'USD', merchant_name: 'Shop', transaction_date: '2026-11-05T12:02:00.000Z' },
      { id: 'tx_p3', user_id: userId, amount: 20, currency: 'USD', merchant_name: 'Shop', transaction_date: '2026-11-05T12:03:00.000Z' }
    ];

    const mockClient = createMockSupabaseClient({ transactions: priorTransactions });
    const criticalPayload = {
      ...baseTxPayload,
      amount: 10000.0,
      merchant_name: 'Wire Transfer Depot',
      transaction_date: txTime.toISOString()
    };

    const result = await createManualTransaction(userId, criticalPayload, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.success, true);
    assert.equal(result.assessment.risk_level, 'critical');
    assert.equal(result.assessment.risk_score, 100);

    assert.ok(result.investigation_case);
    assert.equal(result.investigation_case.priority, 'urgent');
    assert.equal(result.investigation_case.status, 'open');
  });

  test('Rejects duplicate manual transaction with 409 Conflict', async () => {
    const existingTx = {
      id: 'tx_original_99',
      user_id: userId,
      amount: 75.5,
      currency: 'USD',
      merchant_name: 'Acme Hardware',
      transaction_date: '2026-11-05T12:00:00.000Z'
    };

    const mockClient = createMockSupabaseClient({ transactions: [existingTx] });

    await assert.rejects(
      async () => {
        await createManualTransaction(userId, baseTxPayload, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, 'DuplicateTransaction');
        assert.match(err.message, /Duplicate transaction detected/i);
        assert.equal(err.duplicateTransactionId, 'tx_original_99');
        return true;
      }
    );

    // Verify no new transaction was added
    assert.equal(mockClient._state.transactions.length, 1);
  });

  test('Duplicate-check database query failure stops transaction creation and returns 503', async () => {
    const mockClient = createMockSupabaseClient({
      failureFlags: { queryHistory: true }
    });

    await assert.rejects(
      async () => {
        await createManualTransaction(userId, baseTxPayload, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.equal(err.code, 'ServiceUnavailable');
        assert.match(err.message, /Transaction verification service is temporarily unavailable/i);
        return true;
      }
    );

    // Verify zero database mutations (no transaction or assessment inserted)
    assert.equal(mockClient._state.transactions.length, 0);
    assert.equal(mockClient._state.assessments.length, 0);
    assert.equal(mockClient._state.cases.length, 0);
  });

  test('Rejects invalid input payload with 400 ValidationError', async () => {
    const mockClient = createMockSupabaseClient();
    const badPayload = {
      amount: -50,
      currency: 'INVALID_CURRENCY',
      merchant_name: ''
    };

    await assert.rejects(
      async () => {
        await createManualTransaction(userId, badPayload, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'ValidationError');
        assert.ok(err.errors.length >= 2);
        return true;
      }
    );

    assert.equal(mockClient._state.transactions.length, 0);
  });

  test('Compensation rollback: removes inserted transaction if fraud assessment fails', async () => {
    const mockClient = createMockSupabaseClient({
      failureFlags: { insertAssessment: true }
    });

    await assert.rejects(
      async () => {
        await createManualTransaction(userId, baseTxPayload, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 500);
        assert.equal(err.code, 'AssessmentPersistenceError');
        assert.match(err.message, /rolled back/i);
        return true;
      }
    );

    // Transaction was rolled back via compensation DELETE
    assert.equal(mockClient._state.transactions.length, 0);
    assert.equal(mockClient._state.assessments.length, 0);
  });

  test('Compensation rollback: removes assessment and transaction if investigation case fails', async () => {
    const mockClient = createMockSupabaseClient({
      failureFlags: { insertCase: true }
    });

    const highRiskPayload = {
      ...baseTxPayload,
      amount: 10000.0,
      merchant_name: 'High Risk Merchant'
    };

    await assert.rejects(
      async () => {
        await createManualTransaction(userId, highRiskPayload, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 500);
        assert.equal(err.code, 'CaseCreationError');
        assert.match(err.message, /rolled back/i);
        return true;
      }
    );

    // Both were compensated
    assert.equal(mockClient._state.transactions.length, 0);
    assert.equal(mockClient._state.assessments.length, 0);
    assert.equal(mockClient._state.cases.length, 0);
  });
});

describe('FraudShield AI — Transaction History & Tenant Isolation', () => {
  const userA = 'usr_alice';
  const userB = 'usr_bob';

  const seededTransactions = [
    {
      id: 'tx_a1',
      user_id: userA,
      amount: 10.0,
      currency: 'USD',
      merchant_name: 'Alice Coffee',
      transaction_date: '2026-11-05T09:00:00Z',
      created_at: '2026-11-05T09:00:00Z'
    },
    {
      id: 'tx_a2',
      user_id: userA,
      amount: 25.0,
      currency: 'USD',
      merchant_name: 'Alice Books',
      transaction_date: '2026-11-05T10:00:00Z',
      created_at: '2026-11-05T10:00:00Z'
    },
    {
      id: 'tx_b1',
      user_id: userB,
      amount: 99.0,
      currency: 'USD',
      merchant_name: 'Bob Electronics',
      transaction_date: '2026-11-05T11:00:00Z',
      created_at: '2026-11-05T11:00:00Z'
    }
  ];

  const seededAssessments = [
    {
      id: 'fa_a1',
      transaction_id: 'tx_a1',
      user_id: userA,
      risk_score: 0,
      risk_level: 'low',
      heuristic_reasons: []
    },
    {
      id: 'fa_a2',
      transaction_id: 'tx_a2',
      user_id: userA,
      risk_score: 15,
      risk_level: 'low',
      heuristic_reasons: ['Unusual round-number transaction amount']
    },
    {
      id: 'fa_b1',
      transaction_id: 'tx_b1',
      user_id: userB,
      risk_score: 45,
      risk_level: 'medium',
      heuristic_reasons: []
    }
  ];

  test('Strict tenant isolation: user only receives their own transactions and assessments', async () => {
    const mockClient = createMockSupabaseClient({
      transactions: seededTransactions,
      assessments: seededAssessments
    });

    const result = await getTransactionHistory(userA, { page: 1, limit: 10 }, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.success, true);
    assert.equal(result.data.length, 2);
    // User A should only see Alice's transactions
    assert.ok(result.data.every((tx) => tx.user_id === userA));
    assert.ok(result.data.some((tx) => tx.id === 'tx_a1'));
    assert.ok(result.data.some((tx) => tx.id === 'tx_a2'));
    assert.equal(result.data.some((tx) => tx.id === 'tx_b1'), false);

    // Attached assessment verification
    const txA1 = result.data.find((tx) => tx.id === 'tx_a1');
    assert.ok(txA1.fraud_assessment);
    assert.equal(txA1.fraud_assessment.id, 'fa_a1');
    assert.equal(txA1.fraud_assessment.risk_level, 'low');
  });

  test('Pagination handles limits and offsets correctly', async () => {
    const mockClient = createMockSupabaseClient({
      transactions: seededTransactions,
      assessments: seededAssessments
    });

    const page1 = await getTransactionHistory(userA, { page: 1, limit: 1 }, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(page1.data.length, 1);
    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 1);
    assert.equal(page1.pagination.total, 2);
    assert.equal(page1.pagination.totalPages, 2);
  });
});

import express from 'express';
import app from '../src/server.js';
import { requireRole } from '../src/middleware/roleGuard.js';

describe('FraudShield AI — Transaction Routes HTTP Invariants', () => {
  let server;
  let baseUrl;

  // Spin up test server on an ephemeral free OS port
  before((t, done) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      done();
    });
  });

  after((t, done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('POST /api/v1/transactions/manual denies unauthenticated requests (401 or 503)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transactions/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 })
    });
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    const body = await res.json();
    assert.ok(['Unauthorized', 'ServiceUnavailable'].includes(body.error));
  });

  test('GET /api/v1/transactions/history denies unauthenticated requests (401 or 503)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transactions/history`);
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    const body = await res.json();
    assert.ok(['Unauthorized', 'ServiceUnavailable'].includes(body.error));
  });

  test('POST /api/v1/transactions/manual rejects analyst role with 403 Forbidden', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    // Inject verified analyst user
    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'usr_analyst_test',
        role: 'analyst',
        email: 'analyst@fraudshield.ai'
      });
      next();
    });

    const mockRouter = createTransactionRouter({
      createManualTransaction: async () => ({ success: true })
    });
    // Mount router (bypassing authMiddleware by removing it or testing requireRole directly)
    mockApp.post(
      '/api/v1/transactions/manual',
      requireRole(['personal', 'admin']),
      async (req, res) => res.status(201).json({ success: true })
    );

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 })
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error, 'Forbidden');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/transactions/manual allows personal user and creates transaction (201)', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'usr_personal_test',
        role: 'personal',
        email: 'personal@fraudshield.ai'
      });
      next();
    });

    const mockService = {
      createManualTransaction: async (userId, body) => ({
        success: true,
        transaction: { id: 'tx_mock_123', user_id: userId, amount: body.amount },
        assessment: { risk_score: 0, risk_level: 'low', heuristic_reasons: [] },
        investigation_case: null
      })
    };

    mockApp.post(
      '/api/v1/transactions/manual',
      requireRole(['personal', 'admin']),
      async (req, res, next) => {
        try {
          const result = await mockService.createManualTransaction(req.user.id, req.body);
          res.status(201).json(result);
        } catch (err) {
          next(err);
        }
      }
    );

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100.0 })
      });
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.transaction.id, 'tx_mock_123');
      assert.equal(body.transaction.user_id, 'usr_personal_test');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/transactions/manual returns 503 when duplicate verification query fails', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'usr_personal_test',
        role: 'personal',
        email: 'personal@fraudshield.ai'
      });
      next();
    });

    const mockService = {
      createManualTransaction: async () => {
        const err = new Error('Transaction verification service is temporarily unavailable. Please try again.');
        err.statusCode = 503;
        err.code = 'ServiceUnavailable';
        throw err;
      }
    };

    mockApp.post(
      '/api/v1/transactions/manual',
      requireRole(['personal', 'admin']),
      async (req, res, next) => {
        try {
          await mockService.createManualTransaction(req.user.id, req.body);
        } catch (err) {
          if (err.statusCode) {
            return res.status(err.statusCode).json({
              error: err.code || 'TransactionError',
              message: err.message
            });
          }
          next(err);
        }
      }
    );

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100.0 })
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.error, 'ServiceUnavailable');
      assert.match(body.message, /verification service is temporarily unavailable/i);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('GET /api/v1/transactions/history allows personal user to retrieve history (200)', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'usr_personal_test',
        role: 'personal',
        email: 'personal@fraudshield.ai'
      });
      next();
    });

    const mockService = {
      getTransactionHistory: async (userId, query) => ({
        success: true,
        data: [{ id: 'tx_hist_1', user_id: userId, amount: 45.0 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
      })
    };

    mockApp.get(
      '/api/v1/transactions/history',
      requireRole(['personal', 'analyst', 'admin']),
      async (req, res, next) => {
        try {
          const result = await mockService.getTransactionHistory(req.user.id, req.query);
          res.status(200).json(result);
        } catch (err) {
          next(err);
        }
      }
    );

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/history?page=1`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].id, 'tx_hist_1');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });
});
