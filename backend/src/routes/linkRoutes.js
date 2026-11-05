/**
 * FraudShield AI — Suspicious Link Scanner Routes
 *
 * Exposes endpoints for:
 * - POST /api/v1/links/scan : Static defensive link analysis and plain-English AI explanations.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleGuard.js';
import * as defaultLinkScanner from '../services/linkScanner.js';

export function createLinkRouter(
  linkScanner = defaultLinkScanner,
  options = {}
) {
  const router = Router();
  const auth = options.authMiddleware || authMiddleware;
  const scanner = options.linkScanner || linkScanner;

  // All link scanning routes require valid JWT authentication
  router.use(auth);

  /**
   * POST /api/v1/links/scan
   * Analyzes a submitted URL using defensive static heuristics and Gemini AI explanation.
   */
  router.post(
    '/scan',
    requireRole(['personal', 'analyst', 'admin']),
    async (req, res, next) => {
      try {
        const { url } = req.body || {};

        if (!url || typeof url !== 'string' || !url.trim()) {
          return res.status(400).json({
            error: 'ValidationError',
            message: 'A valid "url" string is required in the request body.',
          });
        }

        const callerId = req.user?.id || 'anonymous_user';
        const result = await scanner.scanLink(url, {
          callerId,
          ...options,
        });

        return res.status(200).json(result);
      } catch (err) {
        if (err.statusCode) {
          return res.status(err.statusCode).json({
            error: err.code || 'ScanError',
            message: err.message,
          });
        }
        next(err);
      }
    }
  );

  return router;
}

export default createLinkRouter();

