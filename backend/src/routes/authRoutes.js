import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { isSupabaseConfigured } from '../config/environment.js';

const router = Router();

// Public health check and configuration audit
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'FraudShield AI Backend Gateway',
    timestamp: new Date().toISOString(),
    authConfigured: isSupabaseConfigured(),
  });
});

// Protected: Get currently authenticated user and verified role
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});

export default router;

