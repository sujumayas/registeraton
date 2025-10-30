-- =====================================================
-- IDEMPOTENT MIGRATION FOR SUPABASE
-- This migration can be run multiple times safely
-- Run this entire file in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension (safe to run multiple times)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS (only create if they don't exist)
-- =====================================================

-- User roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'assistant');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Participant types
DO $$ BEGIN
    CREATE TYPE participant_type AS ENUM ('lead', 'participant', 'attendee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Identifier types
DO $$ BEGIN
    CREATE TYPE identifier_type AS ENUM ('dni', 'email', 'name');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- TABLES (only create if they don't exist)
-- =====================================================

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'assistant',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    event_date DATE,
    description TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    participant_type participant_type NOT NULL DEFAULT 'participant',
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    dni TEXT,
    area TEXT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-registered Participants
CREATE TABLE IF NOT EXISTS pre_registered_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    identifier_type identifier_type NOT NULL,
    identifier_value TEXT NOT NULL,
    full_name TEXT,
    email TEXT,
    dni TEXT,
    area TEXT,
    raw_data JSONB,
    is_registered BOOLEAN NOT NULL DEFAULT FALSE,
    registered_participant_id UUID REFERENCES participants(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES (only create if they don't exist)
-- =====================================================

-- Organizations
CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

-- Users
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_organization ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_is_deleted ON events(is_deleted);
CREATE INDEX IF NOT EXISTS idx_events_org_active ON events(organization_id, is_deleted) WHERE is_deleted = FALSE;

-- Participants
CREATE INDEX IF NOT EXISTS idx_participants_event ON participants(event_id);
CREATE INDEX IF NOT EXISTS idx_participants_registered_by ON participants(registered_by);
CREATE INDEX IF NOT EXISTS idx_participants_type ON participants(participant_type);
CREATE INDEX IF NOT EXISTS idx_participants_email ON participants(email);

-- Pre-registered Participants
CREATE INDEX IF NOT EXISTS idx_prereg_event ON pre_registered_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_prereg_is_registered ON pre_registered_participants(is_registered);
CREATE INDEX IF NOT EXISTS idx_prereg_search ON pre_registered_participants(event_id, is_registered);
CREATE INDEX IF NOT EXISTS idx_prereg_identifier ON pre_registered_participants(identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_prereg_email ON pre_registered_participants(email);
CREATE INDEX IF NOT EXISTS idx_prereg_dni ON pre_registered_participants(dni);
CREATE INDEX IF NOT EXISTS idx_prereg_name ON pre_registered_participants(full_name);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get current user's organization ID
CREATE OR REPLACE FUNCTION public.user_organization_id()
RETURNS UUID AS $$
    SELECT organization_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role AS $$
    SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT role = 'admin' FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Get or create default organization
CREATE OR REPLACE FUNCTION public.ensure_default_organization()
RETURNS UUID AS $$
DECLARE
    org_id UUID;
BEGIN
    SELECT id INTO org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;

    IF org_id IS NULL THEN
        INSERT INTO organizations (name) VALUES ('Default Organization')
        RETURNING id INTO org_id;
    END IF;

    RETURN org_id;
END;
$$ LANGUAGE plpgsql;

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
    user_full_name TEXT;
    user_role user_role;
BEGIN
    -- Extract metadata from auth.users
    org_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
    user_full_name := NEW.raw_user_meta_data->>'full_name';
    user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'assistant');

    -- If no organization_id provided, get/create default organization
    IF org_id IS NULL THEN
        SELECT id INTO org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;

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

-- Manually create user profile (fallback)
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
    IF org_id IS NULL THEN
        final_org_id := public.ensure_default_organization();
    ELSE
        final_org_id := org_id;
    END IF;

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
-- TRIGGERS (only create if they don't exist)
-- =====================================================

-- Drop and recreate triggers to ensure they're up to date
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_participants_updated_at ON participants;
CREATE TRIGGER update_participants_updated_at
    BEFORE UPDATE ON participants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- ENABLE RLS
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_registered_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES (drop existing and recreate)
-- =====================================================

-- Organizations Policies
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view their own organization"
    ON organizations FOR SELECT
    USING (id = public.user_organization_id());

DROP POLICY IF EXISTS "Admins can update their organization" ON organizations;
CREATE POLICY "Admins can update their organization"
    ON organizations FOR UPDATE
    USING (id = public.user_organization_id() AND public.is_admin())
    WITH CHECK (id = public.user_organization_id() AND public.is_admin());

-- Users Policies
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization"
    ON users FOR SELECT
    USING (organization_id = public.user_organization_id());

DROP POLICY IF EXISTS "Users can view their own profile" ON users;
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

DROP POLICY IF EXISTS "Admins can create users in their organization" ON users;
CREATE POLICY "Admins can create users in their organization"
    ON users FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id() AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update users in their organization" ON users;
CREATE POLICY "Admins can update users in their organization"
    ON users FOR UPDATE
    USING (organization_id = public.user_organization_id() AND public.is_admin())
    WITH CHECK (organization_id = public.user_organization_id() AND public.is_admin());

DROP POLICY IF EXISTS "Users can update their own profile" ON users;
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can delete users in their organization" ON users;
CREATE POLICY "Admins can delete users in their organization"
    ON users FOR DELETE
    USING (organization_id = public.user_organization_id() AND public.is_admin());

-- Events Policies
DROP POLICY IF EXISTS "Users can view events in their organization" ON events;
CREATE POLICY "Users can view events in their organization"
    ON events FOR SELECT
    USING (organization_id = public.user_organization_id() AND is_deleted = FALSE);

DROP POLICY IF EXISTS "Admins can create events in their organization" ON events;
CREATE POLICY "Admins can create events in their organization"
    ON events FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id() AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update events in their organization" ON events;
CREATE POLICY "Admins can update events in their organization"
    ON events FOR UPDATE
    USING (organization_id = public.user_organization_id() AND public.is_admin())
    WITH CHECK (organization_id = public.user_organization_id() AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete events in their organization" ON events;
CREATE POLICY "Admins can delete events in their organization"
    ON events FOR DELETE
    USING (organization_id = public.user_organization_id() AND public.is_admin());

-- Participants Policies
DROP POLICY IF EXISTS "Users can view participants in their organization" ON participants;
CREATE POLICY "Users can view participants in their organization"
    ON participants FOR SELECT
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

DROP POLICY IF EXISTS "Users can register participants" ON participants;
CREATE POLICY "Users can register participants"
    ON participants FOR INSERT
    WITH CHECK (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

DROP POLICY IF EXISTS "Users can update participants" ON participants;
CREATE POLICY "Users can update participants"
    ON participants FOR UPDATE
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    )
    WITH CHECK (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

DROP POLICY IF EXISTS "Users can delete participants" ON participants;
CREATE POLICY "Users can delete participants"
    ON participants FOR DELETE
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- Pre-registered Participants Policies
DROP POLICY IF EXISTS "Users can view pre-registered in their organization" ON pre_registered_participants;
CREATE POLICY "Users can view pre-registered in their organization"
    ON pre_registered_participants FOR SELECT
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

DROP POLICY IF EXISTS "Users can upload pre-registered participants" ON pre_registered_participants;
CREATE POLICY "Users can upload pre-registered participants"
    ON pre_registered_participants FOR INSERT
    WITH CHECK (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

DROP POLICY IF EXISTS "Users can update pre-registered participants" ON pre_registered_participants;
CREATE POLICY "Users can update pre-registered participants"
    ON pre_registered_participants FOR UPDATE
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    )
    WITH CHECK (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

DROP POLICY IF EXISTS "Users can delete pre-registered participants" ON pre_registered_participants;
CREATE POLICY "Users can delete pre-registered participants"
    ON pre_registered_participants FOR DELETE
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Create default organization (only if it doesn't exist)
INSERT INTO organizations (name) VALUES ('Default Organization')
ON CONFLICT DO NOTHING;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

SELECT
    'user_role enum exists' as check_name,
    EXISTS(SELECT 1 FROM pg_type WHERE typname = 'user_role') as status
UNION ALL
SELECT
    'participant_type enum exists',
    EXISTS(SELECT 1 FROM pg_type WHERE typname = 'participant_type')
UNION ALL
SELECT
    'identifier_type enum exists',
    EXISTS(SELECT 1 FROM pg_type WHERE typname = 'identifier_type')
UNION ALL
SELECT
    'organizations table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations')
UNION ALL
SELECT
    'users table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
UNION ALL
SELECT
    'events table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events')
UNION ALL
SELECT
    'participants table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'participants')
UNION ALL
SELECT
    'pre_registered_participants table exists',
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pre_registered_participants')
UNION ALL
SELECT
    'Default Organization exists',
    EXISTS(SELECT 1 FROM organizations WHERE name = 'Default Organization')
UNION ALL
SELECT
    'Auth trigger exists',
    EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created');
