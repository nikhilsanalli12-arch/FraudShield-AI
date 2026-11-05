/**
 * FraudShield AI — Transaction Routes
 *
 * Exposes endpoints for:
 * - POST /api/v1/transactions/manual : Manual transaction submission with fraud assessment
 * - GET  /api/v1/transactions/history : Scoped transaction history with fraud assessments
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleGuard.js';
import * as defaultTransactionService from '../services/transactionService.js';
import * as defaultGeminiExplainer from '../services/geminiExplainer.js';
import {
  readRequestBuffer,
  extractCsvFromUpload,
  MAX_UPLOAD_SIZE_BYTES
} from '../utils/csvParser.js';

export function createTransactionRouter(
  transactionService = defaultTransactionService,
  options = {}
) {
  const router = Router();
  const auth = options.authMiddleware || authMiddleware;
  const explainer = options.geminiExplainer || defaultGeminiExplainer;

  // All transaction routes require valid JWT authentication
  router.use(auth);

  /**
   * POST /api/v1/transactions/manual
   * Manual transaction entry by personal users or administrators.
   */
  router.post(
    '/manual',
    requireRole(['personal', 'admin']),
    async (req, res, next) => {
      try {
        const userId = req.user.id; // Strictly from database-verified session
        const result = await transactionService.createManualTransaction(userId, req.body);
        return res.status(201).json(result);
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            error: err.code || 'TransactionError',
            message: err.message,
            errors: err.errors || undefined,
            duplicateTransactionId: err.duplicateTransactionId || undefined
          });
        }
        next(err);
      }
    }
  );

  /**
   * POST /api/v1/transactions/import
   * CSV transaction batch import for personal users or administrators.
   */
  router.post(
    '/import',
    requireRole(['personal', 'admin']),
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        // 1. Read request buffer (strictly up to 2MB cap)
        const buffer = await readRequestBuffer(req, MAX_UPLOAD_SIZE_BYTES);

        // 2. Extract and validate file type
        const { csvText, fileName } = extractCsvFromUpload(buffer, req.headers['content-type']);

        // 3. Process CSV batch import
        const result = await transactionService.importCsvTransactions(userId, csvText, { fileName });
        return res.status(200).json(result);
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            error: err.code || 'ImportError',
            message: err.message,
            missingHeaders: err.missingHeaders || undefined
          });
        }
        next(err);
      }
    }
  );

  /**
   * GET /api/v1/transactions/history
   * Scoped transaction history for authenticated user.
   */
  router.get(
    '/history',
    requireRole(['personal', 'analyst', 'admin']),
    async (req, res, next) => {
      try {
        const userId = req.user.id;
        const result = await transactionService.getTransactionHistory(userId, req.query);
        return res.status(200).json(result);
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            error: err.code || 'QueryError',
            message: err.message
          });
        }
        next(err);
      }
    }
  );

  /**
   * POST /api/v1/transactions/ai-explain
   * Generates AI fraud explanation and safety recommendations for a given transaction and assessment payload.
   */
  router.post(
    '/ai-explain',
    requireRole(['personal', 'analyst', 'admin']),
    async (req, res, next) => {
      try {
        const { transaction, assessment } = req.body || {};
        const result = await explainer.explainTransaction(
          transaction,
          assessment,
          { callerId: req.user.id, ...options }
        );
        return res.status(200).json(result);
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            error: err.code || 'ExplanationError',
            message: err.message,
          });
        }
        next(err);
      }
    }
  );

  /**
   * POST /api/v1/transactions/:id/ai-explain
   * Retrieves a saved transaction by ID and generates AI fraud explanation and protection recommendations.
   */
  router.post(
    '/:id/ai-explain',
    requireRole(['personal', 'analyst', 'admin']),
    async (req, res, next) => {
      try {
        const transactionId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        let tx = null;
        if (typeof transactionService.getTransactionById === 'function') {
          tx = await transactionService.getTransactionById(transactionId, userId, userRole, options);
        }

        if (!tx) {
          return res.status(404).json({
            error: 'NotFound',
            message: 'Transaction not found or access denied',
          });
        }

        const assessment = tx.fraud_assessment || {};
        const result = await explainer.explainTransaction(
          tx,
          assessment,
          { callerId: req.user.id, ...options }
        );
        return res.status(200).json(result);
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            error: err.code || 'ExplanationError',
            message: err.message,
          });
        }
        next(err);
      }
    }
  );

  return router;
}

export default createTransactionRouter();

