# Event Registration System with AI-Powered Pre-Registration

A modern, multi-event participant registration system with AI-powered Excel pre-registration processing, real-time updates, and secure authentication.

## Architecture

- **Frontend**: Static HTML/CSS/JavaScript (Vanilla JS, no framework)
- **Backend**: Supabase (PostgreSQL database + Authentication)
- **Serverless Functions**: Netlify Functions for AI processing
- **Hosting**: Netlify (static site hosting)
- **AI Processing**: Anthropic Claude 3.5 Sonnet via Netlify Function
- **Real-time**: Supabase Realtime subscriptions

## Features

### Multi-Event Management
- Create and manage multiple independent events
- Event dashboard with real-time statistics
- Event-specific participant tracking
- Role-based access control (Admin/Assistant)

### AI-Powered Pre-Registration
- **AI Excel Processing**: Upload Excel files and let Claude AI automatically:
  - Identify all columns in your spreadsheet
  - Determine the best identifier column (DNI > Email > Name)
  - Map columns to participant fields (name, email, DNI, area)
- **Smart Search**: Fast keyword search across all pre-registered participants
- **One-Click Registration**: Register participants with a single button click
- **Quick Add**: Add participants who didn't pre-register on the fly

### Authentication & Security
- Secure login with Supabase Auth
- Role-based access control (Admin/Assistant)
- Admins: Can create/edit/delete events
- Assistants: Can only register participants
- Protected routes and API endpoints

### Real-Time Features
- Live updates across all connected clients using Supabase Realtime
- Instant synchronization of events, participants, and registrations
- Visual toast notifications for all actions
- No page refresh needed

## Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Supabase account and project
- Anthropic API key (for AI Excel processing)
- Netlify account (for deployment)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Anthropic API key for AI Excel processing
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Supabase credentials (used by Netlify Functions)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important**: Also configure the Supabase credentials in `public/supabase-client.js` for the frontend.

Get your Anthropic API key from: https://console.anthropic.com/
Get your Supabase credentials from: https://app.supabase.com/ (Project Settings > API)

### 3. Set Up Supabase Database

Run the SQL schema in your Supabase project (see Database Schema section below).

### 4. Start Development Server
```bash
npm run dev
```

This starts Netlify Dev server which runs:
- Static site on http://localhost:8888
- Netlify Functions on http://localhost:8888/.netlify/functions/*

### 5. Open Your Browser
```
http://localhost:8888
```

You'll be redirected to the login page. Use your Supabase credentials to log in.

## Usage

### Event Management Workflow

1. **Login** - Use your Supabase credentials to access the system
2. **Event Dashboard** - View all events with real-time statistics
3. **Create Event** (Admin only) - Click "Create New Event" button
4. **Open Registration** - Click on any event card to open its registration screen

### Pre-Registration Workflow

1. **Select Event** - Navigate to an event's registration screen
2. **Upload Excel File**:
   - Click "Upload Pre-Registered List"
   - Select Excel file (.xlsx, .xls, .csv)
   - AI automatically detects columns (Name, Email, DNI, Area)
   - Participants are loaded into the pre-registration list

3. **Register Participants**:
   - Use search to find participants by name, email, or DNI
   - Click "Register" button next to their name
   - Participant is instantly added to the registered list
   - Real-time updates across all connected devices

4. **Quick Add Walk-Ins**:
   - Click the floating "+" button
   - Enter name, email, and area
   - Submit to register immediately

### User Roles

- **Admin**: Can create/edit/delete events, register participants
- **Assistant**: Can only register participants (read-only for events)

## Database Schema

The application uses Supabase (PostgreSQL) with the following tables:

### Core Tables

**`profiles`** - User profiles and roles
- `id` (UUID, FK to auth.users)
- `email` (TEXT)
- `full_name` (TEXT)
- `role` (TEXT: 'admin' or 'assistant')
- `created_at` (TIMESTAMP)

