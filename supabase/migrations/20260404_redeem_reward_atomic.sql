-- Atomic reward redemption: checks balance, inserts transaction, decrements wallet in one call.
-- Prevents double-spend via row-level locking (SELECT ... FOR UPDATE).
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
  -- Lock the wallet row to prevent concurrent redemptions
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

  -- Insert transaction record
  INSERT INTO token_transactions (user_id, type, amount, reason, reward_id)
  VALUES (p_user_id, 'redeem', p_cost, 'Redeemed: ' || p_reward_name, p_reward_id);

  -- Decrement balance atomically
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


-- Negative balance guard: prevents any update from setting balance below 0.
-- This is a safety net — the RPC above handles the check, but this catches
-- any direct UPDATE or other code path that might bypass the check.
CREATE OR REPLACE FUNCTION prevent_negative_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Balance cannot go below 0 (attempted: %)', NEW.balance;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS check_balance_non_negative ON token_wallets;
CREATE TRIGGER check_balance_non_negative
  BEFORE UPDATE ON token_wallets
  FOR EACH ROW
  EXECUTE FUNCTION prevent_negative_balance();
