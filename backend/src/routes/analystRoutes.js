/**
 * FraudShield AI — Financial Analyst Routes
 *
 * Exposes endpoints for:
 * - GET   /api/v1/analyst/cases      : Real investigation cases triage queue
 * - PATCH /api/v1/analyst/cases/:id  : Case status updates & review management
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleGuard.js';
import * as defaultAnalystService from '../services/analystService.js';

export function createAnalystRouter(
  analystService = defaultAnalystService,
  options = {}
) {
  const router = Router();
  const auth = options.authMiddleware || authMiddleware;

  // All analyst routes require valid JWT authentication and role analyst or admin
  router.use(auth);
  router.use(requireRole(['analyst', 'admin']));

  /**
   * GET /api/v1/analyst/cases
   * Retrieves investigation cases queue with linked transactions and fraud assessments.
   */
  router.get('/cases', async (req, res, next) => {
    try {
      const result = await analystService.getAnalystCases(req.user, req.query, options);
      return res.status(200).json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: err.code || 'AnalystError',
          message: err.message,
        });
      }
      next(err);
    }
  });

  /**
   * PATCH /api/v1/analyst/cases/:id
   * Updates an investigation case status (e.g. in_review, resolved, closed).
   */
  router.patch('/cases/:id', async (req, res, next) => {
    try {
      const result = await analystService.updateCaseStatus(
        req.params.id,
        req.user,
        req.body,
        options
      );
      return res.status(200).json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({
          error: err.code || 'UpdateError',
          message: err.message,
        });
      }
      next(err);
    }
  });

  return router;
}

export default createAnalystRouter();

