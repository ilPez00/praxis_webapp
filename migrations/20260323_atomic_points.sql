-- Atomic point spending function to prevent race conditions
CREATE OR REPLACE FUNCTION spend_points(p_user_id UUID, p_amount INTEGER, p_boost_until TIMESTAMPTZ DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE profiles
  SET 
    praxis_points = praxis_points - p_amount,
    profile_boosted_until = COALESCE(p_boost_until, profile_boosted_until)
  WHERE id = p_user_id
    AND praxis_points >= p_amount
  RETURNING praxis_points INTO new_balance;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
