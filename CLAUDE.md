# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a modern, multi-event participant registration system with AI-powered Excel pre-registration processing, built as a **Netlify static site** with **Supabase backend** and **Netlify serverless functions** for AI processing.

**Architecture**:
- **Frontend**: Static HTML/CSS/JavaScript in `/public` directory (Vanilla JS, no build step)
- **Backend**: Supabase (PostgreSQL database + Authentication + Realtime)
- **Serverless Functions**: Netlify Functions in `/netlify/functions` for AI processing
- **Hosting**: Netlify static site hosting
- **Database**: Supabase PostgreSQL (NOT SQLite)
- **Real-time**: Supabase Realtime subscriptions (NOT Server-Sent Events from Express)

**Key Features**:
- **Multi-Event Management**: Create and manage multiple events with role-based access control
- **Event Dashboard**: Visual cards showing event details, stats, and quick access to registration screens
- **Authentication**: Supabase Auth with Admin/Assistant roles
- **AI-Powered Pre-Registration**: Upload Excel files, AI identifies columns automatically via Netlify Function
- **Quick Add**: Manual registration for walk-ins via floating action button
- **Real-time Updates**: Supabase Realtime for instant synchronization across all connected clients

## Running the Application

**Prerequisites**:
1. Supabase account and project configured
2. `.env` file with required credentials:

```bash
# Anthropic API key for AI Excel processing (Netlify Functions)
ANTHROPIC_API_KEY=your_api_key_here

# Supabase credentials (Netlify Functions)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Configure Supabase credentials in `public/supabase-client.js` for frontend

**Start development server**:
```bash
npm run dev
```

The Netlify Dev server runs on `http://localhost:8888` and serves:
- Static files from `/public` directory
- Netlify Functions at `/.netlify/functions/*`

## Architecture

### Backend (Supabase)

**Database**: PostgreSQL database hosted on Supabase with Row Level Security (RLS)

**Tables**:

  **profiles table**:
  - `id` (UUID, PRIMARY KEY, FK to auth.users)
  - `email` (TEXT, NOT NULL)
  - `full_name` (TEXT, NOT NULL)
  - `role` (TEXT: 'admin' or 'assistant')
  - `created_at` (TIMESTAMP WITH TIME ZONE, DEFAULT now())

  **events table**:
  - `id` (BIGINT, PRIMARY KEY, AUTOINCREMENT)
  - `name` (TEXT, NOT NULL) - Event name
  - `event_date` (DATE) - When the event takes place
  - `description` (TEXT) - Optional event description
  - `created_by` (UUID, FK to profiles.id)
  - `is_deleted` (BOOLEAN, DEFAULT false) - Soft delete flag
  - `created_at` (TIMESTAMP WITH TIME ZONE, DEFAULT now())

  **participants table**:
  - `id` (BIGINT, PRIMARY KEY, AUTOINCREMENT)
  - `event_id` (BIGINT, FOREIGN KEY to events.id)
  - `full_name` (TEXT, NOT NULL)
  - `email` (TEXT, NOT NULL)
  - `area` (TEXT, NOT NULL)
  - `registered_at` (TIMESTAMP WITH TIME ZONE, DEFAULT now())

  **pre_registered_participants table**:
  - `id` (BIGINT, PRIMARY KEY, AUTOINCREMENT)
  - `event_id` (BIGINT, FOREIGN KEY to events.id)
  - `identifier_type` (TEXT: 'dni', 'email', 'name')
  - `identifier_value` (TEXT: actual identifier value)
  - `full_name`, `email`, `dni`, `area` (TEXT, nullable)
  - `raw_data` (JSONB: original Excel row as JSON)
  - `is_registered` (BOOLEAN, DEFAULT false)
  - `registered_participant_id` (BIGINT, FK to participants.id)
  - `uploaded_at` (TIMESTAMP WITH TIME ZONE, DEFAULT now())

**Authentication**: Supabase Auth
- JWT-based authentication
- Protected routes require authentication
- User roles stored in `profiles` table

**Real-time Subscriptions**: Supabase Realtime (PostgreSQL Change Data Capture)
- Clients subscribe to table changes via WebSocket
- Events: INSERT, UPDATE, DELETE on `events`, `participants`, `pre_registered_participants`
- Automatic synchronization across all connected clients
- Event-scoped filtering on client side

### Serverless Functions (Netlify Functions)

