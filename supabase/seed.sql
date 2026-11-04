-- ==============================================================================
-- FraudShield AI — Seed & Administrative Role Assignment
-- ==============================================================================
-- NOTE: Analyst and Admin roles MUST be assigned through this trusted
-- administrative script or via direct Supabase dashboard SQL editor.
-- They can NEVER be acquired through public registration or client requests.

-- Example: Promoting an existing user to 'analyst' by email
-- (Replace 'analyst.user@domain.com' with the authorized user's email)
/*
UPDATE public.profiles
SET role = 'analyst', updated_at = now()
WHERE email = 'analyst.user@domain.com';
*/

-- Example: Promoting an existing user to 'admin' by email
-- (Replace 'admin.user@domain.com' with the authorized user's email)
/*
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE email = 'admin.user@domain.com';
*/

