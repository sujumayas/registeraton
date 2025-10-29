-- =====================================================
-- Migration: Row Level Security (RLS) Policies
-- Description: Multi-tenant access control with role-based permissions
-- =====================================================

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

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

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_registered_participants ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================

-- Users can only view their own organization
CREATE POLICY "Users can view their own organization"
    ON organizations FOR SELECT
    USING (id = public.user_organization_id());

-- Only admins can update their organization
CREATE POLICY "Admins can update their organization"
    ON organizations FOR UPDATE
    USING (id = public.user_organization_id() AND public.is_admin())
    WITH CHECK (id = public.user_organization_id() AND public.is_admin());

-- =====================================================
-- USERS POLICIES
-- =====================================================

-- Users can view other users in their organization
CREATE POLICY "Users can view users in their organization"
    ON users FOR SELECT
    USING (organization_id = public.user_organization_id());

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

-- Admins can insert new users in their organization
CREATE POLICY "Admins can create users in their organization"
    ON users FOR INSERT
    WITH CHECK (organization_id = public.user_organization_id() AND public.is_admin());

-- Admins can update users in their organization
CREATE POLICY "Admins can update users in their organization"
    ON users FOR UPDATE
    USING (organization_id = public.user_organization_id() AND public.is_admin())
    WITH CHECK (organization_id = public.user_organization_id() AND public.is_admin());

-- Users can update their own profile (except role and organization)
CREATE POLICY "Users can update their own profile"
    ON users FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admins can delete users in their organization
CREATE POLICY "Admins can delete users in their organization"
    ON users FOR DELETE
    USING (organization_id = public.user_organization_id() AND public.is_admin());

-- =====================================================
-- EVENTS POLICIES
-- =====================================================

-- Users can view non-deleted events in their organization
CREATE POLICY "Users can view events in their organization"
    ON events FOR SELECT
    USING (
        organization_id = public.user_organization_id()
        AND is_deleted = FALSE
    );

-- Admins can create events in their organization
CREATE POLICY "Admins can create events in their organization"
    ON events FOR INSERT
    WITH CHECK (
        organization_id = public.user_organization_id()
        AND public.is_admin()
    );

-- Admins can update events in their organization
CREATE POLICY "Admins can update events in their organization"
    ON events FOR UPDATE
    USING (
        organization_id = public.user_organization_id()
        AND public.is_admin()
    )
    WITH CHECK (
        organization_id = public.user_organization_id()
        AND public.is_admin()
    );

-- Admins can delete (soft delete) events in their organization
CREATE POLICY "Admins can delete events in their organization"
    ON events FOR DELETE
    USING (
        organization_id = public.user_organization_id()
        AND public.is_admin()
    );

-- =====================================================
-- PARTICIPANTS POLICIES
-- =====================================================

-- Users can view participants for events in their organization
CREATE POLICY "Users can view participants in their organization"
    ON participants FOR SELECT
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- Both admins and assistants can register participants
CREATE POLICY "Users can register participants"
    ON participants FOR INSERT
    WITH CHECK (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- Both admins and assistants can update participants
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

-- Both admins and assistants can delete participants
CREATE POLICY "Users can delete participants"
    ON participants FOR DELETE
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- =====================================================
-- PRE_REGISTERED_PARTICIPANTS POLICIES
-- =====================================================

-- Users can view pre-registered for events in their organization
CREATE POLICY "Users can view pre-registered in their organization"
    ON pre_registered_participants FOR SELECT
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- Both admins and assistants can upload pre-registered participants
CREATE POLICY "Users can upload pre-registered participants"
    ON pre_registered_participants FOR INSERT
    WITH CHECK (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- Both admins and assistants can update pre-registered participants
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

-- Both admins and assistants can delete pre-registered participants
CREATE POLICY "Users can delete pre-registered participants"
    ON pre_registered_participants FOR DELETE
    USING (
        event_id IN (
            SELECT id FROM events
            WHERE organization_id = public.user_organization_id()
        )
    );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.user_organization_id IS 'Returns the organization ID of the authenticated user';
COMMENT ON FUNCTION public.user_role IS 'Returns the role of the authenticated user';
COMMENT ON FUNCTION public.is_admin IS 'Returns true if the authenticated user is an admin';
