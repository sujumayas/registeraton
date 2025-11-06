# GitHub Issues for Refactoring

This file contains all 15 refactoring issues identified in the code review.
Use this to create GitHub issues in your repository.

---

## 🔴 CRITICAL ISSUES (Must Fix Immediately)

### Issue #1: Environment Variable Naming Mismatch in config.js

**Title:** 🔴 CRITICAL: Environment Variable Naming Mismatch in config.js

**Labels:** `bug`, `critical`, `priority:high`

**Description:**
## Problem
The Netlify Function `config.js` expects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, but documentation specifies `SUPABASE_URL` and `SUPABASE_ANON_KEY`. This causes frontend to fail loading Supabase configuration.

## Location
`netlify/functions/config.js:31-32`

## Current Code
```javascript
supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
```

## Fix Required
Change to match documentation:
```javascript
supabaseUrl: process.env.SUPABASE_URL,
supabaseAnonKey: process.env.SUPABASE_ANON_KEY
```

## Impact
- App cannot initialize Supabase client
- All database operations fail
- User sees blank screen or errors

## Priority
🔴 **CRITICAL** - Must fix immediately for app to work

---

### Issue #2: Missing organization_id in Event Creation

**Title:** 🔴 CRITICAL: Missing organization_id in Event Creation

**Labels:** `bug`, `critical`, `priority:high`

**Description:**
## Problem
When creating events, the code sets `organization_id` from `userProfile.organization_id`, but the `getUserProfile()` function doesn't SELECT this field from the database, resulting in `undefined` being inserted.

## Location
- `public/events.js:414` - Sets undefined organization_id
- `public/supabase-client.js:96-100` - Missing field in SELECT

## Current Code
```javascript
// supabase-client.js:96-100
const { data, error } = await window.supabase
  .from('users')
  .select('*')  // Should explicitly select organization_id
  .eq('id', user.id)
  .single();
```

## Fix Required
Update `getUserProfile()` function:
```javascript
const { data, error } = await window.supabase
  .from('users')
  .select('id, email, full_name, role, organization_id')
  .eq('id', user.id)
  .single();
```

## Impact
- Event creation fails due to NOT NULL constraint on organization_id
- Users cannot create events
- Database error shown to admins

## Priority
🔴 **CRITICAL** - Blocks core functionality

---

### Issue #3: Documentation Inconsistency - profiles vs users Table

**Title:** 🔴 CRITICAL: Documentation Inconsistency - profiles vs users Table

**Labels:** `documentation`, `critical`, `priority:high`

**Description:**
## Problem
Database schema defines `users` table with UUID IDs, but documentation (CLAUDE.md, README.md) references `profiles` table with BIGINT IDs. This creates confusion when developing or onboarding new developers.

## Affected Files
- `CLAUDE.md` - References 'profiles' table
- `README.md` - References 'profiles' table
- `supabase/migrations/001_initial_schema.sql` - Defines 'users' table
- Frontend code - Correctly uses 'users' table

## Issues
1. Table name mismatch: `profiles` (docs) vs `users` (actual)
2. ID type mismatch: BIGINT (docs) vs UUID (actual)
3. Schema structure doesn't match implementation

## Fix Required
Update all documentation files to match actual implementation:
- Replace all references to `profiles` table with `users`
- Update ID types from BIGINT to UUID
- Update table structure documentation
- Ensure consistency across CLAUDE.md and README.md

## Impact
- New developers follow wrong schema
- Queries fail due to incorrect table names
- Confusion about data types and relationships

## Priority
🔴 **CRITICAL** - Causes developer confusion and potential bugs

---

## 🟠 HIGH PRIORITY ISSUES (Should Fix Before Production)

### Issue #4: Missing Password Reset Page

**Title:** 🟠 HIGH: Missing Password Reset Page

**Labels:** `bug`, `priority:high`, `ux`

**Description:**
## Problem
Password reset functionality redirects to `/reset-password.html` which doesn't exist, breaking the password recovery flow.

