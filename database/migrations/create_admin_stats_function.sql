-- Admin statistics function
-- Gets all users with their credits usage breakdown

CREATE OR REPLACE FUNCTION get_users_credits_stats()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    full_name TEXT,
    total_credits_used DECIMAL,
    credits_by_service JSONB,
    total_requests INTEGER,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.email,
        u.raw_user_meta_data->>'full_name' as full_name,
        COALESCE(uc.credits_used, 0) as total_credits_used,
        COALESCE(
            (
                SELECT jsonb_object_agg(service_type, total_cost)
                FROM (
                    SELECT 
                        cu.service_type,
                        SUM(cu.credits_spent) as total_cost
                    FROM credits_usage cu
                    WHERE cu.user_id = u.id
                    GROUP BY cu.service_type
                ) service_totals
            ),
            '{}'::jsonb
        ) as credits_by_service,
        COALESCE(
            (SELECT COUNT(*)::INTEGER FROM credits_usage WHERE user_id = u.id),
            0
        ) as total_requests,
        (
            SELECT MAX(created_at) 
            FROM credits_usage 
            WHERE user_id = u.id
        ) as last_activity
    FROM auth.users u
    LEFT JOIN user_credits uc ON uc.user_id = u.id
    ORDER BY uc.credits_used DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users (will be restricted by API auth)
GRANT EXECUTE ON FUNCTION get_users_credits_stats() TO authenticated;

COMMENT ON FUNCTION get_users_credits_stats IS 'Admin function to get all users with credits statistics';