**`/netlify/functions/process-excel.js`**:
- Handles AI-powered Excel column identification
- Uses Anthropic Claude API for intelligent column mapping
- Parses Excel/CSV files using XLSX library
- Input: multipart/form-data with Excel file
- Output: JSON with column mappings and parsed data
- Max file size: 10MB (Netlify limit)
- File types: .xlsx, .xls, .csv only

**`/netlify/functions/config.js`**:
- Returns Supabase configuration to frontend
- Centralized config management
- Environment variables: SUPABASE_URL, SUPABASE_ANON_KEY

### Frontend (`public/`)

**Login Page** (`login.html` + `auth.js`):
- Supabase Auth integration
- Email/password authentication
- Redirects to events dashboard after successful login
- Protected route guards on all pages

**Event Dashboard** (`events.html` + `events.js` + `events.css`):
- Landing page showing all active events in a responsive grid
- User menu dropdown with profile and sign out
- Hero section with personalized welcome message
- Event cards display: name, date, description, participant stats (registered/pending)
- Create/Edit/Delete event functionality (admin only) with modal forms
- Real-time updates via Supabase Realtime subscriptions
- Click "Open Registration" to navigate to event's registration screen
- Role-based UI: admins see create/edit/delete buttons, assistants don't

**Registration Screen** (`register.html` + `app.js`):
- **Event Context**: Displays event name, date, and "Back to Events" link
- **URL-based routing**: `/register.html?eventId=123`
- **Pre-Registration Search Tab**: Excel upload via Netlify Function, AI processing, live search, one-click registration
- **Registered Participants Tab**: View all registered attendees with sorting
- **Quick Add FAB**: Floating action button for manual walk-in registration
- **Event-Scoped Data**: All operations filtered by current event ID via Supabase queries
- **Real-time Updates**: Supabase Realtime filtered by event ID for multi-event support

**Shared Components**:
- **`supabase-client.js`**: Supabase client initialization
- **`auth.js`**: Authentication helpers (requireAuth, getCurrentUser, getUserProfile, signOut)
- **`notifications.js`**: Toast notification system (success, error, warning, info)
- **`notifications.css`**: Toast styles and animations

**Technology Stack**:
- Vanilla JavaScript ES6+ (no frameworks)
- Supabase JavaScript client for database and auth
- URL parameters for routing
- CSS Grid and Flexbox for responsive layouts
- Toast notifications (bottom-right corner)

### Data Access Patterns

**All data operations use Supabase client-side queries** (no traditional REST API):

**Event Management** (via `supabase.from('events')`):
```javascript
// List all active events
.select('*').eq('is_deleted', false).order('created_at', { ascending: false })

// Create new event (admin only, enforced by RLS)
.insert([{ name, event_date, description, created_by }])

// Update event details (admin only)
.update({ name, event_date, description }).eq('id', eventId)

// Soft delete event (admin only)
.update({ is_deleted: true }).eq('id', eventId)
```

**Participant Management** (via `supabase.from('participants')`):
```javascript
// Get all participants for an event
.select('*').eq('event_id', eventId).order('registered_at', { ascending: false })

// Register new participant
.insert([{ event_id, full_name, email, area }])

// Delete participant
.delete().eq('id', participantId)

// Get count
.select('*', { count: 'exact', head: true }).eq('event_id', eventId)
```

**Pre-Registration** (via `supabase.from('pre_registered_participants')`):
```javascript
// Get all pre-registered for event
.select('*').eq('event_id', eventId).eq('is_registered', false)

// Search pre-registered (client-side filtering after fetch)
.select('*').eq('event_id', eventId)
// Then filter in JS: .filter(p => matches search query)

// Mark as registered
.update({ is_registered: true, registered_participant_id }).eq('id', id)

// Clear all pre-registered for event
.delete().eq('event_id', eventId)
```

**Serverless Functions**:
- `POST /.netlify/functions/process-excel` - AI Excel processing with Anthropic Claude
- `GET /.netlify/functions/config` - Get Supabase configuration

**Real-time Subscriptions**:
```javascript
// Subscribe to table changes
supabase.channel('channel-name')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, callback)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events' }, callback)
  .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, callback)
  .subscribe()
```

## Key Implementation Details

### AI-Powered Excel Processing

The Netlify Function `/netlify/functions/process-excel.js`:
1. Receives Excel file via multipart/form-data
2. Parses Excel file using XLSX library
3. Extracts column names and first 5 rows as sample data
4. Sends to Anthropic Claude API with structured prompt asking to:
   - Identify the best identifier column (priority: DNI > email > name)
   - Map columns to fields (full_name, email, dni, area)
   - Return JSON with exact column mappings
