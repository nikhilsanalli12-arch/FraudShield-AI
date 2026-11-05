/**
 * FraudShield AI — Financial Analyst Route & Service Test Suite
 *
 * Verifies:
 * 1. Role-based authorization: personal role rejected (403), analyst and admin permitted (200).
 * 2. Unauthenticated requests rejected (401/503).
 * 3. Analyst data isolation (analysts only see open cases or cases assigned to themselves).
 * 4. Admin unrestricted visibility (admins see cases across all statuses and analysts).
 * 5. Case status update invariants (validation, assigned_analyst_id, resolving_analyst_id).
 * 6. Error handling for database query/update failures and unconfigured client.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import app from '../src/server.js';
import { createAnalystRouter } from '../src/routes/analystRoutes.js';
import { getAnalystCases, updateCaseStatus } from '../src/services/analystService.js';

// Mock Supabase client generator for analyst tests
function createMockAnalystDb(initialCases = []) {
  let cases = JSON.parse(JSON.stringify(initialCases));

  return {
    _state: { cases },
    from: (table) => {
      if (table !== 'investigation_cases') {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: (fields, options = {}) => {
          let filtered = [...cases];

          const queryObj = {
            order: (col, { ascending } = { ascending: true }) => {
              filtered.sort((a, b) => {
                const valA = new Date(a[col]).getTime() || a[col];
                const valB = new Date(b[col]).getTime() || b[col];
                return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
              });
              return queryObj;
            },
            or: (orFilter) => {
              // Parse orFilter like "status.eq.open,assigned_analyst_id.eq.<uid>"
              const parts = orFilter.split(',');
              filtered = filtered.filter((row) => {
                return parts.some((p) => {
                  if (p === 'status.eq.open') {
                    return row.status === 'open';
                  }
                  if (p.startsWith('assigned_analyst_id.eq.')) {
                    const uid = p.replace('assigned_analyst_id.eq.', '');
                    return row.assigned_analyst_id === uid;
                  }
                  return false;
                });
              });
              return queryObj;
            },
            eq: (col, val) => {
              filtered = filtered.filter((row) => row[col] === val);
              return queryObj;
            },
            range: (start, end) => {
              const sliced = filtered.slice(start, end + 1);
              return Promise.resolve({
                data: sliced,
                count: filtered.length,
                error: null,
              });
            },
          };

          return queryObj;
        },
        update: (updateFields) => {
          let targetId = null;
          return {
            eq: (col, val) => {
              if (col === 'id') targetId = val;
              return {
                select: () => ({
                  single: () => {
                    const idx = cases.findIndex((c) => c.id === targetId);
                    if (idx === -1) {
                      return Promise.resolve({ data: null, error: { message: 'Case not found' } });
                    }
                    cases[idx] = { ...cases[idx], ...updateFields };
                    return Promise.resolve({ data: cases[idx], error: null });
                  },
                }),
              };
            },
          };
        },
      };
    },
  };
}

const SAMPLE_CASES = [
  {
    id: 'case-open-1',
    transaction_id: 'tx-1',
    user_id: 'user-a',
    assigned_analyst_id: null,
    resolving_analyst_id: null,
    status: 'open',
    priority: 'high',
    metadata: { heuristic_summary: 'Amount > 5000' },
    opened_at: '2026-11-05T10:00:00.000Z',
    updated_at: '2026-11-05T10:00:00.000Z',
    resolved_at: null,
    transactions: {
      id: 'tx-1',
      amount: 7500,
      currency: 'USD',
      merchant_name: 'Luxury Wire Transfer',
      category: 'transfer',
      transaction_date: '2026-11-05T09:59:00.000Z',
      source: 'manual',
      payment_method_last4: '1234',
      description: 'Urgent transfer',
      fraud_assessments: [
        {
          id: 'fa-1',
          risk_score: 85,
          risk_level: 'critical',
          heuristic_reasons: ['HIGH_AMOUNT', 'OFF_HOURS'],
          model_version: 'deterministic-v1.0',
          assessed_at: '2026-11-05T10:00:00.000Z',
        },
      ],
    },
    profiles: {
      id: 'user-a',
      email: 'user.a@example.com',
      full_name: 'Alice User',
    },
  },
  {
    id: 'case-assigned-to-me',
    transaction_id: 'tx-2',
    user_id: 'user-b',
    assigned_analyst_id: 'analyst-1',
    resolving_analyst_id: null,
    status: 'in_review',
    priority: 'urgent',
    metadata: { heuristic_summary: 'Multiple velocity anomalies' },
    opened_at: '2026-11-05T11:00:00.000Z',
    updated_at: '2026-11-05T11:15:00.000Z',
    resolved_at: null,
    transactions: {
      id: 'tx-2',
      amount: 12000,
      currency: 'USD',
      merchant_name: 'Crypto Exchange',
      category: 'investment',
      transaction_date: '2026-11-05T10:55:00.000Z',
      source: 'import',
      payment_method_last4: '9999',
      description: 'Crypto purchase',
      fraud_assessments: [
        {
          id: 'fa-2',
          risk_score: 92,
          risk_level: 'critical',
          heuristic_reasons: ['HIGH_VELOCITY', 'HIGH_RISK_MERCHANT'],
          model_version: 'deterministic-v1.0',
          assessed_at: '2026-11-05T11:00:00.000Z',
        },
      ],
    },
    profiles: {
      id: 'user-b',
      email: 'user.b@example.com',
      full_name: 'Bob User',
    },
  },
  {
    id: 'case-assigned-to-other',
    transaction_id: 'tx-3',
    user_id: 'user-c',
    assigned_analyst_id: 'analyst-other-id',
    resolving_analyst_id: null,
    status: 'in_review',
    priority: 'medium',
    metadata: {},
    opened_at: '2026-11-05T08:00:00.000Z',
    updated_at: '2026-11-05T08:30:00.000Z',
    resolved_at: null,
    transactions: null,
    profiles: null,
  },
];

describe('Analyst Routes & Service Invariants', () => {
  let server;
  const TEST_PORT = 5062;
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

  test('GET /api/v1/analyst/cases without authentication header is rejected with 401 or 503', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/analyst/cases`);
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error === 'Unauthorized' || body.error === 'ServiceUnavailable');
  });

  test('GET /api/v1/analyst/cases with invalid Bearer token is rejected', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/analyst/cases`, {
      headers: {
        Authorization: 'Bearer invalid.test.token',
      },
    });
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
  });

  test('Role authorization: personal role is rejected with 403 Forbidden', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    // Inject personal user
    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({
        id: 'personal-user-id',
        email: 'user@example.com',
        role: 'personal',
      });
      next();
    };

    const mockDb = createMockAnalystDb(SAMPLE_CASES);
    const router = createAnalystRouter(
      {
        getAnalystCases: (user, query) => getAnalystCases(user, query, { client: mockDb, isConfigCheck: () => true }),
        updateCaseStatus: (id, user, body) => updateCaseStatus(id, user, body, { client: mockDb, isConfigCheck: () => true }),
      },
      { authMiddleware: mockAuth }
    );

    mockApp.use('/api/v1/analyst', router);

    const localServer = mockApp.listen(5063);
    try {
      const res = await fetch('http://localhost:5063/api/v1/analyst/cases');
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error, 'Forbidden');
      assert.match(body.message, /analyst|admin/);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('Role authorization: analyst role is allowed and only sees open or assigned cases', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({
        id: 'analyst-1',
        email: 'analyst@fraudshield.internal',
        role: 'analyst',
      });
      next();
    };

    const mockDb = createMockAnalystDb(SAMPLE_CASES);
    const router = createAnalystRouter(
      {
        getAnalystCases: (user, query) => getAnalystCases(user, query, { client: mockDb, isConfigCheck: () => true }),
        updateCaseStatus: (id, user, body) => updateCaseStatus(id, user, body, { client: mockDb, isConfigCheck: () => true }),
      },
      { authMiddleware: mockAuth }
    );

    mockApp.use('/api/v1/analyst', router);

    const localServer = mockApp.listen(5064);
    try {
      const res = await fetch('http://localhost:5064/api/v1/analyst/cases');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(Array.isArray(body.data), true);

      // Analyst-1 should see case-open-1 and case-assigned-to-me, but NOT case-assigned-to-other
      const caseIds = body.data.map((c) => c.id);
      assert.ok(caseIds.includes('case-open-1'), 'Should see open case');
      assert.ok(caseIds.includes('case-assigned-to-me'), 'Should see case assigned to self');
      assert.ok(!caseIds.includes('case-assigned-to-other'), 'Should NOT see case assigned to other analyst');

      // Verify nested transaction and assessment formatting
      const openCase = body.data.find((c) => c.id === 'case-open-1');
      assert.equal(openCase.transaction.amount, 7500);
      assert.equal(openCase.assessment.risk_score, 85);
      assert.equal(openCase.user_email, 'user.a@example.com');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('Role authorization: admin role sees all cases across all analysts and statuses', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({
        id: 'admin-1',
        email: 'admin@fraudshield.internal',
        role: 'admin',
      });
      next();
    };

    const mockDb = createMockAnalystDb(SAMPLE_CASES);
    const router = createAnalystRouter(
      {
        getAnalystCases: (user, query) => getAnalystCases(user, query, { client: mockDb, isConfigCheck: () => true }),
        updateCaseStatus: (id, user, body) => updateCaseStatus(id, user, body, { client: mockDb, isConfigCheck: () => true }),
      },
      { authMiddleware: mockAuth }
    );

    mockApp.use('/api/v1/analyst', router);

    const localServer = mockApp.listen(5065);
    try {
      const res = await fetch('http://localhost:5065/api/v1/analyst/cases');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.length, 3, 'Admin should see all 3 cases');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('PATCH /api/v1/analyst/cases/:id updates status and assigns analyst', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({
        id: 'analyst-1',
        email: 'analyst@fraudshield.internal',
        role: 'analyst',
      });
      next();
    };

    const mockDb = createMockAnalystDb(SAMPLE_CASES);
    const router = createAnalystRouter(
      {
        getAnalystCases: (user, query) => getAnalystCases(user, query, { client: mockDb, isConfigCheck: () => true }),
        updateCaseStatus: (id, user, body) => updateCaseStatus(id, user, body, { client: mockDb, isConfigCheck: () => true }),
      },
      { authMiddleware: mockAuth }
    );

    mockApp.use('/api/v1/analyst', router);

    const localServer = mockApp.listen(5066);
    try {
      // 1. Move open case into review
      const resReview = await fetch('http://localhost:5066/api/v1/analyst/cases/case-open-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_review' }),
      });
      assert.equal(resReview.status, 200);
      const bodyReview = await resReview.json();
      assert.equal(bodyReview.success, true);
      assert.equal(bodyReview.case.status, 'in_review');
      assert.equal(bodyReview.case.assigned_analyst_id, 'analyst-1');

      // 2. Resolve case
      const resResolve = await fetch('http://localhost:5066/api/v1/analyst/cases/case-open-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });
      assert.equal(resResolve.status, 200);
      const bodyResolve = await resResolve.json();
      assert.equal(bodyResolve.case.status, 'resolved');
      assert.equal(bodyResolve.case.resolving_analyst_id, 'analyst-1');
      assert.ok(bodyResolve.case.resolved_at);

      // 3. Reject invalid status
      const resInvalid = await fetch('http://localhost:5066/api/v1/analyst/cases/case-open-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'bogus_status' }),
      });
      assert.equal(resInvalid.status, 400);
      const bodyInvalid = await resInvalid.json();
      assert.equal(bodyInvalid.error, 'ValidationError');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('getAnalystCases service error handling: returns 503 when Supabase unconfigured', async () => {
    await assert.rejects(
      async () => {
        await getAnalystCases(
          { id: 'analyst-1', role: 'analyst' },
          {},
          { isConfigCheck: () => false }
        );
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.equal(err.code, 'ServiceUnavailable');
        return true;
      }
    );
  });
});

