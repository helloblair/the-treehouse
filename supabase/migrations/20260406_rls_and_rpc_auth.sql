-- ============================================================================
-- Row-Level Security (RLS) for all Treehouse tables
-- COPPA compliance: every child can only read/write their own data.
-- Teachers can read student data for classroom management.
-- ============================================================================

-- Helper: checks if the calling user has the 'teacher' role in user_profiles.
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
      AND role = 'teacher'
  );
$$;


-- ── user_profiles ──────────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; teachers can read all profiles
CREATE POLICY user_profiles_select ON user_profiles
  FOR SELECT USING (
    user_id = auth.uid() OR is_teacher()
  );

-- Users can only update their own profile
CREATE POLICY user_profiles_update ON user_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- Users can insert their own profile (signup)
CREATE POLICY user_profiles_insert ON user_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());


-- ── pets ───────────────────────────────────────────────────────────────────
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

-- Students see only their own pet; teachers can see all
CREATE POLICY pets_select ON pets
  FOR SELECT USING (
    user_id = auth.uid()::text OR is_teacher()
  );

CREATE POLICY pets_insert ON pets
  FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY pets_update ON pets
  FOR UPDATE USING (user_id = auth.uid()::text);


-- ── token_wallets ──────────────────────────────────────────────────────────
ALTER TABLE token_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY token_wallets_select ON token_wallets
  FOR SELECT USING (
    user_id = auth.uid() OR is_teacher()
  );

CREATE POLICY token_wallets_insert ON token_wallets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Students cannot update their own wallet directly (only via RPC)
-- Teachers need update for classroom management
CREATE POLICY token_wallets_update ON token_wallets
  FOR UPDATE USING (is_teacher());


-- ── token_transactions ─────────────────────────────────────────────────────
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY token_transactions_select ON token_transactions
  FOR SELECT USING (
    user_id = auth.uid() OR is_teacher()
  );

-- Only RPCs (SECURITY DEFINER) insert transactions, not direct client calls
CREATE POLICY token_transactions_insert ON token_transactions
  FOR INSERT WITH CHECK (false);


-- ── assignments ────────────────────────────────────────────────────────────
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see assignments
CREATE POLICY assignments_select ON assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only teachers can create assignments
CREATE POLICY assignments_insert ON assignments
  FOR INSERT WITH CHECK (is_teacher());

CREATE POLICY assignments_update ON assignments
  FOR UPDATE USING (is_teacher());


-- ── assignment_submissions ─────────────────────────────────────────────────
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Students see their own submissions; teachers see all
CREATE POLICY submissions_select ON assignment_submissions
  FOR SELECT USING (
    student_id = auth.uid() OR is_teacher()
  );

-- Students can insert their own submissions
CREATE POLICY submissions_insert ON assignment_submissions
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Only teachers can update submissions (approve/reject)
CREATE POLICY submissions_update ON assignment_submissions
  FOR UPDATE USING (is_teacher());


-- ── plugin_states ──────────────────────────────────────────────────────────
ALTER TABLE plugin_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY plugin_states_select ON plugin_states
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY plugin_states_insert ON plugin_states
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY plugin_states_update ON plugin_states
  FOR UPDATE USING (user_id = auth.uid());


-- ============================================================================
-- Fix RPC functions: validate auth.uid() matches the caller
-- Prevents user A from calling RPCs on behalf of user B.
-- ============================================================================

-- ── redeem_reward: validate caller is the wallet owner ──
CREATE OR REPLACE FUNCTION redeem_reward(
  p_user_id uuid,
  p_reward_id text,
  p_reward_name text,
  p_cost integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
  v_redeemed text[];
BEGIN
  -- Auth check: caller must be the wallet owner
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;

  SELECT balance, redeemed_rewards
    INTO v_balance, v_redeemed
    FROM token_wallets
   WHERE user_id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Wallet not found');
  END IF;

  IF v_balance < p_cost THEN
    RETURN json_build_object('error', format('Not enough tokens. Need %s, have %s.', p_cost, v_balance));
  END IF;

  INSERT INTO token_transactions (user_id, type, amount, reason, reward_id)
  VALUES (p_user_id, 'redeem', p_cost, 'Redeemed: ' || p_reward_name, p_reward_id);

  UPDATE token_wallets
     SET balance = balance - p_cost,
         redeemed_rewards = array_append(redeemed_rewards, p_reward_id)
   WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'redeemed', p_reward_name,
    'cost', p_cost,
    'new_balance', v_balance - p_cost
  );
