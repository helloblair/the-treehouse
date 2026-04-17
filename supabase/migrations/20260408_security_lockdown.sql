-- ============================================================================
-- 20260408_security_lockdown.sql
--
-- Comprehensive security migration for The Treehouse.
--
-- Background: an audit on 2026-04-08 found that the policies and RPCs in
-- production did not match any previous repo migration. The live database had
-- "Allow all for dev" placeholder policies on token_wallets, token_transactions
-- and pets, plus wide-open SELECT/INSERT/UPDATE on user_profiles, plus a set
-- of SECURITY DEFINER RPCs that either had no auth check or trusted a
-- client-supplied caller id. Together those let any signed-up user read every
-- other user's data, mint tokens, approve their own submissions, and elevate
-- themselves to teacher.
--
-- This migration:
--   1. Creates is_teacher() and is_support() helpers (didn't exist).
--   2. Replaces every wide-open policy with restrictive owner/teacher policies.
--   3. Adds column-level REVOKE/GRANT so user_profiles.role cannot be written
--      by clients at all.
--   4. Rewrites every existing RPC to ignore the client-supplied caller id and
--      use auth.uid() internally. Function signatures are preserved exactly so
--      no client code needs to change to call them.
--   5. Creates the missing redeem_reward() RPC (it was referenced by client
--      code but had never been created in production).
--   6. Adds get_leaderboard() so the student leaderboard works without giving
--      every student SELECT on user_profiles.
--
-- Idempotent: safe to re-run. Wrapped in BEGIN/COMMIT so partial failure
-- rolls back cleanly. Run in the Supabase Dashboard SQL Editor.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- Helpers
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()::text
      AND role IN ('teacher','support')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_support()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE user_id = auth.uid()::text
      AND role = 'support'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_support() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- user_profiles  (text user_id)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can read profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS "No direct insert on profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow update on profiles"     ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_select           ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_insert           ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_update           ON public.user_profiles;

CREATE POLICY user_profiles_select ON public.user_profiles
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_teacher());

-- New rows can only be the caller's own and only as student. Teachers are
-- promoted server-side by api/claim-teacher-role.ts using the service role.
CREATE POLICY user_profiles_insert ON public.user_profiles
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text AND role = 'student');

CREATE POLICY user_profiles_update ON public.user_profiles
  FOR UPDATE
  USING (user_id = auth.uid()::text);

-- Column-level lockdown: even with the UPDATE policy above, clients can only
-- touch display_name and email. The role column is unreachable from the
-- client connection at the privilege layer, so RLS isn't even consulted.
REVOKE UPDATE ON public.user_profiles FROM authenticated;
GRANT  UPDATE (display_name, email) ON public.user_profiles TO authenticated;
REVOKE UPDATE ON public.user_profiles FROM anon;

-- ────────────────────────────────────────────────────────────────────────────
-- pets  (uuid user_id)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow all for dev" ON public.pets;
DROP POLICY IF EXISTS pets_select         ON public.pets;
DROP POLICY IF EXISTS pets_insert         ON public.pets;
DROP POLICY IF EXISTS pets_update         ON public.pets;
DROP POLICY IF EXISTS pets_delete         ON public.pets;

CREATE POLICY pets_select ON public.pets
  FOR SELECT
  USING (user_id = auth.uid() OR public.is_teacher());

CREATE POLICY pets_insert ON public.pets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY pets_update ON public.pets
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY pets_delete ON public.pets
  FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- token_wallets  (text user_id)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow all token_wallets for dev" ON public.token_wallets;
DROP POLICY IF EXISTS token_wallets_select              ON public.token_wallets;
DROP POLICY IF EXISTS token_wallets_insert              ON public.token_wallets;
DROP POLICY IF EXISTS token_wallets_update              ON public.token_wallets;
DROP POLICY IF EXISTS token_wallets_delete              ON public.token_wallets;

CREATE POLICY token_wallets_select ON public.token_wallets
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_teacher());

-- First-touch wallet creation by the owner. Balance/lifetime_earned default
-- to 0 server-side.
CREATE POLICY token_wallets_insert ON public.token_wallets
  FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- No client UPDATE/DELETE policies. All credit/debit goes through the
-- approve_submission and redeem_reward RPCs (SECURITY DEFINER).

