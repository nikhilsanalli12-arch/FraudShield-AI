/**
 * FraudShield AI — Centralized Transaction API Service
 *
 * Communicates with backend endpoints:
 * - POST /api/v1/transactions/manual
 * - POST /api/v1/transactions/import
 * - GET  /api/v1/transactions/history
 */

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_BASE_URL = rawBaseUrl.trim().replace(/\/+$/, '');

/**
 * Parses HTTP responses and throws informative Error objects on failure.
 *
 * @param {Response} response
 * @returns {Promise<any>}
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  let payload = null;

  try {
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = await response.text();
    }
  } catch {
    // Non-parsable body
    payload = null;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code = 'ApiError';
    let details = null;

    if (payload && typeof payload === 'object') {
      message = payload.message || payload.error || message;
      code = payload.error || payload.code || code;
      details = payload.errors || payload.missingHeaders || payload;
    } else if (typeof payload === 'string' && payload.trim()) {
      message = payload;
    }

    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    error.details = details;
    error.payload = payload;
    throw error;
  }

  return payload;
}

/**
 * Creates a single transaction with immediate deterministic fraud assessment.
 *
 * @param {string} token - Supabase JWT access token
 * @param {Object} data - Transaction payload
 * @returns {Promise<Object>} Created transaction and fraud assessment result
 */
export async function createManualTransaction(token, data) {
  if (!token) {
    throw new Error('Authentication required: no active session token.');
  }

  const response = await fetch(`${API_BASE_URL}/transactions/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

/**
 * Imports a batch of transactions from a CSV file.
 *
 * @param {string} token - Supabase JWT access token
 * @param {File|Blob} file - CSV file object
 * @returns {Promise<Object>} Batch import summary and row results
 */
export async function importTransactionsCsv(token, file) {
  if (!token) {
    throw new Error('Authentication required: no active session token.');
  }

  if (!file) {
    throw new Error('Please select a valid CSV file to import.');
  }

  const formData = new FormData();
  formData.append('file', file);

  // Note: Do not set Content-Type header manually; browser automatically sets boundary for FormData
  const response = await fetch(`${API_BASE_URL}/transactions/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse(response);
}

/**
 * Retrieves paginated transaction history for the authenticated user, including attached fraud assessments.
 *
 * @param {string} token - Supabase JWT access token
 * @param {number} [page=1] - 1-based page number
 * @param {number} [limit=20] - Number of records per page
 * @returns {Promise<Object>} Transaction list with pagination metadata
 */
export async function getTransactionHistory(token, page = 1, limit = 20) {
  if (!token) {
    throw new Error('Authentication required: no active session token.');
  }

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const response = await fetch(`${API_BASE_URL}/transactions/history?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
}

/**
 * Retrieves real investigation cases for analyst/admin triage queue.
 *
 * @param {string} token - Supabase JWT access token
 * @param {Object} [params={}] - Optional filters (status, priority, page, limit)
 * @returns {Promise<Object>} Formatted cases list with pagination
 */
export async function getAnalystCases(token, params = {}) {
  if (!token) {
    throw new Error('Authentication required: no active session token.');
  }

  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${API_BASE_URL}/analyst/cases${queryString}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  return handleResponse(response);
}

/**
 * Updates an investigation case status (e.g. in_review, resolved, closed).
 *
 * @param {string} token - Supabase JWT access token
 * @param {string} caseId - UUID of the case
 * @param {Object} data - { status, note }
 * @returns {Promise<Object>} Updated case details
 */
export async function updateAnalystCase(token, caseId, data) {
  if (!token) {
    throw new Error('Authentication required: no active session token.');
  }

  const response = await fetch(`${API_BASE_URL}/analyst/cases/${caseId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
}

/**
 * Requests a natural-language AI fraud explanation and 3 safety recommendations.
 * Powered by Google Gemini AI on the backend (with automatic heuristic fallback).
 *
 * @param {string} token - Supabase JWT access token
 * @param {Object} options - { transaction, assessment, transactionId }
 * @returns {Promise<Object>} Formatted AI explanation with facts, indicators, and recommendations
 */
export async function getAiTransactionExplanation(token, { transaction, assessment, transactionId } = {}) {
  if (!token) {
    throw new Error('Authentication required: no active session token.');
  }

  const endpoint = transactionId
    ? `${API_BASE_URL}/transactions/${encodeURIComponent(transactionId)}/ai-explain`
    : `${API_BASE_URL}/transactions/ai-explain`;

  const body = transactionId ? undefined : JSON.stringify({ transaction, assessment });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  return handleResponse(response);
}

/**
 * Standard formatted CSV sample content with required and optional headers.
 */
export const SAMPLE_CSV_CONTENT = `amount,currency,merchant_name,category,transaction_date,description,payment_method_last4
45.50,USD,Whole Foods,grocery,2026-11-05T10:30:00Z,Weekly groceries,4242
299.99,USD,Best Buy Electronics,electronics,2026-11-05T11:15:00Z,Headphones,4242
12.00,USD,Starbucks Coffee,dining,2026-11-05T12:00:00Z,Latte,4242
8500.00,USD,Luxury Watch Boutique,retail,2026-11-05T12:05:00Z,High value watch,4242`;

/**
 * Creates and triggers a client-side download of the sample CSV template.
 */
export function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'sample_fraudshield_transactions.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
