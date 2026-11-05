/**
 * FraudShield AI — RFC 4180 Compliant CSV Parser & Upload Extractor
 *
 * Provides:
 * - Robust stream buffer reading with hard storage limit (2MB)
 * - Content-Type validation (multipart/form-data, text/csv, application/csv)
 * - File extension validation (.csv)
 * - RFC 4180 CSV parsing supporting quotes, commas in quotes, escaped quotes, CRLF/LF
 * - Required header validation
 */

export const MAX_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const REQUIRED_CSV_HEADERS = [
  'amount',
  'currency',
  'merchant_name',
  'category',
  'transaction_date'
];

export const OPTIONAL_CSV_HEADERS = [
  'transaction_type',
  'description',
  'payment_method_last4',
  'is_synthetic'
];

/**
 * Reads readable request stream into a Buffer while strictly enforcing a size cap.
 *
 * @param {import('http').IncomingMessage} req
 * @param {number} [maxBytes=MAX_UPLOAD_SIZE_BYTES]
 * @returns {Promise<Buffer>}
 */
export async function readRequestBuffer(req, maxBytes = MAX_UPLOAD_SIZE_BYTES) {
  return new Promise((resolve, reject) => {
    let bytesReceived = 0;
    const chunks = [];

    // If body was already parsed into a Buffer or string by prior middleware
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > maxBytes) {
        const err = new Error(`File upload exceeds maximum allowable size limit of ${Math.round(maxBytes / 1024 / 1024)}MB.`);
        err.statusCode = 413;
        err.code = 'PayloadTooLarge';
        return reject(err);
      }
      return resolve(req.body);
    }

    if (typeof req.body === 'string') {
      const buf = Buffer.from(req.body, 'utf8');
      if (buf.length > maxBytes) {
        const err = new Error(`File upload exceeds maximum allowable size limit of ${Math.round(maxBytes / 1024 / 1024)}MB.`);
        err.statusCode = 413;
        err.code = 'PayloadTooLarge';
        return reject(err);
      }
      return resolve(buf);
    }

    let hasExceeded = false;
    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxBytes && !hasExceeded) {
        hasExceeded = true;
        const err = new Error(`File upload exceeds maximum allowable size limit of ${Math.round(maxBytes / 1024 / 1024)}MB.`);
        err.statusCode = 413;
        err.code = 'PayloadTooLarge';
        req.resume(); // Drain remaining incoming stream gracefully
        return reject(err);
      }
      if (!hasExceeded) {
        chunks.push(chunk);
      }
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Extracts raw CSV text from multipart/form-data or direct text/csv upload.
 *
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {{ csvText: string, fileName: string }}
 */
export function extractCsvFromUpload(buffer, contentType = '') {
  if (!contentType || typeof contentType !== 'string') {
    const err = new Error('Content-Type header is required for CSV upload');
    err.statusCode = 400;
    err.code = 'BadRequest';
    throw err;
  }

  const ct = contentType.toLowerCase();

  // 1. Direct CSV text upload
  if (ct.includes('text/csv') || ct.includes('application/csv') || ct.includes('text/plain')) {
    return {
      csvText: buffer.toString('utf8'),
      fileName: 'direct_upload.csv'
    };
  }

  // 2. Multipart form-data upload
  if (ct.includes('multipart/form-data')) {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      const err = new Error('Malformed multipart/form-data: boundary missing');
      err.statusCode = 400;
      err.code = 'BadRequest';
      throw err;
    }

    const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
    const rawContent = buffer.toString('utf8');
    const parts = rawContent.split(`--${boundary}`);

    for (const part of parts) {
      if (part.includes('Content-Disposition') && part.includes('filename=')) {
        // Extract filename
        const filenameMatch = part.match(/filename="?([^";\r\n]+)"?/i);
        const fileName = filenameMatch ? filenameMatch[1].trim() : '';

        // Validate file extension
        if (!fileName.toLowerCase().endsWith('.csv')) {
          const err = new Error(`Invalid file type: "${fileName}". Uploaded file must have a .csv extension.`);
          err.statusCode = 415;
          err.code = 'UnsupportedMediaType';
          throw err;
        }

        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          let body = part.slice(headerEnd + 4);
          if (body.endsWith('\r\n')) {
            body = body.slice(0, -2);
          }
          return {
            csvText: body,
            fileName: fileName || 'import.csv'
          };
        }
      }
    }

    const err = new Error('No CSV file part found in multipart upload');
    err.statusCode = 400;
    err.code = 'BadRequest';
    throw err;
  }

  // 3. Any other media type rejected
  const err = new Error(`Unsupported Media Type: "${contentType}". Only text/csv or multipart/form-data is accepted.`);
  err.statusCode = 415;
  err.code = 'UnsupportedMediaType';
  throw err;
}

/**
 * RFC 4180 compliant CSV parser.
 * Handles quoted fields, escaped quotes (""), commas inside quotes, CRLF and LF line endings.
 *
 * @param {string} text
 * @returns {Array<Array<string>>}
 */
export function parseCsv(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }

  const lines = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        row.push(field);
        lines.push(row);
        row = [];
        field = '';
      } else if (char === '\n') {
        row.push(field);
        lines.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    lines.push(row);
  }

  // Filter out any blank lines at the end
  return lines.filter((r) => r.length > 0 && r.some((c) => c.trim().length > 0));
}

/**
 * Validates parsed CSV header row against required fields.
 *
 * @param {Array<string>} headers
 * @returns {{ isValid: boolean, normalizedHeaders: Array<string>, missingHeaders: Array<string> }}
 */
export function validateCsvHeaders(headers) {
  if (!Array.isArray(headers) || headers.length === 0) {
    return {
      isValid: false,
      normalizedHeaders: [],
      missingHeaders: REQUIRED_CSV_HEADERS
    };
  }

  const normalized = headers.map((h) => (h || '').trim().toLowerCase());
  const missing = REQUIRED_CSV_HEADERS.filter((reqHeader) => !normalized.includes(reqHeader));

  return {
    isValid: missing.length === 0,
    normalizedHeaders: normalized,
    missingHeaders: missing
  };
}
