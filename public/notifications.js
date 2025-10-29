// Centralized Notification System
// Provides toast-style notifications in bottom-right corner without layout shifts

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = [];
    this.init();
  }

  init() {
    // Create container on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.createContainer());
    } else {
      this.createContainer();
    }
  }

  createContainer() {
    this.container = document.getElementById('notificationContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notificationContainer';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'info', duration = 3000) {
    if (!this.container) {
      this.createContainer();
    }

    const notification = this.createNotification(message, type, duration);
    this.notifications.push(notification);
    this.container.appendChild(notification.element);

    // Trigger animation
    setTimeout(() => {
      notification.element.classList.add('show');
    }, 10);

    // Auto-dismiss
    if (duration > 0) {
      notification.timeout = setTimeout(() => {
        this.dismiss(notification);
      }, duration);
    }

    return notification;
  }

  createNotification(message, type, duration) {
    const element = document.createElement('div');
    element.className = `notification notification-${type}`;

    const icon = this.getIcon(type);
    const closeBtn = '<button class="notification-close" aria-label="Close">&times;</button>';

    element.innerHTML = `
      <div class="notification-icon">${icon}</div>
      <div class="notification-content">
        <div class="notification-message">${this.escapeHtml(message)}</div>
        ${duration > 0 ? `<div class="notification-progress"><div class="notification-progress-bar" style="animation-duration: ${duration}ms"></div></div>` : ''}
      </div>
      ${closeBtn}
    `;

    const notification = {
      element,
      type,
      timeout: null
    };

    // Close button handler
    const closeBtnElement = element.querySelector('.notification-close');
    closeBtnElement.addEventListener('click', () => {
      this.dismiss(notification);
    });

    return notification;
  }

  dismiss(notification) {
    if (notification.timeout) {
      clearTimeout(notification.timeout);
    }

    notification.element.classList.remove('show');
    notification.element.classList.add('hide');

    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
      this.notifications = this.notifications.filter(n => n !== notification);
    }, 300);
  }

  getIcon(type) {
    const icons = {
      success: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`,
      error: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`,
      warning: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`,
      info: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`
    };
    return icons[type] || icons.info;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // Convenience methods
  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 4000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 4000) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }

  // Clear all notifications
  clearAll() {
    this.notifications.forEach(notification => {
      this.dismiss(notification);
    });
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.NotificationManager = notificationManager;
}
