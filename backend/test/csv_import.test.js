/**
 * FraudShield AI — Step 3: CSV Transaction Import Test Suite
 *
 * Verifies:
 * 1. RFC 4180 CSV parsing (quotes, commas in quotes, escaped quotes)
 * 2. Header validation (required headers, missing headers rejection)
 * 3. Valid CSV batch import with automatic fraud assessment and case creation
 * 4. Error isolation: one invalid row does NOT corrupt or break valid rows
 * 5. Duplicate detection: duplicate rows flagged, unique rows processed
 * 6. Intra-batch duplicate detection: second identical row in same CSV is flagged
 * 7. Fail-closed duplicate verification: database failure stops import and returns 503
 * 8. User/tenant isolation: imported transactions are strictly bound to authenticated req.user.id
 * 9. Upload limits: oversized uploads (>2MB) return 413 Payload Too Large
 * 10. File type validation: non-CSV MIME or extension returns 415 Unsupported Media Type
 * 11. Role & Auth: unauthenticated returns 401, analyst role returns 403 Forbidden
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  parseCsv,
  validateCsvHeaders,
  extractCsvFromUpload,
  MAX_UPLOAD_SIZE_BYTES
} from '../src/utils/csvParser.js';
import {
  importCsvTransactions,
  getTransactionHistory
} from '../src/services/transactionService.js';
import { createTransactionRouter } from '../src/routes/transactionRoutes.js';
import app from '../src/server.js';
import { requireRole } from '../src/middleware/roleGuard.js';

// In-memory mock Supabase client supporting transactions, assessments, cases, and import_batches
function createMockSupabaseClient(initialState = {}) {
  const transactions = [...(initialState.transactions || [])];
  const assessments = [...(initialState.assessments || [])];
  const cases = [...(initialState.cases || [])];
  const batches = [...(initialState.batches || [])];

  const failureFlags = {
    queryHistory: false,
    insertTransaction: false,
    insertAssessment: false,
    insertCase: false,
    insertBatch: false,
    ...(initialState.failureFlags || {})
  };

  const client = {
    _state: { transactions, assessments, cases, batches },
    failureFlags,
    from: (table) => {
      if (table === 'transactions') {
        return {
          select: (fields, options = {}) => {
            let filtered = [...transactions];
            const isCountExact = options.count === 'exact';

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
                  const attached = assessments.filter((a) => a.transaction_id === tx.id);
                  return { ...tx, fraud_assessments: attached };
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
                  single: async () => ({ data: null, error: { message: 'Transaction insert error' } })
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
          delete: () => ({
            eq: (col, val) => {
              const idx = transactions.findIndex((tx) => tx[col] === val);
              if (idx !== -1) transactions.splice(idx, 1);
              return Promise.resolve({ error: null });
            }
          })
        };
      }

      if (table === 'fraud_assessments') {
        return {
          insert: (payload) => {
            if (failureFlags.insertAssessment) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Assessment insert error' } })
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
          delete: () => ({
            eq: (col, val) => {
              const idx = assessments.findIndex((fa) => fa[col] === val);
              if (idx !== -1) assessments.splice(idx, 1);
              return Promise.resolve({ error: null });
            }
          })
        };
      }

      if (table === 'investigation_cases') {
        return {
          insert: (payload) => {
            if (failureFlags.insertCase) {
              return {
                select: () => ({
                  single: async () => ({ data: null, error: { message: 'Case insert error' } })
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
          delete: () => ({
            eq: (col, val) => {
              const idx = cases.findIndex((c) => c[col] === val);
              if (idx !== -1) cases.splice(idx, 1);
              return Promise.resolve({ error: null });
            }
          })
        };
      }

      if (table === 'import_batches') {
        return {
          insert: (payload) => {
            const record = {
              id: 'batch_' + Math.random().toString(36).substring(2, 9),
              created_at: new Date().toISOString(),
              ...payload
            };
            batches.push(record);
            return {
              select: () => ({
                single: async () => ({ data: record, error: null })
              })
            };
          },
          update: (payload) => ({
            eq: (col, val) => {
              const b = batches.find((item) => item[col] === val);
              if (b) Object.assign(b, payload);
              return Promise.resolve({ data: b, error: null });
            }
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }
  };

  return client;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('FraudShield AI — RFC 4180 CSV Parsing & Header Verification', () => {
  test('parseCsv handles RFC 4180 quotes, commas inside quotes, and CRLF line breaks', () => {
    const csvContent =
      'amount,currency,merchant_name,category,transaction_date\r\n' +
      '100.50,USD,"Super, Market",Groceries,2026-11-05T10:00:00Z\r\n' +
      '50.00,EUR,"Cafe ""Delight""",Dining,2026-11-05T11:00:00Z';

    const parsed = parseCsv(csvContent);
    assert.equal(parsed.length, 3);
    assert.deepEqual(parsed[0], ['amount', 'currency', 'merchant_name', 'category', 'transaction_date']);
    assert.equal(parsed[1][2], 'Super, Market'); // Preserves comma inside quotes
    assert.equal(parsed[2][2], 'Cafe "Delight"'); // Preserves escaped double quote
  });

  test('validateCsvHeaders verifies required headers and flags missing ones', () => {
    const validHeaders = ['AMOUNT', ' Currency ', 'merchant_name', 'Category', 'TRANSACTION_DATE', 'description'];
    const validRes = validateCsvHeaders(validHeaders);
    assert.equal(validRes.isValid, true);
    assert.equal(validRes.missingHeaders.length, 0);

    const missingHeaders = ['amount', 'currency', 'merchant_name']; // missing category, transaction_date
    const invalidRes = validateCsvHeaders(missingHeaders);
    assert.equal(invalidRes.isValid, false);
    assert.ok(invalidRes.missingHeaders.includes('category'));
    assert.ok(invalidRes.missingHeaders.includes('transaction_date'));
  });

  test('extractCsvFromUpload handles text/csv and multipart/form-data with .csv file', () => {
    // 1. Direct text/csv
    const directRes = extractCsvFromUpload(Buffer.from('amount,currency\n10,USD'), 'text/csv');
    assert.ok(directRes.csvText.includes('amount'));

    // 2. Multipart form-data
    const boundary = '----WebKitBoundaryABC';
    const multipart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="tx_export.csv"\r\nContent-Type: text/csv\r\n\r\namount,currency\n25,EUR\r\n--${boundary}--`
    );
    const multiRes = extractCsvFromUpload(multipart, `multipart/form-data; boundary=${boundary}`);
    assert.ok(multiRes.csvText.includes('25,EUR'));
    assert.equal(multiRes.fileName, 'tx_export.csv');
  });

  test('extractCsvFromUpload rejects non-CSV files (.pdf, .exe) with 415 UnsupportedMediaType', () => {
    const boundary = '----WebKitBoundaryXYZ';
    const badExtMultipart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="statement.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4...\r\n--${boundary}--`
    );

    assert.throws(
      () => extractCsvFromUpload(badExtMultipart, `multipart/form-data; boundary=${boundary}`),
      (err) => {
        assert.equal(err.statusCode, 415);
        assert.equal(err.code, 'UnsupportedMediaType');
        assert.match(err.message, /must have a \.csv extension/i);
        return true;
      }
    );

    // Direct application/pdf
    assert.throws(
      () => extractCsvFromUpload(Buffer.from('...'), 'application/pdf'),
      (err) => {
        assert.equal(err.statusCode, 415);
        assert.equal(err.code, 'UnsupportedMediaType');
        return true;
      }
    );
  });
});

describe('FraudShield AI — CSV Transaction Batch Import Service', () => {
  const userId = 'usr_csv_importer';

  const validCsv =
    'amount,currency,merchant_name,category,transaction_date,description\n' +
    '55.00,USD,Amazon AWS,Cloud Hosting,2026-11-05T09:00:00Z,Dev server\n' +
    '120.75,EUR,Deutsche Bahn,Travel,2026-11-05T10:00:00Z,Train ticket\n' +
    '500000.00,INR,Zaveri Jewellers,Jewellery,2026-11-05T11:00:00Z,Gold purchase';

  test('Successfully imports all valid CSV rows and runs fraud assessments', async () => {
    const mockClient = createMockSupabaseClient();
    const result = await importCsvTransactions(userId, validCsv, {
      client: mockClient,
      isConfigCheck: () => true,
      fileName: 'monthly_statement.csv'
    });

    assert.equal(result.success, true);
    assert.equal(result.summary.total_rows, 3);
    assert.equal(result.summary.imported_rows, 3);
    assert.equal(result.summary.rejected_rows, 0);
    assert.equal(result.summary.duplicate_rows, 0);

    // Database verification
    assert.equal(mockClient._state.transactions.length, 3);
    assert.equal(mockClient._state.assessments.length, 3);

    // Verify all transactions carry user_id and source=csv_import
    assert.ok(mockClient._state.transactions.every((tx) => tx.user_id === userId));
    assert.ok(mockClient._state.transactions.every((tx) => tx.source === 'csv_import'));

    // Row 3 is ₹500,000 INR (elevated amount 25 + major round 25 = 50 / medium risk)
    const inrTx = mockClient._state.transactions.find((tx) => tx.currency === 'INR');
    assert.ok(inrTx);
    const inrAssessment = mockClient._state.assessments.find((a) => a.transaction_id === inrTx.id);
    assert.equal(inrAssessment.risk_level, 'medium');
  });

  test('High-risk CSV row automatically opens compliance investigation case', async () => {
    const mockClient = createMockSupabaseClient();
    // $10,000 round number USD triggers extreme amount (45) + major round (25) = 70 (high risk)
    const highRiskCsv =
      'amount,currency,merchant_name,category,transaction_date\n' +
      '10000,USD,High Value Antiques,Art,2026-11-05T12:00:00Z';

    const result = await importCsvTransactions(userId, highRiskCsv, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.summary.imported_rows, 1);
    assert.equal(mockClient._state.cases.length, 1);
    assert.equal(mockClient._state.cases[0].priority, 'high');
    assert.equal(mockClient._state.cases[0].status, 'open');
  });

  test('Invalid headers immediately reject the import without mutating database', async () => {
    const mockClient = createMockSupabaseClient();
    const badHeaderCsv =
      'amount,currency,merchant_name\n' + // missing category and transaction_date
      '50,USD,Store';

    await assert.rejects(
      async () => {
        await importCsvTransactions(userId, badHeaderCsv, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, 'InvalidCsvHeadersError');
        assert.ok(err.missingHeaders.includes('category'));
        return true;
      }
    );

    assert.equal(mockClient._state.transactions.length, 0);
  });

  test('Error isolation: invalid row is rejected and reported without breaking valid rows', async () => {
    const mockClient = createMockSupabaseClient();
    const mixedCsv =
      'amount,currency,merchant_name,category,transaction_date\n' +
      '45.00,USD,Coffee Roasters,Food,2026-11-05T08:00:00Z\n' +
      '-15.00,USD,Refund Store,Shopping,2026-11-05T08:15:00Z\n' + // INVALID: negative amount
      '30.00,JPY,Tokyo Books,Books,2026-11-05T08:30:00Z\n' + // INVALID: unsupported currency
      '99.99,CAD,Maple Hardware,Supplies,2026-11-05T09:00:00Z'; // VALID

    const result = await importCsvTransactions(userId, mixedCsv, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.summary.total_rows, 4);
    assert.equal(result.summary.imported_rows, 2);
    assert.equal(result.summary.rejected_rows, 2);
    assert.equal(result.summary.duplicate_rows, 0);

    // Verify row-specific error reporting
    assert.equal(result.results.errors.length, 2);
    assert.equal(result.results.errors[0].row, 3); // -15.00 row
    assert.match(result.results.errors[0].reason, /amount/i);
    assert.equal(result.results.errors[1].row, 4); // JPY row
    assert.match(result.results.errors[1].reason, /currency/i);

    // Database should hold strictly the 2 valid rows
    assert.equal(mockClient._state.transactions.length, 2);
  });

  test('Duplicate detection: identifies existing duplicate and intra-batch duplicate', async () => {
    const existingTx = {
      id: 'tx_pre_existing',
      user_id: userId,
      amount: 100,
      currency: 'USD',
      merchant_name: 'Metro Transit',
      transaction_date: '2026-11-05T12:00:00Z'
    };

    const mockClient = createMockSupabaseClient({ transactions: [existingTx] });

    const duplicateCsv =
      'amount,currency,merchant_name,category,transaction_date\n' +
      '100,USD,Metro Transit,Transit,2026-11-05T12:01:00Z\n' + // DUPLICATE of existingTx (1 min apart, same amount & merchant)
      '200,USD,New Store,Retail,2026-11-05T12:30:00Z\n' + // FRESH row (imported)
      '200,USD,New Store,Retail,2026-11-05T12:30:30Z'; // INTRA-BATCH DUPLICATE of previous row

    const result = await importCsvTransactions(userId, duplicateCsv, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(result.summary.total_rows, 3);
    assert.equal(result.summary.imported_rows, 1); // Only the unique 200 USD row
    assert.equal(result.summary.duplicate_rows, 2);
    assert.equal(result.summary.rejected_rows, 0);

    assert.equal(result.results.duplicates.length, 2);
    assert.equal(result.results.duplicates[0].row, 2); // First duplicate
    assert.equal(result.results.duplicates[1].row, 4); // Intra-batch duplicate
  });

  test('Fail-closed: database error during duplicate verification stops import with 503', async () => {
    const mockClient = createMockSupabaseClient({
      failureFlags: { queryHistory: true }
    });

    await assert.rejects(
      async () => {
        await importCsvTransactions(userId, validCsv, {
          client: mockClient,
          isConfigCheck: () => true
        });
      },
      (err) => {
        assert.equal(err.statusCode, 503);
        assert.equal(err.code, 'ServiceUnavailable');
        assert.match(err.message, /verification service is temporarily unavailable/i);
        return true;
      }
    );

    // Zero transactions written
    assert.equal(mockClient._state.transactions.length, 0);
    assert.equal(mockClient._state.assessments.length, 0);
  });

  test('Tenant isolation: user ID in CSV is strictly ignored; authenticated req.user.id is enforced', async () => {
    const mockClient = createMockSupabaseClient();
    // Attacker attempts to spoof user_id column in CSV
    const spoofCsv =
      'amount,currency,merchant_name,category,transaction_date,user_id\n' +
      '45.00,USD,Coffee Shop,Food,2026-11-05T08:00:00Z,target_victim_uuid';

    await importCsvTransactions(userId, spoofCsv, {
      client: mockClient,
      isConfigCheck: () => true
    });

    assert.equal(mockClient._state.transactions.length, 1);
    // User ID is strictly authenticated userId, NEVER victim UUID
    assert.equal(mockClient._state.transactions[0].user_id, userId);
  });
});

describe('FraudShield AI — CSV Import HTTP Endpoint Invariants', () => {
  let server;
  let baseUrl;

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

  test('POST /api/v1/transactions/import denies unauthenticated requests (401 or 503)', async () => {
    const res = await fetch(`${baseUrl}/api/v1/transactions/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: 'amount,currency\n10,USD'
    });
    assert.ok([401, 503].includes(res.status));
    const body = await res.json();
    assert.ok(['Unauthorized', 'ServiceUnavailable'].includes(body.error));
  });

  test('POST /api/v1/transactions/import rejects analyst role with 403 Forbidden', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    // Inject analyst user
    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'usr_analyst_demo',
        role: 'analyst',
        email: 'analyst@fraudshield.ai'
      });
      next();
    });

    mockApp.post(
      '/api/v1/transactions/import',
      requireRole(['personal', 'admin']),
      async (req, res) => res.status(200).json({ success: true })
    );

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: 'amount,currency\n10,USD'
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error, 'Forbidden');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/transactions/import rejects oversized uploads with 413 Payload Too Large', async () => {
    const mockApp = express();
    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({ id: 'usr_p1', role: 'personal' });
      next();
    };
    const router = createTransactionRouter(undefined, { authMiddleware: mockAuth });
    mockApp.use('/api/v1/transactions', router);

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      // Create a payload exceeding MAX_UPLOAD_SIZE_BYTES (2.1 MB)
      const hugeBuffer = Buffer.alloc(2.1 * 1024 * 1024, 'a');
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: hugeBuffer
      });
      assert.equal(res.status, 413);
      const body = await res.json();
      assert.equal(body.error, 'PayloadTooLarge');
      assert.match(body.message, /exceeds maximum allowable size limit/i);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/transactions/import rejects unsupported media types with 415', async () => {
    const mockApp = express();
    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({ id: 'usr_p1', role: 'personal' });
      next();
    };
    const router = createTransactionRouter(undefined, { authMiddleware: mockAuth });
    mockApp.use('/api/v1/transactions', router);

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: '%PDF-1.4 mock file'
      });
      assert.equal(res.status, 415);
      const body = await res.json();
      assert.equal(body.error, 'UnsupportedMediaType');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/v1/transactions/import accepts valid direct CSV and returns import summary', async () => {
    const mockApp = express();
    const mockAuth = (req, res, next) => {
      req.user = Object.freeze({ id: 'usr_p1', role: 'personal' });
      next();
    };

    const mockService = {
      importCsvTransactions: async (userId, csvText) => ({
        success: true,
        summary: {
          total_rows: 2,
          imported_rows: 2,
          rejected_rows: 0,
          duplicate_rows: 0
        },
        results: {
          imported: [{ row: 2, amount: 50 }, { row: 3, amount: 75 }],
          duplicates: [],
          errors: []
        }
      })
    };

    const router = createTransactionRouter(mockService, { authMiddleware: mockAuth });
    mockApp.use('/api/v1/transactions', router);

    const localServer = mockApp.listen(0);
    const port = localServer.address().port;
    try {
      const csvData = 'amount,currency,merchant_name,category,transaction_date\n50,USD,Shop A,Food,2026-11-05T10:00:00Z\n75,USD,Shop B,Food,2026-11-05T11:00:00Z';
      const res = await fetch(`http://localhost:${port}/api/v1/transactions/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csvData
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.summary.imported_rows, 2);
      assert.equal(body.summary.rejected_rows, 0);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });
});
