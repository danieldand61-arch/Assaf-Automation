-- RPC function to fetch id, email, full_name from auth.users
-- Run this in the Supabase SQL editor

CREATE OR REPLACE FUNCTION public.get_auth_users_info()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.id,
    au.email::text,
    (au.raw_user_meta_data ->> 'full_name')::text AS full_name,
    au.created_at
  FROM auth.users au
  ORDER BY au.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_users_info() TO service_role;