-- ────────────────────────────────────────────────────────────────────────────
-- token_transactions  (text user_id)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow all token_transactions for dev" ON public.token_transactions;
DROP POLICY IF EXISTS token_transactions_select              ON public.token_transactions;
DROP POLICY IF EXISTS token_transactions_insert              ON public.token_transactions;
DROP POLICY IF EXISTS token_transactions_update              ON public.token_transactions;
DROP POLICY IF EXISTS token_transactions_delete              ON public.token_transactions;

CREATE POLICY token_transactions_select ON public.token_transactions
  FOR SELECT
  USING (user_id = auth.uid()::text OR public.is_teacher());

-- No client INSERT/UPDATE/DELETE. Inserts come from the SECURITY DEFINER RPCs.

-- ────────────────────────────────────────────────────────────────────────────
-- assignments
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can read active assignments" ON public.assignments;
DROP POLICY IF EXISTS "Block direct insert on assignments" ON public.assignments;
DROP POLICY IF EXISTS "Block direct update on assignments" ON public.assignments;
DROP POLICY IF EXISTS assignments_select                   ON public.assignments;
DROP POLICY IF EXISTS assignments_insert                   ON public.assignments;
DROP POLICY IF EXISTS assignments_update                   ON public.assignments;
DROP POLICY IF EXISTS assignments_delete                   ON public.assignments;

-- Assignments are class-wide; any signed-in user can read them.
CREATE POLICY assignments_select ON public.assignments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- No client INSERT/UPDATE/DELETE. The create_assignment RPC handles writes.

-- ────────────────────────────────────────────────────────────────────────────
-- assignment_submissions  (text student_id)
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can read submissions"         ON public.assignment_submissions;
DROP POLICY IF EXISTS "Block direct insert on submissions"  ON public.assignment_submissions;
DROP POLICY IF EXISTS "Block direct update on submissions"  ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_select                    ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_insert                    ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_update                    ON public.assignment_submissions;
DROP POLICY IF EXISTS submissions_delete                    ON public.assignment_submissions;

CREATE POLICY submissions_select ON public.assignment_submissions
  FOR SELECT
  USING (student_id = auth.uid()::text OR public.is_teacher());

-- No client INSERT/UPDATE/DELETE. submit/approve/reject RPCs handle writes.

-- ────────────────────────────────────────────────────────────────────────────
-- plugin_states  (uuid user_id)
-- ────────────────────────────────────────────────────────────────────────────
-- Already correctly scoped, but rewrite idempotently for completeness.

DROP POLICY IF EXISTS "Users can read their own plugin state"   ON public.plugin_states;
DROP POLICY IF EXISTS "Users can insert their own plugin state" ON public.plugin_states;
DROP POLICY IF EXISTS "Users can update their own plugin state" ON public.plugin_states;
DROP POLICY IF EXISTS plugin_states_select                      ON public.plugin_states;
DROP POLICY IF EXISTS plugin_states_insert                      ON public.plugin_states;
DROP POLICY IF EXISTS plugin_states_update                      ON public.plugin_states;
DROP POLICY IF EXISTS plugin_states_delete                      ON public.plugin_states;

CREATE POLICY plugin_states_select ON public.plugin_states
  FOR SELECT  USING (user_id = auth.uid());

CREATE POLICY plugin_states_insert ON public.plugin_states
  FOR INSERT  WITH CHECK (user_id = auth.uid());

CREATE POLICY plugin_states_update ON public.plugin_states
  FOR UPDATE  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────
-- pioneer_games  (text user_id)
-- ────────────────────────────────────────────────────────────────────────────
-- Existing policies relied on a client-supplied request.headers value, which
-- the client controls and therefore cannot be trusted. Replace with proper
-- auth.uid()-scoped RLS.

DROP POLICY IF EXISTS "Users can read own games"   ON public.pioneer_games;
DROP POLICY IF EXISTS "Users can insert own games" ON public.pioneer_games;
DROP POLICY IF EXISTS "Users can update own games" ON public.pioneer_games;
DROP POLICY IF EXISTS pioneer_games_select         ON public.pioneer_games;
DROP POLICY IF EXISTS pioneer_games_insert         ON public.pioneer_games;
DROP POLICY IF EXISTS pioneer_games_update         ON public.pioneer_games;

CREATE POLICY pioneer_games_select ON public.pioneer_games
  FOR SELECT  USING (user_id = auth.uid()::text);

CREATE POLICY pioneer_games_insert ON public.pioneer_games
  FOR INSERT  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY pioneer_games_update ON public.pioneer_games
  FOR UPDATE  USING (user_id = auth.uid()::text);

