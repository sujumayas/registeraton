-- =====================================================
-- DEBUG RLS ISSUE
-- Run this to diagnose the 403 error
-- =====================================================

-- 1. Check your user profile
SELECT
    'USER PROFILE' as check_type,
    id,
    email,
    full_name,
    role,
    organization_id
FROM public.users
WHERE id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- 2. Check the event you're trying to delete
SELECT
    'EVENT INFO' as check_type,
    id,
    name,
    organization_id,
    created_by,
    is_deleted
FROM events
WHERE id = '50970211-27aa-44fc-a861-020555cce38c';

-- 3. Check if organizations exist
SELECT
    'ORGANIZATIONS' as check_type,
    id,
    name
FROM organizations;

-- 4. Test the helper functions
SELECT
    'HELPER FUNCTIONS' as check_type,
    public.user_organization_id() as user_org_id,
    public.is_admin() as is_admin,
    auth.uid() as auth_uid;

-- 5. Check all your events and their organizations
SELECT
    'YOUR EVENTS' as check_type,
    id,
    name,
    organization_id,
    created_by,
    is_deleted
FROM events
WHERE created_by = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- 6. Check RLS policies on events table
SELECT
    'RLS POLICIES' as check_type,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'events';
