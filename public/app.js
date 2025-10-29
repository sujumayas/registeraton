// Global state
let participants = [];
let preregisteredParticipants = [];
let realtimeChannel = null;
let currentTab = 'search';
let currentEventId = null;
let currentEvent = null;
let currentUser = null;
let userProfile = null;
let sortState = {
  column: null,
  direction: 'asc' // 'asc' or 'desc'
};
let registeredSortState = {
  column: 'time',
  direction: 'desc' // Default: newest first
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  if (!(await window.supabaseHelpers.requireAuth())) {
    return;
  }

  // Load user info
  currentUser = await window.supabaseHelpers.getCurrentUser();
  userProfile = await window.supabaseHelpers.getUserProfile();

  // Get event ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  currentEventId = urlParams.get('eventId');

  if (!currentEventId) {
    // Redirect to events page if no event ID
    window.location.href = '/events.html';
    return;
  }

  // Load event details first
  await loadEventDetails();

  // Initialize realtime subscriptions
  initializeRealtime();

  // Load data
  await loadParticipants();
  await loadPreregisteredParticipants();

  // Setup UI
  setupFileUpload();
  setupPreregSearch();
  setupQuickAdd();
  setupUIHandlers();
  setupSortHandlers();
  setupTabNavigation();
  setupRegisteredSearch();
  setupRegisteredSortHandlers();
});

// Load event details
async function loadEventDetails() {
  try {
    const { data, error } = await window.supabase
      .from('events')
      .select('*')
      .eq('id', currentEventId)
      .eq('is_deleted', false)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Event not found');

    currentEvent = data;

    // Update UI with event details
    document.getElementById('eventName').textContent = currentEvent.name;
    document.title = `${currentEvent.name} - Registration`;

    if (currentEvent.event_date) {
      const date = new Date(currentEvent.event_date);
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
      document.getElementById('eventDate').textContent = `📅 ${formattedDate}`;
    }
  } catch (error) {
    console.error('Error loading event:', error);
    window.NotificationManager.error('Event not found. Redirecting...');
    setTimeout(() => {
      window.location.href = '/events.html';
    }, 2000);
  }
}

// Set up Supabase Realtime for real-time updates
function initializeRealtime() {
  // Subscribe to participants table changes for this event
  realtimeChannel = window.supabase
    .channel('registration-changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'participants',
        filter: `event_id=eq.${currentEventId}`
      },
      (payload) => {
        console.log('New participant:', payload);
        participants.unshift(payload.new);
        renderRegisteredParticipants();
        updateStats();
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'participants',
        filter: `event_id=eq.${currentEventId}`
      },
      (payload) => {
        console.log('Participant deleted:', payload);
        participants = participants.filter(p => p.id !== payload.old.id);
        renderRegisteredParticipants();
        updateStats();
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'pre_registered_participants',
        filter: `event_id=eq.${currentEventId}`
      },
      (payload) => {
        console.log('Pre-registered change:', payload);
        loadPreregisteredParticipants();
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

// Load all participants from Supabase for current event
async function loadParticipants() {
  try {
    const { data, error } = await window.supabase
      .from('participants')
      .select('*')
      .eq('event_id', currentEventId)
      .order('registered_at', { ascending: false });

    if (error) throw error;

    participants = data || [];
    renderRegisteredParticipants();
    updateStats();
  } catch (error) {
    console.error('Error loading participants:', error);
    window.NotificationManager.error('Failed to load participants');
  }
}

// Update statistics
function updateStats() {
  document.getElementById('totalCount').textContent = participants.length;
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

  // Otherwise show date and time
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
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

// ====== PRE-REGISTRATION FUNCTIONS ======

// Setup UI handlers (setup panel, FAB, modal)
function setupUIHandlers() {
  // Setup button toggle
  const setupBtn = document.getElementById('setupBtn');
  const setupPanel = document.getElementById('setupPanel');

  setupBtn.addEventListener('click', () => {
    if (setupPanel.style.display === 'none' || !setupPanel.style.display) {
      setupPanel.style.display = 'block';
    } else {
      setupPanel.style.display = 'none';
    }
  });

  // Floating Action Button
  const fabBtn = document.getElementById('fabBtn');
  const modal = document.getElementById('quickAddModal');

  fabBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    document.getElementById('quickName').focus();
  });

  // Modal close button
  const modalClose = document.getElementById('modalClose');
  modalClose.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Click outside modal to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      modal.style.display = 'none';
    }
  });
}

