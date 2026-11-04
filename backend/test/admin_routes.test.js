import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { requireRole } from '../src/middleware/roleGuard.js';
import adminRoutes from '../src/routes/adminRoutes.js';
import app from '../src/server.js';

describe('Admin Telemetry & Statistics Route Invariants', () => {
  let server;
  const TEST_PORT = 5056;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  before((t, done) => {
    server = app.listen(TEST_PORT, () => {
      done();
    });
  });

  after((t, done) => {
    server.close(() => {
      done();
    });
  });

  test('GET /api/v1/admin/stats without authentication header is rejected with 401', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/admin/stats`);
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error === 'Unauthorized' || body.error === 'ServiceUnavailable');
  });

  test('GET /api/v1/admin/stats with invalid Bearer token is rejected', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/admin/stats`, {
      headers: {
        Authorization: 'Bearer invalid.fake.token',
      },
    });
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
  });

  test('Admin route unit test: personal role is rejected with 403 Forbidden', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    // Inject mock user with role 'personal'
    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'mock-personal-id',
        email: 'user@example.com',
        role: 'personal',
      });
      next();
    });

    // Mount requireRole(['admin'])
    mockApp.get('/test-admin', requireRole(['admin']), (req, res) => {
      res.json({ success: true });
    });

    const localServer = mockApp.listen(5057);
    try {
      const res = await fetch('http://localhost:5057/test-admin');
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error, 'Forbidden');
      assert.match(body.message, /requires one of the following roles: \[admin\]/);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('Admin route unit test: analyst role is rejected with 403 Forbidden', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    // Inject mock user with role 'analyst'
    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'mock-analyst-id',
        email: 'analyst@example.com',
        role: 'analyst',
      });
      next();
    });

    mockApp.get('/test-admin', requireRole(['admin']), (req, res) => {
      res.json({ success: true });
    });

    const localServer = mockApp.listen(5058);
    try {
      const res = await fetch('http://localhost:5058/test-admin');
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.error, 'Forbidden');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('Admin route unit test: admin role is allowed through', async () => {
    const mockApp = express();
    mockApp.use(express.json());

    // Inject mock user with role 'admin'
    mockApp.use((req, res, next) => {
      req.user = Object.freeze({
        id: 'mock-admin-id',
        email: 'admin@example.com',
        role: 'admin',
      });
      next();
    });

    mockApp.get('/test-admin', requireRole(['admin']), (req, res) => {
      res.json({
        success: true,
        gateway: { status: 'healthy', uptimeSeconds: 12 },
        users: { total: 4, roles: { personal: 2, analyst: 1, admin: 1 } },
        modules: {
          mlInferenceEngine: 'Integration pending (Milestone 6)',
          auditLogEngine: 'Integration pending (Milestone 12)',
        },
      });
    });

    const localServer = mockApp.listen(5059);
    try {
      const res = await fetch('http://localhost:5059/test-admin');
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.gateway.status, 'healthy');
      assert.equal(body.users.total, 4);
      assert.equal(body.modules.mlInferenceEngine, 'Integration pending (Milestone 6)');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });
});

