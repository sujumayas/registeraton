-- =====================================================
-- DIAGNOSTIC QUERY
-- Run this to check current database state
-- =====================================================

-- Check if enums exist and in which schema
SELECT
    n.nspname as schema,
    t.typname as type_name,
    t.oid
FROM pg_type t
LEFT JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname IN ('user_role', 'participant_type', 'identifier_type')
ORDER BY t.typname;

-- Check if tables exist
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_name IN ('organizations', 'users', 'events', 'participants', 'pre_registered_participants')
ORDER BY table_name;

-- Check if trigger exists
SELECT
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if functions exist
SELECT
    n.nspname as schema,
    p.proname as function_name
FROM pg_proc p
LEFT JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('handle_new_user', 'user_organization_id', 'user_role', 'is_admin')
ORDER BY p.proname;

-- Try to see what's in the auth schema
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE schemaname = 'auth'
ORDER BY tablename;
