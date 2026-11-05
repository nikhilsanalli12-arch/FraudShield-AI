/**
 * FraudShield AI — Suspicious Link Scanner API Service
 *
 * Communicates with backend endpoint:
 * - POST /api/v1/links/scan
 */

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const API_BASE_URL = rawBaseUrl.trim().replace(/\/+$/, '');

/**
 * Parses HTTP responses safely and throws structured Error objects.
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
    payload = null;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let code = 'ApiError';

    if (payload && typeof payload === 'object') {
      message = payload.message || payload.error || message;
      code = payload.error || payload.code || code;
    } else if (typeof payload === 'string' && payload.trim()) {
      message = payload;
    }

    const error = new Error(message);
    error.status = response.status;
    error.code = code;
    throw error;
  }

  return payload;
}

/**
 * Scans a user-provided URL for security and fraud indicators.
 *
 * @param {string} token - User's Supabase JWT access token
 * @param {string} url - Target URL to analyze
 * @returns {Promise<Object>} Formatted scan analysis
 */
export async function scanLink(token, url) {
  if (!token) {
    throw new Error('Authentication token is required to scan links.');
  }

  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('Please enter a valid URL to analyze.');
  }

  const response = await fetch(`${API_BASE_URL}/links/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: url.trim() }),
  });

  return handleResponse(response);
}

