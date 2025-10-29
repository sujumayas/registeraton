# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fast, lightweight multi-event participant registration system with AI-powered Excel pre-registration processing. Built with vanilla JavaScript, Node.js, SQLite, and Anthropic Claude API.

**Key Features**:
- **Multi-Event Management**: Create and manage multiple events, each with their own participants and pre-registered attendees
- **Event Dashboard**: Visual cards showing event details, stats (registered/pending counts), and quick access to registration screens
- **AI-Powered Pre-Registration**: Upload Excel files, AI identifies columns automatically, search and register with one click
- **Quick Add**: Manual registration for walk-ins not in pre-registered list
- **Real-time Updates**: Server-Sent Events (SSE) for instant synchronization across all connected clients

## Running the Application

**Prerequisites**: Create a `.env` file with your Anthropic API key:
```bash
ANTHROPIC_API_KEY=your_api_key_here
```

Then start the server:
```bash
npm start
```

The server runs on `http://localhost:3000` and serves both the API and static frontend files.

## Architecture

### Backend (`server.js`)

- **Express server** handling REST API and serving static files
- **Anthropic Claude API** for AI-powered Excel column identification
- **Multer** for file upload handling (max 10MB, Excel/CSV only)
- **XLSX library** for parsing Excel files
- **SQLite database** (`participants.db`) with three tables:

  **events table**:
  - `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
  - `name` (TEXT, NOT NULL) - Event name
  - `event_date` (DATE) - When the event takes place
  - `description` (TEXT) - Optional event description
  - `is_deleted` (INTEGER, DEFAULT 0) - Soft delete flag
  - `created_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)

  **participants table**:
  - `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
  - `event_id` (INTEGER, FOREIGN KEY to events.id)
  - `full_name` (TEXT, NOT NULL)
  - `email` (TEXT, NOT NULL)
  - `area` (TEXT, NOT NULL)
  - `registered_at` (DATETIME, DEFAULT CURRENT_TIMESTAMP)

  **pre_registered_participants table**:
  - `id` (INTEGER, PRIMARY KEY, AUTOINCREMENT)
  - `event_id` (INTEGER, FOREIGN KEY to events.id)
  - `identifier_type` (TEXT: 'dni', 'email', 'name')
  - `identifier_value` (TEXT: actual identifier value)
  - `full_name`, `email`, `dni`, `area` (TEXT, nullable)
  - `raw_data` (TEXT: JSON of original Excel row)
  - `is_registered` (INTEGER: 0/1)
  - `registered_participant_id` (INTEGER: FK to participants.id)
  - `uploaded_at` (DATETIME)

- **Database Migration**: Automatically migrates existing data to multi-event schema by creating a default "Initial Event" and associating all existing participants with it

- **Server-Sent Events (SSE)** for real-time updates:
  - Maintains array of connected clients in `sseClients`
  - `broadcast()` function sends updates to all connected clients with `eventId` for filtering
  - Events: `event_created`, `event_updated`, `event_deleted`, `new_participant`, `participant_deleted`, `preregister_uploaded`, `preregistered_updated`, `preregister_cleared`
  - Clients filter events by current event context

### Frontend (`public/`)

**Event Dashboard** (`events.html` + `events.js` + `events.css`):
- Landing page showing all active events in a responsive grid
- Event cards display: name, date, description, participant stats (registered/pending)
- Create/Edit/Delete event functionality with modal forms
- Real-time updates via SSE (event creation, updates, deletion)
- Click "Open Registration" to navigate to event's registration screen

**Registration Screen** (`register.html` + `app.js`):
- **Event Context**: Displays event name, date, and "Back to Events" link
- **URL-based routing**: `/register.html?eventId=123`
- **Pre-Registration Search Tab**: Excel upload, AI processing, live search, one-click registration
- **Registered Participants Tab**: View all registered attendees with sorting
- **Quick Add FAB**: Floating button for manual walk-in registration
- **Event-Scoped Data**: All operations filtered by current event ID
- **Real-time Updates**: SSE filtered by event ID for multi-event support

**Technology Stack**:
- Vanilla JavaScript (no frameworks)
- EventSource API for real-time updates
- URL parameters for routing
- CSS Grid for responsive layouts

### API Endpoints

**Event Management**:
- `GET /api/events` - List all active events (soft-deleted excluded)
- `POST /api/events` - Create new event (requires name, optional date/description)
- `GET /api/events/:id` - Get single event details
- `PUT /api/events/:id` - Update event details
- `DELETE /api/events/:id` - Soft delete event (preserves all data)
- `GET /api/events/:id/stats` - Get comprehensive event statistics (participants, pre-reg counts)

**Participant Management (Event-Scoped)**:
- `GET /api/events/:eventId/participants` - Fetch all registered participants for event
- `POST /api/events/:eventId/participants` - Register new participant for event
- `DELETE /api/events/:eventId/participants/:id` - Delete participant

**Pre-Registration (Event-Scoped)**:
- `POST /api/events/:eventId/upload-preregister` - Upload Excel file for event, AI processes columns
- `GET /api/events/:eventId/preregistered` - Fetch pre-registered participants for event
- `GET /api/events/:eventId/preregistered/search?q=query` - Search pre-registered by name/email/DNI
- `POST /api/events/:eventId/preregistered/:id/register` - Register a pre-registered participant
- `DELETE /api/events/:eventId/preregistered` - Clear all pre-registered for event

**Real-time**:
- `GET /events` - SSE stream for real-time updates (includes eventId in payloads)

## Key Implementation Details

### AI-Powered Excel Processing

The `processExcelWithAI()` function in server.js:
1. Parses Excel file using XLSX library
2. Extracts column names and first 5 rows as sample data
3. Sends to Claude API with structured prompt asking to:
   - Identify the best identifier column (priority: DNI > email > name)
   - Map columns to fields (full_name, email, dni, area)
   - Return JSON with exact column mappings
4. Uses Claude 3.5 Sonnet model for accurate column identification
5. Handles any column naming convention (English, Spanish, etc.)
6. Stores identified mappings along with raw data for flexibility

### Real-Time Synchronization with Multi-Event Support

The app uses SSE instead of WebSockets for simplicity:
1. Clients connect to `/events` on page load
2. Server maintains client connections in `sseClients` array
3. On POST/DELETE operations, server calls `broadcast()` with `eventId` in payload
4. **Event Dashboard**: Listens for `event_created`, `event_updated`, `event_deleted` events
5. **Registration Screen**: Filters events by `currentEventId` to only process updates for the current event
6. Frontend listeners update local state arrays and re-render affected components
7. Data isolation ensured by event_id filtering at both database and client levels

### State Management

- **Backend**: SQLite database is source of truth with event_id foreign keys ensuring data isolation
- **Frontend Event Dashboard**: Maintains `events` array synchronized via SSE
- **Frontend Registration Screen**: Maintains `participants` and `preregisteredParticipants` arrays for current event only
- **URL-based Context**: Event ID passed via URL parameter (`?eventId=123`)
- **Automatic Redirect**: Registration screen redirects to dashboard if no eventId provided

### Multi-Event Data Isolation

- All participant and pre-registration queries filtered by `event_id`
- SSE broadcasts include `eventId` for client-side filtering
- Each event has completely independent participant lists
- Soft delete for events preserves all historical data
- Migration logic handles upgrading from single to multi-event schema

### Navigation Flow

1. User lands on Event Dashboard (`/` or `/events.html`)
2. Click "Create New Event" → Modal form → New event card appears
3. Click "Open Registration" → Navigate to `/register.html?eventId=X`
4. Registration screen loads event details and scoped data
5. Click "Back to Events" → Return to dashboard

### Tab Navigation (Registration Screen)

- **Pre-Registration Search Tab** (default): Excel upload, search, one-click registration, quick add FAB
- **Registered Participants Tab**: View all registered with sorting by name/email/area/time
- Tab state managed client-side with CSS `.tab-content.active`
- Real-time updates work across both tabs

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
- Works seamlessly with existing SSE real-time update system

**Migration Notes**:
- Old inline `.message` divs have been removed from HTML
- Old `showMessage()` and `showUploadMessage()` functions removed from JavaScript
- All notification calls now use `NotificationManager` API
- No breaking changes to backend API

## Important Notes

- No build step required - runs directly with Node.js
- Database file `participants.db` is created automatically on first run
- SSE connection auto-reconnects on error (3-second delay)
- XSS protection via `escapeHtml()` function for all user input rendering
