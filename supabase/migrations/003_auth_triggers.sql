-- =====================================================
-- Migration: Auth Triggers and Functions
-- Description: Automatic user profile creation on signup
-- =====================================================

-- =====================================================
-- FUNCTION: Handle new user signup
-- =====================================================

-- This function is triggered when a new user signs up via Supabase Auth
-- It creates a corresponding record in the public.users table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    user_full_name TEXT;
    user_role user_role;
BEGIN
    -- Extract metadata from auth.users
    -- Expected metadata format: { organization_id: "uuid", full_name: "Name", role: "admin"|"assistant" }
    org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    user_full_name := NEW.raw_user_meta_data->>'full_name';
    user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'assistant');

    -- If no organization_id provided, try to get a default organization
    -- or create one if none exists
    IF org_id IS NULL THEN
        -- Check if there's a default organization
        SELECT id INTO org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;

        -- If no default organization exists, create one
        IF org_id IS NULL THEN
            INSERT INTO organizations (name) VALUES ('Default Organization')
            RETURNING id INTO org_id;
        END IF;
    END IF;

    -- Use email as full_name fallback if not provided
    IF user_full_name IS NULL THEN
        user_full_name := NEW.email;
    END IF;

    -- Insert into public.users
    INSERT INTO public.users (id, email, full_name, role, organization_id)
    VALUES (
        NEW.id,
        NEW.email,
        user_full_name,
        user_role,
        org_id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: On new user signup
-- =====================================================

-- Create trigger to automatically create user profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- FUNCTION: Get or create default organization
-- =====================================================

-- Helper function to ensure a default organization exists
CREATE OR REPLACE FUNCTION public.ensure_default_organization()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Try to get existing default organization
    SELECT id INTO org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;

    -- Create if doesn't exist
    IF org_id IS NULL THEN
        INSERT INTO organizations (name) VALUES ('Default Organization')
        RETURNING id INTO org_id;
    END IF;

    RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Manually create user profile (fallback)
-- =====================================================

-- Function to manually create a user profile if trigger fails
-- or for migrating existing auth users
CREATE OR REPLACE FUNCTION public.create_user_profile(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT,
    user_role user_role DEFAULT 'assistant',
    org_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    final_org_id UUID;
BEGIN
    -- Use provided org_id or get default
    IF org_id IS NULL THEN
        final_org_id := public.ensure_default_organization();
    ELSE
        final_org_id := org_id;
    END IF;

    -- Insert user profile
    INSERT INTO public.users (id, email, full_name, role, organization_id)
    VALUES (user_id, user_email, user_full_name, user_role, final_org_id)
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        organization_id = EXCLUDED.organization_id,
        updated_at = NOW();

    RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- INITIAL DATA: Create default organization
-- =====================================================

-- Ensure default organization exists for initial setup
INSERT INTO organizations (name) VALUES ('Default Organization')
ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.handle_new_user IS 'Automatically creates a user profile when someone signs up via Supabase Auth';
COMMENT ON FUNCTION public.ensure_default_organization IS 'Returns the default organization ID, creating it if it does not exist';
COMMENT ON FUNCTION public.create_user_profile IS 'Manually creates or updates a user profile - useful for migrations or manual setup';
