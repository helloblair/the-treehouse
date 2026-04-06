-- Award pet XP when a teacher approves a student's assignment submission.
-- Replaces approve_submission to atomically award both tokens AND pet XP (+20)
-- with growth-stage promotion (puppy → junior @ 100, junior → adult @ 300).

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

  -- Award tokens to student (token_wallets/token_transactions use TEXT user_id)
  INSERT INTO token_transactions (user_id, type, amount, reason, subject)
  VALUES (v_student_id::text, 'earn', v_token_value, 'Assignment approved', (
    SELECT subject FROM assignments WHERE id = v_assignment_id
  ));

  UPDATE token_wallets
     SET balance = balance + v_token_value,
         lifetime_earned = lifetime_earned + v_token_value
   WHERE user_id = v_student_id::text;

  -- Award XP to student's pet (+20 XP, +10 happiness, auto-evolve)
  -- pets.user_id is UUID, no cast needed
  UPDATE pets
     SET xp = xp + 20,
         happiness = LEAST(100, happiness + 10),
         growth_stage = CASE
           WHEN xp + 20 >= 300 THEN 'adult'
           WHEN xp + 20 >= 100 THEN 'junior'
           ELSE 'puppy'
         END
   WHERE user_id = v_student_id
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
