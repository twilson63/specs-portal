/**
 * Pending Stamps State Manager
 * Tracks specs that have been stamped but not yet confirmed on-chain
 * Also tracks user stamps to prevent duplicate stamping
 */

const PENDING_STAMPS_KEY = 'specs-portal-pending-stamps';
const USER_STAMPS_KEY = 'specs-portal-user-stamps';

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
 * Get user's stamped TX IDs from localStorage
 * Used to prevent the same wallet from stamping the same resource twice
 * @returns {Set<string>} Set of stamped spec transaction IDs
 */
export function getUserStamps() {
  try {
    const stored = localStorage.getItem(USER_STAMPS_KEY);
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
 * Add a user stamp (when stamp is confirmed on-chain or locally)
 * @paramId - The spec {string} spec transaction ID that was stamped
 * @returns {Set<string>} Updated set of user stamps
 */
export function addUserStamp(specId) {
  const userStamps = getUserStamps();
  userStamps.add(specId);
  localStorage.setItem(USER_STAMPS_KEY, JSON.stringify([...userStamps]));
  
  return userStamps;
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
 * Check if user has already stamped a spec (from localStorage cache)
 * @param {string} specId - The spec transaction ID to check
 * @returns {boolean} True if the user has stamped this spec
 */
export function hasUserStamped(specId) {
  return getUserStamps().has(specId);
}

/**
 * Clear all pending stamps (use with caution)
 */
export function clearPendingStamps() {
  localStorage.removeItem(PENDING_STAMPS_KEY);
  window.dispatchEvent(new CustomEvent('pendingStampsChanged'));
}

/**
 * Clear user stamps (use with caution, e.g., wallet switch)
 */
export function clearUserStamps() {
  localStorage.removeItem(USER_STAMPS_KEY);
}