5. Uses Claude 3.5 Sonnet model for accurate column identification
6. Handles any column naming convention (English, Spanish, etc.)
7. Returns analysis result with mappings and full data array
8. Frontend stores pre-registered participants in Supabase with raw_data as JSONB

### Real-Time Synchronization with Multi-Event Support

The app uses Supabase Realtime (PostgreSQL Change Data Capture):
1. Clients subscribe to database table changes on page load via WebSocket
2. Supabase broadcasts INSERT/UPDATE/DELETE events to all subscribed clients
3. **Event Dashboard**: Subscribes to `events` table changes
4. **Registration Screen**: Subscribes to `participants` and `pre_registered_participants` for specific event
5. Frontend listeners update local state arrays and re-render affected components
6. Data isolation ensured by event_id filtering at both database (RLS) and client levels
7. No server-side state management needed - fully serverless

### State Management

- **Backend**: Supabase PostgreSQL database is source of truth with event_id foreign keys ensuring data isolation
- **Frontend Event Dashboard**: Maintains `events` array synchronized via Supabase Realtime
- **Frontend Registration Screen**: Maintains `participants` and `preregisteredParticipants` arrays for current event only
- **URL-based Context**: Event ID passed via URL parameter (`?eventId=123`)
- **Automatic Redirect**: Registration screen redirects to dashboard if no eventId provided
- **Authentication State**: Managed by Supabase Auth, checked on page load via `requireAuth()`

### Multi-Event Data Isolation

- All participant and pre-registration queries filtered by `event_id` in Supabase queries
- Row Level Security (RLS) policies enforce access control at database level
- Each event has completely independent participant lists
- Soft delete for events preserves all historical data (is_deleted flag)
- Role-based access: admins can manage events, assistants can only register participants

### Navigation Flow

1. User visits app → Redirected to `/login.html` if not authenticated
2. Login with Supabase credentials → Redirected to `/events.html`
3. Event Dashboard loads with user profile and role
4. **Admin**: Sees "Create New Event" button in hero section
5. **Assistant**: Only sees events, no create button
6. Click "Open Registration" on event card → Navigate to `/register.html?eventId=X`
7. Registration screen loads event details and scoped data
8. Click "Back to Events" → Return to dashboard
9. Click user avatar dropdown → See profile and sign out option

### Tab Navigation (Registration Screen)

- **Pre-Registration Search Tab** (default): Excel upload via Netlify Function, search, one-click registration
- **Registered Participants Tab**: View all registered with sorting by name/email/area/time
- **Quick Add FAB**: Floating action button (bottom-right) for manual registration, visible on both tabs
- Tab state managed client-side with CSS `.tab-content.active`
- Real-time updates via Supabase Realtime work across both tabs

### Notification System

The application uses a centralized toast-style notification system that appears in the bottom-right corner without causing layout shifts.

**Implementation** (`notifications.js` + `notifications.css`):
- **NotificationManager** singleton class manages all notifications
- Toast-style cards with slide-in animations from the right
- Fixed positioning (bottom-right corner, z-index 9999)
- Supports stacking multiple notifications vertically
- Auto-dismiss with visual progress bar
- Manual close button on each notification
- Responsive design (full-width on mobile)
- Dark mode support via CSS media queries

**Files**:
- `public/notifications.js` - Core notification manager
- `public/notifications.css` - Toast styles and animations
- Integrated in both `events.html` and `register.html`

**API Methods**:
```javascript
// Show notification with custom type and duration
NotificationManager.show(message, type, duration)

// Convenience methods (recommended)
NotificationManager.success(message, duration?)  // Green, default 3s
NotificationManager.error(message, duration?)    // Red, default 4s
NotificationManager.warning(message, duration?)  // Yellow, default 4s
NotificationManager.info(message, duration?)     // Blue, default 3s

// Clear all notifications
NotificationManager.clearAll()
```

**Usage Examples**:
```javascript
// Success notification (auto-dismiss after 3 seconds)
NotificationManager.success('Participant registered successfully!');

// Error notification with custom duration
NotificationManager.error('Failed to upload file', 5000);

// Warning notification
NotificationManager.warning('This action cannot be undone');

// Info notification
NotificationManager.info('Processing your request...');
```

