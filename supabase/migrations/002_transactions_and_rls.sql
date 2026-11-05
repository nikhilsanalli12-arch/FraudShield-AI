-- ==============================================================================
-- FraudShield AI — Migration 002: Transactions, Fraud Assessments,
-- Cases, RLS, Compliance Audit & Retention Architecture
-- ==============================================================================
-- Baseline: Commit cf35f77 (Milestones 1–3 preserved)
-- Version: Milestone 4 Stage 1 Implementation
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Required Extensions
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. Reference Tables: Retention Policies & Supported Currencies
-- ------------------------------------------------------------------------------

-- 2.1 Retention Policies
CREATE TABLE IF NOT EXISTS public.retention_policies (
  code text PRIMARY KEY,
  description text NOT NULL,
  retention_period_days integer NOT NULL CHECK (retention_period_days > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed Approved Retention Policies
INSERT INTO public.retention_policies (code, description, retention_period_days)
VALUES
  ('STANDARD_COMPLIANCE_HOLD', 'Standard financial regulatory retention hold (5 years)', 1825),
  ('LEGAL_DISCOVERY_HOLD', 'Active legal or litigation hold', 2555),
  ('SUSPICIOUS_ACTIVITY_INVESTIGATION', 'SAR / AML investigation compliance hold', 1825)
ON CONFLICT (code) DO UPDATE
SET description = EXCLUDED.description,
    retention_period_days = EXCLUDED.retention_period_days;

-- 2.2 Supported Currencies
CREATE TABLE IF NOT EXISTS public.supported_currencies (
  code varchar(3) PRIMARY KEY,
  name text NOT NULL,
  symbol varchar(5) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed Approved ISO 4217 Currencies (including INR)
INSERT INTO public.supported_currencies (code, name, symbol, is_active)
VALUES
  ('USD', 'United States Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('GBP', 'British Pound', '£', true),
  ('CAD', 'Canadian Dollar', 'CA$', true),
  ('AUD', 'Australian Dollar', 'A$', true),
  ('INR', 'Indian Rupee', '₹', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    symbol = EXCLUDED.symbol,
    is_active = EXCLUDED.is_active;

-- ------------------------------------------------------------------------------
-- 3. Profiles Table Extension (Lifecycle, Status & Metadata)
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'deactivated', 'suspended', 'pending_deletion')),
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON public.profiles(account_status);

-- ------------------------------------------------------------------------------
-- 4. Metadata Validation & Formatting Functions
-- ------------------------------------------------------------------------------

-- 4.1 Strict UTC Timestamp Validator
CREATE OR REPLACE FUNCTION public.is_valid_utc_timestamp(val text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_utc_regex text := '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])(\.[0-9]{1,6})?(Z|\+00:00)$';
  v_dummy timestamptz;
BEGIN
  IF val IS NULL OR NOT (val ~ v_utc_regex) THEN
    RETURN false;
  END IF;

  -- Validate actual calendar validity (rejects Feb 31, leap-year overflows, etc.)
  BEGIN
    v_dummy := val::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN true;
END;
$$;

-- 4.2 Comprehensive Metadata Structure Validator (16 KiB Hard Storage Cap)
CREATE OR REPLACE FUNCTION public.validate_transaction_metadata_structure(meta jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_key text;
  v_val jsonb;
  v_type text;
  v_key_count integer := 0;
  v_uuid_regex text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  -- 1. Reject non-objects and SQL NULLs
  IF meta IS NULL OR jsonb_typeof(meta) <> 'object' THEN
    RETURN false;
  END IF;

  -- 2. Authoritative database storage limit: 16 KiB (16,384 UTF-8 bytes)
  IF octet_length(meta::text) > 16384 THEN
    RETURN false;
  END IF;

  -- 3. Iterate through top-level keys
  FOR v_key, v_val IN SELECT * FROM jsonb_each(meta)
  LOOP
    v_key_count := v_key_count + 1;
    v_type := jsonb_typeof(v_val);

    -- Key name syntax: 1-64 alphanumeric, underscore, hyphen, or dot
    IF NOT (v_key ~ '^[a-zA-Z0-9_.-]{1,64}$') THEN
      RETURN false;
    END IF;

    -- Reserved System Fields: JSON null is strictly prohibited
    IF v_key IN ('test_run_id', 'test_user_id', 'is_test_fixture', 'retention_hold', 
                 'policy_tag', 'deidentified_at', 'retention_expires_at') THEN
      IF v_type = 'null' THEN
        RETURN false;
      END IF;

      IF v_key = 'test_run_id' OR v_key = 'test_user_id' THEN
        IF v_type <> 'string' OR NOT (v_val #>> '{}' ~ v_uuid_regex) THEN
          RETURN false;
        END IF;
      ELSIF v_key = 'is_test_fixture' OR v_key = 'retention_hold' THEN
        IF v_type <> 'boolean' THEN
          RETURN false;
        END IF;
      ELSIF v_key = 'policy_tag' THEN
        IF v_type <> 'string' OR NOT (v_val #>> '{}' IN (
          'STANDARD_COMPLIANCE_HOLD', 'LEGAL_DISCOVERY_HOLD', 'SUSPICIOUS_ACTIVITY_INVESTIGATION'
        )) THEN
          RETURN false;
        END IF;
      ELSIF v_key = 'deidentified_at' OR v_key = 'retention_expires_at' THEN
        IF v_type <> 'string' OR NOT public.is_valid_utc_timestamp(v_val #>> '{}') THEN
          RETURN false;
        END IF;
      END IF;
    ELSE
      -- Custom user keys: Flat scalars only (nested objects/arrays disallowed)
      IF v_type IN ('object', 'array') THEN
        RETURN false;
      END IF;
      IF v_type = 'string' AND octet_length(v_val #>> '{}') > 2048 THEN
        RETURN false;
      END IF;
    END IF;
  END LOOP;

  -- Maximum 30 keys limit
  IF v_key_count > 30 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- 4.3 Attach Metadata Constraint to Profiles Table
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_profiles_metadata,
  ADD CONSTRAINT chk_profiles_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

-- ------------------------------------------------------------------------------
-- 5. Primary Entity Tables
-- ------------------------------------------------------------------------------

-- 5.1 Import Batches Table
CREATE TABLE IF NOT EXISTS public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name text NOT NULL CHECK (length(trim(file_name)) > 0 AND length(file_name) <= 255),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'archived')),
  total_records integer NOT NULL DEFAULT 0 CHECK (total_records >= 0),
  processed_records integer NOT NULL DEFAULT 0 CHECK (processed_records >= 0),
  failed_records integer NOT NULL DEFAULT 0 CHECK (failed_records >= 0),
  error_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 5.2 Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  currency varchar(3) NOT NULL REFERENCES public.supported_currencies(code),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('debit', 'credit', 'transfer')),
  merchant_name text NOT NULL CHECK (length(trim(merchant_name)) > 0 AND length(merchant_name) <= 200),
  category text NOT NULL CHECK (length(trim(category)) > 0 AND length(category) <= 100),
  description text CHECK (description IS NULL OR length(description) <= 500),
  payment_method_last4 varchar(4) CHECK (payment_method_last4 IS NULL OR payment_method_last4 ~ '^[0-9]{4}$'),
  transaction_date timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv_import')),
  import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE RESTRICT,
  is_synthetic boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite unique constraint required for composite foreign key cascade
  CONSTRAINT uq_transactions_id_user_id UNIQUE (id, user_id)
);

-- 5.3 Fraud Assessments Table
CREATE TABLE IF NOT EXISTS public.fraud_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE,
  user_id uuid,
  risk_score numeric(5, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level text NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  heuristic_reasons text[] NOT NULL DEFAULT '{}',
  model_version text NOT NULL DEFAULT 'rule-engine-v1',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  assessed_at timestamptz NOT NULL DEFAULT now(),

  -- Cascades user_id update to NULL in tandem with transactions during account de-identification
  CONSTRAINT fk_fraud_assessment_transaction FOREIGN KEY (transaction_id, user_id)
    REFERENCES public.transactions(id, user_id) ON UPDATE CASCADE ON DELETE CASCADE
);

-- 5.4 Investigation Cases Table
CREATE TABLE IF NOT EXISTS public.investigation_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_analyst_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  resolving_analyst_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'escalated', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- 5.5 Case Assignment History Table
CREATE TABLE IF NOT EXISTS public.case_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE RESTRICT,
  previous_analyst_id uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  new_analyst_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reassigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reassignment_reason text NOT NULL CHECK (length(trim(reassignment_reason)) >= 5 AND length(reassignment_reason) <= 1000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  reassigned_at timestamptz NOT NULL DEFAULT now()
);

-- 5.6 Investigation Notes Table
CREATE TABLE IF NOT EXISTS public.investigation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.investigation_cases(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note_text text NOT NULL CHECK (length(trim(note_text)) > 0 AND length(note_text) <= 5000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5.7 Compliance Redaction Audit Table
CREATE TABLE IF NOT EXISTS public.compliance_redaction_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  case_id uuid NOT NULL,
  transaction_id uuid NOT NULL,
  redacted_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  operator_type text NOT NULL CHECK (operator_type IN ('admin', 'system')),
  redaction_reason text NOT NULL CHECK (length(trim(redaction_reason)) >= 5 AND length(redaction_reason) <= 1000),
  original_hash text NOT NULL CHECK (length(original_hash) = 64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  redacted_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ck_redaction_operator CHECK (
    (operator_type = 'admin' AND redacted_by IS NOT NULL) OR
    (operator_type = 'system' AND redacted_by IS NULL)
  )
);

-- ------------------------------------------------------------------------------
-- 6. Attach All 8 Metadata Check Constraints
-- ------------------------------------------------------------------------------

ALTER TABLE public.import_batches
  DROP CONSTRAINT IF EXISTS chk_import_batches_metadata,
  ADD CONSTRAINT chk_import_batches_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS chk_transactions_metadata,
  ADD CONSTRAINT chk_transactions_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

ALTER TABLE public.fraud_assessments
  DROP CONSTRAINT IF EXISTS chk_fraud_assessments_metadata,
  ADD CONSTRAINT chk_fraud_assessments_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

ALTER TABLE public.investigation_cases
  DROP CONSTRAINT IF EXISTS chk_investigation_cases_metadata,
  ADD CONSTRAINT chk_investigation_cases_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

ALTER TABLE public.case_assignment_history
  DROP CONSTRAINT IF EXISTS chk_case_assignment_history_metadata,
  ADD CONSTRAINT chk_case_assignment_history_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

ALTER TABLE public.investigation_notes
  DROP CONSTRAINT IF EXISTS chk_investigation_notes_metadata,
  ADD CONSTRAINT chk_investigation_notes_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

ALTER TABLE public.compliance_redaction_audit
  DROP CONSTRAINT IF EXISTS chk_compliance_redaction_audit_metadata,
  ADD CONSTRAINT chk_compliance_redaction_audit_metadata
    CHECK (validate_transaction_metadata_structure(metadata));

-- ------------------------------------------------------------------------------
-- 7. High-Performance Indexes
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_import_batches_user ON public.import_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batches_status ON public.import_batches(status);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON public.transactions(currency);
CREATE INDEX IF NOT EXISTS idx_transactions_batch ON public.transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_fraud_assessments_tx ON public.fraud_assessments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fraud_assessments_user ON public.fraud_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_assessments_risk ON public.fraud_assessments(risk_level);

CREATE INDEX IF NOT EXISTS idx_cases_tx ON public.investigation_cases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cases_user ON public.investigation_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_assigned ON public.investigation_cases(assigned_analyst_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.investigation_cases(status);

CREATE INDEX IF NOT EXISTS idx_case_history_case ON public.case_assignment_history(case_id, reassigned_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_case ON public.investigation_notes(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_author ON public.investigation_notes(author_id);

CREATE INDEX IF NOT EXISTS idx_redaction_case ON public.compliance_redaction_audit(case_id);
CREATE INDEX IF NOT EXISTS idx_redaction_note ON public.compliance_redaction_audit(note_id);

-- ------------------------------------------------------------------------------
-- 8. Authorization & Immutability Triggers
-- ------------------------------------------------------------------------------

-- 8.1 Reserved Metadata Key Authorization Trigger
CREATE OR REPLACE FUNCTION public.enforce_reserved_metadata_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller_role text;
  v_is_service_or_admin boolean := false;
  v_reserved_keys text[] := ARRAY[
    'test_run_id', 'test_user_id', 'is_test_fixture',
    'retention_hold', 'policy_tag', 'deidentified_at', 'retention_expires_at'
  ];
  v_key text;
BEGIN
  v_caller_role := current_setting('request.jwt.claim.role', true);
  IF v_caller_role = 'service_role' THEN
    v_is_service_or_admin := true;
  ELSIF auth.uid() IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true 
        AND account_status = 'active'
    ) THEN
      v_is_service_or_admin := true;
    END IF;
  END IF;

  IF NOT v_is_service_or_admin THEN
    FOREACH v_key IN ARRAY v_reserved_keys
    LOOP
      IF TG_OP = 'INSERT' THEN
        IF NEW.metadata ? v_key THEN
          RAISE EXCEPTION 'Unauthorized: only service_role or platform administrators can set metadata field "%"', v_key
            USING ERRCODE = '42501';
        END IF;
      ELSIF TG_OP = 'UPDATE' THEN
        IF (NEW.metadata ? v_key) IS DISTINCT FROM (OLD.metadata ? v_key) OR
           (NEW.metadata->v_key) IS DISTINCT FROM (OLD.metadata->v_key) THEN
          RAISE EXCEPTION 'Unauthorized: only service_role or platform administrators can modify metadata field "%"', v_key
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach Reserved Metadata Authorization to all 8 tables
DROP TRIGGER IF EXISTS trg_auth_meta_profiles ON public.profiles;
CREATE TRIGGER trg_auth_meta_profiles BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_batches ON public.import_batches;
CREATE TRIGGER trg_auth_meta_batches BEFORE INSERT OR UPDATE ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_transactions ON public.transactions;
CREATE TRIGGER trg_auth_meta_transactions BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_assessments ON public.fraud_assessments;
CREATE TRIGGER trg_auth_meta_assessments BEFORE INSERT OR UPDATE ON public.fraud_assessments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_cases ON public.investigation_cases;
CREATE TRIGGER trg_auth_meta_cases BEFORE INSERT OR UPDATE ON public.investigation_cases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_history ON public.case_assignment_history;
CREATE TRIGGER trg_auth_meta_history BEFORE INSERT OR UPDATE ON public.case_assignment_history
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_notes ON public.investigation_notes;
CREATE TRIGGER trg_auth_meta_notes BEFORE INSERT OR UPDATE ON public.investigation_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

DROP TRIGGER IF EXISTS trg_auth_meta_audit ON public.compliance_redaction_audit;
CREATE TRIGGER trg_auth_meta_audit BEFORE INSERT OR UPDATE ON public.compliance_redaction_audit
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reserved_metadata_authorization();

-- 8.2 Transaction Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_transaction_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_deletion_context boolean := false;
BEGIN
  -- Financial immutability: Core transaction fields can never be altered
  IF (NEW.id IS DISTINCT FROM OLD.id) OR
     (NEW.amount IS DISTINCT FROM OLD.amount) OR
     (NEW.currency IS DISTINCT FROM OLD.currency) OR
     (NEW.transaction_type IS DISTINCT FROM OLD.transaction_type) OR
     (NEW.merchant_name IS DISTINCT FROM OLD.merchant_name) OR
     (NEW.category IS DISTINCT FROM OLD.category) OR
     (NEW.payment_method_last4 IS DISTINCT FROM OLD.payment_method_last4) OR
     (NEW.transaction_date IS DISTINCT FROM OLD.transaction_date) OR
     (NEW.source IS DISTINCT FROM OLD.source) OR
     (NEW.import_batch_id IS DISTINCT FROM OLD.import_batch_id) OR
     (NEW.is_synthetic IS DISTINCT FROM OLD.is_synthetic) OR
     (NEW.created_at IS DISTINCT FROM OLD.created_at) THEN
    RAISE EXCEPTION 'Financial Integrity Violation: Transaction financial fields are strictly immutable.'
      USING ERRCODE = '42501';
  END IF;

  -- User ID dissociation is permitted strictly during account retention de-identification
  IF (NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    v_is_deletion_context := current_setting('app.in_account_deletion', true) = 'true';
    IF NOT v_is_deletion_context OR NEW.user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Integrity Violation: user_id cannot be modified outside authorized retention de-identification.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_transaction_immutability ON public.transactions;
CREATE TRIGGER trg_enforce_transaction_immutability
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_transaction_immutability();

-- 8.3 Case Update & State Machine Trigger
CREATE OR REPLACE FUNCTION public.enforce_case_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_reassignment boolean := false;
  v_in_deletion boolean := false;
  v_caller_role text;
  v_is_active_admin boolean := false;
  v_audit_id_str text;
BEGIN
  -- 1. MANDATORY IMMUTABLE CHECK: Active across ALL paths without exception
  IF (NEW.id IS DISTINCT FROM OLD.id) OR
     (NEW.transaction_id IS DISTINCT FROM OLD.transaction_id) OR
     (NEW.opened_at IS DISTINCT FROM OLD.opened_at) THEN
    RAISE EXCEPTION 'Case Integrity Violation: Fundamental case identifiers (id, transaction_id, opened_at) are strictly immutable.'
      USING ERRCODE = '42501';
  END IF;

  v_caller_role := current_setting('request.jwt.claim.role', true);
  v_is_reassignment := current_setting('app.in_case_reassignment', true) = 'true';
  v_in_deletion := current_setting('app.in_account_deletion', true) = 'true';

  -- Verify if caller is an active platform administrator
  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true 
        AND account_status = 'active'
    ) INTO v_is_active_admin;
  END IF;

  -- 2. SECURE ACCOUNT DELETION ROUTE
  IF v_in_deletion THEN
    -- A. Authorization Check: strictly service_role or active platform administrator
    IF v_caller_role IS DISTINCT FROM 'service_role' AND NOT v_is_active_admin THEN
      RAISE EXCEPTION 'Security Violation: Account deletion bypass requires service_role or active platform administrator'
        USING ERRCODE = '42501';
    END IF;

    -- B. Strict Immutability of Non-Permitted Fields (all 7 other columns must not change)
    IF (NEW.resolving_analyst_id IS DISTINCT FROM OLD.resolving_analyst_id) OR
       (NEW.priority IS DISTINCT FROM OLD.priority) OR
       (NEW.resolved_at IS DISTINCT FROM OLD.resolved_at) OR
       (NEW.metadata IS DISTINCT FROM OLD.metadata) THEN
      RAISE EXCEPTION 'Security Violation: Account deletion cannot mutate resolving_analyst_id, priority, resolved_at, or metadata'
        USING ERRCODE = '42501';
    END IF;

    -- C. Customer user_id de-identification validation:
    IF NEW.user_id IS NOT NULL AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Security Violation: Account deletion can only decouple user_id to NULL'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id IS NULL AND OLD.user_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = OLD.user_id AND is_active = false AND account_status IN ('pending_deletion', 'deactivated')
      ) THEN
        RAISE EXCEPTION 'Security Violation: Customer user_id can only be decoupled if profile is deactivated or pending deletion'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- D. Analyst assigned_analyst_id de-allocation validation:
    IF NEW.assigned_analyst_id IS NOT NULL AND NEW.assigned_analyst_id IS DISTINCT FROM OLD.assigned_analyst_id THEN
      RAISE EXCEPTION 'Security Violation: Account deletion can only decouple assigned_analyst_id to NULL'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.assigned_analyst_id IS NULL AND OLD.assigned_analyst_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = OLD.assigned_analyst_id AND is_active = false AND account_status IN ('pending_deletion', 'deactivated')
      ) THEN
        RAISE EXCEPTION 'Security Violation: assigned_analyst_id can only be decoupled if analyst profile is deactivated or pending deletion'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- E. Case Status Reset Rules:
    -- Status reset ((in_review, escalated) -> open) is STRICTLY PROHIBITED unless directly tied
    -- to the de-allocation of a deactivated analyst on this specific case!
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (
        OLD.status IN ('in_review', 'escalated') AND
        NEW.status = 'open' AND
        OLD.assigned_analyst_id IS NOT NULL AND
        NEW.assigned_analyst_id IS NULL AND
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE id = OLD.assigned_analyst_id AND is_active = false AND account_status IN ('pending_deletion', 'deactivated')
        )
      ) THEN
        RAISE EXCEPTION 'Security Violation: Case status reset to open is strictly restricted to analyst de-allocation on this specific case'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- updated_at is strictly system-controlled
    NEW.updated_at = now();
    RETURN NEW;
  END IF;

  -- 3. SECURE ADMIN REASSIGNMENT ROUTE
  IF v_is_reassignment THEN
    -- A. Authorization Check: caller must be active administrator
    IF NOT v_is_active_admin THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment requires active platform administrator'
        USING ERRCODE = '42501';
    END IF;

    -- B. Verify assignment actually changes to a non-null analyst
    IF NEW.assigned_analyst_id IS NOT DISTINCT FROM OLD.assigned_analyst_id THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment requires assigned analyst to change'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.assigned_analyst_id IS NULL THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment cannot unassign analyst to NULL'
        USING ERRCODE = '42501';
    END IF;

    -- C. Verify new analyst is active and eligible
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = NEW.assigned_analyst_id 
        AND role = 'analyst' 
        AND is_active = true 
        AND account_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Security Violation: Target analyst is not an active eligible analyst'
        USING ERRCODE = '42501';
    END IF;

    -- D. Single-Use Transactional Audit Handshake Verification
    v_audit_id_str := current_setting('app.reassignment_audit_id', true);
    IF v_audit_id_str IS NULL OR v_audit_id_str = '' THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment requires an active single-use audit handshake ticket'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.case_assignment_history
      WHERE id = v_audit_id_str::uuid
        AND case_id = NEW.id
        AND previous_analyst_id IS NOT DISTINCT FROM OLD.assigned_analyst_id
        AND new_analyst_id = NEW.assigned_analyst_id
        AND reassigned_by = auth.uid()
        AND reassigned_at >= transaction_timestamp()
    ) THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment audit handshake verification failed'
        USING ERRCODE = '42501';
    END IF;

    -- E. Single-Use Consumption: Invalidate ticket immediately to enforce 1-ticket -> 1-update guarantee
    PERFORM set_config('app.reassignment_audit_id', '', true);
    PERFORM set_config('app.in_case_reassignment', '', true);

    -- F. Strict Immutability of Non-Permitted Fields: user_id, priority, resolving_analyst_id, resolved_at, metadata
    IF (NEW.user_id IS DISTINCT FROM OLD.user_id) OR
       (NEW.resolving_analyst_id IS DISTINCT FROM OLD.resolving_analyst_id) OR
       (NEW.priority IS DISTINCT FROM OLD.priority) OR
       (NEW.resolved_at IS DISTINCT FROM OLD.resolved_at) OR
       (NEW.metadata IS DISTINCT FROM OLD.metadata) THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment cannot mutate user_id, priority, resolving_analyst_id, resolved_at, or metadata'
        USING ERRCODE = '42501';
    END IF;

    -- G. Status Rules for Reassignment:
    IF OLD.status IN ('resolved', 'closed') THEN
      RAISE EXCEPTION 'Invalid State: Cannot reassign a resolved or closed case'
        USING ERRCODE = '22023';
    END IF;

    IF OLD.status = 'open' AND NEW.status IS DISTINCT FROM 'in_review' THEN
      RAISE EXCEPTION 'Invalid State Transition: Reassigning an open case must transition status to in_review'
        USING ERRCODE = '22023';
    ELSIF OLD.status <> 'open' AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Security Violation: Case reassignment cannot mutate status on cases already in_review or escalated'
        USING ERRCODE = '42501';
    END IF;

    -- updated_at is strictly system-controlled
    NEW.updated_at = now();
    RETURN NEW;
  END IF;

  -- 4. STANDARD STATE TRANSITION VALIDATION

  -- A. Customer user_id is strictly immutable in standard operations
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Case Integrity Violation: Customer user_id cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  -- B. Strict Analyst Assignment Control Guard
  IF NEW.assigned_analyst_id IS DISTINCT FROM OLD.assigned_analyst_id THEN
    -- Rule 1: Every change to an already assigned case requires the audited admin reassignment procedure
    IF OLD.assigned_analyst_id IS NOT NULL THEN
      RAISE EXCEPTION 'Security Violation: Modifying an assigned analyst requires the authorized reassignment or de-allocation procedure.'
        USING ERRCODE = '42501';
    END IF;

    -- Rule 2: Assigning an unassigned case is strictly restricted to the self-claiming workflow:
    -- - Case must be currently in 'open' status
    -- - Transition must be to 'in_review'
    -- - The assignee must be the authenticated caller (auth.uid())
    -- - The caller must be an active, verified financial analyst
    IF NOT (
      OLD.status = 'open' AND
      NEW.status = 'in_review' AND
      NEW.assigned_analyst_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role = 'analyst' 
          AND is_active = true 
          AND account_status = 'active'
      )
    ) THEN
      RAISE EXCEPTION 'Security Violation: Unassigned cases can only be claimed when status is open, transitioning to in_review, and assigned to the authenticated active analyst.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- C. Standard Status Progression Machine
  -- Enforce non-NULL assigned_analyst_id on entering or staying in in_review
  IF OLD.status = 'open' AND NEW.status = 'in_review' THEN
    IF NEW.assigned_analyst_id IS NULL THEN
      RAISE EXCEPTION 'Invalid State Transition: Case cannot enter in_review without an assigned analyst.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF OLD.status = 'in_review' AND NEW.status IN ('in_review', 'escalated', 'resolved') THEN
    IF NEW.status = 'in_review' AND NEW.assigned_analyst_id IS NULL THEN
      RAISE EXCEPTION 'Invalid State: Case in status in_review must have an assigned analyst.'
        USING ERRCODE = '22023';
    END IF;
  ELSIF OLD.status = 'escalated' AND NEW.status IN ('escalated', 'resolved') THEN
    NULL;
  ELSIF OLD.status = 'resolved' AND NEW.status = 'closed' THEN
    NULL;
  ELSIF OLD.status = NEW.status THEN
    IF NEW.status = 'in_review' AND NEW.assigned_analyst_id IS NULL THEN
      RAISE EXCEPTION 'Invalid State: Case in status in_review must have an assigned analyst.'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid State Transition: Transition from % to % is not permitted.', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  -- Maintain resolution timestamp and strict attribution
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    -- 1. Require caller to be the active financial analyst assigned to this specific case
    IF auth.uid() IS NULL OR
       OLD.assigned_analyst_id IS DISTINCT FROM auth.uid() OR
       NOT EXISTS (
         SELECT 1 FROM public.profiles 
         WHERE id = auth.uid() 
           AND role = 'analyst' 
           AND is_active = true 
           AND account_status = 'active'
       ) THEN
      RAISE EXCEPTION 'Security Violation: Resolving a case requires the authenticated active analyst assigned to the case.'
        USING ERRCODE = '42501';
    END IF;

    -- 2. Reject third-party attribution attempts
    IF NEW.resolving_analyst_id IS NOT NULL AND NEW.resolving_analyst_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Security Violation: resolving_analyst_id must match the authenticated resolving analyst.'
        USING ERRCODE = '42501';
    END IF;

    -- 3. Automatic system-controlled attribution and resolution timestamp
    NEW.resolving_analyst_id = auth.uid();
    NEW.resolved_at = now();

  -- 4. Post-resolution immutability: once resolved, attribution and timestamp cannot be modified
  ELSIF OLD.status IN ('resolved', 'closed') THEN
    IF (NEW.resolving_analyst_id IS DISTINCT FROM OLD.resolving_analyst_id) OR
       (NEW.resolved_at IS DISTINCT FROM OLD.resolved_at) THEN
      RAISE EXCEPTION 'Case Integrity Violation: resolving_analyst_id and resolved_at are strictly immutable once resolved.'
        USING ERRCODE = '42501';
    END IF;

  -- 5. Pre-resolution guard: attribution cannot be populated prior to resolution
  ELSIF NEW.status NOT IN ('resolved', 'closed') THEN
    IF NEW.resolving_analyst_id IS NOT NULL OR NEW.resolved_at IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid State: resolving_analyst_id and resolved_at can only be set upon case resolution.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_case_update_rules ON public.investigation_cases;
CREATE TRIGGER trg_enforce_case_update_rules
  BEFORE UPDATE ON public.investigation_cases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_case_update_rules();

-- 8.4 Investigation Notes Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_note_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_redaction boolean := false;
  v_active_test_run_id text;
  v_is_test_cleanup boolean := false;
BEGIN
  v_is_redaction := current_setting('app.in_compliance_redaction', true) = 'true';
  v_active_test_run_id := NULLIF(trim(current_setting('app.active_test_run_id', true)), '');
  v_is_test_cleanup := v_active_test_run_id IS NOT NULL AND length(v_active_test_run_id) > 0;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_is_test_cleanup THEN
      RAISE EXCEPTION 'Compliance Violation: Investigation notes can never be deleted outside authorized test cleanup.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT v_is_redaction THEN
      RAISE EXCEPTION 'Compliance Violation: Investigation notes are strictly immutable. Redactions must use redact_note_by_admin.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_note_immutability ON public.investigation_notes;
CREATE TRIGGER trg_enforce_note_immutability
  BEFORE UPDATE OR DELETE ON public.investigation_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_note_immutability();

-- 8.5 Compliance Redaction Audit Immutability Trigger
CREATE OR REPLACE FUNCTION public.enforce_compliance_audit_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_active_test_run_id text;
  v_is_test_cleanup boolean := false;
BEGIN
  v_active_test_run_id := NULLIF(trim(current_setting('app.active_test_run_id', true)), '');
  v_is_test_cleanup := v_active_test_run_id IS NOT NULL AND length(v_active_test_run_id) > 0;

  IF TG_OP = 'DELETE' THEN
    IF NOT v_is_test_cleanup THEN
      RAISE EXCEPTION 'Compliance Violation: Audit records cannot be deleted outside authorized test cleanup.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Compliance Violation: Audit records are strictly append-only and cannot be updated.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_compliance_audit_immutability ON public.compliance_redaction_audit;
CREATE TRIGGER trg_enforce_compliance_audit_immutability
  BEFORE UPDATE OR DELETE ON public.compliance_redaction_audit
  FOR EACH ROW EXECUTE FUNCTION public.enforce_compliance_audit_immutability();

-- ------------------------------------------------------------------------------
-- 9. Privileged Stored Procedures
-- ------------------------------------------------------------------------------

-- 9.1 Analyst Case Claiming Procedure
CREATE OR REPLACE FUNCTION public.claim_case(p_case_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_analyst_id uuid;
  v_case_status text;
BEGIN
  v_analyst_id := auth.uid();
  IF v_analyst_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Validate caller is an active financial analyst
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_analyst_id 
      AND role = 'analyst' 
      AND is_active = true 
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only active financial analysts can claim cases' USING ERRCODE = '42501';
  END IF;

  -- Lock case row FOR UPDATE to prevent race conditions
  SELECT status INTO v_case_status
  FROM public.investigation_cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found: %', p_case_id USING ERRCODE = 'P0002';
  END IF;

  IF v_case_status IS DISTINCT FROM 'open' THEN
    RAISE EXCEPTION 'Conflict: Case % is already in status %', p_case_id, v_case_status USING ERRCODE = '23505';
  END IF;

  UPDATE public.investigation_cases
  SET assigned_analyst_id = v_analyst_id,
      status = 'in_review',
      updated_at = now()
  WHERE id = p_case_id;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', p_case_id,
    'assigned_analyst_id', v_analyst_id,
    'status', 'in_review'
  );
END;
$$;

-- 9.2 Administrator Case Reassignment Procedure
CREATE OR REPLACE FUNCTION public.reassign_case_by_admin(
  p_case_id uuid,
  p_new_analyst_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operator_id uuid;
  v_current_analyst_id uuid;
  v_current_case_status text;
  v_target_analyst_status text;
  v_resulting_case_status text;
  v_audit_id uuid;
BEGIN
  v_operator_id := auth.uid();
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Validate operator is an active platform administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_operator_id 
      AND role = 'admin' 
      AND is_active = true 
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only active platform administrators can reassign cases' USING ERRCODE = '42501';
  END IF;

  -- Validate target analyst is an active analyst
  SELECT account_status INTO v_target_analyst_status
  FROM public.profiles
  WHERE id = p_new_analyst_id AND role = 'analyst' AND is_active = true;

  IF v_target_analyst_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Invalid Target: Target analyst does not exist or is inactive' USING ERRCODE = '22023';
  END IF;

  -- Validate reason length
  IF p_reason IS NULL OR length(trim(p_reason)) < 5 OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'Validation Error: Reassignment reason must be between 5 and 1000 characters' USING ERRCODE = '22023';
  END IF;

  -- Lock case row FOR UPDATE
  SELECT assigned_analyst_id, status INTO v_current_analyst_id, v_current_case_status
  FROM public.investigation_cases
  WHERE id = p_case_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Case not found: %', p_case_id USING ERRCODE = 'P0002';
  END IF;

  IF v_current_case_status IN ('resolved', 'closed') THEN
    RAISE EXCEPTION 'Invalid State: Cannot reassign a resolved or closed case' USING ERRCODE = '22023';
  END IF;

  -- Validate target analyst is distinct from current analyst
  IF p_new_analyst_id IS NOT DISTINCT FROM v_current_analyst_id THEN
    RAISE EXCEPTION 'Validation Error: Target analyst is already assigned to this case' USING ERRCODE = '22023';
  END IF;

  -- Determine resulting case status
  IF v_current_case_status = 'open' THEN
    v_resulting_case_status := 'in_review';
  ELSE
    v_resulting_case_status := v_current_case_status;
  END IF;

  -- Record audit trail and capture generated id
  INSERT INTO public.case_assignment_history (
    case_id,
    previous_analyst_id,
    new_analyst_id,
    reassigned_by,
    reassignment_reason,
    reassigned_at
  ) VALUES (
    p_case_id,
    v_current_analyst_id,
    p_new_analyst_id,
    v_operator_id,
    trim(p_reason),
    now()
  )
  RETURNING id INTO v_audit_id;

  -- Enable reassignment session flag and set single-use audit handshake ticket for trigger
  PERFORM set_config('app.in_case_reassignment', 'true', true);
  PERFORM set_config('app.reassignment_audit_id', v_audit_id::text, true);

  -- Update case atomically (trigger validates handshake and consumes tickets)
  UPDATE public.investigation_cases
  SET assigned_analyst_id = p_new_analyst_id,
      status = v_resulting_case_status,
      updated_at = now()
  WHERE id = p_case_id;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', p_case_id,
    'previous_analyst_id', v_current_analyst_id,
    'new_analyst_id', p_new_analyst_id,
    'reassigned_by', v_operator_id,
    'status', v_resulting_case_status
  );
END;
$$;

-- 9.3 Administrator Investigation Note Redaction Procedure
CREATE OR REPLACE FUNCTION public.redact_note_by_admin(
  p_note_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_operator_id uuid;
  v_case_id uuid;
  v_tx_id uuid;
  v_orig_text text;
  v_orig_hash text;
BEGIN
  v_operator_id := auth.uid();
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Caller is not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Validate operator is an active platform administrator
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_operator_id 
      AND role = 'admin' 
      AND is_active = true 
      AND account_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only active administrators can redact investigation notes' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 OR length(p_reason) > 1000 THEN
    RAISE EXCEPTION 'Validation Error: Redaction reason must be between 5 and 1000 characters' USING ERRCODE = '22023';
  END IF;

  -- Lock note row FOR UPDATE
  SELECT n.case_id, n.note_text, c.transaction_id INTO v_case_id, v_orig_text, v_tx_id
  FROM public.investigation_notes n
  JOIN public.investigation_cases c ON c.id = n.case_id
  WHERE n.id = p_note_id
  FOR UPDATE OF n;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found: %', p_note_id USING ERRCODE = 'P0002';
  END IF;

  -- Compute SHA-256 hash of original text
  v_orig_hash := encode(digest(v_orig_text, 'sha256'), 'hex');

  -- Enable redaction session flag for trigger
  PERFORM set_config('app.in_compliance_redaction', 'true', true);

  -- Record immutable compliance audit record
  INSERT INTO public.compliance_redaction_audit (
    note_id,
    case_id,
    transaction_id,
    redacted_by,
    operator_type,
    redaction_reason,
    original_hash,
    redacted_at
  ) VALUES (
    p_note_id,
    v_case_id,
    v_tx_id,
    v_operator_id,
    'admin',
    trim(p_reason),
    v_orig_hash,
    now()
  );

  -- Replace note text with standardized redaction placeholder
  UPDATE public.investigation_notes
  SET note_text = '[REDACTED FOR COMPLIANCE: ' || trim(p_reason) || ']'
  WHERE id = p_note_id;

  RETURN jsonb_build_object(
    'success', true,
    'note_id', p_note_id,
    'redacted_by', v_operator_id,
    'original_hash', v_orig_hash
  );
END;
$$;

-- 9.4 Account Deletion & Retention Procedure
CREATE OR REPLACE FUNCTION public.execute_account_deletion_and_retention(
  p_user_id uuid,
  p_operator_id uuid,
  p_legal_hold boolean DEFAULT false,
  p_policy_tag text DEFAULT 'STANDARD_COMPLIANCE_HOLD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_role text;
  v_retention_days integer;
  v_expiry timestamptz;
  v_uninvestigated_tx_ids uuid[];
  v_held_tx_ids uuid[];
BEGIN
  -- Validate caller authorization: separate service-role from authenticated administrator
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    -- Service-role authorization: trusted backend lifecycle task
    NULL;
  ELSE
    -- Authenticated caller: operator ID must match the verified JWT auth.uid()
    IF auth.uid() IS NULL OR p_operator_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: Caller ID must match authenticated operator ID'
        USING ERRCODE = '42501';
    END IF;

    -- Validate authenticated caller is an active platform administrator
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true 
        AND account_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only service_role or active platform administrators can execute deletion procedures'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id USING ERRCODE = 'P0002';
  END IF;

  -- Retrieve retention policy parameters
  SELECT retention_period_days INTO v_retention_days
  FROM public.retention_policies
  WHERE code = p_policy_tag;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid policy tag: %', p_policy_tag USING ERRCODE = '22023';
  END IF;

  v_expiry := now() + (v_retention_days || ' days')::interval;

  -- Enable deletion context session flag
  PERFORM set_config('app.in_account_deletion', 'true', true);

  -- 1. Identify transactions subject to retention hold (investigated cases or flagged)
  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[]) INTO v_held_tx_ids
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND (
      EXISTS (SELECT 1 FROM public.investigation_cases c WHERE c.transaction_id = t.id)
      OR EXISTS (SELECT 1 FROM public.fraud_assessments f WHERE f.transaction_id = t.id AND f.risk_level IN ('high', 'critical'))
      OR p_legal_hold = true
    );

  -- 2. Identify uninvestigated transactions to prune
  SELECT COALESCE(array_agg(t.id), ARRAY[]::uuid[]) INTO v_uninvestigated_tx_ids
  FROM public.transactions t
  WHERE t.user_id = p_user_id
    AND t.id <> ALL(v_held_tx_ids);

  -- 3. Delete uninvestigated transactions (and their fraud_assessments via cascade)
  IF cardinality(v_uninvestigated_tx_ids) > 0 THEN
    DELETE FROM public.fraud_assessments WHERE transaction_id = ANY(v_uninvestigated_tx_ids);
    DELETE FROM public.transactions WHERE id = ANY(v_uninvestigated_tx_ids);
  END IF;

  -- 4. De-identify retained transactions: decouple user_id to NULL, apply retention metadata
  IF cardinality(v_held_tx_ids) > 0 THEN
    UPDATE public.transactions
    SET user_id = NULL,
        metadata = metadata || jsonb_build_object(
          'retention_hold', true,
          'policy_tag', p_policy_tag,
          'deidentified_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
          'retention_expires_at', to_char(v_expiry AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        )
    WHERE id = ANY(v_held_tx_ids);
  END IF;

  -- 5. De-identify user's import batches
  UPDATE public.import_batches
  SET user_id = NULL
  WHERE user_id = p_user_id;

  -- 6. Deactivate profile FIRST:
  -- Must precede investigation_cases decoupling and caseload release so that
  -- enforce_case_update_rules() can verify the profile is deactivated/pending_deletion.
  UPDATE public.profiles
  SET is_active = false,
      account_status = 'pending_deletion',
      metadata = metadata || jsonb_build_object(
        'deactivated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'retention_hold', cardinality(v_held_tx_ids) > 0
      )
  WHERE id = p_user_id;

  -- 7. De-identify user's cases (decouple user_id to NULL while preserving case & note history)
  UPDATE public.investigation_cases
  SET user_id = NULL
  WHERE user_id = p_user_id;

  -- 8. If user is an analyst, release active unfinalized cases back to open triage
  -- Handles open, in_review, and escalated cases consistently with permitted de-allocation rules
  IF v_user_role = 'analyst' THEN
    UPDATE public.investigation_cases
    SET assigned_analyst_id = NULL,
        status = 'open',
        updated_at = now()
    WHERE assigned_analyst_id = p_user_id
      AND status IN ('open', 'in_review', 'escalated');
  END IF;

  -- Clear deletion context session flag
  PERFORM set_config('app.in_account_deletion', '', true);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'pruned_transactions', cardinality(v_uninvestigated_tx_ids),
    'retained_transactions', cardinality(v_held_tx_ids),
    'retention_expires_at', v_expiry
  );
END;
$$;

-- 9.5 Complete Isolated Test Cleanup Procedure
CREATE OR REPLACE FUNCTION public.run_test_cleanup(
  p_test_run_id uuid,
  p_test_user_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_test_case_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_test_transaction_ids uuid[] DEFAULT ARRAY[]::uuid[],
  p_test_batch_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_caller_role text;
  v_user_ids uuid[];
  v_case_ids uuid[];
  v_tx_ids uuid[];
  v_batch_ids uuid[];

  v_batch_count integer := 0;
  v_tx_count integer := 0;
  v_case_count integer := 0;
  v_user_count integer := 0;

  v_user_tx_ids uuid[] := ARRAY[]::uuid[];
  v_user_batch_ids uuid[] := ARRAY[]::uuid[];
  v_user_case_ids uuid[] := ARRAY[]::uuid[];
  v_user_history_case_ids uuid[] := ARRAY[]::uuid[];
  v_user_note_case_ids uuid[] := ARRAY[]::uuid[];

  v_discovered_tx_ids uuid[] := ARRAY[]::uuid[];
  v_discovered_case_ids uuid[] := ARRAY[]::uuid[];
  v_discovered_batch_ids uuid[] := ARRAY[]::uuid[];

  v_prev_tx_count integer;
  v_prev_case_count integer;
  v_prev_batch_count integer;
  v_discovery_iter integer := 0;

  v_del_audit integer := 0;
  v_del_notes integer := 0;
  v_del_history integer := 0;
  v_del_cases integer := 0;
  v_del_assessments integer := 0;
  v_del_tx integer := 0;
  v_del_batches integer := 0;
  v_del_profiles integer := 0;
BEGIN
  -- 1. Authorization: strictly service_role or active platform administrators
  v_caller_role := current_setting('request.jwt.claim.role', true);
  IF v_caller_role IS DISTINCT FROM 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
        AND role = 'admin' 
        AND is_active = true 
        AND account_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: only service_role or active platform administrators can execute test cleanup'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_test_run_id IS NULL THEN
    RAISE EXCEPTION 'Safety Violation: p_test_run_id must not be null' USING ERRCODE = '22004';
  END IF;

  -- 2. Deduplicate all initial input arrays
  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_user_ids
  FROM unnest(COALESCE(p_test_user_ids, ARRAY[]::uuid[])) AS id WHERE id IS NOT NULL;

  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_batch_ids
  FROM unnest(COALESCE(p_test_batch_ids, ARRAY[]::uuid[])) AS id WHERE id IS NOT NULL;

  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_tx_ids
  FROM unnest(COALESCE(p_test_transaction_ids, ARRAY[]::uuid[])) AS id WHERE id IS NOT NULL;

  SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_case_ids
  FROM unnest(COALESCE(p_test_case_ids, ARRAY[]::uuid[])) AS id WHERE id IS NOT NULL;

  -- =========================================================================
  -- PHASE 1: PRE-VERIFICATION & COMPLETE ITERATIVE DEPENDENCY DISCOVERY
  -- =========================================================================

  -- A. Verify Test Users & Gather User Dependencies
  IF cardinality(v_user_ids) > 0 THEN
    SELECT count(DISTINCT id) INTO v_user_count 
    FROM public.profiles
    WHERE id = ANY(v_user_ids) 
      AND metadata->>'is_test_fixture' = 'true'
      AND metadata->>'test_run_id' = p_test_run_id::text
      AND (email LIKE '%@test.fraudshield.internal' OR email LIKE '%@test.local');

    IF v_user_count <> cardinality(v_user_ids) THEN
      RAISE EXCEPTION 'User profile verification failed: target users include non-fixture or production profiles'
        USING ERRCODE = 'P0001';
    END IF;

    -- Fail closed if test users own any record outside p_test_run_id
    IF EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE user_id = ANY(v_user_ids) 
        AND (
          metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'User dependency violation: user owns transactions outside test_run_id %', p_test_run_id
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.import_batches 
      WHERE user_id = ANY(v_user_ids) 
        AND (
          metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'User dependency violation: user owns import batches outside test_run_id %', p_test_run_id
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.investigation_cases 
      WHERE (
        user_id = ANY(v_user_ids) 
        OR assigned_analyst_id = ANY(v_user_ids) 
        OR resolving_analyst_id = ANY(v_user_ids)
      )
      AND (
        metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
        OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
      )
    ) THEN
      RAISE EXCEPTION 'User dependency violation: user associated with cases outside test_run_id %', p_test_run_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Fail closed if test users authored any notes outside test run or linked to missing/production cases
    IF EXISTS (
      SELECT 1 
      FROM public.investigation_notes n
      LEFT JOIN public.investigation_cases c ON c.id = n.case_id
      WHERE n.author_id = ANY(v_user_ids)
        AND (
          n.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (n.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
          OR c.id IS NULL
          OR c.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (c.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'User note integrity violation: note authored by test user is outside test_run_id % or linked to a missing, production, or non-fixture case',
        p_test_run_id USING ERRCODE = 'P0001';
    END IF;

    -- Fail closed if test users are referenced in case_assignment_history outside test run or linked to missing/production cases
    IF EXISTS (
      SELECT 1 
      FROM public.case_assignment_history h
      LEFT JOIN public.investigation_cases c ON c.id = h.case_id
      WHERE (
        h.previous_analyst_id = ANY(v_user_ids)
        OR h.new_analyst_id = ANY(v_user_ids)
        OR h.reassigned_by = ANY(v_user_ids)
      )
      AND (
        h.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
        OR (h.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        OR c.id IS NULL
        OR c.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
        OR (c.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
      )
    ) THEN
      RAISE EXCEPTION 'User history integrity violation: case assignment history for test user is outside test_run_id % or linked to a missing, production, or non-fixture case',
        p_test_run_id USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.fraud_assessments
      WHERE user_id = ANY(v_user_ids)
        AND (
          metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'User dependency violation: user owns fraud_assessments outside test_run_id %', p_test_run_id
        USING ERRCODE = 'P0001';
    END IF;

    -- Collect user-owned dependencies
    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_user_tx_ids 
    FROM public.transactions WHERE user_id = ANY(v_user_ids);

    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_user_batch_ids 
    FROM public.import_batches WHERE user_id = ANY(v_user_ids);

    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_user_case_ids 
    FROM public.investigation_cases 
    WHERE user_id = ANY(v_user_ids) 
       OR assigned_analyst_id = ANY(v_user_ids) 
       OR resolving_analyst_id = ANY(v_user_ids);

    -- Discover cases whose history references target test users
    SELECT COALESCE(array_agg(DISTINCT case_id), ARRAY[]::uuid[]) INTO v_user_history_case_ids
    FROM public.case_assignment_history
    WHERE previous_analyst_id = ANY(v_user_ids)
       OR new_analyst_id = ANY(v_user_ids)
       OR reassigned_by = ANY(v_user_ids);

    -- Discover cases where target test users authored notes
    SELECT COALESCE(array_agg(DISTINCT case_id), ARRAY[]::uuid[]) INTO v_user_note_case_ids
    FROM public.investigation_notes
    WHERE author_id = ANY(v_user_ids);

    -- Deduplicate combined arrays to handle any overlaps cleanly
    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_tx_ids
    FROM unnest(array_cat(v_tx_ids, v_user_tx_ids)) AS id WHERE id IS NOT NULL;

    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_batch_ids
    FROM unnest(array_cat(v_batch_ids, v_user_batch_ids)) AS id WHERE id IS NOT NULL;

    SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_case_ids
    FROM unnest(array_cat(v_case_ids, array_cat(v_user_case_ids, array_cat(v_user_history_case_ids, v_user_note_case_ids)))) AS id WHERE id IS NOT NULL;
  END IF;

  -- B. Complete Iterative Dependency Discovery (Fixed-Point Graph Traversal)
  -- Iterates until no new linked cases, transactions, or import batches are found.
  LOOP
    v_discovery_iter := v_discovery_iter + 1;
    IF v_discovery_iter > 100 THEN
      RAISE EXCEPTION 'Dependency discovery safety violation: iteration limit exceeded (potential cycle)'
        USING ERRCODE = '54001';
    END IF;

    v_prev_tx_count := cardinality(v_tx_ids);
    v_prev_case_count := cardinality(v_case_ids);
    v_prev_batch_count := cardinality(v_batch_ids);

    -- 1. Cases -> Linked Transactions
    IF cardinality(v_case_ids) > 0 THEN
      SELECT COALESCE(array_agg(DISTINCT transaction_id), ARRAY[]::uuid[]) INTO v_discovered_tx_ids
      FROM public.investigation_cases
      WHERE id = ANY(v_case_ids) AND transaction_id IS NOT NULL;

      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_tx_ids
      FROM unnest(array_cat(v_tx_ids, v_discovered_tx_ids)) AS id WHERE id IS NOT NULL;
    END IF;

    -- 2. Batches -> Linked Transactions
    IF cardinality(v_batch_ids) > 0 THEN
      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_discovered_tx_ids
      FROM public.transactions
      WHERE import_batch_id = ANY(v_batch_ids);

      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_tx_ids
      FROM unnest(array_cat(v_tx_ids, v_discovered_tx_ids)) AS id WHERE id IS NOT NULL;
    END IF;

    -- 3. Transactions -> Linked Cases
    IF cardinality(v_tx_ids) > 0 THEN
      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_discovered_case_ids
      FROM public.investigation_cases
      WHERE transaction_id = ANY(v_tx_ids);

      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_case_ids
      FROM unnest(array_cat(v_case_ids, v_discovered_case_ids)) AS id WHERE id IS NOT NULL;
    END IF;

    -- 4. Transactions -> Linked Batches
    IF cardinality(v_tx_ids) > 0 THEN
      SELECT COALESCE(array_agg(DISTINCT import_batch_id), ARRAY[]::uuid[]) INTO v_discovered_batch_ids
      FROM public.transactions
      WHERE id = ANY(v_tx_ids) AND import_batch_id IS NOT NULL;

      SELECT COALESCE(array_agg(DISTINCT id), ARRAY[]::uuid[]) INTO v_batch_ids
      FROM unnest(array_cat(v_batch_ids, v_discovered_batch_ids)) AS id WHERE id IS NOT NULL;
    END IF;

    -- Fixed-point check: stop when no new IDs were added across all three sets
    IF cardinality(v_tx_ids) = v_prev_tx_count AND
       cardinality(v_case_ids) = v_prev_case_count AND
       cardinality(v_batch_ids) = v_prev_batch_count THEN
      EXIT;
    END IF;
  END LOOP;

  -- =========================================================================
  -- PHASE 2: POST-DISCOVERY EXHAUSTIVE VERIFICATION (Fail Closed)
  -- =========================================================================

  -- C. Verify All Target Batches (Post-Discovery Verification)
  IF cardinality(v_batch_ids) > 0 THEN
    SELECT count(DISTINCT id) INTO v_batch_count 
    FROM public.import_batches 
    WHERE id = ANY(v_batch_ids) 
      AND metadata->>'test_run_id' = p_test_run_id::text
      AND (metadata->>'is_test_fixture')::text = 'true';

    IF v_batch_count <> cardinality(v_batch_ids) THEN
      RAISE EXCEPTION 'Batch verification failed: expected % distinct batches for test_run_id %, found %',
        cardinality(v_batch_ids), p_test_run_id, v_batch_count USING ERRCODE = 'P0001';
    END IF;

    -- Fail closed if batches contain any transactions outside p_test_run_id
    IF EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE import_batch_id = ANY(v_batch_ids)
        AND (
          metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Batch dependency violation: batch contains transactions outside test_run_id % or non-fixture transactions',
        p_test_run_id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- D. Verify All Target Transactions & Linked Assessments (Post-Discovery Verification)
  IF cardinality(v_tx_ids) > 0 THEN
    SELECT count(DISTINCT id) INTO v_tx_count 
    FROM public.transactions 
    WHERE id = ANY(v_tx_ids) 
      AND metadata->>'test_run_id' = p_test_run_id::text
      AND (metadata->>'is_test_fixture')::text = 'true';

    IF v_tx_count <> cardinality(v_tx_ids) THEN
      RAISE EXCEPTION 'Transaction verification failed: expected % distinct transactions for test_run_id %, found %',
        cardinality(v_tx_ids), p_test_run_id, v_tx_count USING ERRCODE = 'P0001';
    END IF;

    -- Strict assessment verification: must match exact test_run_id and is_test_fixture=true
    IF EXISTS (
      SELECT 1 FROM public.fraud_assessments 
      WHERE transaction_id = ANY(v_tx_ids) 
        AND (
          metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Assessment verification failed: fraud_assessments linked to transactions lack exact test_run_id % or fixture flag',
        p_test_run_id USING ERRCODE = 'P0001';
    END IF;

    -- Strict batch verification for transactions: linked batch must belong to same test run
    IF EXISTS (
      SELECT 1 
      FROM public.transactions t
      JOIN public.import_batches b ON b.id = t.import_batch_id
      WHERE t.id = ANY(v_tx_ids)
        AND (
          b.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (b.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Transaction dependency violation: linked import batch belongs to a different test run or production (expected test_run_id %)',
        p_test_run_id USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- E. Verify All Target Cases & Linked Records (Post-Discovery Verification)
  IF cardinality(v_case_ids) > 0 THEN
    SELECT count(DISTINCT id) INTO v_case_count 
    FROM public.investigation_cases 
    WHERE id = ANY(v_case_ids) 
      AND metadata->>'test_run_id' = p_test_run_id::text
      AND (metadata->>'is_test_fixture')::text = 'true';

    IF v_case_count <> cardinality(v_case_ids) THEN
      RAISE EXCEPTION 'Case verification failed: expected % distinct cases for test_run_id %, found %',
        cardinality(v_case_ids), p_test_run_id, v_case_count USING ERRCODE = 'P0001';
    END IF;

    -- Linked transactions must belong to same test run
    IF EXISTS (
      SELECT 1 
      FROM public.investigation_cases c
      JOIN public.transactions t ON t.id = c.transaction_id
      WHERE c.id = ANY(v_case_ids)
        AND (
          t.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (t.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Case integrity violation: linked transaction belongs to a different test run or production'
        USING ERRCODE = 'P0001';
    END IF;

    -- Case history records must belong to same test run
    IF EXISTS (
      SELECT 1 
      FROM public.case_assignment_history h
      WHERE h.case_id = ANY(v_case_ids)
        AND (
          h.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (h.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Case history integrity violation: history record belongs to a different test run or production'
        USING ERRCODE = 'P0001';
    END IF;

    -- Redaction audit records must belong to same test run
    IF EXISTS (
      SELECT 1 
      FROM public.compliance_redaction_audit cra
      WHERE cra.case_id = ANY(v_case_ids)
        AND (
          cra.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (cra.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Compliance audit integrity violation: redaction audit record belongs to a different test run or production'
        USING ERRCODE = 'P0001';
    END IF;

    -- Investigation notes must belong to same test run
    IF EXISTS (
      SELECT 1 FROM public.investigation_notes 
      WHERE case_id = ANY(v_case_ids) 
        AND (
          metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
          OR (metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
        )
    ) THEN
      RAISE EXCEPTION 'Investigation note integrity violation: note belongs to a different test run or production'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- =========================================================================
  -- PHASE 3: ORDERED DELETIONS (Executed strictly on deduplicated verified IDs)
  -- =========================================================================

  PERFORM set_config('app.active_test_run_id', p_test_run_id::text, true);

  -- 1. Compliance Redaction Audit
  IF cardinality(v_case_ids) > 0 THEN
    DELETE FROM public.compliance_redaction_audit WHERE case_id = ANY(v_case_ids);
    GET DIAGNOSTICS v_del_audit = ROW_COUNT;
  END IF;

  -- 2. Investigation Notes (by target case or by test author)
  IF cardinality(v_case_ids) > 0 OR cardinality(v_user_ids) > 0 THEN
    -- Verify parent case integrity before deleting notes authored by test users
    IF cardinality(v_user_ids) > 0 THEN
      IF EXISTS (
        SELECT 1 
        FROM public.investigation_notes n
        LEFT JOIN public.investigation_cases c ON c.id = n.case_id
        WHERE n.author_id = ANY(v_user_ids)
          AND (
            n.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
            OR (n.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
            OR c.id IS NULL
            OR c.metadata->>'test_run_id' IS DISTINCT FROM p_test_run_id::text
            OR (c.metadata->>'is_test_fixture')::text IS DISTINCT FROM 'true'
          )
      ) THEN
        RAISE EXCEPTION 'User note integrity violation: note authored by test user is outside test_run_id % or linked to a missing, production, or non-fixture case',
          p_test_run_id USING ERRCODE = 'P0001';
      END IF;
    END IF;

    DELETE FROM public.investigation_notes 
    WHERE (cardinality(v_case_ids) > 0 AND case_id = ANY(v_case_ids))
       OR (cardinality(v_user_ids) > 0 AND author_id = ANY(v_user_ids));
    GET DIAGNOSTICS v_del_notes = ROW_COUNT;
  END IF;

  -- 3. Case Assignment History
  IF cardinality(v_case_ids) > 0 THEN
    DELETE FROM public.case_assignment_history WHERE case_id = ANY(v_case_ids);
    GET DIAGNOSTICS v_del_history = ROW_COUNT;
  END IF;

  -- 4. Investigation Cases
  IF cardinality(v_case_ids) > 0 THEN
    DELETE FROM public.investigation_cases WHERE id = ANY(v_case_ids);
    GET DIAGNOSTICS v_del_cases = ROW_COUNT;
  END IF;

  -- 5. Fraud Assessments
  IF cardinality(v_tx_ids) > 0 OR cardinality(v_user_ids) > 0 THEN
    DELETE FROM public.fraud_assessments 
    WHERE (cardinality(v_tx_ids) > 0 AND transaction_id = ANY(v_tx_ids))
       OR (cardinality(v_user_ids) > 0 AND user_id = ANY(v_user_ids));
    GET DIAGNOSTICS v_del_assessments = ROW_COUNT;
  END IF;

  -- 6. Transactions
  IF cardinality(v_tx_ids) > 0 THEN
    DELETE FROM public.transactions WHERE id = ANY(v_tx_ids);
    GET DIAGNOSTICS v_del_tx = ROW_COUNT;
  END IF;

  -- 7. Import Batches
  IF cardinality(v_batch_ids) > 0 THEN
    DELETE FROM public.import_batches WHERE id = ANY(v_batch_ids);
    GET DIAGNOSTICS v_del_batches = ROW_COUNT;
  END IF;

  -- 8. Profiles
  IF cardinality(v_user_ids) > 0 THEN
    DELETE FROM public.profiles WHERE id = ANY(v_user_ids);
    GET DIAGNOSTICS v_del_profiles = ROW_COUNT;
  END IF;

  -- Clear active test run session flag
  PERFORM set_config('app.active_test_run_id', '', true);

  RETURN jsonb_build_object(
    'success', true,
    'test_run_id', p_test_run_id,
    'deleted', jsonb_build_object(
      'profiles', v_del_profiles,
      'import_batches', v_del_batches,
      'transactions', v_del_tx,
      'fraud_assessments', v_del_assessments,
      'investigation_cases', v_del_cases,
      'investigation_notes', v_del_notes,
      'case_assignment_history', v_del_history,
      'compliance_redaction_audit', v_del_audit
    )
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Enable Row Level Security (RLS) on All Tables
-- ------------------------------------------------------------------------------

ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supported_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_redaction_audit ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 11. Row Level Security Policies (Fully Idempotent)
-- ------------------------------------------------------------------------------

-- 11.1 Retention Policies & Currencies: Read-only for authenticated active users
DROP POLICY IF EXISTS "retention_policies_select_active" ON public.retention_policies;
CREATE POLICY "retention_policies_select_active" ON public.retention_policies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

DROP POLICY IF EXISTS "supported_currencies_select_active" ON public.supported_currencies;
CREATE POLICY "supported_currencies_select_active" ON public.supported_currencies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );

-- 11.2 Import Batches Policies
-- Personal users: Select and insert own batches
DROP POLICY IF EXISTS "batches_select_own" ON public.import_batches;
CREATE POLICY "batches_select_own" ON public.import_batches
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'personal'
    )
  );

DROP POLICY IF EXISTS "batches_insert_own" ON public.import_batches;
CREATE POLICY "batches_insert_own" ON public.import_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'personal'
    )
  );

-- 11.3 Transactions Policies
-- Personal users: Select and insert own transactions
DROP POLICY IF EXISTS "transactions_select_own" ON public.transactions;
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'personal'
    )
  );

DROP POLICY IF EXISTS "transactions_insert_own" ON public.transactions;
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'personal'
    )
  );

-- Analysts: View transactions associated with assigned cases, open triage cases, or flagged risk
DROP POLICY IF EXISTS "transactions_select_analyst" ON public.transactions;
CREATE POLICY "transactions_select_analyst" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    ) AND (
      EXISTS (
        SELECT 1 FROM public.investigation_cases c 
        WHERE c.transaction_id = public.transactions.id 
          AND (c.assigned_analyst_id = auth.uid() OR c.status = 'open')
      ) OR
      EXISTS (
        SELECT 1 FROM public.fraud_assessments f 
        WHERE f.transaction_id = public.transactions.id 
          AND f.risk_level IN ('high', 'critical')
      )
    )
  );

-- Administrators: Health/telemetry selection (no direct mutation)
DROP POLICY IF EXISTS "transactions_select_admin" ON public.transactions;
CREATE POLICY "transactions_select_admin" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'admin'
    )
  );

-- 11.4 Fraud Assessments Policies
-- Personal users: View assessment risk scores on own transactions
DROP POLICY IF EXISTS "assessments_select_own" ON public.fraud_assessments;
CREATE POLICY "assessments_select_own" ON public.fraud_assessments
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'personal'
    )
  );

-- Analysts: View assessments scoped strictly to flagged triage or assigned/open cases
DROP POLICY IF EXISTS "assessments_select_analyst" ON public.fraud_assessments;
CREATE POLICY "assessments_select_analyst" ON public.fraud_assessments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    ) AND (
      risk_level IN ('high', 'critical') OR
      EXISTS (
        SELECT 1 FROM public.investigation_cases c 
        WHERE c.transaction_id = public.fraud_assessments.transaction_id 
          AND (c.assigned_analyst_id = auth.uid() OR c.status = 'open')
      )
    )
  );

-- 11.5 Investigation Cases Policies
-- Analysts: Scoped strictly to cases assigned to them or open unassigned triage cases
DROP POLICY IF EXISTS "cases_select_analyst" ON public.investigation_cases;
CREATE POLICY "cases_select_analyst" ON public.investigation_cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    ) AND (
      assigned_analyst_id = auth.uid() OR
      status = 'open'
    )
  );

DROP POLICY IF EXISTS "cases_update_assigned_analyst" ON public.investigation_cases;
CREATE POLICY "cases_update_assigned_analyst" ON public.investigation_cases
  FOR UPDATE TO authenticated
  USING (
    assigned_analyst_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    )
  )
  WITH CHECK (
    assigned_analyst_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    )
  );

-- Administrators: Full visibility on all cases
DROP POLICY IF EXISTS "cases_select_admin" ON public.investigation_cases;
CREATE POLICY "cases_select_admin" ON public.investigation_cases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'admin'
    )
  );

-- 11.6 Case Assignment History Policies
-- Analysts: Scoped strictly to their own past/current assignments or open cases
DROP POLICY IF EXISTS "history_select_analyst" ON public.case_assignment_history;
CREATE POLICY "history_select_analyst" ON public.case_assignment_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    ) AND (
      previous_analyst_id = auth.uid() OR
      new_analyst_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.investigation_cases c 
        WHERE c.id = public.case_assignment_history.case_id 
          AND (c.assigned_analyst_id = auth.uid() OR c.status = 'open')
      )
    )
  );

DROP POLICY IF EXISTS "history_select_admin" ON public.case_assignment_history;
CREATE POLICY "history_select_admin" ON public.case_assignment_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'admin'
    )
  );

-- 11.7 Investigation Notes Policies
-- Analysts: View notes scoped strictly to their assigned cases or open cases in triage
DROP POLICY IF EXISTS "notes_select_analyst" ON public.investigation_notes;
CREATE POLICY "notes_select_analyst" ON public.investigation_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    ) AND
    EXISTS (
      SELECT 1 FROM public.investigation_cases c 
      WHERE c.id = public.investigation_notes.case_id 
        AND (c.assigned_analyst_id = auth.uid() OR c.status = 'open')
    )
  );

