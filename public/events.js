// Global state
let events = [];
let realtimeChannel = null;
let currentEventId = null;
let isEditing = false;
let currentUser = null;
let userProfile = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  if (!(await window.supabaseHelpers.requireAuth())) {
    return;
  }

  // Load user info
  await loadUserInfo();

  // Initialize realtime subscriptions
  initializeRealtime();

  // Load events
  await loadEvents();

  // Setup event handlers
  setupEventHandlers();
});

// Load user information
async function loadUserInfo() {
  try {
    currentUser = await window.supabaseHelpers.getCurrentUser();
    userProfile = await window.supabaseHelpers.getUserProfile();

    if (!userProfile) return;

    // Get user initials for avatar
    const initials = userProfile.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    // Update user menu trigger
    document.getElementById('userInitials').textContent = initials;
    const userName = document.querySelector('.user-details .user-name');
    const userRole = document.querySelector('.user-details .user-role');
    if (userName) userName.textContent = userProfile.full_name;
    if (userRole) userRole.textContent = userProfile.role;

    // Update dropdown menu
    const dropdownName = document.getElementById('dropdownUserName');
    const dropdownEmail = document.getElementById('dropdownUserEmail');
    if (dropdownName) dropdownName.textContent = userProfile.full_name;
    if (dropdownEmail) dropdownEmail.textContent = currentUser.email;

    // Update welcome message
    const welcomeMsg = document.getElementById('welcomeMessage');
    const firstName = userProfile.full_name.split(' ')[0];
    if (welcomeMsg) {
      welcomeMsg.textContent = `Welcome back, ${firstName}!`;
    }

    // Show/hide create button based on role
    const createBtn = document.getElementById('createEventBtn');
    if (createBtn && userProfile.role === 'admin') {
      createBtn.style.display = 'flex';
    }
  } catch (error) {
    console.error('Error loading user info:', error);
    window.NotificationManager.error('Failed to load user information');
  }
}

// Set up Supabase Realtime for real-time updates
function initializeRealtime() {
  // Subscribe to events table changes
  realtimeChannel = window.supabase
    .channel('events-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events' },
      (payload) => {
        console.log('Event created:', payload);
        events.unshift(payload.new);
        renderEvents();
        window.NotificationManager.success('Event created successfully!');
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events' },
      (payload) => {
        console.log('Event updated:', payload);
        const index = events.findIndex(e => e.id === payload.new.id);
        if (index !== -1) {
          events[index] = payload.new;
          renderEvents();
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'events' },
      (payload) => {
        console.log('Event deleted:', payload);
        events = events.filter(e => e.id !== payload.old.id);
        renderEvents();
        window.NotificationManager.success('Event deleted successfully');
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Realtime subscribed successfully');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Realtime subscription error');
        setTimeout(initializeRealtime, 3000);
      }
    });
}

// Load all events
async function loadEvents() {
  try {
    const { data, error } = await window.supabase
      .from('events')
      .select('*')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw error;

    events = data || [];
    renderEvents();
  } catch (error) {
    console.error('Error loading events:', error);
    window.NotificationManager.error('Failed to load events');
  }
}