## Location
`public/auth.js:119`

## Current Code
```javascript
const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/reset-password.html`  // Page doesn't exist!
});
```

## Fix Options
1. Create the `reset-password.html` page with password update form
2. Update redirect to handle reset in login page
3. Redirect to Supabase-hosted password reset page

## Impact
- Users cannot reset forgotten passwords
- Support requests increase
- Poor user experience

## Priority
🟠 **HIGH** - Important UX feature missing

---

### Issue #5: No Error Handling for Supabase Client Initialization

**Title:** 🟠 HIGH: No Error Handling for Supabase Client Initialization

**Labels:** `bug`, `priority:high`, `reliability`

**Description:**
## Problem
If Supabase config fetch fails (both endpoints), the error is thrown but not handled gracefully. App becomes completely unusable with no user feedback.

## Location
`public/supabase-client.js:13-62`

## Current Code
```javascript
catch (error) {
  console.error('Failed to initialize Supabase client:', error);
  throw error;  // App crashes with no user feedback
}
```

## Fix Required
Add user-friendly error handling:
```javascript
catch (error) {
  console.error('Failed to initialize Supabase client:', error);

  // Show user-friendly error page
  document.body.innerHTML = `
    <div style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;font-family:system-ui;">
      <h1>⚠️ Configuration Error</h1>
      <p>Unable to connect to the server. Please check:</p>
      <ul style="text-align:left;">
        <li>Environment variables are set correctly in Netlify</li>
        <li>Netlify Functions are deployed and running</li>
        <li>Supabase project is active and accessible</li>
      </ul>
      <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;">Retry</button>
    </div>
  `;
  throw error;
}
```

## Impact
- Users see cryptic errors or blank screen
- No clear indication of what's wrong
- Difficult to debug for non-technical users

## Priority
🟠 **HIGH** - Affects all users when config fails

---

### Issue #6: Missing DNI Field in Quick Add Form

**Title:** 🟠 HIGH: Missing DNI Field in Quick Add Form

**Labels:** `enhancement`, `priority:high`, `consistency`

**Description:**
## Problem
Database schema has `dni` field (nullable), pre-registration includes it, but Quick Add form doesn't collect it. This creates inconsistent data between pre-registered and manually added participants.

## Location
- `public/app.js:566-573` - Quick Add data collection
- `public/register.html:125-131` - Quick Add modal HTML

## Current Form Fields
- Full Name ✅
- Email ✅
- Area ✅
- DNI ❌ (Missing)

## Fix Required

**HTML (register.html):**
```html
<div class="form-group">
  <label for="quickDni">DNI (Optional)</label>
  <input type="text" id="quickDni" placeholder="Document number">
</div>
```

**JavaScript (app.js):**
```javascript
const participantData = {
  event_id: currentEventId,
  registered_by: currentUser.id,
  participant_type: 'participant',
  full_name: document.getElementById('quickName').value,
  email: document.getElementById('quickEmail').value,
  dni: document.getElementById('quickDni').value || null,  // Add this
  area: document.getElementById('quickArea').value
};
```

## Impact
- Data inconsistency between pre-registered and manual entries
- Cannot track participants by DNI if manually added
- Confusion about which fields are required

## Priority
🟠 **HIGH** - Data consistency issue

---

## 🟡 MEDIUM PRIORITY ISSUES (UX/Performance)

### Issue #7: Duplicate Utility Functions Across Files

**Title:** 🟡 MEDIUM: Duplicate Utility Functions Across Files

**Labels:** `refactor`, `priority:medium`, `code-quality`

**Description:**
## Problem
`escapeHtml()` and `formatDateTime()` functions are duplicated in multiple files, violating DRY principle and making maintenance harder.

## Locations
- `public/events.js:569-579` - escapeHtml, formatDateTime
- `public/app.js:216-226` - escapeHtml, formatDateTime
- `public/notifications.js:126-135` - escapeHtml

## Fix Required
1. Create shared utility file `public/utils.js`:
```javascript
// utils.js
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

