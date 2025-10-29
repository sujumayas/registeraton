# Migration Guide: SQLite + Node.js → Supabase + Netlify

This guide will walk you through completing the migration of your event registration system to a modern serverless architecture with Supabase and Netlify.

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [What's Been Completed](#whats-been-completed)
3. [Prerequisites](#prerequisites)
4. [Step 1: Set Up Supabase](#step-1-set-up-supabase)
5. [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
6. [Step 3: Migrate app.js](#step-3-migrate-appjs)
7. [Step 4: Update register.html](#step-4-update-registerhtml)
8. [Step 5: Migrate Data](#step-5-migrate-data)
9. [Step 6: Test Locally](#step-6-test-locally)
10. [Step 7: Deploy to Netlify](#step-7-deploy-to-netlify)
11. [Troubleshooting](#troubleshooting)

---

## Migration Overview

### Architecture Changes

| Component | Before | After |
|-----------|--------|-------|
| **Backend** | Node.js/Express (server.js) | Supabase (PostgreSQL + REST API) |
| **Database** | SQLite (participants.db) | Supabase PostgreSQL |
| **Auth** | None | Supabase Auth (email/password) |
| **Real-time** | Server-Sent Events | Supabase Realtime |
| **AI Processing** | Express endpoint | Netlify Function |
| **Hosting** | Node server (port 3000) | Netlify (CDN) |
| **Multi-tenancy** | Single instance | Organization-based |
| **Access Control** | None | Role-based (Admin/Assistant) |

---

## What's Been Completed

✅ **Database Schema** (supabase/migrations/001_initial_schema.sql)
- Organizations, Users, Events, Participants, Pre-registered Participants tables
- All indexes and foreign keys
- UUIDs instead of integer IDs
- PostgreSQL-specific features (JSONB, TIMESTAMPTZ)

✅ **Row Level Security** (supabase/migrations/002_rls_policies.sql)
- Organization-based multi-tenancy
- Role-based permissions (Admin vs Assistant)
- Secure data isolation

✅ **Auth Triggers** (supabase/migrations/003_auth_triggers.sql)
- Automatic user profile creation on signup
- Default organization management

✅ **Netlify Function** (netlify/functions/process-excel.js)
- AI-powered Excel processing endpoint
- Replacement for Express `/upload-preregister` endpoint

✅ **Frontend Authentication**
- Supabase client configuration (public/supabase-client.js)
- Auth helpers (public/auth.js)
- Login page (public/login.html)

✅ **Events Dashboard Migration**
- events.js fully migrated to Supabase
- events.html updated with auth and user info

✅ **Configuration Files**
- netlify.toml with proper settings
- package.json updated with Supabase dependencies

---

## Prerequisites

Before starting, ensure you have:

- [ ] Supabase account (https://supabase.com)
- [ ] Netlify account (https://netlify.com)
- [ ] Node.js 18+ installed
- [ ] Git repository for your project
- [ ] Anthropic API key (same one you're currently using)

---

## Step 1: Set Up Supabase

### 1.1 Create Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose organization or create one
4. Enter project details:
   - **Name**: event-registration
   - **Database Password**: (generate and save securely)
   - **Region**: Choose closest to your users
5. Wait for project to be created (~2 minutes)

### 1.2 Run Database Migrations

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste content from `supabase/migrations/001_initial_schema.sql`
4. Click "Run" and verify success
5. Repeat for `002_rls_policies.sql`
6. Repeat for `003_auth_triggers.sql`

**Verification**: Go to **Table Editor** and confirm you see:
- organizations
- users
- events
- participants
- pre_registered_participants

### 1.3 Get API Credentials

1. In Supabase Dashboard, go to **Settings** → **API**
2. Copy and save:
   - **Project URL** (e.g., https://xxxxx.supabase.co)
   - **anon public** key (starts with `eyJ...`)

---

## Step 2: Configure Environment Variables

### 2.1 Create .env File

Create `.env` in project root:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...

# Anthropic (same as before)
ANTHROPIC_API_KEY=sk-ant-xxx...
```

### 2.2 Update supabase-client.js

Edit `public/supabase-client.js` lines 10-11:

```javascript
// Replace these lines:
const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// With your actual values:
const SUPABASE_URL = 'https://xxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJxxx...';
```

---

## Step 3: Migrate app.js

The registration page logic in `public/app.js` needs to be migrated similarly to `events.js`.

### Key Changes Required:

1. **Add auth check** at the start of `DOMContentLoaded`:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await window.supabaseHelpers.requireAuth())) {
    return;
  }
  // ... rest of initialization
});
```

2. **Replace all fetch() calls** with Supabase queries:

**Before:**
```javascript
const response = await fetch(`/api/events/${eventId}/participants`);
const participants = await response.json();
```

**After:**
```javascript
const { data: participants, error } = await window.supabase
  .from('participants')
  .select('*')
  .eq('event_id', eventId)
  .order('registered_at', { ascending: false });

if (error) throw error;
```

3. **Replace SSE with Supabase Realtime**:

**Before:**
```javascript
eventSource = new EventSource('/events');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // handle events
};
```

**After:**
```javascript
realtimeChannel = window.supabase
  .channel('participants-changes')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'participants', filter: `event_id=eq.${currentEventId}` },
    (payload) => {
      participants.push(payload.new);
      renderRegisteredParticipants();
    }
  )
  .subscribe();
```

4. **Update Excel upload** to use Netlify Function:

**Before:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch(`/api/events/${eventId}/upload-preregister`, {
  method: 'POST',
  body: formData
});
```

**After:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

// Call Netlify Function
const response = await fetch('/.netlify/functions/process-excel', {
  method: 'POST',
  body: formData
});

const { analysis, data: excelData } = await response.json();

// Then insert into Supabase
const records = excelData.map(row => ({
  event_id: currentEventId,
  identifier_type: analysis.identifier_type,
  identifier_value: row[analysis.identifier_column],
  full_name: row[analysis.mappings.full_name] || null,
  email: row[analysis.mappings.email] || null,
  dni: row[analysis.mappings.dni] || null,
  area: row[analysis.mappings.area] || null,
  raw_data: row
}));

const { error } = await window.supabase
  .from('pre_registered_participants')
  .insert(records);
```

### Full app.js Migration Template

I've created `app.js.backup` with the old version. You can use `events.js` as a reference for the migration pattern. The key sections to migrate are:

- [ ] `loadEventDetails()` - Use Supabase select
- [ ] `loadParticipants()` - Use Supabase select
- [ ] `loadPreregisteredParticipants()` - Use Supabase select
- [ ] `registerPreregistered()` - Use Supabase insert + update
- [ ] `uploadExcelFile()` - Call Netlify Function + Supabase insert
- [ ] `setupPreregSearch()` - Use Supabase select with ilike filter
- [ ] `setupQuickAdd()` - Use Supabase insert
- [ ] Replace SSE with Realtime subscriptions

---

## Step 4: Update register.html

Similar to events.html, add Supabase scripts before closing `</body>`:

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
<script src="auth.js"></script>
<script src="notifications.js"></script>
<script src="app.js"></script>
```

Also add user info section in the header if not already present.

---

## Step 5: Migrate Data

### Option A: Manual Export/Import (Recommended for small datasets)

1. **Export from SQLite:**

```bash
npm install better-sqlite3
node scripts/export-data.js
```

Create `scripts/export-data.js`:

```javascript
const Database = require('better-sqlite3');
const fs = require('fs');

const db = new Database('participants.db', { readonly: true });

// Export events
const events = db.prepare('SELECT * FROM events WHERE is_deleted = 0').all();
fs.writeFileSync('export-events.json', JSON.stringify(events, null, 2));

// Export participants
const participants = db.prepare('SELECT * FROM participants').all();
fs.writeFileSync('export-participants.json', JSON.stringify(participants, null, 2));

// Export pre-registered
const preReg = db.prepare('SELECT * FROM pre_registered_participants').all();
fs.writeFileSync('export-prereg.json', JSON.stringify(preReg, null, 2));

db.close();
console.log('Export complete!');
```

2. **Import to Supabase:**

Use Supabase SQL Editor or create import script:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for migration
);

async function importData() {
  // Create default organization
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'Default Organization' })
    .select()
    .single();

  // Create admin user (you'll need to create this via Supabase Auth first)
  // Then get user ID and insert into users table

  // Import events
  const events = JSON.parse(fs.readFileSync('export-events.json'));
  // Map integer IDs to UUIDs, add organization_id

  // Import participants
  // Map event IDs to new UUIDs

  // Import pre-registered
  // Map event IDs to new UUIDs
}

importData();
```

### Option B: Start Fresh

If you have no production data yet, simply create:
1. Default organization via Supabase dashboard
2. Admin user via signup on login page
3. Re-create events manually

---

## Step 6: Test Locally

### 6.1 Install Dependencies

```bash
npm install
```

### 6.2 Start Netlify Dev Server

```bash
npx netlify dev
```

This starts:
- Static file server on http://localhost:8888
- Netlify Functions on http://localhost:8888/.netlify/functions/*

### 6.3 Test Flow

1. Open http://localhost:8888/login.html
2. Sign up with email/password
3. Verify user profile created (check Supabase Table Editor → users)
4. Create a new event
5. Upload Excel file for pre-registration
6. Register a participant
7. Test realtime updates (open in two browser windows)

---

## Step 7: Deploy to Netlify

### 7.1 Connect Repository

1. Push code to GitHub/GitLab
2. Go to Netlify Dashboard → "New Site from Git"
3. Connect repository
4. Configure build settings:
   - **Build command**: (leave empty)
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`

### 7.2 Set Environment Variables

In Netlify Dashboard → Site Settings → Environment Variables:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
ANTHROPIC_API_KEY=sk-ant-xxx...
```

### 7.3 Deploy

Click "Deploy Site" and wait for build to complete.

### 7.4 Update Supabase Auth Settings

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: https://your-site.netlify.app
- **Redirect URLs**: Add https://your-site.netlify.app/*

---

## Troubleshooting

### Issue: "Supabase client not initialized"

**Solution**: Make sure Supabase CDN script loads before supabase-client.js:
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-client.js"></script>
```

### Issue: "RLS policy violation" or "Permission denied"

**Solutions**:
1. Check user is authenticated: `await window.supabaseHelpers.getCurrentUser()`
2. Verify user has correct organization_id in users table
3. Check RLS policies are enabled: Supabase Dashboard → Authentication → Policies
4. Test with RLS disabled temporarily (NOT for production):
   ```sql
   ALTER TABLE events DISABLE ROW LEVEL SECURITY;
   ```

### Issue: Netlify Function timeout

**Solution**: Increase timeout in netlify.toml:
```toml
[functions]
  timeout = 26
```

### Issue: Excel upload fails

**Solutions**:
1. Check ANTHROPIC_API_KEY is set in Netlify env vars
2. Check function logs: Netlify Dashboard → Functions → process-excel → Logs
3. Verify file size < 10MB
4. Check CORS if calling from different domain

### Issue: Realtime not working

**Solutions**:
1. Enable Realtime in Supabase: Database → Replication → Enable for tables
2. Check subscription status in console: should log "SUBSCRIBED"
3. Verify RLS policies allow SELECT on tables
4. Check browser console for errors

---

## Next Steps

After migration is complete:

1. **Remove old files**:
   - `server.js`
   - `participants.db`
   - `node_modules` (old dependencies)

2. **Update CLAUDE.md** with new architecture

3. **Set up monitoring**:
   - Supabase Dashboard → Database → Performance
   - Netlify Dashboard → Analytics

4. **Configure backups**:
   - Supabase provides automatic daily backups
   - Download manual backup: Database → Backups → Download

5. **Consider additional features**:
   - Email confirmations (Supabase Auth Email Templates)
   - Two-factor authentication
   - User invitation system
   - Event capacity limits
   - Check-in QR codes

---

## Need Help?

- **Supabase Docs**: https://supabase.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Anthropic Docs**: https://docs.anthropic.com

## Summary of Changes

| File | Status | Action Required |
|------|--------|----------------|
| `supabase/migrations/*.sql` | ✅ Complete | Run in Supabase SQL Editor |
| `netlify/functions/process-excel.js` | ✅ Complete | None |
| `public/supabase-client.js` | ✅ Complete | Add your Supabase credentials |
| `public/auth.js` | ✅ Complete | None |
| `public/login.html` | ✅ Complete | None |
| `public/events.js` | ✅ Complete | None |
| `public/events.html` | ✅ Complete | None |
| `public/app.js` | ⚠️ **TODO** | Migrate using events.js pattern |
| `public/register.html` | ⚠️ **TODO** | Add Supabase script tags |
| `netlify.toml` | ✅ Complete | None |
| `package.json` | ✅ Complete | Run `npm install` |
| `.env` | ⚠️ **TODO** | Create with your credentials |

---

**Estimated time to complete remaining tasks**: 2-4 hours

Good luck with your migration! 🚀