DROP POLICY IF EXISTS "notes_insert_analyst" ON public.investigation_notes;
CREATE POLICY "notes_insert_analyst" ON public.investigation_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'analyst'
    ) AND
    EXISTS (
      SELECT 1 FROM public.investigation_cases c 
      WHERE c.id = case_id AND c.assigned_analyst_id = auth.uid()
    )
  );

-- Administrators: Audit visibility on notes
DROP POLICY IF EXISTS "notes_select_admin" ON public.investigation_notes;
CREATE POLICY "notes_select_admin" ON public.investigation_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'admin'
    )
  );

-- 11.8 Compliance Redaction Audit Policies
-- Read-only for administrators and compliance officers
DROP POLICY IF EXISTS "redaction_audit_select_admin" ON public.compliance_redaction_audit;
CREATE POLICY "redaction_audit_select_admin" ON public.compliance_redaction_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true AND p.role = 'admin'
    )
  );

-- ------------------------------------------------------------------------------
-- 12. Explicit Role Privileges & Security Isolation
-- ------------------------------------------------------------------------------

-- 12.1 Revoke all table access from anonymous / unauthenticated callers
REVOKE ALL ON TABLE public.retention_policies FROM anon;
REVOKE ALL ON TABLE public.supported_currencies FROM anon;
REVOKE ALL ON TABLE public.import_batches FROM anon;
REVOKE ALL ON TABLE public.transactions FROM anon;
REVOKE ALL ON TABLE public.fraud_assessments FROM anon;
REVOKE ALL ON TABLE public.investigation_cases FROM anon;
REVOKE ALL ON TABLE public.case_assignment_history FROM anon;
REVOKE ALL ON TABLE public.investigation_notes FROM anon;
REVOKE ALL ON TABLE public.compliance_redaction_audit FROM anon;

