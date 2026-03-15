-- Migration: Create function to get top Axiom users
-- Run this on your Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_top_axiom_users(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(user_id UUID, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    axiom_daily_briefs.user_id,
    COUNT(*)::BIGINT as count
  FROM axiom_daily_briefs
  GROUP BY axiom_daily_briefs.user_id
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_top_axiom_users(INTEGER) TO authenticated;

COMMENT ON FUNCTION get_top_axiom_users IS 'Returns top users by number of Axiom daily briefs generated';
