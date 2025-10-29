/**
 * Authentication Helper Module
 *
 * Provides functions for user authentication:
 * - Sign in with email/password
 * - Sign up with email/password
 * - Sign out
 * - Session management
 * - Auth state listeners
 */

/**
 * Sign in with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} - { user, session, error }
 */
async function signIn(email, password) {
  try {
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, session: null, error };
  }
}

/**
 * Sign up with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} fullName - User full name
 * @param {string} role - User role ('admin' or 'assistant')
 * @param {string} organizationId - Optional organization ID
 * @returns {Promise<Object>} - { user, session, error }
 */
async function signUp(email, password, fullName, role = 'assistant', organizationId = null) {
  try {
    // Prepare user metadata
    const metadata = {
      full_name: fullName,
      role: role
    };

    // Add organization ID if provided
    if (organizationId) {
      metadata.organization_id = organizationId;
    }

    const { data, error } = await window.supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });

    if (error) throw error;

    return { user: data.user, session: data.session, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { user: null, session: null, error };
  }
}

/**
 * Sign out current user
 * @returns {Promise<Object>} - { error }
 */
async function signOut() {
  try {
    const { error } = await window.supabase.auth.signOut();
    if (error) throw error;

    // Redirect to login page
    window.location.href = '/login.html';

    return { error: null };
  } catch (error) {
    console.error('Sign out error:', error);
    return { error };
  }
}

/**
 * Get current session
 * @returns {Promise<Object|null>}
 */
async function getSession() {
  const { data: { session } } = await window.supabase.auth.getSession();
  return session;
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Callback function (event, session) => {}
 * @returns {Object} - Subscription object with unsubscribe method
 */
function onAuthStateChange(callback) {
  const { data: { subscription } } = window.supabase.auth.onAuthStateChange(callback);
  return subscription;
}

/**
 * Reset password (send email with reset link)
 * @param {string} email - User email
 * @returns {Promise<Object>} - { error }
 */
async function resetPassword(email) {
  try {
    const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`
    });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Password reset error:', error);
    return { error };
  }
}

/**
 * Update password (requires active session)
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} - { user, error }
 */
async function updatePassword(newPassword) {
  try {
    const { data, error } = await window.supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    return { user: data.user, error: null };
  } catch (error) {
    console.error('Password update error:', error);
    return { user: null, error };
  }
}

/**
 * Update user profile
 * @param {Object} updates - Profile fields to update
 * @returns {Promise<Object>} - { data, error }
 */
async function updateProfile(updates) {
  try {
    const { data: { user } } = await window.supabase.auth.getUser();

    if (!user) {
      throw new Error('No authenticated user');
    }

    const { data, error } = await window.supabase
      .from('users')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Profile update error:', error);
    return { data: null, error };
  }
}

/**
 * Check if current session is valid
 * @returns {Promise<boolean>}
 */
async function isSessionValid() {
  const session = await getSession();
  if (!session) return false;

  // Check if session is expired
  const expiresAt = session.expires_at;
  const now = Math.floor(Date.now() / 1000);

  return expiresAt > now;
}

/**
 * Refresh session if expired
 * @returns {Promise<Object>} - { session, error }
 */
async function refreshSession() {
  try {
    const { data, error } = await window.supabase.auth.refreshSession();

    if (error) throw error;

    return { session: data.session, error: null };
  } catch (error) {
    console.error('Session refresh error:', error);
    return { session: null, error };
  }
}

// Export all functions
window.auth = {
  signIn,
  signUp,
  signOut,
  getSession,
  onAuthStateChange,
  resetPassword,
  updatePassword,
  updateProfile,
  isSessionValid,
  refreshSession
};

console.log('Auth module loaded');
