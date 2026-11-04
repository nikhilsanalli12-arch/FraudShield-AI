import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleGuard.js';

const router = Router();

// 1. Personal User Protected Route
// Accessible by: personal, analyst, admin
router.get(
  '/personal/overview',
  authMiddleware,
  requireRole(['personal', 'analyst', 'admin']),
  (req, res) => {
    res.json({
      success: true,
      scope: 'personal',
      message: 'Access granted to personal user resources.',
      user: req.user,
    });
  }
);

// 2. Financial Analyst Protected Route
// Accessible by: analyst, admin
router.get(
  '/analyst/queue',
  authMiddleware,
  requireRole(['analyst', 'admin']),
  (req, res) => {
    res.json({
      success: true,
      scope: 'analyst',
      message: 'Access granted to analyst fraud triage queue.',
      user: req.user,
    });
  }
);

// 3. Platform Administrator Protected Route
// Accessible strictly by: admin
router.get(
  '/admin/audit',
  authMiddleware,
  requireRole(['admin']),
  (req, res) => {
    res.json({
      success: true,
      scope: 'admin',
      message: 'Access granted to platform administrative audit logs.',
      user: req.user,
    });
  }
);

export default router;

