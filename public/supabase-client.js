/**
 * Supabase Client Configuration
 *
 * This file initializes and exports the Supabase client for use throughout the application.
 * It uses environment variables (injected at build time by Netlify) for configuration.
 *
 * For local development:
 * 1. Copy .env.example to .env.local
 * 2. Fill in your Supabase URL and anon key
 * 3. Use a local dev server that loads environment variables
 */

// For production (Netlify), these are injected at build time
// For local development, you'll need to replace these with actual values
// or use a build tool that injects environment variables

const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Validate configuration
if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.error('Supabase URL is not configured. Please set SUPABASE_URL environment variable.');
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  console.error('Supabase anon key is not configured. Please set SUPABASE_ANON_KEY environment variable.');
}

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});

// Export for use in other modules
window.supabase = supabase;

/**
 * Helper: Check if user is authenticated
 * @returns {Promise<boolean>}
 */
async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Helper: Get current user
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Helper: Get current user profile (from users table)
 * @returns {Promise<Object|null>}
 */
async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
}

/**
 * Helper: Check if user is admin
 * @returns {Promise<boolean>}
 */
async function isAdmin() {
  const profile = await getUserProfile();
  return profile?.role === 'admin';
}

/**
 * Helper: Redirect to login if not authenticated
 */
async function requireAuth() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Helper: Redirect to login if not admin
 */
async function requireAdmin() {
  const authenticated = await requireAuth();
  if (!authenticated) return false;

  const admin = await isAdmin();
  if (!admin) {
    alert('You do not have permission to access this page.');
    window.location.href = '/events.html';
    return false;
  }
  return true;
}

// Export helpers
window.supabaseHelpers = {
  isAuthenticated,
  getCurrentUser,
  getUserProfile,
  isAdmin,
  requireAuth,
  requireAdmin
};

console.log('Supabase client initialized');
