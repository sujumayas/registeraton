-- =====================================================
-- FIX USER ORGANIZATION - Quick Fix
-- Description: Ensure user has organization_id set
-- Run this in Supabase SQL Editor
-- =====================================================

-- Step 1: Create default organization if it doesn't exist
INSERT INTO organizations (name)
VALUES ('Default Organization')
ON CONFLICT DO NOTHING;

-- Step 2: Update your user to have the organization_id
UPDATE public.users
SET
    role = 'admin',
    organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1)
WHERE id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';

-- Step 3: Update all your existing events to have the organization_id
UPDATE events
SET organization_id = (SELECT id FROM organizations WHERE name = 'Default Organization' LIMIT 1)
WHERE created_by = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49'
  AND organization_id IS NULL;

-- Step 4: Verify the fix worked
SELECT
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.organization_id,
    o.name as organization_name
FROM public.users u
LEFT JOIN organizations o ON o.id = u.organization_id
WHERE u.id = 'e08bfb81-9fcb-416d-b3ba-c6184d0bfc49';