export function formatDateTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // ... implementation
}
```

2. Import in other files:
```javascript
import { escapeHtml, formatDateTime } from './utils.js';
```

## Impact
- Code duplication
- Harder to maintain and update
- Potential bugs if functions drift

## Priority
🟡 **MEDIUM** - Code quality improvement

---

### Issue #8: No Confirmation Before Clearing Pre-registered List

**Title:** 🟡 MEDIUM: No Confirmation Before Clearing Pre-registered List

**Labels:** `enhancement`, `priority:medium`, `ux`, `safety`

**Description:**
## Problem
Uploading a new Excel file immediately deletes ALL existing pre-registered participants with no warning. This could result in accidental data loss.

## Location
`public/app.js:419-426`

## Current Code
```javascript
// Step 2: Clear existing pre-registered participants for this event
const { error: deleteError } = await window.supabase
  .from('pre_registered_participants')
  .delete()
  .eq('event_id', currentEventId);  // No confirmation!
```

## Fix Required
Add confirmation dialog:
```javascript
// Check if there are existing pre-registered participants
if (preregisteredParticipants.length > 0) {
  const confirmed = confirm(
    `This will replace ${preregisteredParticipants.length} existing pre-registered participants. ` +
    `Registered participants will NOT be affected.\n\nContinue?`
  );

  if (!confirmed) {
    progressDiv.style.display = 'none';
    document.getElementById('uploadBtn').disabled = false;
    return;
  }
}
```

## Impact
- Risk of accidental data loss
- Users may not realize previous list is deleted
- No way to undo the operation

## Priority
🟡 **MEDIUM** - Safety feature to prevent accidents

---

### Issue #9: Event Stats Loading State Never Completes on Error

**Title:** 🟡 MEDIUM: Event Stats Loading State Never Completes on Error

**Labels:** `bug`, `priority:medium`, `ux`

**Description:**
## Problem
Event cards show "Loading stats..." but if the stats query fails, it stays in loading state forever with no error indication.

## Location
`public/events.js:233-269`

## Current Code
```javascript
async function loadEventStats(eventId) {
  try {
    // ... query stats
    statsDiv.innerHTML = `...stats...`;
  } catch (error) {
    console.error('Error loading event stats:', error);
    // No UI update! Stats stuck on "Loading..."
  }
}
```

## Fix Required
Add error state handling:
```javascript
catch (error) {
  console.error('Error loading event stats:', error);

  const statsDiv = document.getElementById(`stats-${eventId}`);
  if (statsDiv) {
    statsDiv.innerHTML = `
      <div class="stat-error" style="color: var(--error-color); font-size: 12px;">
        Unable to load stats
        <button onclick="loadEventStats('${eventId}')" style="margin-left: 8px; font-size: 11px;">
          Retry
        </button>
      </div>
    `;
  }
}
```

## Impact
- Confusing UX - users don't know if it's still loading or failed
- No way to retry loading stats
- Looks unprofessional

## Priority
🟡 **MEDIUM** - UX improvement

---

### Issue #10: Search Debouncing Has No Visual Feedback

**Title:** 🟡 MEDIUM: Search Debouncing Has No Visual Feedback

**Labels:** `enhancement`, `priority:medium`, `ux`

**Description:**
## Problem
User types in search box, nothing happens for 300ms, then results appear. No indication that search is in progress during debounce period.

## Locations
- `public/app.js:472-500` - Pre-registration search
- `public/app.js:740-760` - Registered participants search

## Current Behavior
1. User types "john"
2. Wait 300ms (no feedback)
3. Results appear

## Fix Required
Add loading state during debounce:
```javascript
searchInput.addEventListener('input', async (e) => {
  const query = e.target.value.toLowerCase().trim();

  clearTimeout(searchTimeout);

  if (!query) {
    renderPreregistered();
    return;
  }

  // Show loading state immediately
  const tbody = document.getElementById('preregisterBody');
  tbody.innerHTML = '<tr><td colspan="4">🔍 Searching...</td></tr>';

  // Debounce actual search
  searchTimeout = setTimeout(async () => {
    // ... perform search
  }, 300);
});
```

## Impact
- Poor user experience during search
- Users may think app is frozen
- May type query multiple times thinking it didn't work

## Priority
🟡 **MEDIUM** - UX polish

---

## 🟢 LOW PRIORITY / ENHANCEMENTS

### Issue #11: Global Variables - Poor Code Organization

**Title:** 🟢 LOW: Global Variables - Poor Code Organization

**Labels:** `refactor`, `priority:low`, `code-quality`, `technical-debt`

**Description:**
## Problem
All variables in `events.js` and `app.js` are global, making the code hard to test, maintain, and reason about. Risk of naming conflicts and unintended mutations.

## Locations
- `public/events.js:1-7` - All global variables
- `public/app.js:1-17` - All global variables

## Current Code
```javascript
// Global namespace pollution
let events = [];
let realtimeChannel = null;
let currentEventId = null;
// ... many more
```

## Fix Options

**Option 1: IIFE (Immediately Invoked Function Expression)**
```javascript
(function() {
  'use strict';

  // All code here with local scope
  let events = [];
  let realtimeChannel = null;

  // ... rest of code
})();
```

**Option 2: ES6 Modules**
```javascript
// events.module.js
let events = [];
let realtimeChannel = null;

