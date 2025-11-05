-- =====================================================
-- COMPLETE FIX - Diagnose and Fix RLS Issues
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- PART 1: DIAGNOSTIC - Check what tables exist
SELECT
    'TABLE CHECK' as check_type,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('users', 'profiles', 'events', 'organizations')
ORDER BY table_name;

-- PART 2: Check actual column names in the user table
SELECT
    'COLUMN CHECK' as check_type,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('users', 'profiles')
ORDER BY table_name, ordinal_position;

-- PART 3: Check your actual user data (try both table names)
-- Try 'users' table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        RAISE NOTICE 'Checking users table...';
    END IF;
END $$;

SELECT
    'USER DATA (users table)' as check_type,
    id,
    email,
    full_name,
    role,
    organization_id
FROM public.users
WHERE id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- Try 'profiles' table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        EXECUTE 'SELECT ''USER DATA (profiles table)'' as check_type, * FROM public.profiles WHERE id = ''e08bfb81-9fcb-416d-b3ba-c6184d0bfc49''';
    END IF;
END $$;

-- PART 4: Check the helper functions
SELECT
    'HELPER FUNCTIONS' as check_type,
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN ('user_organization_id', 'is_admin', 'user_role')
ORDER BY routine_name;

-- PART 5: Test if helper functions work
SELECT
    'FUNCTION TEST' as check_type,
    auth.uid() as current_auth_uid,
    (SELECT organization_id FROM public.users WHERE id = auth.uid()) as direct_org_id,
    (SELECT role FROM public.users WHERE id = auth.uid()) as direct_role;

-- PART 6: Check the problematic event
SELECT
    'EVENT DATA' as check_type,
    id,
    name,
    organization_id,
    created_by,
    is_deleted
FROM events
WHERE id = '50970211-27aa-44fc-a861-020555cce38c';

-- PART 7: Check all organizations
SELECT
    'ALL ORGANIZATIONS' as check_type,
    id,
    name,
    created_at
FROM organizations;

-- =====================================================
-- FIXES (run these after reviewing diagnostics above)
-- =====================================================

-- FIX 1: Ensure default organization exists
INSERT INTO organizations (name)
VALUES ('Default Organization')
ON CONFLICT DO NOTHING;

-- FIX 2: Update your user to have organization_id
UPDATE public.users
SET
    role = 'admin',
    organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1)
WHERE id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- FIX 3: Update ALL events to have the same organization_id
UPDATE events
SET organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1)
WHERE organization_id IS NULL
    OR created_by = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- FIX 4: Recreate helper functions to ensure they work correctly
CREATE OR REPLACE FUNCTION public.user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT COALESCE((SELECT role::text = 'admin' FROM public.users WHERE id = auth.uid()), false);
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- FIX 5: Verify the fix worked
SELECT
    'VERIFICATION' as check_type,
    u.id,
    u.email,
    u.role,
    u.organization_id,
    o.name as org_name,
    (SELECT COUNT(*) FROM events WHERE organization_id = u.organization_id) as events_in_org
FROM public.users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- FIX 6: Check if the specific event now has matching org
SELECT
    'EVENT VERIFICATION' as check_type,
    e.id,
    e.name,
    e.organization_id as event_org_id,
    u.organization_id as user_org_id,
    (e.organization_id = u.organization_id) as org_match,
    u.role as user_role
FROM events e
CROSS JOIN public.users u
WHERE e.id = '50970211-27aa-44fc-a861-020555cce38c'
    AND u.id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';
