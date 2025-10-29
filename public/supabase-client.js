/**
 * Supabase Client Configuration
 *
 * This file initializes and exports the Supabase client for use throughout the application.
 * It fetches configuration from the server API endpoint.
 */

// Store initialization promise for other modules to wait on
let initPromise = null;
let supabaseClient = null;

// Initialize Supabase client by fetching config from server
initPromise = (async function initSupabase() {
  try {
    // Fetch config from server
    // Try Netlify Functions endpoint first (for production), then local API (for development)
    let response = await fetch('/.netlify/functions/config');

    if (!response.ok) {
      // Fallback to local API endpoint
      response = await fetch('/api/config');
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.statusText}`);
    }

    const config = await response.json();
    const SUPABASE_URL = config.supabaseUrl;
    const SUPABASE_ANON_KEY = config.supabaseAnonKey;

    // Validate configuration
    if (!SUPABASE_URL) {
      console.error('Supabase URL is not configured. Please set NEXT_PUBLIC_SUPABASE_URL environment variable.');
      throw new Error('Supabase URL is not configured');
    }

    if (!SUPABASE_ANON_KEY) {
      console.error('Supabase anon key is not configured. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
      throw new Error('Supabase anon key is not configured');
    }

    // Initialize Supabase client using the CDN library
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    });

    // Export for use in other modules
    window.supabase = supabaseClient;

    console.log('Supabase client initialized successfully');
    return supabaseClient;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    throw error;
  }
})();

// Export initialization promise
window.supabaseReady = initPromise;

/**
 * Helper: Check if user is authenticated
 * @returns {Promise<boolean>}
 */
async function isAuthenticated() {
  await window.supabaseReady;
  const { data: { session } } = await window.supabase.auth.getSession();
  return !!session;
}

/**
 * Helper: Get current user
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
  await window.supabaseReady;
  const { data: { user } } = await window.supabase.auth.getUser();
  return user;
}

/**
 * Helper: Get current user profile (from users table)
 * @returns {Promise<Object|null>}
 */
async function getUserProfile() {
  await window.supabaseReady;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await window.supabase
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
  await window.supabaseReady;
  const profile = await getUserProfile();
  return profile?.role === 'admin';
}

/**
 * Helper: Redirect to login if not authenticated
 */
async function requireAuth() {
  await window.supabaseReady;
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
  await window.supabaseReady;
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
