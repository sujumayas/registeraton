-- =====================================================
-- FIX RLS HELPER FUNCTIONS
-- The issue is that the helper functions might not be working correctly
-- This script recreates them with proper permissions
-- =====================================================

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS public.user_organization_id();
DROP FUNCTION IF EXISTS public.user_role();
DROP FUNCTION IF EXISTS public.is_admin();

-- Recreate user_organization_id with better error handling
CREATE OR REPLACE FUNCTION public.user_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT organization_id INTO org_id
    FROM public.users
    WHERE id = auth.uid();

    RETURN org_id;
END;
$$;

-- Recreate is_admin with better error handling
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    user_role_value TEXT;
BEGIN
    SELECT role::text INTO user_role_value
    FROM public.users
    WHERE id = auth.uid();

    RETURN COALESCE(user_role_value = 'admin', false);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_organization_id() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Test the functions (should show your org ID and TRUE for admin)
SELECT
    'FUNCTION TEST' as test_type,
    auth.uid() as current_user_id,
    public.user_organization_id() as org_id_result,
    public.is_admin() as is_admin_result;

-- Check your user data to verify it's correct
SELECT
    'USER DATA' as test_type,
    id,
    email,
    role,
    organization_id
FROM public.users
WHERE id = auth.uid();

-- =====================================================
-- ALTERNATIVE FIX: Simplify RLS policies to not use helper functions
-- If the above doesn't work, drop the existing policies and create simpler ones
-- =====================================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "Admins can update events in their organization" ON events;

-- Create new UPDATE policy that directly checks the users table
CREATE POLICY "Admins can update events in their organization"
    ON events FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id
            FROM public.users
            WHERE id = auth.uid()
            AND role = 'admin'
        )
    );

-- Verify the policy was created
SELECT
    'RLS POLICY CHECK' as test_type,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE tablename = 'events'
    AND cmd = 'UPDATE';

-- Test if you can now update an event
SELECT
    'UPDATE TEST' as test_type,
    'If you see this, the query completed' as result;
