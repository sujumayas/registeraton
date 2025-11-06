#!/bin/bash
# Script to create all GitHub issues from code review
# Usage: ./create-github-issues.sh
# Prerequisites: GitHub CLI installed and authenticated (gh auth login)

set -e

echo "🚀 Creating GitHub Issues for Code Review Refactoring..."
echo ""

# Color codes for output
RED='\033[0;31m'
ORANGE='\033[0;33m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) not found. Please install it first:"
    echo "   https://cli.github.com/manual/installation"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub CLI. Please run:"
    echo "   gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

# Critical Issues
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}Creating CRITICAL Issues (3)${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "1. Environment Variable Naming Mismatch..."
gh issue create \
  --title "🔴 CRITICAL: Environment Variable Naming Mismatch in config.js" \
  --label "bug,critical,priority:high" \
  --body "## Problem
The Netlify Function \`config.js\` expects \`NEXT_PUBLIC_SUPABASE_URL\` and \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, but documentation specifies \`SUPABASE_URL\` and \`SUPABASE_ANON_KEY\`. This causes frontend to fail loading Supabase configuration.

## Location
\`netlify/functions/config.js:31-32\`

## Current Code
\`\`\`javascript
supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
\`\`\`

## Fix Required
Change to match documentation:
\`\`\`javascript
supabaseUrl: process.env.SUPABASE_URL,
supabaseAnonKey: process.env.SUPABASE_ANON_KEY
\`\`\`

## Impact
- App cannot initialize Supabase client
- All database operations fail
- User sees blank screen or errors

## Priority
🔴 **CRITICAL** - Must fix immediately for app to work"

echo ""

echo "2. Missing organization_id in Event Creation..."
gh issue create \
  --title "🔴 CRITICAL: Missing organization_id in Event Creation" \
  --label "bug,critical,priority:high" \
  --body "## Problem
When creating events, the code sets \`organization_id\` from \`userProfile.organization_id\`, but the \`getUserProfile()\` function doesn't SELECT this field from the database, resulting in \`undefined\` being inserted.

## Location
- \`public/events.js:414\` - Sets undefined organization_id
- \`public/supabase-client.js:96-100\` - Missing field in SELECT

## Current Code
\`\`\`javascript
// supabase-client.js:96-100
const { data, error } = await window.supabase
  .from('users')
  .select('*')  // Should explicitly select organization_id
  .eq('id', user.id)
  .single();
\`\`\`

## Fix Required
Update \`getUserProfile()\` function:
\`\`\`javascript
const { data, error } = await window.supabase
  .from('users')
  .select('id, email, full_name, role, organization_id')
  .eq('id', user.id)
  .single();
\`\`\`

## Impact
- Event creation fails due to NOT NULL constraint on organization_id
- Users cannot create events
- Database error shown to admins

## Priority
🔴 **CRITICAL** - Blocks core functionality"

echo ""

echo "3. Documentation Inconsistency..."
gh issue create \
  --title "🔴 CRITICAL: Documentation Inconsistency - profiles vs users Table" \
  --label "documentation,critical,priority:high" \
  --body "## Problem
Database schema defines \`users\` table with UUID IDs, but documentation (CLAUDE.md, README.md) references \`profiles\` table with BIGINT IDs. This creates confusion when developing or onboarding new developers.

## Affected Files
- \`CLAUDE.md\` - References 'profiles' table
- \`README.md\` - References 'profiles' table
- \`supabase/migrations/001_initial_schema.sql\` - Defines 'users' table
- Frontend code - Correctly uses 'users' table

## Issues
1. Table name mismatch: \`profiles\` (docs) vs \`users\` (actual)
2. ID type mismatch: BIGINT (docs) vs UUID (actual)
3. Schema structure doesn't match implementation

## Fix Required
Update all documentation files to match actual implementation:
- Replace all references to \`profiles\` table with \`users\`
- Update ID types from BIGINT to UUID
- Update table structure documentation
- Ensure consistency across CLAUDE.md and README.md

## Impact
- New developers follow wrong schema
- Queries fail due to incorrect table names
- Confusion about data types and relationships

## Priority
🔴 **CRITICAL** - Causes developer confusion and potential bugs"

echo ""

# High Priority Issues
echo -e "${ORANGE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${ORANGE}Creating HIGH PRIORITY Issues (4)${NC}"
echo -e "${ORANGE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "4. Missing Password Reset Page..."
gh issue create \
  --title "🟠 HIGH: Missing Password Reset Page" \
  --label "bug,priority:high,ux" \
  --body "## Problem
Password reset functionality redirects to \`/reset-password.html\` which doesn't exist, breaking the password recovery flow.

## Location
\`public/auth.js:119\`

## Current Code
\`\`\`javascript
const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
  redirectTo: \`\${window.location.origin}/reset-password.html\`  // Page doesn't exist!
});
\`\`\`

## Fix Options
1. Create the \`reset-password.html\` page with password update form
2. Update redirect to handle reset in login page
3. Redirect to Supabase-hosted password reset page

## Impact
- Users cannot reset forgotten passwords
- Support requests increase
- Poor user experience

## Priority
🟠 **HIGH** - Important UX feature missing"

echo ""

echo "5. No Error Handling for Supabase Client..."
gh issue create \
  --title "🟠 HIGH: No Error Handling for Supabase Client Initialization" \
  --label "bug,priority:high,reliability" \
  --body "## Problem
If Supabase config fetch fails (both endpoints), the error is thrown but not handled gracefully. App becomes completely unusable with no user feedback.

## Location
\`public/supabase-client.js:13-62\`

## Impact
- Users see cryptic errors or blank screen
- No clear indication of what's wrong
- Difficult to debug for non-technical users

## Priority
🟠 **HIGH** - Affects all users when config fails"

echo ""

echo "6. Missing DNI Field in Quick Add..."
gh issue create \
  --title "🟠 HIGH: Missing DNI Field in Quick Add Form" \
  --label "enhancement,priority:high,consistency" \
  --body "## Problem
Database schema has \`dni\` field (nullable), pre-registration includes it, but Quick Add form doesn't collect it. This creates inconsistent data between pre-registered and manually added participants.

## Location
- \`public/app.js:566-573\` - Quick Add data collection
- \`public/register.html:125-131\` - Quick Add modal HTML

## Impact
- Data inconsistency between pre-registered and manual entries
- Cannot track participants by DNI if manually added
- Confusion about which fields are required

## Priority
🟠 **HIGH** - Data consistency issue"

echo ""

# Medium Priority Issues
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Creating MEDIUM PRIORITY Issues (4)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "7. Duplicate Utility Functions..."
gh issue create \
  --title "🟡 MEDIUM: Duplicate Utility Functions Across Files" \
  --label "refactor,priority:medium,code-quality" \
  --body "## Problem
\`escapeHtml()\` and \`formatDateTime()\` functions are duplicated in multiple files, violating DRY principle and making maintenance harder.

## Locations
- \`public/events.js:569-579\`
- \`public/app.js:216-226\`
- \`public/notifications.js:126-135\`

## Priority
🟡 **MEDIUM** - Code quality improvement"

echo ""

echo "8. No Confirmation Before Clearing List..."
gh issue create \
  --title "🟡 MEDIUM: No Confirmation Before Clearing Pre-registered List" \
  --label "enhancement,priority:medium,ux,safety" \
  --body "## Problem
Uploading a new Excel file immediately deletes ALL existing pre-registered participants with no warning. This could result in accidental data loss.

## Location
\`public/app.js:419-426\`

## Impact
- Risk of accidental data loss
- Users may not realize previous list is deleted
- No way to undo the operation

## Priority
🟡 **MEDIUM** - Safety feature to prevent accidents"

echo ""

echo "9. Event Stats Loading State..."
gh issue create \
  --title "🟡 MEDIUM: Event Stats Loading State Never Completes on Error" \
  --label "bug,priority:medium,ux" \
  --body "## Problem
Event cards show \"Loading stats...\" but if the stats query fails, it stays in loading state forever with no error indication.

## Location
\`public/events.js:233-269\`

## Impact
- Confusing UX - users don't know if it's still loading or failed
- No way to retry loading stats
- Looks unprofessional

## Priority
🟡 **MEDIUM** - UX improvement"

echo ""

echo "10. Search Debouncing Feedback..."
gh issue create \
  --title "🟡 MEDIUM: Search Debouncing Has No Visual Feedback" \
  --label "enhancement,priority:medium,ux" \
  --body "## Problem
User types in search box, nothing happens for 300ms, then results appear. No indication that search is in progress during debounce period.

## Locations
- \`public/app.js:472-500\`
- \`public/app.js:740-760\`

## Impact
- Poor user experience during search
- Users may think app is frozen

## Priority
🟡 **MEDIUM** - UX polish"

echo ""

# Low Priority Issues
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Creating LOW PRIORITY Issues (5)${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "11. Global Variables..."
gh issue create \
  --title "🟢 LOW: Global Variables - Poor Code Organization" \
  --label "refactor,priority:low,code-quality,technical-debt" \
  --body "## Problem
All variables in \`events.js\` and \`app.js\` are global, making the code hard to test, maintain, and reason about.

## Locations
- \`public/events.js:1-7\`
- \`public/app.js:1-17\`

## Priority
🟢 **LOW** - Technical debt"

echo ""

echo "12. Participant Export..."
gh issue create \
  --title "🟢 LOW: Add Participant Export to CSV/Excel" \
  --label "enhancement,priority:low,feature" \
  --body "## Problem
Users can view registered participants in the UI but cannot export the list to CSV/Excel for external analysis, reporting, or record-keeping.

## Priority
🟢 **LOW** - Nice-to-have feature"

echo ""

echo "13. Realtime Channel Cleanup..."
gh issue create \
  --title "🟢 LOW: Improve Realtime Channel Cleanup on Navigation" \
  --label "bug,priority:low,performance,reliability" \
  --body "## Problem
Realtime channels are only cleaned up on \`beforeunload\` event, but not when navigating between pages within the app. This could lead to memory leaks.

## Locations
- \`public/events.js:586\`
- \`public/app.js:229-233\`

## Priority
🟢 **LOW** - Minor performance issue"

echo ""

echo "14. Rate Limiting..."
gh issue create \
  --title "🟢 LOW: Add Rate Limiting to Excel Upload Function" \
  --label "security,priority:low,cost-optimization" \
  --body "## Problem
The \`process-excel\` Netlify Function has no rate limiting. Malicious users or bugs could spam the AI API causing unexpected costs.

## Location
\`netlify/functions/process-excel.js\`

## Priority
🟢 **LOW** - Risk mitigation"

echo ""

echo "15. Retry Logic..."
gh issue create \
  --title "🟢 LOW: Add Retry Logic for Critical Supabase Operations" \
  --label "enhancement,priority:low,reliability" \
  --body "## Problem
Network errors cause Supabase operations to fail permanently with no retry mechanism. Transient network issues result in failed operations.

## Priority
🟢 **LOW** - Reliability improvement"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All 15 issues created successfully!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Summary:"
echo "  🔴 Critical:  3 issues"
echo "  🟠 High:      4 issues"
echo "  🟡 Medium:    4 issues"
echo "  🟢 Low:       5 issues"
echo "  ━━━━━━━━━━━━━━━━━━━━"
echo "  📝 Total:     15 issues"
echo ""
echo "View all issues: gh issue list"
echo "View by label:   gh issue list --label critical"