**Features**:
- **Multiple Notification Types**: `success`, `error`, `warning`, `info` with color-coded styling
- **Auto-dismiss**: Configurable duration (default 3-4 seconds)
- **Progress Bar**: Visual feedback showing time until auto-dismiss
- **Manual Close**: Click × button to dismiss immediately
- **Stacking**: Multiple notifications stack vertically with 10px gap
- **Animations**: Smooth slide-in from right, fade-out on dismiss
- **Hover Pause**: Progress bar pauses when hovering over notification
- **No Layout Shifts**: Fixed positioning prevents content from moving
- **XSS Protection**: All messages are HTML-escaped via `escapeHtml()`
- **Mobile Responsive**: Full-width notifications on small screens
- **Accessibility**: Focus-visible states and semantic markup

**Design Notes**:
- Notifications appear in bottom-right (30px from edges on desktop)
- Toast cards have gradient backgrounds matching notification type
- Icons (SVG) displayed for each notification type
- Smooth cubic-bezier animations for professional feel
- Works seamlessly with Supabase Realtime update system

**Migration Notes**:
- Old inline `.message` divs have been removed from HTML
- Old `showMessage()` and `showUploadMessage()` functions removed from JavaScript
- All notification calls now use `NotificationManager` API

## Important Notes

- **No build step required** - static site runs directly on Netlify
- **Database**: Supabase PostgreSQL (NOT SQLite `participants.db`)
- **Development server**: Use `npm run dev` (NOT `npm start`)
- **Port**: localhost:8888 (NOT localhost:3000)
- **Real-time**: Supabase Realtime subscriptions (NOT Express SSE)
- **Authentication**: Required for all pages except login
- **Role-based access**: Enforced at database level via RLS policies
- **Supabase Realtime**: Auto-reconnects on connection loss
- **XSS protection**: `escapeHtml()` function for all user input rendering
- **Toast notifications**: NotificationManager for all user feedback (success, error, warning, info)
- **Configuration**: Supabase credentials in both `.env` and `public/supabase-client.js`

## File Structure

```
/
├── public/                    # Static frontend files (served by Netlify)
│   ├── index.html            # Root redirect to events.html
│   ├── login.html            # Login page
│   ├── events.html           # Event dashboard
│   ├── register.html         # Registration screen
│   ├── auth.js               # Authentication helpers
│   ├── events.js             # Event dashboard logic
│   ├── app.js                # Registration screen logic
│   ├── supabase-client.js    # Supabase client initialization
│   ├── notifications.js      # Toast notification system
│   ├── styles.css            # Global styles
│   ├── events.css            # Event dashboard styles
│   └── notifications.css     # Toast notification styles
├── netlify/
│   └── functions/            # Netlify serverless functions
│       ├── process-excel.js  # AI Excel processing
│       └── config.js         # Supabase config endpoint
├── netlify.toml              # Netlify configuration
├── package.json              # Dependencies and scripts
├── .env                      # Environment variables (not committed)
├── README.md                 # User-facing documentation
└── CLAUDE.md                 # This file (AI assistant guidance)
```

## Common Development Tasks

### Adding a New Feature
1. Update frontend HTML/JS/CSS in `/public`
2. Use Supabase client for data operations
3. Add Realtime subscriptions if needed
4. Test with `npm run dev`
5. Deploy: Netlify auto-deploys on push to main

### Modifying Database Schema
1. Update schema in Supabase SQL Editor
2. Update RLS policies if needed
3. Update frontend Supabase queries
4. Test thoroughly - no local migration system

### Adding a New Netlify Function
1. Create new file in `/netlify/functions/`
2. Export `handler` async function
3. Add dependencies to `package.json` if needed
4. Configure in `netlify.toml` if special settings needed
5. Access at `/.netlify/functions/your-function-name`

## Troubleshooting

**"npm start" doesn't work**
- Use `npm run dev` instead (Netlify Dev server)

**Authentication errors**
- Check Supabase credentials in both `.env` and `public/supabase-client.js`
- Verify Supabase project is active and accessible

**Real-time updates not working**
- Check Supabase Realtime is enabled for tables in Supabase dashboard
- Verify WebSocket connection in browser DevTools

**Excel upload fails**
- Check ANTHROPIC_API_KEY in Netlify environment
- Verify file size < 10MB
- Check file format (.xlsx, .xls, .csv only)

**Role-based access not working**
- Verify user has profile in `profiles` table with correct role
- Check RLS policies in Supabase
