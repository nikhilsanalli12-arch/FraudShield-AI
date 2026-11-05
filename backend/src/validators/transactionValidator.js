/**
 * FraudShield AI — Transaction Validation Schemas
 *
 * Strict validation enforcing database constraints from Migration 002:
 * - public.transactions schema
 * - public.supported_currencies (USD, EUR, GBP, CAD, AUD, INR)
 * - public.validate_transaction_metadata_structure()
 */

import { z } from 'zod';

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'INR'];
export const TRANSACTION_TYPES = ['debit', 'credit', 'transfer'];
export const TRANSACTION_SOURCES = ['manual', 'csv_import'];

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UTC_TIMESTAMP_REGEX = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,6})?(Z|\+00:00)$/;
const KEY_NAME_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;
const ALLOWED_POLICY_TAGS = [
  'STANDARD_COMPLIANCE_HOLD',
  'LEGAL_DISCOVERY_HOLD',
  'SUSPICIOUS_ACTIVITY_INVESTIGATION'
];

/**
 * Validates metadata structure against public.validate_transaction_metadata_structure()
 */
export function validateMetadataStructure(meta) {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return false;
  }

  // 16 KiB UTF-8 byte limit
  const serialized = JSON.stringify(meta);
  if (Buffer.byteLength(serialized, 'utf8') > 16384) {
    return false;
  }

  const entries = Object.entries(meta);
  if (entries.length > 30) {
    return false;
  }

  for (const [key, val] of entries) {
    if (!KEY_NAME_REGEX.test(key)) {
      return false;
    }

    if (['test_run_id', 'test_user_id'].includes(key)) {
      if (typeof val !== 'string' || !UUID_REGEX.test(val)) return false;
    } else if (['is_test_fixture', 'retention_hold'].includes(key)) {
      if (typeof val !== 'boolean') return false;
    } else if (key === 'policy_tag') {
      if (typeof val !== 'string' || !ALLOWED_POLICY_TAGS.includes(val)) return false;
    } else if (['deidentified_at', 'retention_expires_at'].includes(key)) {
      if (typeof val !== 'string' || !UTC_TIMESTAMP_REGEX.test(val)) return false;
    } else {
      // Custom user keys: Flat scalars only (objects and arrays forbidden)
      if (typeof val === 'object' && val !== null) {
        return false;
      }
      if (typeof val === 'string' && Buffer.byteLength(val, 'utf8') > 2048) {
        return false;
      }
    }
  }

  return true;
}

export const amountSchema = z.preprocess(
  (val) => {
    if (typeof val === 'string' && val.trim().length > 0) {
      const parsed = Number(val.trim());
      return isNaN(parsed) ? val : parsed;
    }
    return val;
  },
  z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a valid number'
    })
    .positive({ message: 'Amount must be strictly greater than zero' })
    .finite({ message: 'Amount must be a finite number' })
    .max(999999999999.99, { message: 'Amount exceeds maximum allowable numeric limit (14,2)' })
    .refine(
      (val) => {
        const parts = val.toString().split('.');
        return !parts[1] || parts[1].length <= 2;
      },
      { message: 'Amount cannot have more than 2 decimal places' }
    )
);

export const currencySchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toUpperCase() : val),
  z.enum(SUPPORTED_CURRENCIES, {
    errorMap: () => ({
      message: `Currency must be one of the supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`
    })
  })
);

export const transactionTypeSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.enum(TRANSACTION_TYPES, {
    errorMap: () => ({
      message: `Transaction type must be one of: ${TRANSACTION_TYPES.join(', ')}`
    })
  })
).default('debit');

export const merchantNameSchema = z
  .string({
    required_error: 'Merchant name is required',
    invalid_type_error: 'Merchant name must be a string'
  })
  .trim()
  .min(1, 'Merchant name cannot be empty')
  .max(200, 'Merchant name must not exceed 200 characters');

export const categorySchema = z
  .string({
    required_error: 'Category is required',
    invalid_type_error: 'Category must be a string'
  })
  .trim()
  .min(1, 'Category cannot be empty')
  .max(100, 'Category must not exceed 100 characters');

export const descriptionSchema = z
  .string({ invalid_type_error: 'Description must be a string' })
  .trim()
  .max(500, 'Description must not exceed 500 characters')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const paymentMethodLast4Schema = z
  .string({ invalid_type_error: 'Last 4 digits must be a string' })
  .trim()
  .regex(/^[0-9]{4}$/, 'Last 4 digits must be exactly 4 numeric characters (0000-9999)')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

export const transactionDateSchema = z.preprocess(
  (val) => {
    if (val instanceof Date) return val.toISOString();
    return val;
  },
  z
    .string({
      required_error: 'Transaction date is required',
      invalid_type_error: 'Transaction date must be an ISO 8601 date string or Date object'
    })
    .trim()
    .min(1, 'Transaction date cannot be empty')
    .refine(
      (val) => {
        const parsed = Date.parse(val);
        if (isNaN(parsed)) return false;
        const d = new Date(parsed);
        const year = d.getUTCFullYear();
        return year >= 2000 && year <= 2100;
      },
      { message: 'Transaction date must be a valid date between years 2000 and 2100' }
    )
    .transform((val) => new Date(val).toISOString())
);

export const sourceSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.enum(TRANSACTION_SOURCES, {
    errorMap: () => ({
      message: `Source must be one of: ${TRANSACTION_SOURCES.join(', ')}`
    })
  })
).default('manual');

export const isSyntheticSchema = z.boolean().default(false);

export const metadataSchema = z
  .record(z.any())
  .refine(validateMetadataStructure, {
    message: 'Metadata violates database constraints (max 30 keys, 16KB limit, flat scalars, valid system tags)'
  })
  .default({});

/**
 * Primary Manual Transaction Schema
 */
export const manualTransactionSchema = z.object({
  amount: amountSchema,
  currency: currencySchema,
  transaction_type: transactionTypeSchema,
  merchant_name: merchantNameSchema,
  category: categorySchema,
  description: descriptionSchema.default(null),
  payment_method_last4: paymentMethodLast4Schema.default(null),
  transaction_date: transactionDateSchema,
  source: sourceSchema,
  is_synthetic: isSyntheticSchema,
  metadata: metadataSchema
});

/**
 * CSV Transaction Row Schema
 */
export const csvTransactionRowSchema = manualTransactionSchema.extend({
  source: z.literal('csv_import').default('csv_import')
});

/**
 * Helper to validate a manual transaction payload.
 * Returns { success: true, data } or { success: false, errors: [{ field, message }] }
 */
export function validateManualTransaction(input) {
  const result = manualTransactionSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    return {
      success: false,
      data: null,
      errors: issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message
      }))
    };
  }
  return {
    success: true,
    data: result.data,
    errors: null
  };
}

/**
 * Helper to validate a CSV transaction row.
 */
export function validateCsvTransactionRow(input) {
  const payload = {
    ...input,
    source: input?.source || 'csv_import'
  };
  const result = csvTransactionRowSchema.safeParse(payload);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    return {
      success: false,
      data: null,
      errors: issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message
      }))
    };
  }
  return {
    success: true,
    data: result.data,
    errors: null
  };
}
