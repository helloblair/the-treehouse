-- ============================================================================
-- Support/Dev role for The Treehouse
-- Support users can see all settings including AI tuning, and can
-- manage configuration on behalf of teachers.
-- ============================================================================

-- Helper: checks if the calling user has the 'support' role
CREATE OR REPLACE FUNCTION is_support()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
      AND role = 'support'
  );
$$;

-- Update existing RLS helper: support users get teacher-level access
-- (they can see everything teachers can see, plus more)
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
      AND role IN ('teacher', 'support')
  );
$$;

-- ── Seed support user ──────────────────────────────────────────────────────
-- Creates the initial support account. On sign-in, the JWT user_metadata
-- will carry role='support' and useAuth.ts will resolve it correctly.

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at,
  confirmation_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'kirsten@support.thetreehouse.com',
  crypt('treehouse123', gen_salt('bf')),
  now(),
  '{"role": "support", "display_name": "Kirsten (Support)", "dev_credential": "support.kirsten"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  now(),
  now(),
  ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'kirsten@support.thetreehouse.com'
);

-- Create matching user_profiles entry
INSERT INTO user_profiles (user_id, email, display_name, role)
SELECT
  id,
  'kirsten@support.thetreehouse.com',
  'Kirsten (Support)',
  'support'
FROM auth.users
WHERE email = 'kirsten@support.thetreehouse.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'support';
