/**
 * FraudShield AI — Transaction Service
 *
 * Implements core transaction lifecycle, fraud scoring orchestration,
 * duplicate detection, and audit/investigation case management.
 *
 * Adheres strictly to:
 * - Migration 002 schema (public.transactions, public.fraud_assessments, public.investigation_cases)
 * - Tenant isolation (auth.uid() = user_id)
 * - Safe rollback / compensation on partial database failures
 */

import { getSupabaseAdmin } from '../config/supabase.js';
import { isSupabaseConfigured } from '../config/environment.js';
import {
  validateManualTransaction,
  validateCsvTransactionRow
} from '../validators/transactionValidator.js';
import { evaluateTransaction } from './fraudEngine.js';
import { parseCsv, validateCsvHeaders } from '../utils/csvParser.js';

/**
 * Sanitizes metadata object to ensure all top-level values are flat scalars,
 * strictly satisfying the database constraint `validate_transaction_metadata_structure(metadata)`.
 *
 * @param {Object} [meta={}]
 * @returns {Object} Flat scalar metadata
 */
export function sanitizeMetadataForDb(meta = {}) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const sanitized = {};
  for (const [key, val] of Object.entries(meta)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      sanitized[key] = val.join(',');
    } else if (typeof val === 'object') {
      sanitized[key] = JSON.stringify(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Checks whether a candidate transaction is a likely duplicate of an existing recent transaction.
 * A transaction is deemed duplicate if the same user has an existing record with:
 * - Identical merchant name (case-insensitive)
 * - Exact same numeric amount
 * - Identical currency
 * - Transaction timestamps within a 2-minute rolling window (or exact same timestamp)
 *
 * @param {Object} candidate - Validated candidate transaction object
 * @param {Array<Object>} recentHistory - User's recent transaction records
 * @returns {{ isDuplicate: boolean, duplicateTransaction: Object | null }}
 */
export function detectDuplicateTransaction(candidate, recentHistory = []) {
  if (!Array.isArray(recentHistory) || recentHistory.length === 0) {
    return { isDuplicate: false, duplicateTransaction: null };
  }

  const candidateAmount = Number(candidate.amount);
  const candidateMerchant = (candidate.merchant_name || '').trim().toLowerCase();
  const candidateCurrency = (candidate.currency || '').trim().toUpperCase();
  const candidateTime = new Date(candidate.transaction_date).getTime();
  const DUPLICATE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

  const duplicate = recentHistory.find((tx) => {
    if (!tx || typeof tx !== 'object') return false;
    // Exclude if comparing same record by ID
    if (candidate.id && tx.id === candidate.id) return false;

    const txAmount = Number(tx.amount);
    const txMerchant = (tx.merchant_name || '').trim().toLowerCase();
    const txCurrency = (tx.currency || '').trim().toUpperCase();
    const txTime = new Date(tx.transaction_date).getTime();

    if (txAmount !== candidateAmount) return false;
    if (txMerchant !== candidateMerchant) return false;
    if (txCurrency !== candidateCurrency) return false;

    // Check timestamp proximity
    if (!isNaN(candidateTime) && !isNaN(txTime)) {
      const diff = Math.abs(candidateTime - txTime);
      if (diff <= DUPLICATE_WINDOW_MS) return true;
    }

    return false;
  });

  return {
    isDuplicate: Boolean(duplicate),
    duplicateTransaction: duplicate || null
  };
}

/**
 * Creates and evaluates a manual transaction for an authenticated user.
 *
 * Steps:
 * 1. Validate payload against strict database schema (transactionValidator).
 * 2. Query user's recent transactions for duplicate detection and velocity scoring.
 * 3. Reject duplicate transactions with a descriptive Conflict error.
 * 4. Insert transaction into public.transactions bound strictly to authenticated userId.
 * 5. Run deterministic fraud scoring engine (fraudEngine).
 * 6. Persist fraud assessment into public.fraud_assessments.
 * 7. If risk level is high or critical, create an investigation case in public.investigation_cases.
 * 8. If assessment or case insertion fails, roll back / compensate to prevent orphaned transactions.
 *
 * @param {string} userId - Authenticated user UUID (never user-supplied input)
 * @param {Object} rawPayload - Request body payload
 * @param {Object} [options={}] - Options, e.g. client injection for testing
 * @returns {Promise<Object>} Created transaction, fraud assessment, and optional investigation case
 */
export async function createManualTransaction(userId, rawPayload, options = {}) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Authenticated user ID is required');
    err.statusCode = 401;
    err.code = 'Unauthorized';
    throw err;
  }

  // 1. Validate transaction schema
  const validation = validateManualTransaction(rawPayload);
  if (!validation.success) {
    const err = new Error('Transaction validation failed');
    err.statusCode = 400;
    err.code = 'ValidationError';
    err.errors = validation.errors;
    throw err;
  }
  const validData = validation.data;

  // 2. Obtain Supabase client
  const clientGetter = options.clientGetter || getSupabaseAdmin;
  const isConfigCheck = options.isConfigCheck || isSupabaseConfigured;

  if (!isConfigCheck()) {
    const err = new Error('Database service is not configured');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  const client = options.client || clientGetter();
  if (!client) {
    const err = new Error('Supabase client uninitialized');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  // 3. Query recent transactions for duplicate detection & fraud context
  let recentHistory = [];
  try {
    const { data: historyData, error: historyErr } = await client
      .from('transactions')
      .select('id, user_id, amount, currency, merchant_name, category, transaction_date, created_at')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(20);

    if (historyErr) {
      console.error('[TransactionService] Database error during duplicate check query:', historyErr.message);
      const err = new Error('Transaction verification service is temporarily unavailable. Please try again.');
      err.statusCode = 503;
      err.code = 'ServiceUnavailable';
      throw err;
    }

    if (Array.isArray(historyData)) {
      recentHistory = historyData;
    }
  } catch (queryErr) {
    if (queryErr.statusCode) {
      throw queryErr;
    }
    console.error('[TransactionService] Unexpected error during duplicate check query:', queryErr.message);
    const err = new Error('Transaction verification service is temporarily unavailable. Please try again.');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  // 4. Duplicate transaction detection
  const duplicateCheck = detectDuplicateTransaction(validData, recentHistory);
  if (duplicateCheck.isDuplicate) {
    const err = new Error(
      `Duplicate transaction detected: an identical transaction at "${validData.merchant_name}" for ${validData.amount} ${validData.currency} was processed recently.`
    );
    err.statusCode = 409;
    err.code = 'DuplicateTransaction';
    err.duplicateTransactionId = duplicateCheck.duplicateTransaction?.id || null;
    throw err;
  }

  // 5. Evaluate fraud score deterministically using existing engine
  const assessmentResult = evaluateTransaction(validData, recentHistory, {
    historicalContextAvailable: recentHistory.length > 0
  });

  // 6. Insert transaction row into public.transactions
  // Enforces financial immutability and user tenancy
  const transactionInsertPayload = {
    user_id: userId,
    currency: validData.currency,
    amount: validData.amount,
    transaction_type: validData.transaction_type,
    merchant_name: validData.merchant_name,
    category: validData.category,
    description: validData.description,
    payment_method_last4: validData.payment_method_last4,
    transaction_date: validData.transaction_date,
    source: 'manual',
    is_synthetic: Boolean(validData.is_synthetic),
    metadata: validData.metadata || {}
  };

  const { data: insertedTx, error: txInsertErr } = await client
    .from('transactions')
    .insert(transactionInsertPayload)
    .select()
    .single();

  if (txInsertErr || !insertedTx) {
    const err = new Error('Failed to record transaction in database');
    err.statusCode = 500;
    err.code = 'DatabaseInsertError';
    err.details = txInsertErr ? txInsertErr.message : 'Unknown insert failure';
    throw err;
  }

  // 7. Persist fraud assessment into public.fraud_assessments
  const assessmentInsertPayload = {
    transaction_id: insertedTx.id,
    user_id: userId,
    risk_score: assessmentResult.risk_score,
    risk_level: assessmentResult.risk_level,
    heuristic_reasons: assessmentResult.heuristic_reasons,
    model_version: assessmentResult.model_version,
    metadata: sanitizeMetadataForDb(assessmentResult.metadata)
  };

  const { data: insertedAssessment, error: assessmentInsertErr } = await client
    .from('fraud_assessments')
    .insert(assessmentInsertPayload)
    .select()
    .single();

  // Compensation: If assessment fails, rollback the inserted transaction
  if (assessmentInsertErr || !insertedAssessment) {
    console.error(
      `[TransactionService] Assessment insert failed for tx ${insertedTx.id}:`,
      assessmentInsertErr?.message || assessmentInsertErr
    );
    try {
      await client.from('transactions').delete().eq('id', insertedTx.id);
    } catch (compensationErr) {
      console.error(
        `[TransactionService] CRITICAL: Transaction rollback compensation failed for ${insertedTx.id}:`,
        compensationErr.message
      );
    }

    const err = new Error('Failed to record fraud assessment. Transaction was rolled back.');
    err.statusCode = 500;
    err.code = 'AssessmentPersistenceError';
    throw err;
  }

  // 8. Open investigation case if risk is high or critical
  let insertedCase = null;
  if (assessmentResult.risk_level === 'high' || assessmentResult.risk_level === 'critical') {
    const casePayload = {
      transaction_id: insertedTx.id,
      user_id: userId,
      status: 'open',
      priority: assessmentResult.risk_level === 'critical' ? 'urgent' : 'high',
      metadata: {
        auto_flagged: true,
        risk_score: assessmentResult.risk_score,
        risk_level: assessmentResult.risk_level,
        heuristic_summary: assessmentResult.heuristic_reasons.join('; ') || 'Heuristic alert',
        source: 'manual'
      }
    };

    const { data: caseData, error: caseErr } = await client
      .from('investigation_cases')
      .insert(casePayload)
      .select()
      .single();

    if (caseErr || !caseData) {
      console.error(
        `[TransactionService] Investigation case insert failed for tx ${insertedTx.id}:`,
        caseErr?.message || caseErr
      );
      try {
        await client.from('fraud_assessments').delete().eq('id', insertedAssessment.id);
        await client.from('transactions').delete().eq('id', insertedTx.id);
      } catch (compensationErr) {
        console.error(
          `[TransactionService] CRITICAL: Case rollback compensation failed for ${insertedTx.id}:`,
          compensationErr.message
        );
      }

      const err = new Error('Failed to create required compliance investigation case. Transaction was rolled back.');
      err.statusCode = 500;
      err.code = 'CaseCreationError';
      throw err;
    }

    insertedCase = caseData;
  }

  return {
    success: true,
    transaction: insertedTx,
    assessment: {
      id: insertedAssessment.id,
      risk_score: insertedAssessment.risk_score,
      risk_level: insertedAssessment.risk_level,
      heuristic_reasons: insertedAssessment.heuristic_reasons,
      model_version: insertedAssessment.model_version,
      assessed_at: insertedAssessment.assessed_at
    },
    investigation_case: insertedCase
      ? {
          id: insertedCase.id,
          status: insertedCase.status,
          priority: insertedCase.priority,
          opened_at: insertedCase.opened_at
        }
      : null
  };
}

/**
 * Retrieves paginated transaction history for an authenticated user, including attached fraud assessments.
 *
 * @param {string} userId - Authenticated user UUID (strictly enforced)
 * @param {Object} [queryParams={}] - Pagination parameters (page, limit)
 * @param {Object} [options={}] - Dependency injection options for testing
 * @returns {Promise<Object>} Paginated transaction list with metadata
 */
export async function getTransactionHistory(userId, queryParams = {}, options = {}) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Authenticated user ID is required');
    err.statusCode = 401;
    err.code = 'Unauthorized';
    throw err;
  }

  const clientGetter = options.clientGetter || getSupabaseAdmin;
  const isConfigCheck = options.isConfigCheck || isSupabaseConfigured;

  if (!isConfigCheck()) {
    const err = new Error('Database service is not configured');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  const client = options.client || clientGetter();
  if (!client) {
    const err = new Error('Supabase client uninitialized');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  // Safe pagination defaults
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const { data: rows, count, error } = await client
    .from('transactions')
    .select(
      `
      id,
      user_id,
      currency,
      amount,
      transaction_type,
      merchant_name,
      category,
      description,
      payment_method_last4,
      transaction_date,
      source,
      is_synthetic,
      metadata,
      created_at,
      fraud_assessments (
        id,
        risk_score,
        risk_level,
        heuristic_reasons,
        model_version,
        assessed_at
      )
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[TransactionService] History query error:', error.message);
    const err = new Error('Failed to retrieve transaction history');
    err.statusCode = 500;
    err.code = 'DatabaseQueryError';
    throw err;
  }

  const total = count ?? (rows ? rows.length : 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // Flatten nested 1-to-1 relationship cleanly
  const transactions = (rows || []).map((row) => {
    const assessment = Array.isArray(row.fraud_assessments)
      ? row.fraud_assessments[0] || null
      : row.fraud_assessments || null;

    const { fraud_assessments, ...cleanTx } = row;
    return {
      ...cleanTx,
      fraud_assessment: assessment
    };
  });

  return {
    success: true,
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
}

/**
 * Retrieves a single transaction with attached fraud assessment, strictly scoped by tenant ID.
 *
 * @param {string} transactionId - UUID of the transaction
 * @param {string} userId - Authenticated user UUID
 * @param {string} [userRole='personal'] - User role (analyst/admin can inspect cross-tenant)
 * @param {Object} [options={}] - Testing overrides
 * @returns {Promise<Object|null>} Transaction object or null if not found
 */
export async function getTransactionById(transactionId, userId, userRole = 'personal', options = {}) {
  if (!transactionId || typeof transactionId !== 'string') {
    const err = new Error('Valid transaction ID is required');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  const clientGetter = options.clientGetter || getSupabaseAdmin;
  const isConfigCheck = options.isConfigCheck || isSupabaseConfigured;

  if (!isConfigCheck()) {
    const err = new Error('Database service is not configured');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  const client = options.client || clientGetter();
  if (!client) {
    const err = new Error('Supabase client uninitialized');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  let query = client
    .from('transactions')
    .select(
      `
      id,
      user_id,
      currency,
      amount,
      transaction_type,
      merchant_name,
      category,
      description,
      payment_method_last4,
      transaction_date,
      source,
      is_synthetic,
      metadata,
      created_at,
      fraud_assessments (
        id,
        risk_score,
        risk_level,
        heuristic_reasons,
        model_version,
        assessed_at
      )
    `
    )
    .eq('id', transactionId);

  // If role is personal, enforce strict tenant isolation (user_id = userId)
  if (userRole === 'personal' && userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  const assessment = Array.isArray(data.fraud_assessments)
    ? data.fraud_assessments[0] || null
    : data.fraud_assessments || null;

  const { fraud_assessments, ...cleanTx } = data;
  return {
    ...cleanTx,
    fraud_assessment: assessment,
  };
}

/**
 * Imports and processes a batch of transactions from CSV text.
 *
 * @param {string} userId - Authenticated user UUID
 * @param {string} csvText - Parsed CSV content string
 * @param {Object} [options={}] - Options (fileName, client, isConfigCheck)
 * @returns {Promise<Object>} Import summary with row-level outcome breakdown
 */
export async function importCsvTransactions(userId, csvText, options = {}) {
  if (!userId || typeof userId !== 'string') {
    const err = new Error('Authenticated user ID is required');
    err.statusCode = 401;
    err.code = 'Unauthorized';
    throw err;
  }

  if (typeof csvText !== 'string' || csvText.trim().length === 0) {
    const err = new Error('CSV content cannot be empty');
    err.statusCode = 400;
    err.code = 'EmptyCsvError';
    throw err;
  }

  // 1. Parse CSV lines
  const lines = parseCsv(csvText);
  if (lines.length === 0) {
    const err = new Error('CSV file contains no valid rows');
    err.statusCode = 400;
    err.code = 'EmptyCsvError';
    throw err;
  }

  // 2. Validate CSV header row
  const headerRow = lines[0];
  const headerValidation = validateCsvHeaders(headerRow);
  if (!headerValidation.isValid) {
    const err = new Error(
      `CSV header is missing required columns: ${headerValidation.missingHeaders.join(', ')}`
    );
    err.statusCode = 400;
    err.code = 'InvalidCsvHeadersError';
    err.missingHeaders = headerValidation.missingHeaders;
    throw err;
  }

  const dataRows = lines.slice(1);
  if (dataRows.length === 0) {
    const err = new Error('CSV file contains a header but no transaction data rows');
    err.statusCode = 400;
    err.code = 'EmptyCsvError';
    throw err;
  }

  // 3. Obtain database client
  const clientGetter = options.clientGetter || getSupabaseAdmin;
  const isConfigCheck = options.isConfigCheck || isSupabaseConfigured;

  if (!isConfigCheck()) {
    const err = new Error('Database service is not configured');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  const client = options.client || clientGetter();
  if (!client) {
    const err = new Error('Supabase client uninitialized');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  // 4. Query recent transactions for duplicate check and velocity (FAIL-CLOSED)
  let workingHistory = [];
  try {
    const { data: historyData, error: historyErr } = await client
      .from('transactions')
      .select('id, user_id, amount, currency, merchant_name, category, transaction_date, created_at')
      .eq('user_id', userId)
      .order('transaction_date', { ascending: false })
      .limit(50);

    if (historyErr) {
      console.error('[TransactionService] Database error during CSV duplicate-check query:', historyErr.message);
      const err = new Error('Transaction verification service is temporarily unavailable. Please try again.');
      err.statusCode = 503;
      err.code = 'ServiceUnavailable';
      throw err;
    }

    if (Array.isArray(historyData)) {
      workingHistory = [...historyData];
    }
  } catch (queryErr) {
    if (queryErr.statusCode) throw queryErr;
    console.error('[TransactionService] Unexpected error during CSV history query:', queryErr.message);
    const err = new Error('Transaction verification service is temporarily unavailable. Please try again.');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  // 5. Optional Import Batch Tracking (Migration 002 public.import_batches)
  let batchId = null;
  const fileName = (options.fileName || 'transactions_import.csv').substring(0, 255);
  try {
    const { data: batchData, error: batchErr } = await client
      .from('import_batches')
      .insert({
        user_id: userId,
        file_name: fileName,
        status: 'processing',
        total_records: dataRows.length,
        processed_records: 0,
        failed_records: 0,
        error_log: []
      })
      .select()
      .single();

    if (!batchErr && batchData) {
      batchId = batchData.id;
    }
  } catch (bErr) {
    console.warn('[TransactionService] Notice: import_batches tracking skipped:', bErr.message);
  }

  // 6. Iterate and process each row with strict tenant isolation and error isolation
  const headers = headerValidation.normalizedHeaders;
  const imported = [];
  const duplicates = [];
  const errors = [];
  let importedCount = 0;
  let rejectedCount = 0;
  let duplicateCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const rowValues = dataRows[i];
    const rowNumber = i + 2; // Row 1 is header

    // Map headers to row values
    const rawRow = {};
    for (let h = 0; h < headers.length; h++) {
      rawRow[headers[h]] = rowValues[h] !== undefined ? rowValues[h].trim() : '';
    }

    // Row-level schema validation
    const validation = validateCsvTransactionRow(rawRow);
    if (!validation.success) {
      rejectedCount++;
      errors.push({
        row: rowNumber,
        reason: 'Validation failed: ' + validation.errors.map((e) => `${e.field}: ${e.message}`).join(', '),
        fields: validation.errors
      });
      continue;
    }

    const rowData = validation.data;

    // Duplicate detection against working history (includes previously imported rows in this batch)
    const duplicateCheck = detectDuplicateTransaction(rowData, workingHistory);
    if (duplicateCheck.isDuplicate) {
      duplicateCount++;
      duplicates.push({
        row: rowNumber,
        merchant_name: rowData.merchant_name,
        amount: rowData.amount,
        currency: rowData.currency,
        reason: 'Duplicate transaction: an identical transaction was processed recently.',
        duplicate_transaction_id: duplicateCheck.duplicateTransaction?.id || null
      });
      continue;
    }

    // Deterministic fraud scoring
    const assessmentResult = evaluateTransaction(rowData, workingHistory, {
      historicalContextAvailable: workingHistory.length > 0
    });

    // Insert into public.transactions (strictly with authenticated userId)
    const txPayload = {
      user_id: userId,
      currency: rowData.currency,
      amount: rowData.amount,
      transaction_type: rowData.transaction_type,
      merchant_name: rowData.merchant_name,
      category: rowData.category,
      description: rowData.description,
      payment_method_last4: rowData.payment_method_last4,
      transaction_date: rowData.transaction_date,
      source: 'csv_import',
      import_batch_id: batchId,
      is_synthetic: Boolean(rowData.is_synthetic),
      metadata: rowData.metadata || {}
    };

    let insertedTx = null;
    try {
      const { data: txData, error: txErr } = await client
        .from('transactions')
        .insert(txPayload)
        .select()
        .single();

      if (txErr || !txData) {
        throw new Error(txErr ? txErr.message : 'Failed to insert transaction row');
      }
      insertedTx = txData;
    } catch (txInsertError) {
      rejectedCount++;
      errors.push({
        row: rowNumber,
        reason: 'Database insertion error for transaction row'
      });
      continue;
    }

    // Persist fraud assessment
    let insertedAssessment = null;
    try {
      const assessmentPayload = {
        transaction_id: insertedTx.id,
        user_id: userId,
        risk_score: assessmentResult.risk_score,
        risk_level: assessmentResult.risk_level,
        heuristic_reasons: assessmentResult.heuristic_reasons,
        model_version: assessmentResult.model_version,
        metadata: sanitizeMetadataForDb(assessmentResult.metadata)
      };

      const { data: faData, error: faErr } = await client
        .from('fraud_assessments')
        .insert(assessmentPayload)
        .select()
        .single();

      if (faErr || !faData) {
        throw new Error(faErr ? faErr.message : 'Assessment insertion failed');
      }
      insertedAssessment = faData;
    } catch (faInsertError) {
      // Compensate rollback on transaction
      try {
        await client.from('transactions').delete().eq('id', insertedTx.id);
      } catch (cErr) {
        console.error('[TransactionService] Rollback error for tx:', insertedTx.id);
      }
      rejectedCount++;
      errors.push({
        row: rowNumber,
        reason: 'Failed to record fraud assessment. Row rolled back.'
      });
      continue;
    }

    // Open investigation case if risk is high or critical
    let insertedCase = null;
    if (assessmentResult.risk_level === 'high' || assessmentResult.risk_level === 'critical') {
      try {
        const casePayload = {
          transaction_id: insertedTx.id,
          user_id: userId,
          status: 'open',
          priority: assessmentResult.risk_level === 'critical' ? 'urgent' : 'high',
          metadata: {
            auto_flagged: true,
            risk_score: assessmentResult.risk_score,
            risk_level: assessmentResult.risk_level,
            heuristic_summary: assessmentResult.heuristic_reasons.join('; ') || 'Heuristic alert',
            source: 'csv_import'
          }
        };

        const { data: caseData, error: caseErr } = await client
          .from('investigation_cases')
          .insert(casePayload)
          .select()
          .single();

        if (caseErr || !caseData) {
          throw new Error(caseErr ? caseErr.message : 'Case creation failed');
        }
        insertedCase = caseData;
      } catch (caseInsertError) {
        // Compensate rollback
        try {
          await client.from('fraud_assessments').delete().eq('id', insertedAssessment.id);
          await client.from('transactions').delete().eq('id', insertedTx.id);
        } catch (cErr) {
          console.error('[TransactionService] Case compensation error for tx:', insertedTx.id);
        }
        rejectedCount++;
        errors.push({
          row: rowNumber,
          reason: 'Failed to open required compliance investigation case. Row rolled back.'
        });
        continue;
      }
    }

    // Successful row!
    importedCount++;
    workingHistory.unshift(insertedTx); // Update working history for subsequent intra-batch rows
    imported.push({
      row: rowNumber,
      transaction_id: insertedTx.id,
      amount: insertedTx.amount,
      currency: insertedTx.currency,
      merchant_name: insertedTx.merchant_name,
      risk_score: assessmentResult.risk_score,
      risk_level: assessmentResult.risk_level
    });
  }

  // 7. Update batch record if created
  if (batchId) {
    try {
      await client
        .from('import_batches')
        .update({
          status: importedCount > 0 ? 'completed' : 'failed',
          processed_records: importedCount,
          failed_records: rejectedCount + duplicateCount,
          error_log: errors,
          completed_at: new Date().toISOString()
        })
        .eq('id', batchId);
    } catch (updateErr) {
      console.warn('[TransactionService] Notice: import_batches update skipped:', updateErr.message);
    }
  }

  // Sanitized logging (zero financial or sensitive payload logged)
  console.log(
    `[TransactionService] CSV import complete for user ${userId.substring(0, 8)}: total=${dataRows.length}, imported=${importedCount}, rejected=${rejectedCount}, duplicates=${duplicateCount}`
  );

  return {
    success: true,
    summary: {
      total_rows: dataRows.length,
      imported_rows: importedCount,
      rejected_rows: rejectedCount,
      duplicate_rows: duplicateCount,
      batch_id: batchId
    },
    results: {
      imported,
      duplicates,
      errors
    }
  };
}