export function initializeApp() {
  // ...
}

// Import in HTML
<script type="module" src="events.module.js"></script>
```

## Impact
- Code harder to test
- Risk of variable conflicts
- Difficult to track state mutations
- Not following modern JavaScript best practices

## Priority
🟢 **LOW** - Technical debt, works but not ideal

---

### Issue #12: No Participant Export Functionality

**Title:** 🟢 LOW: Add Participant Export to CSV/Excel

**Labels:** `enhancement`, `priority:low`, `feature`

**Description:**
## Problem
Users can view registered participants in the UI but cannot export the list to CSV/Excel for external analysis, reporting, or record-keeping.

## Use Cases
- Export participant list for certificates
- Import into other systems (CRM, email marketing)
- Generate reports for stakeholders
- Backup participant data locally

## Proposed Implementation

**1. Add Export Button to Registered Tab:**
```html
<div class="registered-header">
  <h2>All Registered Participants</h2>
  <div class="registered-actions">
    <input type="text" id="registeredSearchInput" placeholder="Search...">
    <button onclick="exportParticipants()" class="btn-secondary">
      📥 Export CSV
    </button>
  </div>
</div>
```

**2. Export Function:**
```javascript
function exportParticipants() {
  // Create CSV header
  const header = 'Full Name,Email,DNI,Area,Registered At\n';

  // Create CSV rows
  const rows = participants.map(p =>
    `"${p.full_name}","${p.email}","${p.dni || ''}","${p.area}","${p.registered_at}"`
  ).join('\n');

  const csv = header + rows;

  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${currentEvent.name.replace(/\s+/g, '_')}_participants_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);

  window.NotificationManager.success('Participant list exported!');
}
```

## Benefits
- Enables offline data analysis
- Supports integration with other tools
- Better record-keeping
- Reduces support requests

## Priority
🟢 **LOW** - Nice-to-have feature

---

### Issue #13: Realtime Channel Cleanup on Navigation

**Title:** 🟢 LOW: Improve Realtime Channel Cleanup on Navigation

**Labels:** `bug`, `priority:low`, `performance`, `reliability`

**Description:**
## Problem
Realtime channels are only cleaned up on `beforeunload` event, but not when navigating between pages within the app. This could lead to memory leaks and unnecessary WebSocket connections.

## Locations
- `public/events.js:586` - Only cleans up on beforeunload
- `public/app.js:229-233` - Same issue

## Current Code
```javascript
// Only cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (realtimeChannel) {
    window.supabase.removeChannel(realtimeChannel);
  }
});
```

## Fix Required

**In events.js when navigating to registration:**
```javascript
function openEvent(eventId) {
  // Cleanup before navigation
  if (realtimeChannel) {
    window.supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  window.location.href = `/register.html?eventId=${eventId}`;
}
```

**Better: Use a global navigation handler:**
```javascript
// In a shared navigation module
function navigateTo(url, cleanup = true) {
  if (cleanup && window.currentChannel) {
    window.supabase.removeChannel(window.currentChannel);
    window.currentChannel = null;
  }
  window.location.href = url;
}
```

## Impact
- Small memory leak over time
- Multiple WebSocket connections open unnecessarily
- Slightly slower app on devices with many tabs

## Priority
🟢 **LOW** - Minor performance issue

---

### Issue #14: No Rate Limiting on Excel Upload Netlify Function

**Title:** 🟢 LOW: Add Rate Limiting to Excel Upload Function

**Labels:** `security`, `priority:low`, `cost-optimization`

**Description:**
## Problem
The `process-excel` Netlify Function has no rate limiting. Malicious users or bugs could spam the AI API causing unexpected costs from Anthropic Claude API usage.

## Location
`netlify/functions/process-excel.js`

## Risk Factors
- Anthropic API charged per token
- No limit on upload frequency
- Could be automated/scripted
- No user or IP tracking

## Proposed Solutions

**Option 1: Netlify Rate Limiting (Requires Pro Plan)**
```toml
# netlify.toml
[[edge_functions]]
  function = "process-excel"
  path = "/.netlify/functions/process-excel"

  [edge_functions.config]
    rate_limit = { window_size = "1m", max_requests = 10 }
```

**Option 2: In-Function Rate Limiting with Supabase**
```javascript
// Track uploads in database
const { data: recent } = await supabase
  .from('upload_log')
  .select('*')
  .eq('user_id', userId)
  .gte('created_at', new Date(Date.now() - 60000)); // Last minute

if (recent.length >= 5) {
  return {
    statusCode: 429,
    body: JSON.stringify({
      error: 'Too many uploads. Please wait before trying again.'
    })
  };
}
```

**Option 3: Simple In-Memory Rate Limiter**
```javascript
const uploadTracker = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const userUploads = uploadTracker.get(ip) || [];

  // Remove old entries (older than 1 minute)
  const recentUploads = userUploads.filter(t => now - t < 60000);

  if (recentUploads.length >= 5) {
    return false; // Rate limit exceeded
  }

  recentUploads.push(now);
  uploadTracker.set(ip, recentUploads);
  return true;
}
```

## Impact
- Potential API cost overruns
- Denial of service if abused
- Unfair usage by single user

## Priority
🟢 **LOW** - Risk mitigation, not immediate threat

---

### Issue #15: No Retry Logic for Supabase Operations

**Title:** 🟢 LOW: Add Retry Logic for Critical Supabase Operations

**Labels:** `enhancement`, `priority:low`, `reliability`

**Description:**
## Problem
Network errors cause Supabase operations to fail permanently with no retry mechanism. Transient network issues result in failed registrations or data operations that could have succeeded with a retry.

## Common Failure Scenarios
- Temporary network interruption
- Supabase momentary downtime
- Rate limiting from Supabase
- Timeout on slow connections

## Proposed Implementation

**Generic Retry Wrapper:**
```javascript
// utils.js
async function withRetry(operation, options = {}) {
  const {
    maxRetries = 3,
    backoffMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = (error) => true
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const shouldRetryError = shouldRetry(error);

      if (isLastAttempt || !shouldRetryError) {
        throw error;
      }

      // Exponential backoff
      const delay = backoffMs * Math.pow(backoffMultiplier, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));

      console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
    }
  }
}

