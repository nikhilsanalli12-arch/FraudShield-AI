import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/server.js';

describe('Express Server HTTP Integration Test', () => {
  let server;
  const TEST_PORT = 5055;
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

  test('GET /health returns 200 with service information', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'FraudShield AI Gateway');
    assert.equal(typeof body.authConfigured, 'boolean');
  });

  test('GET /api/v1/auth/health returns 200 with auth status', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'healthy');
  });

  test('GET /api/v1/personal/overview without token is rejected', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/personal/overview`);
    assert.ok([401, 503].includes(res.status), `Expected 401 or 503, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error === 'Unauthorized' || body.error === 'ServiceUnavailable');
  });

  test('GET /unknown-route returns 404 NotFound', async () => {
    const res = await fetch(`${BASE_URL}/api/v1/non-existent-endpoint`);
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error, 'NotFound');
  });
});
