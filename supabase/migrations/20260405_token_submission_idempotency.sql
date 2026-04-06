-- Idempotent approve/reject submission RPCs.
-- Prevents double-approval (tokens awarded twice) and double-rejection
-- by checking status = 'pending' under row-level lock before proceeding.
-- Modeled after redeem_reward_atomic.sql pattern.

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
BEGIN
  -- Lock the submission row to prevent concurrent approvals
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

  -- Look up token value from the assignment
  SELECT token_value INTO v_token_value
    FROM assignments
   WHERE id = v_assignment_id;

  IF NOT FOUND OR v_token_value IS NULL THEN
    RETURN json_build_object('error', 'Assignment not found or has no token value');
  END IF;

  -- Mark submission as approved
  UPDATE assignment_submissions
     SET status = 'approved',
         teacher_notes = p_teacher_notes,
         reviewed_at = now()
   WHERE id = p_submission_id;

  -- Award tokens to student
  INSERT INTO token_transactions (user_id, type, amount, reason, subject)
  VALUES (v_student_id, 'earn', v_token_value, 'Assignment approved', (
    SELECT subject FROM assignments WHERE id = v_assignment_id
  ));

  UPDATE token_wallets
     SET balance = balance + v_token_value,
         lifetime_earned = lifetime_earned + v_token_value
   WHERE user_id = v_student_id;

  RETURN json_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'tokens_awarded', v_token_value
  );
END;
$$;


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
  -- Lock the submission row to prevent concurrent status changes
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
