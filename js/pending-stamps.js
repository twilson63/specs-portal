/**
 * Pending Stamps State Manager
 * Tracks specs that have been stamped but not yet confirmed on-chain
 */

const PENDING_STAMPS_KEY = 'specs-portal-pending-stamps';

/**
 * Get pending stamps from localStorage
 * @returns {Set<string>} Set of pending spec transaction IDs
 */
export function getPendingStamps() {
  try {
    const stored = localStorage.getItem(PENDING_STAMPS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Add a spec to pending stamps
 * @param {string} specId - The spec transaction ID to add
 * @returns {Set<string>} Updated set of pending stamps
 */
export function addPendingStamp(specId) {
  const pending = getPendingStamps();
  pending.add(specId);
  localStorage.setItem(PENDING_STAMPS_KEY, JSON.stringify([...pending]));
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('pendingStampsChanged'));
  
  return pending;
}

/**
 * Remove a spec from pending stamps (after confirmation)
 * @param {string} specId - The spec transaction ID to remove
 * @returns {Set<string>} Updated set of pending stamps
 */
export function removePendingStamp(specId) {
  const pending = getPendingStamps();
  pending.delete(specId);
  localStorage.setItem(PENDING_STAMPS_KEY, JSON.stringify([...pending]));
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('pendingStampsChanged'));
  
  return pending;
}

/**
 * Check if a spec is pending
 * @param {string} specId - The spec transaction ID to check
 * @returns {boolean} True if the spec is in pending state
 */
export function isPendingStamp(specId) {
  return getPendingStamps().has(specId);
}

/**
 * Clear all pending stamps (use with caution)
 */
export function clearPendingStamps() {
  localStorage.removeItem(PENDING_STAMPS_KEY);
  window.dispatchEvent(new CustomEvent('pendingStampsChanged'));
}