-- ============================================================================
-- RPC rewrites
--
-- Every RPC below preserves its existing parameter signature so the client
-- code in treehouse-tokens/ does not need to change to call it. The client-
-- supplied caller-id parameter is now ignored entirely; auth.uid() is the
-- only source of caller identity.
-- ============================================================================

-- ── upsert_plugin_state ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_plugin_state(
  p_user_id   uuid,
  p_plugin_id text,
  p_state     jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller does not own this state';
  END IF;

  INSERT INTO public.plugin_states (user_id, plugin_id, state, updated_at)
  VALUES (p_user_id, p_plugin_id, p_state, now())
  ON CONFLICT (user_id, plugin_id)
  DO UPDATE SET state = EXCLUDED.state, updated_at = now();
END;
$$;

-- ── submit_assignment ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_assignment(
  p_caller_id      text,   -- IGNORED, kept for client compatibility
  p_assignment_id  uuid,
  p_student_notes  text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller        text;
  v_role          text;
  v_assignment    record;
  v_existing      record;
  v_submission_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  v_caller := auth.uid()::text;

  SELECT role INTO v_role FROM public.user_profiles WHERE user_id = v_caller;
  IF v_role IS NULL OR v_role <> 'student' THEN
    RETURN jsonb_build_object('error', 'Only students can submit assignments');
  END IF;

  SELECT * INTO v_assignment FROM public.assignments
    WHERE id = p_assignment_id AND status = 'active';
  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('error', 'Assignment not found or not active');
  END IF;

  SELECT * INTO v_existing FROM public.assignment_submissions
    WHERE assignment_id = p_assignment_id AND student_id = v_caller;
  IF v_existing IS NOT NULL THEN
    IF v_existing.status = 'pending' THEN
      RETURN jsonb_build_object('error', 'Already submitted and waiting for review');
    END IF;
    IF v_existing.status = 'approved' THEN
      RETURN jsonb_build_object('error', 'Already approved');
    END IF;
    UPDATE public.assignment_submissions
       SET status = 'pending', student_notes = p_student_notes,
           submitted_at = now(), reviewed_at = NULL,
           teacher_notes = '', reviewed_by = NULL
     WHERE id = v_existing.id
     RETURNING id INTO v_submission_id;
    RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id, 'resubmission', true);
  END IF;

  INSERT INTO public.assignment_submissions (assignment_id, student_id, student_notes)
    VALUES (p_assignment_id, v_caller, p_student_notes)
    RETURNING id INTO v_submission_id;

  RETURN jsonb_build_object('success', true, 'submission_id', v_submission_id);
END;
$$;

-- ── create_assignment ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_assignment(
  p_caller_id   text,                                  -- IGNORED
  p_title       text,
  p_description text DEFAULT '',
  p_subject     text DEFAULT 'general',
  p_token_value integer DEFAULT 10,
  p_due_date    timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller        text;
  v_assignment_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT public.is_teacher() THEN
    RETURN jsonb_build_object('error', 'Only teachers can create assignments');
  END IF;
  v_caller := auth.uid()::text;

  INSERT INTO public.assignments (teacher_id, title, description, subject, token_value, due_date)
    VALUES (v_caller, p_title, p_description, p_subject, p_token_value, p_due_date)
    RETURNING id INTO v_assignment_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'title', p_title,
    'token_value', p_token_value
  );
END;
$$;

-- ── approve_submission ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_submission(
  p_caller_id     uuid,   -- IGNORED
  p_submission_id uuid,
  p_teacher_notes text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status        text;
  v_student_id    text;
  v_assignment_id uuid;
  v_token_value   integer;
  v_pet_new_xp    integer;
  v_pet_new_stage text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  IF NOT public.is_teacher() THEN
    RETURN json_build_object('error', 'Only teachers can approve submissions');
  END IF;

  SELECT status, student_id, assignment_id
    INTO v_status, v_student_id, v_assignment_id
    FROM public.assignment_submissions
   WHERE id = p_submission_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Submission not found');
  END IF;
  IF v_status <> 'pending' THEN
    RETURN json_build_object('error', format('Submission is not pending (current status: %s)', v_status));
  END IF;

  SELECT token_value INTO v_token_value
    FROM public.assignments
   WHERE id = v_assignment_id;

  IF NOT FOUND OR v_token_value IS NULL THEN
    RETURN json_build_object('error', 'Assignment not found or has no token value');
  END IF;

  UPDATE public.assignment_submissions
     SET status        = 'approved',
         teacher_notes = p_teacher_notes,
         reviewed_at   = now(),
         reviewed_by   = auth.uid()::text
   WHERE id = p_submission_id;

  -- token_wallets/token_transactions use text user_id
  INSERT INTO public.token_transactions (user_id, type, amount, reason, subject)
  VALUES (v_student_id, 'earn', v_token_value, 'Assignment approved', (
    SELECT subject FROM public.assignments WHERE id = v_assignment_id
  ));

  UPDATE public.token_wallets
     SET balance         = balance + v_token_value,
         lifetime_earned = lifetime_earned + v_token_value
   WHERE user_id = v_student_id;

  -- pets.user_id is uuid; cast text → uuid
  UPDATE public.pets
     SET xp           = xp + 20,
         happiness    = LEAST(100, happiness + 10),
         growth_stage = CASE
           WHEN xp + 20 >= 300 THEN 'adult'
           WHEN xp + 20 >= 100 THEN 'junior'
           ELSE 'puppy'
         END
   WHERE user_id = v_student_id::uuid
   RETURNING xp, growth_stage INTO v_pet_new_xp, v_pet_new_stage;

  RETURN json_build_object(
    'success', true,
    'submission_id',  p_submission_id,
    'tokens_awarded', v_token_value,
    'pet_xp',         v_pet_new_xp,
    'pet_stage',      v_pet_new_stage
  );
END;
$$;

-- ── reject_submission ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reject_submission(
  p_caller_id     text,   -- IGNORED
  p_submission_id uuid,
  p_teacher_notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT public.is_teacher() THEN
    RETURN jsonb_build_object('error', 'Only teachers can reject submissions');
  END IF;

  SELECT s.id AS sub_id, s.status AS sub_status, a.title
    INTO v_sub
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
   WHERE s.id = p_submission_id;

  IF v_sub IS NULL THEN
    RETURN jsonb_build_object('error', 'Submission not found');
  END IF;
  IF v_sub.sub_status <> 'pending' THEN
    RETURN jsonb_build_object('error', 'Submission is not pending');
  END IF;

  UPDATE public.assignment_submissions
     SET status        = 'rejected',
         teacher_notes = p_teacher_notes,
         reviewed_at   = now(),
         reviewed_by   = auth.uid()::text
   WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true, 'assignment_title', v_sub.title);
END;
$$;

-- ── redeem_reward (new — was missing in production) ────────────────────────

CREATE OR REPLACE FUNCTION public.redeem_reward(
  p_user_id     text,   -- IGNORED, kept for client compatibility
  p_reward_id   text,
  p_reward_name text,
  p_cost        integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller   text;
  v_balance  integer;
  v_redeemed text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;
  v_caller := auth.uid()::text;

  SELECT balance, redeemed_rewards
    INTO v_balance, v_redeemed
    FROM public.token_wallets
   WHERE user_id = v_caller
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Wallet not found');
  END IF;

  IF v_balance < p_cost THEN
    RETURN json_build_object('error',
      format('Not enough tokens. Need %s, have %s.', p_cost, v_balance));
  END IF;

  -- token_transactions: use only the columns we know exist in production
  -- (user_id, type, amount, reason, subject from approve_submission's body).
  INSERT INTO public.token_transactions (user_id, type, amount, reason, subject)
  VALUES (v_caller, 'redeem', p_cost, 'Redeemed: ' || p_reward_name, p_reward_id);

  UPDATE public.token_wallets
     SET balance          = balance - p_cost,
         redeemed_rewards = array_append(redeemed_rewards, p_reward_id)
   WHERE user_id = v_caller;

  RETURN json_build_object(
    'success',     true,
    'redeemed',    p_reward_name,
    'cost',        p_cost,
    'new_balance', v_balance - p_cost
  );
END;
$$;

-- ── get_leaderboard (new — sanitized public ranking view) ──────────────────

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit integer DEFAULT 20)
RETURNS TABLE(display_name text, lifetime_earned integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT up.display_name, COALESCE(tw.lifetime_earned, 0) AS lifetime_earned
    FROM public.user_profiles up
    LEFT JOIN public.token_wallets tw ON tw.user_id = up.user_id
   WHERE up.role = 'student'
   ORDER BY COALESCE(tw.lifetime_earned, 0) DESC
   LIMIT p_limit;
$$;

-- ── Grants ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.upsert_plugin_state(uuid, text, jsonb)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_assignment(text, uuid, text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_assignment(text, text, text, text, integer, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_submission(uuid, uuid, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_submission(text, uuid, text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(text, text, text, integer)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer)                             TO authenticated;

COMMIT;