**`events`** - Event definitions
- `id` (BIGINT, PRIMARY KEY)
- `name` (TEXT, NOT NULL)
- `event_date` (DATE)
- `description` (TEXT)
- `created_by` (UUID, FK to profiles.id)
- `is_deleted` (BOOLEAN, DEFAULT false)
- `created_at` (TIMESTAMP)

**`participants`** - Registered participants
- `id` (BIGINT, PRIMARY KEY)
- `event_id` (BIGINT, FK to events.id)
- `full_name` (TEXT, NOT NULL)
- `email` (TEXT, NOT NULL)
- `area` (TEXT, NOT NULL)
- `registered_at` (TIMESTAMP)

**`pre_registered_participants`** - Pre-registered from Excel
- `id` (BIGINT, PRIMARY KEY)
- `event_id` (BIGINT, FK to events.id)
- `identifier_type` (TEXT: 'dni', 'email', 'name')
- `identifier_value` (TEXT)
- `full_name` (TEXT)
- `email` (TEXT)
- `dni` (TEXT)
- `area` (TEXT)
- `raw_data` (JSONB)
- `is_registered` (BOOLEAN)
- `registered_participant_id` (BIGINT, FK to participants.id)
- `uploaded_at` (TIMESTAMP)

### Row Level Security (RLS)

All tables have RLS policies enabled:
- Users must be authenticated to access any data
- Role-based permissions enforced at database level
- Admins have full access, assistants have limited access

## API Architecture

### Supabase Client-Side API

All data operations are performed client-side using Supabase JavaScript client:

**Events**
```javascript
supabase.from('events').select('*')
supabase.from('events').insert([{ name, event_date, description }])
supabase.from('events').update({ name }).eq('id', eventId)
supabase.from('events').delete().eq('id', eventId)
```

**Participants**
```javascript
supabase.from('participants').select('*').eq('event_id', eventId)
supabase.from('participants').insert([{ event_id, full_name, email, area }])
supabase.from('participants').delete().eq('id', participantId)
```

**Real-time Subscriptions**
```javascript
supabase.channel('events-changes')
  .on('postgres_changes', { event: 'INSERT', table: 'events' }, callback)
  .subscribe()
```

### Netlify Serverless Functions

**`/.netlify/functions/process-excel`** - AI Excel Processing
- **Method**: POST
- **Input**: multipart/form-data with Excel file
- **Output**: JSON with column mappings and parsed data
- **Environment**: Requires `ANTHROPIC_API_KEY`

**`/.netlify/functions/config`** - Supabase Config
- **Method**: GET
- **Output**: Supabase URL and anon key
- **Purpose**: Centralized config for frontend

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Serverless**: Netlify Functions (Node.js)
- **AI**: Anthropic Claude 3.5 Sonnet
- **File Processing**: XLSX library
- **Hosting**: Netlify Static Site Hosting
- **Real-time**: Supabase Realtime (PostgreSQL Change Data Capture)

## Security

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row Level Security (RLS) policies in Supabase
- **Role-Based Access**: Admin/Assistant roles enforced at DB level
- **XSS Protection**: `escapeHtml()` function for all user input
- **File Validation**: Type and size validation for Excel uploads
- **API Keys**: Stored in environment variables (Netlify/Supabase)
- **HTTPS**: Enforced in production (Netlify automatic SSL)
- **CORS**: Configured for Netlify Functions

## Deployment

### Deploy to Netlify

1. **Connect Repository**: Link your GitHub repo to Netlify
2. **Configure Build Settings**:
   - Build command: `echo 'No build required'`
   - Publish directory: `public`
3. **Set Environment Variables** in Netlify dashboard:
   - `ANTHROPIC_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. **Deploy**: Netlify will automatically deploy on push to main branch

### Configure Supabase

1. Create project at https://app.supabase.com/
2. Run the SQL schema in SQL Editor
3. Enable Realtime for all tables
4. Configure authentication providers
5. Copy URL and anon key to Netlify environment variables

## Development Scripts

```bash
npm run dev      # Start Netlify Dev server (port 8888)
npm run build    # No-op (static site, no build step)
npm run deploy   # Deploy to Netlify production
```
