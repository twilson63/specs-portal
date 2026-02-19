/**
 * Utility Functions
 */

/**
 * Parse Arweave tags array into object
 */
export function parseTags(tags) {
  const result = {};
  
  if (!tags || !Array.isArray(tags)) return result;
  
  for (const tag of tags) {
    let value = tag.value;
    
    // Parse comma-separated arrays
    if (tag.name === 'Spec-Topics' || tag.name === 'Spec-Authors') {
      value = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
    }
    
    // Strip Spec- prefix for cleaner access
    const key = tag.name.replace('Spec-', '');
    result[key] = value;
  }
  
  return result;
}

/**
 * Create tags array from metadata object
 */
export function createTags(metadata) {
  const tags = [
    { name: 'Content-Type', value: 'text/markdown' },
    { name: 'App-Name', value: 'Specs-Portal' },
    { name: 'Spec-Type', value: 'spec' },
    { name: 'Spec-Version', value: '1.0.0' },
    { name: 'Timestamp', value: Date.now().toString() }
  ];
  
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      tags.push({
        name: `Spec-${key}`,
        value: Array.isArray(value) ? value.join(',') : value.toString()
      });
    }
  });
  
  return tags;
}

/**
 * Shorten a hash for display
 */
export function shortHash(hash, start = 5, end = 5) {
  if (!hash) return '';
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp) {
  if (!timestamp || timestamp === 'Pending') return 'Pending';
  
  const ts = typeof timestamp === 'string' 
    ? parseInt(timestamp) > 2000000000 
      ? Math.floor(parseInt(timestamp) / 1000) 
      : parseInt(timestamp)
    : timestamp;
  
  if (ts <= 0) return 'Pending';
  
  const date = new Date(ts * 1000);
  return date.toLocaleDateString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

/**
 * Simple hash-based router
 */
export function createRouter(routes) {
  function handleRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, ...params] = hash.split('/').filter(Boolean);
    
    const handler = routes['/' + path] || routes['/'];
    if (handler) {
      handler(params);
    }
  }
  
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  
  return {
    navigate: (path) => {
      window.location.hash = path;
    }
  };
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render markdown to HTML
 */
export function renderMarkdown(content) {
  if (window.marked) {
    return window.marked.parse(content);
  }
  // Fallback: escape and wrap in pre
  return `<pre>${escapeHtml(content)}</pre>`;
}

/**
 * Debounce function
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `alert alert-${type} shadow-lg mb-2`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast toast-end z-50';
  container.style.position = 'fixed';
  container.style.top = '1rem';
  container.style.right = '1rem';
  document.body.appendChild(container);
  return container;
}