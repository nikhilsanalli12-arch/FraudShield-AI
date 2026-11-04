import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { config, isSupabaseConfigured } from './config/environment.js';
import authRoutes from './routes/authRoutes.js';
import protectedTestRoutes from './routes/protectedTestRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// 1. Security Headers via Helmet
app.use(helmet());

// 2. Strict CORS Restricted to Frontend Origin
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl, or automated test runners)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        config.frontendUrl,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Sanitized Structured Logging
// Explicitly never logs Authorization headers or sensitive tokens
app.use(
  morgan((tokens, req, res) => {
    return [
      tokens.date(req, res, 'iso'),
      tokens.method(req, res),
      tokens.url(req, res),
      tokens.status(req, res),
      tokens.res(req, res, 'content-length'), '-',
      tokens['response-time'](req, res), 'ms',
    ].join(' ');
  })
);

// 4. Request Body Parsing with strict limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// 5. Mount API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1', protectedTestRoutes);

// Root Health Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FraudShield AI Gateway',
    environment: config.nodeEnv,
    authConfigured: isSupabaseConfigured(),
  });
});

// 6. 404 Handler for Unmatched API Routes
app.use((req, res) => {
  res.status(404).json({
    error: 'NotFound',
    message: `Resource not found at ${req.method} ${req.originalUrl}`,
  });
});

// 7. Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: config.nodeEnv === 'production' ? 'An unexpected internal error occurred.' : err.message,
  });
});

// Boot Server if invoked directly as the entry point
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  app.listen(config.port, () => {
    console.log(`[FraudShield Gateway] Running on http://localhost:${config.port}`);
    console.log(`[FraudShield Gateway] Supabase Auth Configured: ${isSupabaseConfigured()}`);
  });
}

export default app;
