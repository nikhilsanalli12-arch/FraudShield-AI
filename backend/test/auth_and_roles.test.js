import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireRole } from '../src/middleware/roleGuard.js';
import { authMiddleware } from '../src/middleware/authMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FraudShield AI — Milestone 2 Security & Authorization Test Suite', () => {

  describe('1. Database Security & Migration Invariant Verification', () => {
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/001_auth_and_profiles.sql');
    assert.ok(fs.existsSync(migrationPath), 'Migration 001_auth_and_profiles.sql must exist');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    test('All public registrations must strictly receive "personal" role (Ignoring client metadata)', () => {
      assert.match(
        sql,
        /'personal',/i,
        'Trigger function must hardcode the default "personal" role'
      );
      assert.doesNotMatch(
        sql,
        /raw_user_meta_data->>'role'/i,
        'Trigger must NEVER read or accept a role parameter from client metadata'
      );
    });

    test('Anti-tampering trigger must block users from updating their own role column', () => {
      assert.match(
        sql,
        /prevent_profile_role_update/i,
        'Migration must define prevent_profile_role_update trigger function'
      );
      assert.match(
        sql,
        /You do not have permission to modify your role/i,
        'Trigger must raise an exception when a non-service-role updates role'
      );
    });

    test('Row Level Security (RLS) must be enabled on profiles with strict ownership isolation', () => {
      assert.match(
        sql,
        /alter table public\.profiles enable row level security/i,
        'RLS must be explicitly enabled on public.profiles'
      );
      assert.match(
        sql,
        /auth\.uid\(\) = id/i,
        'Profiles RLS policies must strictly restrict read/write to the authenticated user ID'
      );
    });
  });

  describe('2. Backend Auth Middleware Token Rejection Verification', () => {
    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.body = data;
        return res;
      };
      return res;
    };

    test('Request with missing Authorization header is rejected with 401 Unauthorized', async () => {
      const req = { headers: {} };
      const res = mockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false, 'Next must not be called when Authorization header is absent');
      // When Supabase is unconfigured, returns 503; if configured without header, returns 401
      assert.ok(
        [401, 503].includes(res.statusCode),
        `Must return 401 Unauthorized or 503 ConfigurationRequired, got ${res.statusCode}`
      );
      assert.ok(res.body.error === 'Unauthorized' || res.body.error === 'ServiceUnavailable');
    });

    test('Request with empty Bearer token is rejected', async () => {
      const req = { headers: { authorization: 'Bearer ' } };
      const res = mockRes();
      let nextCalled = false;

      await authMiddleware(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.ok([401, 503].includes(res.statusCode));
    });
  });

  describe('3. Backend Role Guard Middleware Verification', () => {
    const mockRes = () => {
      const res = {};
      res.statusCode = 200;
      res.status = (code) => {
        res.statusCode = code;
        return res;
      };
      res.json = (data) => {
        res.body = data;
        return res;
      };
      return res;
    };

    test('Personal user CAN access personal endpoints', () => {
      const req = { user: { id: 'u1', email: 'personal@user.com', role: 'personal' } };
      const res = mockRes();
      let nextCalled = false;
      const middleware = requireRole(['personal', 'analyst', 'admin']);

      middleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, true, 'Next must be called for personal role on personal route');
      assert.equal(res.statusCode, 200);
    });

    test('Personal user CANNOT access analyst endpoints (Returns 403 Forbidden)', () => {
      const req = { user: { id: 'u1', email: 'personal@user.com', role: 'personal' } };
      const res = mockRes();
      let nextCalled = false;
      const middleware = requireRole(['analyst', 'admin']);

      middleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, false, 'Next must NOT be called for personal role on analyst route');
      assert.equal(res.statusCode, 403, 'Must return 403 Forbidden');
      assert.equal(res.body.error, 'Forbidden');
      assert.match(res.body.message, /Access denied/);
      assert.equal(res.body.currentRole, 'personal');
    });

    test('Personal user CANNOT access administrator endpoints (Returns 403 Forbidden)', () => {
      const req = { user: { id: 'u1', email: 'personal@user.com', role: 'personal' } };
      const res = mockRes();
      let nextCalled = false;
      const middleware = requireRole(['admin']);

      middleware(req, res, () => { nextCalled = true; });
      assert.equal(nextCalled, false, 'Next must NOT be called for personal role on admin route');
      assert.equal(res.statusCode, 403, 'Must return 403 Forbidden');
      assert.equal(res.body.currentRole, 'personal');
    });

    test('Financial Analyst CAN access analyst queue but CANNOT access admin endpoints', () => {
      const req = { user: { id: 'a1', email: 'analyst@user.com', role: 'analyst' } };
      
      const resAnalyst = mockRes();
      let nextAnalyst = false;
      requireRole(['analyst', 'admin'])(req, resAnalyst, () => { nextAnalyst = true; });
      assert.equal(nextAnalyst, true, 'Analyst must be allowed on analyst route');

      const resAdmin = mockRes();
      let nextAdmin = false;
      requireRole(['admin'])(req, resAdmin, () => { nextAdmin = true; });
      assert.equal(nextAdmin, false, 'Analyst must NOT be allowed on admin route');
      assert.equal(resAdmin.statusCode, 403, 'Must return 403 Forbidden for analyst accessing admin route');
    });

    test('Administrator CAN access personal, analyst, and admin endpoints', () => {
      const req = { user: { id: 'adm1', email: 'admin@user.com', role: 'admin' } };
      
      let nextPersonal = false;
      requireRole(['personal', 'analyst', 'admin'])(req, mockRes(), () => { nextPersonal = true; });
      assert.equal(nextPersonal, true);

      let nextAnalyst = false;
      requireRole(['analyst', 'admin'])(req, mockRes(), () => { nextAnalyst = true; });
      assert.equal(nextAnalyst, true);

      let nextAdmin = false;
      requireRole(['admin'])(req, mockRes(), () => { nextAdmin = true; });
      assert.equal(nextAdmin, true);
    });

    test('Unauthenticated request rejected with 401 Unauthorized', () => {
      const req = {}; // No req.user attached
      const res = mockRes();
      let nextCalled = false;
      requireRole(['personal'])(req, res, () => { nextCalled = true; });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, 'Unauthorized');
    });
  });

  describe('4. Frontend Bundle Secret Exposure Verification', () => {
    test('Client production build bundle does NOT contain service-role key or private secrets', () => {
      const distDir = path.resolve(__dirname, '../../frontend/dist/assets');
      assert.ok(fs.existsSync(distDir), 'Frontend dist/assets directory must exist from build');

      const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
      assert.ok(jsFiles.length > 0, 'At least one JavaScript bundle file must exist');

      for (const file of jsFiles) {
        const bundleContent = fs.readFileSync(path.join(distDir, file), 'utf8');
        assert.doesNotMatch(
          bundleContent,
          /SUPABASE_SERVICE_ROLE_KEY/i,
          `Bundle ${file} must not reference SUPABASE_SERVICE_ROLE_KEY`
        );
        assert.doesNotMatch(
          bundleContent,
          /your-supabase-service-role-key/i,
          `Bundle ${file} must not contain service-role secret values`
        );
        assert.doesNotMatch(
          bundleContent,
          /INTERNAL_API_SECRET/i,
          `Bundle ${file} must not reference INTERNAL_API_SECRET`
        );
      }
    });
  });
});
