-- =====================================================
-- Migration: Initial Schema for Multi-Tenant Event Registration System
-- Description: Supabase PostgreSQL schema with organizations, users, events, participants
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'assistant');

-- Participant types (lead, participant, attendee)
CREATE TYPE participant_type AS ENUM ('lead', 'participant', 'attendee');

-- Identifier types for pre-registered participants
CREATE TYPE identifier_type AS ENUM ('dni', 'email', 'name');

-- =====================================================
-- TABLES
-- =====================================================

-- Organizations (teams/companies)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users (extends Supabase Auth)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'assistant',
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events
CREATE TABLE events (
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
CREATE TABLE participants (
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

-- Pre-registered Participants (uploaded from Excel)
CREATE TABLE pre_registered_participants (
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
-- INDEXES
-- =====================================================

-- Organizations
CREATE INDEX idx_organizations_name ON organizations(name);

-- Users
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Events
CREATE INDEX idx_events_organization ON events(organization_id);
CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_is_deleted ON events(is_deleted);
CREATE INDEX idx_events_org_active ON events(organization_id, is_deleted) WHERE is_deleted = FALSE;

-- Participants
CREATE INDEX idx_participants_event ON participants(event_id);
CREATE INDEX idx_participants_registered_by ON participants(registered_by);
CREATE INDEX idx_participants_type ON participants(participant_type);
CREATE INDEX idx_participants_email ON participants(email);

-- Pre-registered Participants
CREATE INDEX idx_prereg_event ON pre_registered_participants(event_id);
CREATE INDEX idx_prereg_is_registered ON pre_registered_participants(is_registered);
CREATE INDEX idx_prereg_search ON pre_registered_participants(event_id, is_registered);
CREATE INDEX idx_prereg_identifier ON pre_registered_participants(identifier_type, identifier_value);
CREATE INDEX idx_prereg_email ON pre_registered_participants(email);
CREATE INDEX idx_prereg_dni ON pre_registered_participants(dni);
CREATE INDEX idx_prereg_name ON pre_registered_participants(full_name);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to events
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to participants
CREATE TRIGGER update_participants_updated_at
    BEFORE UPDATE ON participants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE organizations IS 'Teams/companies that own events and users';
COMMENT ON TABLE users IS 'System users (admins and assistants) - extends Supabase Auth';
COMMENT ON TABLE events IS 'Events managed by organizations';
COMMENT ON TABLE participants IS 'Registered participants for events';
COMMENT ON TABLE pre_registered_participants IS 'Pre-registered participants uploaded from Excel files';

COMMENT ON COLUMN users.role IS 'admin: full access; assistant: can only register participants';
COMMENT ON COLUMN participants.participant_type IS 'Categorizes participants as lead, participant, or attendee';
COMMENT ON COLUMN pre_registered_participants.raw_data IS 'Original Excel row data stored as JSONB';
COMMENT ON COLUMN pre_registered_participants.is_registered IS 'Whether this pre-registered person has been converted to a participant';