-- 12.2 Grant authenticated table permissions strictly governed by Row Level Security
GRANT SELECT ON public.retention_policies TO authenticated;
GRANT SELECT ON public.supported_currencies TO authenticated;
GRANT SELECT, INSERT ON public.import_batches TO authenticated;
GRANT SELECT, INSERT ON public.transactions TO authenticated;
GRANT SELECT ON public.fraud_assessments TO authenticated;
GRANT SELECT, UPDATE ON public.investigation_cases TO authenticated;
GRANT SELECT ON public.case_assignment_history TO authenticated;
GRANT SELECT, INSERT ON public.investigation_notes TO authenticated;
GRANT SELECT ON public.compliance_redaction_audit TO authenticated;

-- 12.3 Function Execution Privileges: Explicitly Revoke from PUBLIC and anon
REVOKE ALL ON FUNCTION public.is_valid_utc_timestamp(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_transaction_metadata_structure(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_reserved_metadata_authorization() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_transaction_immutability() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_case_update_rules() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_note_immutability() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_compliance_audit_immutability() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_case(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reassign_case_by_admin(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redact_note_by_admin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.execute_account_deletion_and_retention(uuid, uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_test_cleanup(uuid, uuid[], uuid[], uuid[], uuid[]) FROM PUBLIC, anon;

-- 12.4 Grant Execution Only to Intended Roles
GRANT EXECUTE ON FUNCTION public.is_valid_utc_timestamp(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_transaction_metadata_structure(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_case(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reassign_case_by_admin(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redact_note_by_admin(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_account_deletion_and_retention(uuid, uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_test_cleanup(uuid, uuid[], uuid[], uuid[], uuid[]) TO authenticated, service_role;

-- 12.5 Service Role full administrative access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

