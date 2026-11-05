/**
 * FraudShield AI — Financial Analyst Service
 *
 * Handles case triage, queue retrieval, status updates, and investigation management
 * strictly guarded by role authorization (analyst, admin) and PostgreSQL RLS constraints.
 */

import { getSupabaseAdmin } from '../config/supabase.js';
import { isSupabaseConfigured } from '../config/environment.js';

export const VALID_CASE_STATUSES = ['open', 'in_review', 'escalated', 'resolved', 'closed'];

/**
 * Retrieves investigation cases with linked transaction, fraud assessment, and user profile data.
 *
 * @param {Object} callerUser - Verified user { id, email, role }
 * @param {Object} [queryParams={}] - Query filters (status, priority, page, limit)
 * @param {Object} [options={}] - Dependency injection options for testing
 * @returns {Promise<Object>} Formatted cases list with pagination
 */
export async function getAnalystCases(callerUser, queryParams = {}, options = {}) {
  if (!callerUser || !['analyst', 'admin'].includes(callerUser.role)) {
    const err = new Error('Access denied: financial analyst or administrator privilege required');
    err.statusCode = 403;
    err.code = 'Forbidden';
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
    const err = new Error('Database client is uninitialized');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  // Pagination parameters
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 50));
  const offset = (page - 1) * limit;

  // Build query
  let query = client
    .from('investigation_cases')
    .select(
      `
      id,
      transaction_id,
      user_id,
      assigned_analyst_id,
      resolving_analyst_id,
      status,
      priority,
      metadata,
      opened_at,
      updated_at,
      resolved_at,
      transactions (
        id,
        user_id,
        amount,
        currency,
        merchant_name,
        category,
        transaction_date,
        source,
        payment_method_last4,
        description,
        fraud_assessments (
          id,
          risk_score,
          risk_level,
          heuristic_reasons,
          model_version,
          assessed_at
        )
      ),
      profiles:user_id (
        id,
        email,
        full_name
      )
    `,
      { count: 'exact' }
    )
    .order('opened_at', { ascending: false });

  // Role-based scoping: Analysts see unassigned/open cases or cases assigned to them
  if (callerUser.role === 'analyst') {
    query = query.or(`status.eq.open,assigned_analyst_id.eq.${callerUser.id}`);
  }

  // Filter by status if requested
  if (queryParams.status && VALID_CASE_STATUSES.includes(queryParams.status)) {
    query = query.eq('status', queryParams.status);
  }

  // Filter by priority if requested
  if (queryParams.priority && ['low', 'medium', 'high', 'urgent'].includes(queryParams.priority)) {
    query = query.eq('priority', queryParams.priority);
  }

  // Apply pagination range
  query = query.range(offset, offset + limit - 1);

  const { data: rows, count, error } = await query;

  if (error) {
    console.error('[AnalystService] Error fetching investigation cases:', error.message);
    const err = new Error('Failed to retrieve investigation cases from database');
    err.statusCode = 500;
    err.code = 'DatabaseQueryError';
    throw err;
  }

  const total = count ?? (rows ? rows.length : 0);
  const totalPages = Math.ceil(total / limit) || 1;

  // Format cases to flatten single relations cleanly
  const cases = (rows || []).map((c) => {
    const tx = c.transactions || null;
    let assessment = null;
    if (tx && tx.fraud_assessments) {
      assessment = Array.isArray(tx.fraud_assessments)
        ? tx.fraud_assessments[0] || null
        : tx.fraud_assessments;
    }

    return {
      id: c.id,
      transaction_id: c.transaction_id,
      user_id: c.user_id,
      user_email: c.profiles?.email || null,
      user_name: c.profiles?.full_name || null,
      assigned_analyst_id: c.assigned_analyst_id,
      resolving_analyst_id: c.resolving_analyst_id,
      status: c.status,
      priority: c.priority,
      metadata: c.metadata || {},
      opened_at: c.opened_at,
      updated_at: c.updated_at,
      resolved_at: c.resolved_at,
      transaction: tx
        ? {
            id: tx.id,
            amount: tx.amount,
            currency: tx.currency,
            merchant_name: tx.merchant_name,
            category: tx.category,
            transaction_date: tx.transaction_date,
            source: tx.source,
            payment_method_last4: tx.payment_method_last4,
            description: tx.description,
          }
        : null,
      assessment: assessment
        ? {
            id: assessment.id,
            risk_score: assessment.risk_score,
            risk_level: assessment.risk_level,
            heuristic_reasons: assessment.heuristic_reasons || [],
            model_version: assessment.model_version,
            assessed_at: assessment.assessed_at,
          }
        : null,
    };
  });

  return {
    success: true,
    data: cases,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Updates an investigation case status (e.g. in_review, resolved, closed).
 *
 * @param {string} caseId - UUID of the case
 * @param {Object} callerUser - Verified user { id, email, role }
 * @param {Object} updatePayload - { status, note }
 * @param {Object} [options={}] - Dependency injection options for testing
 * @returns {Promise<Object>} Updated case
 */
export async function updateCaseStatus(caseId, callerUser, updatePayload = {}, options = {}) {
  if (!callerUser || !['analyst', 'admin'].includes(callerUser.role)) {
    const err = new Error('Access denied: financial analyst or administrator privilege required');
    err.statusCode = 403;
    err.code = 'Forbidden';
    throw err;
  }

  if (!caseId || typeof caseId !== 'string') {
    const err = new Error('Valid case ID is required');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  const { status } = updatePayload;
  if (!status || !VALID_CASE_STATUSES.includes(status)) {
    const err = new Error(`Status must be one of: ${VALID_CASE_STATUSES.join(', ')}`);
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
    const err = new Error('Database client is uninitialized');
    err.statusCode = 503;
    err.code = 'ServiceUnavailable';
    throw err;
  }

  const updateFields = {
    status,
    updated_at: new Date().toISOString(),
  };

  // Assign analyst if case is being moved into review
  if (status === 'in_review' && callerUser.role === 'analyst') {
    updateFields.assigned_analyst_id = callerUser.id;
  }

  // If resolved or closed, record resolving analyst and timestamp
  if (status === 'resolved' || status === 'closed') {
    updateFields.resolving_analyst_id = callerUser.id;
    updateFields.resolved_at = new Date().toISOString();
  }

  const { data: updatedCase, error } = await client
    .from('investigation_cases')
    .update(updateFields)
    .eq('id', caseId)
    .select()
    .single();

  if (error || !updatedCase) {
    console.error('[AnalystService] Error updating investigation case:', error?.message);
    const err = new Error(error ? error.message : 'Failed to update case');
    err.statusCode = 500;
    err.code = 'DatabaseUpdateError';
    throw err;
  }

  return {
    success: true,
    case: updatedCase,
  };
}

