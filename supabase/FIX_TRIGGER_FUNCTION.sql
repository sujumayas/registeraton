-- =====================================================
-- FIX: Update trigger function to use schema-qualified types
-- This fixes the "type user_role does not exist" error
-- =====================================================

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the function with explicit search_path and schema qualification
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    org_id UUID;
    user_full_name TEXT;
    user_role_value TEXT;  -- Changed from user_role type to TEXT
BEGIN
    -- Extract metadata from auth.users
    org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    user_full_name := NEW.raw_user_meta_data->>'full_name';
    user_role_value := COALESCE(NEW.raw_user_meta_data->>'role', 'assistant');

    -- If no organization_id provided, get/create default organization
    IF org_id IS NULL THEN
        SELECT id INTO org_id FROM public.organizations WHERE name = 'Default Organization' LIMIT 1;

        IF org_id IS NULL THEN
            INSERT INTO public.organizations (name) VALUES ('Default Organization')
            RETURNING id INTO org_id;
        END IF;
    END IF;

    -- Use email as full_name fallback if not provided
    IF user_full_name IS NULL THEN
        user_full_name := NEW.email;
    END IF;

    -- Insert into public.users (cast the text to user_role enum)
    INSERT INTO public.users (id, email, full_name, role, organization_id)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        user_role_value::public.user_role,  -- Explicit schema qualification
        org_id
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error for debugging
        RAISE LOG 'Error in handle_new_user: % %', SQLERRM, SQLSTATE;
        RAISE;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Verify the function exists
SELECT
    'Trigger function recreated successfully' as status,
    proname as function_name,
    prosrc as function_body
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Verify the trigger exists
SELECT
    'Trigger recreated successfully' as status,
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