END;
$$;


-- ── upsert_plugin_state: validate caller owns the state ──
CREATE OR REPLACE FUNCTION upsert_plugin_state(
  p_user_id   UUID,
  p_plugin_id TEXT,
  p_state     JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Auth check: caller must be the state owner
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller does not own this state';
  END IF;

  INSERT INTO plugin_states (user_id, plugin_id, state, updated_at)
  VALUES (p_user_id, p_plugin_id, p_state, now())
  ON CONFLICT (user_id, plugin_id)
  DO UPDATE SET state = p_state, updated_at = now();
END;
$$;


-- ── approve_submission: validate caller is a teacher ──
CREATE OR REPLACE FUNCTION approve_submission(
  p_caller_id  UUID,
  p_submission_id UUID,
  p_teacher_notes TEXT DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
  v_student_id UUID;
  v_assignment_id UUID;
  v_token_value INTEGER;
  v_pet_new_xp INTEGER;
  v_pet_new_stage TEXT;
BEGIN
  -- Auth check: caller must be a teacher
  IF auth.uid() IS NULL OR auth.uid() != p_caller_id THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  IF NOT is_teacher() THEN
    RETURN json_build_object('error', 'Only teachers can approve submissions');
  END IF;

  SELECT status, student_id, assignment_id
    INTO v_status, v_student_id, v_assignment_id
    FROM assignment_submissions
   WHERE id = p_submission_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Submission not found');
  END IF;

  IF v_status != 'pending' THEN
    RETURN json_build_object('error', format('Submission is not pending (current status: %s)', v_status));
  END IF;

  SELECT token_value INTO v_token_value
    FROM assignments
   WHERE id = v_assignment_id;

  IF NOT FOUND OR v_token_value IS NULL THEN
    RETURN json_build_object('error', 'Assignment not found or has no token value');
  END IF;

  UPDATE assignment_submissions
     SET status = 'approved',
         teacher_notes = p_teacher_notes,
         reviewed_at = now()
   WHERE id = p_submission_id;

  INSERT INTO token_transactions (user_id, type, amount, reason, subject)
  VALUES (v_student_id, 'earn', v_token_value, 'Assignment approved', (
    SELECT subject FROM assignments WHERE id = v_assignment_id
  ));

  UPDATE token_wallets
     SET balance = balance + v_token_value,
         lifetime_earned = lifetime_earned + v_token_value
   WHERE user_id = v_student_id;

  UPDATE pets
     SET xp = xp + 20,
         happiness = LEAST(100, happiness + 10),
         growth_stage = CASE
           WHEN xp + 20 >= 300 THEN 'adult'
           WHEN xp + 20 >= 100 THEN 'junior'
           ELSE 'puppy'
         END
   WHERE user_id = v_student_id::text
  RETURNING xp, growth_stage INTO v_pet_new_xp, v_pet_new_stage;

  RETURN json_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'tokens_awarded', v_token_value,
    'pet_xp', v_pet_new_xp,
    'pet_stage', v_pet_new_stage
  );
END;
$$;


-- ── reject_submission: validate caller is a teacher ──
CREATE OR REPLACE FUNCTION reject_submission(
  p_caller_id  UUID,
  p_submission_id UUID,
  p_teacher_notes TEXT DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status TEXT;
BEGIN
  -- Auth check: caller must be a teacher
  IF auth.uid() IS NULL OR auth.uid() != p_caller_id THEN
    RETURN json_build_object('error', 'Unauthorized');
  END IF;
  IF NOT is_teacher() THEN
    RETURN json_build_object('error', 'Only teachers can reject submissions');
  END IF;

  SELECT status INTO v_status
    FROM assignment_submissions
   WHERE id = p_submission_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Submission not found');
  END IF;

  IF v_status != 'pending' THEN
    RETURN json_build_object('error', format('Submission is not pending (current status: %s)', v_status));
  END IF;

  UPDATE assignment_submissions
     SET status = 'rejected',
         teacher_notes = p_teacher_notes,
         reviewed_at = now()
   WHERE id = p_submission_id;

  RETURN json_build_object(
    'success', true,
    'submission_id', p_submission_id
  );
END;
$$;