// Render events grid
function renderEvents() {
  const grid = document.getElementById('eventsGrid');

  // Update event count
  const eventCountEl = document.getElementById('eventCount');
  if (eventCountEl) {
    const count = events.length;
    eventCountEl.textContent = `${count} event${count !== 1 ? 's' : ''}`;
  }

  if (events.length === 0) {
    const isAdmin = userProfile?.role === 'admin';
    const message = isAdmin
      ? 'No events yet. Click "Create New Event" to get started.'
      : 'No events available. Contact your administrator to create events.';
    grid.innerHTML = `<div class="no-events">${message}</div>`;
    return;
  }

  const isAdmin = userProfile?.role === 'admin';

  grid.innerHTML = events.map(event => {
    const date = event.event_date ? formatDate(event.event_date) : 'No date set';
    const createdDate = formatDateTime(event.created_at);

    // Show edit/delete buttons only for admins
    const actionsHtml = isAdmin ? `
      <div class="event-card-actions">
        <button class="btn-icon" onclick="editEvent('${event.id}')" title="Edit">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M11.333 2A1.886 1.886 0 0 1 14 4.667l-9 9-3.667.666.667-3.666 9-9z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="btn-icon btn-delete" onclick="showDeleteModal('${event.id}')" title="Delete">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
            <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4m2 0v9.333a1.333 1.333 0 0 1-1.334 1.334H4.667a1.333 1.333 0 0 1-1.334-1.334V4h9.334z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    ` : '';

    return `
      <div class="event-card" data-id="${event.id}">
        <div class="event-card-header">
          <h3>${escapeHtml(event.name)}</h3>
          ${actionsHtml}
        </div>
        <div class="event-card-body">
          <div class="event-meta">
            <span class="event-date">📅 ${date}</span>
            <span class="event-created">Created ${createdDate}</span>
          </div>
          ${event.description ? `<p class="event-description">${escapeHtml(event.description)}</p>` : ''}
          <div class="event-stats" id="stats-${event.id}">
            <div class="stat-loading">Loading stats...</div>
          </div>
        </div>
        <div class="event-card-footer">
          <button class="btn-primary btn-block" onclick="openEvent('${event.id}')">
            Open Registration →
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Load stats for each event
  events.forEach(event => loadEventStats(event.id));
}

// Load stats for a specific event
async function loadEventStats(eventId) {
  try {
    // Get total registered participants
    const { count: totalCount, error: totalError } = await window.supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (totalError) throw totalError;

    // Get pending pre-registered count
    const { count: pendingCount, error: pendingError } = await window.supabase
      .from('pre_registered_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('is_registered', false);

    if (pendingError) throw pendingError;

    const statsDiv = document.getElementById(`stats-${eventId}`);

    if (!statsDiv) return;

    statsDiv.innerHTML = `
      <div class="stat-item">
        <strong>${totalCount || 0}</strong>
        <span>Registered</span>
      </div>
      <div class="stat-item">
        <strong>${pendingCount || 0}</strong>
        <span>Pending</span>
      </div>
    `;
  } catch (error) {
    console.error('Error loading event stats:', error);
  }
}

// Setup event handlers
function setupEventHandlers() {
  const createBtn = document.getElementById('createEventBtn');
  const modal = document.getElementById('eventModal');
  const modalClose = document.getElementById('modalClose');
  const cancelBtn = document.getElementById('cancelBtn');
  const eventForm = document.getElementById('eventForm');
  const deleteModal = document.getElementById('deleteModal');
  const deleteModalClose = document.getElementById('deleteModalClose');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const userMenuTrigger = document.getElementById('userMenuTrigger');
  const userMenuDropdown = document.getElementById('userMenuDropdown');

  // User menu dropdown toggle
  if (userMenuTrigger && userMenuDropdown) {
    userMenuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = userMenuDropdown.style.display === 'block';
      userMenuDropdown.style.display = isVisible ? 'none' : 'block';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!userMenuTrigger.contains(e.target) && !userMenuDropdown.contains(e.target)) {
        userMenuDropdown.style.display = 'none';
      }
    });
  }

  // Create event button
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      openCreateModal();
    });
  }

  // Close modal buttons
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Close delete modal buttons
  if (deleteModalClose) deleteModalClose.addEventListener('click', closeDeleteModal);
  if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);

  // Confirm delete
  if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);

  // Click outside modal to close
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }

  if (deleteModal) {
    deleteModal.addEventListener('click', (e) => {
      if (e.target === deleteModal) {
        closeDeleteModal();
      }
    });
  }

  // ESC key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modal && modal.style.display === 'flex') {
        closeModal();
      }
      if (deleteModal && deleteModal.style.display === 'flex') {
        closeDeleteModal();
      }
    }
  });

  // Form submission
  if (eventForm) {
    eventForm.addEventListener('submit', handleFormSubmit);
  }
}

// Open create modal
function openCreateModal() {
  // Check if user is admin
  if (userProfile?.role !== 'admin') {
    window.NotificationManager.error('Only admins can create events');
    return;
  }

  isEditing = false;
  currentEventId = null;
  document.getElementById('modalTitle').textContent = 'Create New Event';
  document.getElementById('submitBtn').textContent = 'Create Event';
  document.getElementById('eventForm').reset();
  document.getElementById('eventId').value = '';
  document.getElementById('eventModal').style.display = 'flex';
  document.getElementById('eventName').focus();
}

// Edit event
async function editEvent(eventId) {
  // Check if user is admin
  if (userProfile?.role !== 'admin') {
    window.NotificationManager.error('Only admins can edit events');
    return;
  }

  const event = events.find(e => e.id === eventId);
  if (!event) return;

  isEditing = true;
  currentEventId = eventId;
  document.getElementById('modalTitle').textContent = 'Edit Event';
  document.getElementById('submitBtn').textContent = 'Update Event';
  document.getElementById('eventId').value = eventId;
  document.getElementById('eventName').value = event.name;
  document.getElementById('eventDate').value = event.event_date || '';
  document.getElementById('eventDescription').value = event.description || '';
  document.getElementById('eventModal').style.display = 'flex';
  document.getElementById('eventName').focus();
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  // Check if user is admin
  if (userProfile?.role !== 'admin') {
    window.NotificationManager.error('Only admins can create/edit events');
    return;
  }

  const eventData = {
    name: document.getElementById('eventName').value.trim(),
    event_date: document.getElementById('eventDate').value || null,
    description: document.getElementById('eventDescription').value.trim() || null
  };

  // Add created_by for new events
  if (!isEditing) {
    eventData.created_by = currentUser.id;
  }

  try {
    let result;

    if (isEditing) {
      const { data, error } = await window.supabase
        .from('events')
        .update(eventData)
        .eq('id', currentEventId)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await window.supabase
        .from('events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    closeModal();
    window.NotificationManager.success(isEditing ? 'Event updated successfully!' : 'Event created successfully!');
  } catch (error) {
    console.error('Error saving event:', error);
    window.NotificationManager.error(error.message || 'Failed to save event');
  }
}

// Close modal
function closeModal() {
  document.getElementById('eventModal').style.display = 'none';
  document.getElementById('eventForm').reset();
  isEditing = false;
  currentEventId = null;
}

// Show delete confirmation modal
function showDeleteModal(eventId) {
  // Check if user is admin
  if (userProfile?.role !== 'admin') {
    window.NotificationManager.error('Only admins can delete events');
    return;
  }

  currentEventId = eventId;
  document.getElementById('deleteModal').style.display = 'flex';
}

// Close delete modal
function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  currentEventId = null;
}

// Confirm delete
async function confirmDelete() {
  if (!currentEventId) return;

  // Check if user is admin
  if (userProfile?.role !== 'admin') {
    window.NotificationManager.error('Only admins can delete events');
    closeDeleteModal();
    return;
  }

  try {
    // Soft delete - set is_deleted to true
    const { error } = await window.supabase
      .from('events')
      .update({ is_deleted: true })
      .eq('id', currentEventId);

    if (error) throw error;

    closeDeleteModal();
  } catch (error) {
    console.error('Error deleting event:', error);
    window.NotificationManager.error(error.message || 'Failed to delete event');
    closeDeleteModal();
  }
}

// Open event registration page
function openEvent(eventId) {
  window.location.href = `/register.html?eventId=${eventId}`;
}

// Sign out handler
async function handleSignOut() {
  await window.auth.signOut();
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Format date and time
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  // If less than 1 minute ago
  if (diff < 60000) {
    return 'Just now';
  }

  // If less than 1 hour ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  }

  // If today
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Otherwise show date
  return formatDate(dateString);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (realtimeChannel) {
    window.supabase.removeChannel(realtimeChannel);
  }
});