// Load pre-registered participants for current event
async function loadPreregisteredParticipants() {
  try {
    const { data, error } = await window.supabase
      .from('pre_registered_participants')
      .select('*')
      .eq('event_id', currentEventId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    preregisteredParticipants = data || [];
    renderPreregistered();
    updatePreregStats();
  } catch (error) {
    console.error('Error loading pre-registered participants:', error);
  }
}

// Render pre-registered participants (optimized for speed)
function renderPreregistered(filteredList = null) {
  const tbody = document.getElementById('preregisterBody');
  let list = filteredList !== null ? filteredList : preregisteredParticipants.filter(p => !p.is_registered);

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="no-results"><td colspan="4">No participants found</td></tr>';
    updateSortArrows();
    return;
  }

  // Apply sorting if active
  if (sortState.column) {
    list = sortParticipants(list, sortState.column, sortState.direction);
  }

  tbody.innerHTML = list.map(p => {
    const emailDni = [p.email, p.dni].filter(Boolean).join(' • ') || '-';
    return `
    <tr data-id="${p.id}" class="${p.is_registered ? 'registered' : ''}">
      <td>${escapeHtml(p.full_name || p.identifier_value)}</td>
      <td>${escapeHtml(emailDni)}</td>
      <td>${escapeHtml(p.area || '-')}</td>
      <td>
        ${p.is_registered ?
          '<span class="text-muted">✓ Registered</span>' :
          `<button class="btn-register" onclick="registerPreregistered('${p.id}')">Register</button>`
        }
      </td>
    </tr>
  `;
  }).join('');

  updateSortArrows();
}

// Update pre-registration stats
async function updatePreregStats() {
  try {
    const { count: totalCount, error: totalError } = await window.supabase
      .from('pre_registered_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', currentEventId);

    if (totalError) throw totalError;

    const { count: pendingCount, error: pendingError } = await window.supabase
      .from('pre_registered_participants')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', currentEventId)
      .eq('is_registered', false);

    if (pendingError) throw pendingError;

    document.getElementById('preregPendingCount').textContent = pendingCount || 0;

    // Show/hide pre-reg stats box
    const statsBox = document.getElementById('preregStats');
    if (totalCount > 0) {
      statsBox.style.display = 'block';
    } else {
      statsBox.style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading pre-reg stats:', error);
  }
}

// Setup file upload
function setupFileUpload() {
  const fileInput = document.getElementById('excelFile');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileName = document.getElementById('fileName');

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileName.textContent = e.target.files[0].name;
      uploadBtn.style.display = 'inline-block';
    } else {
      fileName.textContent = '';
      uploadBtn.style.display = 'none';
    }
  });

  uploadBtn.addEventListener('click', uploadExcelFile);
}