export { withRetry };
```

**Usage Example:**
```javascript
// Wrap critical operations
const participant = await withRetry(
  () => window.supabase
    .from('participants')
    .insert([participantData])
    .select()
    .single(),
  {
    maxRetries: 3,
    shouldRetry: (error) => {
      // Don't retry validation errors
      return !error.message.includes('duplicate') &&
             !error.message.includes('constraint');
    }
  }
);
```

**Apply to Critical Operations:**
- Event creation/update
- Participant registration
- Pre-registration upload
- Stats loading

## Benefits
- Better resilience to network issues
- Fewer failed operations
- Better user experience
- Automatic recovery from transient errors

## Considerations
- Don't retry validation errors (duplicates, constraints)
- Don't retry on client errors (400s)
- Show retry feedback to user
- Add max retry timeout

## Priority
🟢 **LOW** - Nice-to-have reliability improvement

---

## Summary

| Priority | Count | Timeframe |
|----------|-------|-----------|
| 🔴 Critical | 3 | **Week 1** |
| 🟠 High | 4 | **Week 2** |
| 🟡 Medium | 4 | **Week 3** |
| 🟢 Low | 5 | **Week 4+** |

**Total Issues:** 15

---

## Quick Create Script

To create all issues at once using GitHub CLI:

```bash
#!/bin/bash
# Run this script from repository root after authenticating with: gh auth login

