-- =====================================================
-- FIX CURRENT USER PROFILE
-- Description: Check if your user exists in the users table and create if missing
-- =====================================================

-- Step 1: Check if your user exists in the users table
-- Replace 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49' with your actual user ID from the error
SELECT
    au.id,
    au.email,
    au.created_at as auth_created_at,
    u.id as user_profile_id,
    u.full_name,
    u.role,
    u.organization_id
FROM auth.users au
LEFT JOIN public.users u ON u.id = au.id
WHERE au.id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- If the above query shows NULL for user_profile_id, run the next query to create the profile

-- Step 2: Check if default organization exists
SELECT id, name FROM organizations WHERE name = 'Default Organization';

-- Step 3: If user doesn't exist in users table, create it
-- This uses the helper function from the auth triggers migration
SELECT create_user_profile(
    'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49'::uuid,  -- Replace with your user ID
    'eespinosa@intercorp.com.pe',  -- Replace with your actual email
    'Esen Espinosa',  -- Replace with your name
    'admin'::user_role,  -- Set to 'admin' or 'assistant'
    NULL  -- Will use default organization
);

-- Step 4: Verify the user was created
SELECT
    id,
    email,
    full_name,
    role,
    organization_id
FROM public.users
WHERE id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- =====================================================
-- ALTERNATIVE: If the helper function doesn't work, manually insert
-- =====================================================

-- First, ensure default organization exists
INSERT INTO organizations (name)
VALUES ('Default Organization')
ON CONFLICT DO NOTHING
RETURNING id;

-- Then manually insert user (get org_id from above query)
INSERT INTO public.users (id, email, full_name, role, organization_id)
VALUES (
    'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49'::uuid,
    'eespinosa@intercorp.com.pe',
    'Esen Espinosa',
    'admin'::user_role,
    (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1)
)
ON CONFLICT (id) DO UPDATE
SET
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id;