// Upload Excel file
async function uploadExcelFile() {
  const fileInput = document.getElementById('excelFile');
  const file = fileInput.files[0];

  if (!file) {
    window.NotificationManager.error('Please select a file');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  const progressDiv = document.getElementById('uploadProgress');
  progressDiv.style.display = 'block';
  document.getElementById('uploadBtn').disabled = true;

  try {
    // Step 1: Call Netlify Function to process Excel with AI
    const response = await fetch('/.netlify/functions/process-excel', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    const { analysis, data: excelData } = result;

    // Step 2: Clear existing pre-registered participants for this event
    const { error: deleteError } = await window.supabase
      .from('pre_registered_participants')
      .delete()
      .eq('event_id', currentEventId);

    if (deleteError) throw deleteError;

    // Step 3: Insert new pre-registered records into Supabase
    const records = excelData.map(row => ({
      event_id: currentEventId,
      identifier_type: analysis.identifier_type,
      identifier_value: row[analysis.identifier_column] || 'Unknown',
      full_name: row[analysis.mappings.full_name] || null,
      email: row[analysis.mappings.email] || null,
      dni: row[analysis.mappings.dni] || null,
      area: row[analysis.mappings.area] || null,
      raw_data: row
    }));

    const { error: insertError } = await window.supabase
      .from('pre_registered_participants')
      .insert(records);

    if (insertError) throw insertError;

    window.NotificationManager.success(`✓ Success! ${records.length} participants loaded. AI identified: ${analysis.identifier_type}`, 5000);

    // Clear file input
    fileInput.value = '';
    document.getElementById('fileName').textContent = '';
    document.getElementById('uploadBtn').style.display = 'none';

    // Load the pre-registered list
    await loadPreregisteredParticipants();

    // Close setup panel and focus on search
    document.getElementById('setupPanel').style.display = 'none';
    document.getElementById('preregSearchInput').focus();
  } catch (error) {
    console.error('Error uploading file:', error);
    window.NotificationManager.error(error.message);
  } finally {
    progressDiv.style.display = 'none';
    document.getElementById('uploadBtn').disabled = false;
  }
}

// Setup pre-registration search
function setupPreregSearch() {
  const searchInput = document.getElementById('preregSearchInput');
  let searchTimeout;

  searchInput.addEventListener('input', async (e) => {
    const query = e.target.value.toLowerCase().trim();

    clearTimeout(searchTimeout);

    if (!query) {
      renderPreregistered();
      return;
    }

    // Debounce search
    searchTimeout = setTimeout(async () => {
      try {
        const { data, error } = await window.supabase
          .from('pre_registered_participants')
          .select('*')
          .eq('event_id', currentEventId)
          .eq('is_registered', false)
          .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,dni.ilike.%${query}%,identifier_value.ilike.%${query}%`)
          .limit(50);

        if (error) throw error;

        renderPreregistered(data);
      } catch (error) {
        console.error('Error searching:', error);
      }
    }, 300);
  });
}

// Register a pre-registered participant
async function registerPreregistered(preRegId) {
  try {
    // Get the pre-registered participant
    const { data: preReg, error: preRegError } = await window.supabase
      .from('pre_registered_participants')
      .select('*')
      .eq('id', preRegId)
      .single();

    if (preRegError) throw preRegError;

    // Create new participant record
    const participantData = {
      event_id: currentEventId,
      registered_by: currentUser.id,
      participant_type: 'participant',
      full_name: preReg.full_name || preReg.identifier_value || 'Unknown',
      email: preReg.email || `${preReg.identifier_value}@temp.com`,
      dni: preReg.dni || null,
      area: preReg.area || 'Not specified'
    };

    const { data: newParticipant, error: participantError } = await window.supabase
      .from('participants')
      .insert([participantData])
      .select()
      .single();

    if (participantError) throw participantError;

    // Update pre-registered record
    const { error: updateError } = await window.supabase
      .from('pre_registered_participants')
      .update({
        is_registered: true,
        registered_participant_id: newParticipant.id
      })
      .eq('id', preRegId);

    if (updateError) throw updateError;

    window.NotificationManager.success('Participant registered successfully!');

    // Reload pre-registered list
    await loadPreregisteredParticipants();

    // Focus back on search
    document.getElementById('preregSearchInput').focus();
  } catch (error) {
    console.error('Error registering participant:', error);
    window.NotificationManager.error(error.message || 'Registration failed');
  }
}

// Setup quick add form
function setupQuickAdd() {
  const form = document.getElementById('quickAddForm');
  const modal = document.getElementById('quickAddModal');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const participantData = {
      event_id: currentEventId,
      registered_by: currentUser.id,
      participant_type: 'participant',
      full_name: document.getElementById('quickName').value,
      email: document.getElementById('quickEmail').value,
      area: document.getElementById('quickArea').value
    };

    try {
      const { data, error } = await window.supabase
        .from('participants')
        .insert([participantData])
        .select()
        .single();

      if (error) throw error;

      // Clear form and close modal
      form.reset();
      modal.style.display = 'none';
      document.getElementById('preregSearchInput').focus();

      window.NotificationManager.success('Participant registered successfully!');
    } catch (error) {
      console.error('Error registering participant:', error);
      window.NotificationManager.error(error.message || 'Registration failed');
    }
  });
}

// ====== SORTING FUNCTIONS ======

// Setup sort handlers
function setupSortHandlers() {
  const sortableHeaders = document.querySelectorAll('.sortable');

  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;

      // Toggle direction if same column, otherwise set to ascending
      if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.column = column;
        sortState.direction = 'asc';
      }

      // Re-render with new sort
      renderPreregistered();
    });
  });
}

// Sort participants by column
function sortParticipants(list, column, direction) {
  const sorted = [...list].sort((a, b) => {
    let aVal, bVal;

    switch(column) {
      case 'name':
        aVal = (a.full_name || a.identifier_value || '').toLowerCase();
        bVal = (b.full_name || b.identifier_value || '').toLowerCase();
        break;
      case 'email':
        const aEmail = [a.email, a.dni].filter(Boolean).join(' ') || '';
        const bEmail = [b.email, b.dni].filter(Boolean).join(' ') || '';
        aVal = aEmail.toLowerCase();
        bVal = bEmail.toLowerCase();
        break;
      case 'area':
        aVal = (a.area || '').toLowerCase();
        bVal = (b.area || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

// Update sort arrow indicators
function updateSortArrows() {
  const headers = document.querySelectorAll('.sortable');

  headers.forEach(header => {
    const arrow = header.querySelector('.sort-arrow');
    const column = header.dataset.sort;

    if (sortState.column === column) {
      header.classList.add('sorted');
      arrow.classList.add('active');
      arrow.classList.toggle('desc', sortState.direction === 'desc');
    } else {
      header.classList.remove('sorted');
      arrow.classList.remove('active', 'desc');
    }
  });
}

// ====== TAB NAVIGATION ======

function setupTabNavigation() {
  const tabButtons = document.querySelectorAll('.tab-button');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  currentTab = tabName;

  // Update button states
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update content visibility
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  if (tabName === 'search') {
    document.getElementById('searchTab').classList.add('active');
    document.getElementById('preregSearchInput').focus();
  } else if (tabName === 'registered') {
    document.getElementById('registeredTab').classList.add('active');
    renderRegisteredParticipants();
  }
}

// ====== REGISTERED PARTICIPANTS VIEW ======

function renderRegisteredParticipants(filteredList = null) {
  const tbody = document.getElementById('registeredBody');
  let list = filteredList !== null ? filteredList : [...participants];

  if (list.length === 0) {
    tbody.innerHTML = '<tr class="no-results"><td colspan="4">No registered participants yet</td></tr>';
    updateRegisteredSortArrows();
    return;
  }

  // Apply sorting
  if (registeredSortState.column) {
    list = sortRegisteredParticipants(list, registeredSortState.column, registeredSortState.direction);
  }

  tbody.innerHTML = list.map(p => `
    <tr data-id="${p.id}">
      <td>${escapeHtml(p.full_name)}</td>
      <td>${escapeHtml(p.email)}</td>
      <td>${escapeHtml(p.area)}</td>
      <td class="time">${formatDateTime(p.registered_at)}</td>
    </tr>
  `).join('');

  updateRegisteredSortArrows();
}

function setupRegisteredSearch() {
  const searchInput = document.getElementById('registeredSearchInput');
  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    clearTimeout(searchTimeout);

    if (!query) {
      renderRegisteredParticipants();
      return;
    }

    // Debounce search
    searchTimeout = setTimeout(() => {
      const filtered = participants.filter(p => {
        return p.full_name.toLowerCase().includes(query) ||
               p.email.toLowerCase().includes(query) ||
               p.area.toLowerCase().includes(query);
      });
      renderRegisteredParticipants(filtered);
    }, 300);
  });
}

function setupRegisteredSortHandlers() {
  const sortableHeaders = document.querySelectorAll('.sortable-reg');

  sortableHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.sort;

      // Toggle direction if same column, otherwise set to ascending
      if (registeredSortState.column === column) {
        registeredSortState.direction = registeredSortState.direction === 'asc' ? 'desc' : 'asc';
      } else {
        registeredSortState.column = column;
        registeredSortState.direction = 'asc';
      }

      // Re-render with new sort
      renderRegisteredParticipants();
    });
  });
}

function sortRegisteredParticipants(list, column, direction) {
  const sorted = [...list].sort((a, b) => {
    let aVal, bVal;

    switch(column) {
      case 'name':
        aVal = a.full_name.toLowerCase();
        bVal = b.full_name.toLowerCase();
        break;
      case 'email':
        aVal = a.email.toLowerCase();
        bVal = b.email.toLowerCase();
        break;
      case 'area':
        aVal = a.area.toLowerCase();
        bVal = b.area.toLowerCase();
        break;
      case 'time':
        aVal = new Date(a.registered_at).getTime();
        bVal = new Date(b.registered_at).getTime();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}

function updateRegisteredSortArrows() {
  const headers = document.querySelectorAll('.sortable-reg');

  headers.forEach(header => {
    const arrow = header.querySelector('.sort-arrow');
    const column = header.dataset.sort;

    if (registeredSortState.column === column) {
      header.classList.add('sorted');
      arrow.classList.add('active');
      arrow.classList.toggle('desc', registeredSortState.direction === 'desc');
    } else {
      header.classList.remove('sorted');
      arrow.classList.remove('active', 'desc');
    }
  });
}