# Critical Issues
gh issue create --title "🔴 CRITICAL: Environment Variable Naming Mismatch in config.js" --body-file .github/issues/issue-001.md --label "bug,critical,priority:high"
gh issue create --title "🔴 CRITICAL: Missing organization_id in Event Creation" --body-file .github/issues/issue-002.md --label "bug,critical,priority:high"
gh issue create --title "🔴 CRITICAL: Documentation Inconsistency - profiles vs users Table" --body-file .github/issues/issue-003.md --label "documentation,critical,priority:high"

# High Priority
gh issue create --title "🟠 HIGH: Missing Password Reset Page" --body-file .github/issues/issue-004.md --label "bug,priority:high,ux"
gh issue create --title "🟠 HIGH: No Error Handling for Supabase Client Initialization" --body-file .github/issues/issue-005.md --label "bug,priority:high,reliability"
gh issue create --title "🟠 HIGH: Missing DNI Field in Quick Add Form" --body-file .github/issues/issue-006.md --label "enhancement,priority:high,consistency"

# Medium Priority
gh issue create --title "🟡 MEDIUM: Duplicate Utility Functions Across Files" --body-file .github/issues/issue-007.md --label "refactor,priority:medium,code-quality"
gh issue create --title "🟡 MEDIUM: No Confirmation Before Clearing Pre-registered List" --body-file .github/issues/issue-008.md --label "enhancement,priority:medium,ux,safety"
gh issue create --title "🟡 MEDIUM: Event Stats Loading State Never Completes on Error" --body-file .github/issues/issue-009.md --label "bug,priority:medium,ux"
gh issue create --title "🟡 MEDIUM: Search Debouncing Has No Visual Feedback" --body-file .github/issues/issue-010.md --label "enhancement,priority:medium,ux"

# Low Priority
gh issue create --title "🟢 LOW: Global Variables - Poor Code Organization" --body-file .github/issues/issue-011.md --label "refactor,priority:low,code-quality,technical-debt"
gh issue create --title "🟢 LOW: Add Participant Export to CSV/Excel" --body-file .github/issues/issue-012.md --label "enhancement,priority:low,feature"
gh issue create --title "🟢 LOW: Improve Realtime Channel Cleanup on Navigation" --body-file .github/issues/issue-013.md --label "bug,priority:low,performance,reliability"
gh issue create --title "🟢 LOW: Add Rate Limiting to Excel Upload Function" --body-file .github/issues/issue-014.md --label "security,priority:low,cost-optimization"
gh issue create --title "🟢 LOW: Add Retry Logic for Critical Supabase Operations" --body-file .github/issues/issue-015.md --label "enhancement,priority:low,reliability"

echo "✅ All 15 issues created successfully!"
```

---

## Alternative: Manual Creation

You can also copy each issue from this document and create them manually through the GitHub web interface:
1. Go to your repository on GitHub
2. Click on "Issues" tab
3. Click "New issue"
4. Copy the title and description from above
5. Add the specified labels
6. Click "Submit new issue"
