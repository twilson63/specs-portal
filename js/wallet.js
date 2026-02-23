/**
 * Arweave Wallet Integration
 * Works with Wander wallet extension
 */

import Arweave from 'https://esm.sh/arweave@1.15.1';

// Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

// State
let address = null;
let wallet = null;

/**
 * Check if wallet is connected
 * @returns {boolean} True if wallet is connected
 */
export function isConnected() {
  return address !== null;
}

/**
 * Get connected wallet address
 * @returns {string|null} The wallet address or null if not connected
 */
export function getAddress() {
  return address;
}

/**
 * Get shortened address display
 * @returns {string|null} Shortened address (e.g., "abc123...xyz1") or null if not connected
 */
export function getShortAddress() {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Connect to Arweave wallet (Wander)
 * @returns {Promise<string>} The connected wallet address
 * @throws {Error} If Wander wallet extension is not installed
 */
export async function connect() {
  if (!window.arweaveWallet) {
    throw new Error('Please install Wander wallet extension');
  }
  
  try {
    await window.arweaveWallet.connect([
      'ACCESS_ADDRESS',
      'SIGN_TRANSACTION',
      'DISPATCH'
    ]);
    
    address = await window.arweaveWallet.getActiveAddress();
    
    // Listen for wallet changes
    window.addEventListener('walletSwitch', handleWalletSwitch);
    
    return address;
  } catch (err) {
    console.error('Wallet connection failed:', err);
    throw err;
  }
}

/**
 * Disconnect wallet
 * @returns {Promise<void>}
 */
export async function disconnect() {
  if (window.arweaveWallet) {
    try {
      await window.arweaveWallet.disconnect();
    } catch (err) {
      // Ignore disconnect errors
    }
  }
  address = null;
  window.removeEventListener('walletSwitch', handleWalletSwitch);
}

/**
 * Handle wallet switch event
 * @param {CustomEvent} event - Wallet switch event containing new address
 */
function handleWalletSwitch(event) {
  address = event.detail.address;
  window.dispatchEvent(new CustomEvent('walletChanged', { detail: { address } }));
}

/**
 * Create and post a new spec transaction
 * Uses ANS-110 for spec discoverability
 * https://cookbook.arweave.net/references/specs/ans/ANS-110.html
 * @param {string} content - The spec content in markdown format
 * @param {Object} metadata - Spec metadata
 * @param {string} metadata.title - Spec title (required, ANS-110)
 * @param {string} [metadata.description] - Spec description (ANS-110)
 * @param {string[]} [metadata.topics] - Array of topics (ANS-110)
 * @param {string} [metadata.variant] - Version variant (e.g., "1.0.0")
 * @param {string} [metadata.group] - Group identifier
 * @param {string[]} [metadata.authors] - Array of author addresses
 * @param {string} [metadata.fork] - Transaction ID being forked
 * @returns {Promise<string>} The transaction ID of the published spec
 * @throws {Error} If wallet is not connected
 */
export async function createSpec(content, metadata) {
  if (!address) throw new Error('Wallet not connected');
  
  const tx = await arweave.createTransaction({ data: content });
  
  // ANS-110 Required tags
  tx.addTag('Content-Type', 'text/markdown');
  tx.addTag('Type', 'spec');
  tx.addTag('Title', metadata.title);
  
  // ANS-110 Optional tags
  if (metadata.description) tx.addTag('Description', metadata.description);
  if (metadata.topics?.length) tx.addTag('Topics', metadata.topics.join(','));
  
  // Additional metadata
  tx.addTag('App-Name', 'Specs-Portal'); // App identity
  tx.addTag('App-Version', '2.0.0');
  if (metadata.variant) tx.addTag('Variant', metadata.variant);
  if (metadata.group) tx.addTag('GroupId', metadata.group);
  if (metadata.authors?.length) tx.addTag('Authors', metadata.authors.join(','));
  if (metadata.fork) tx.addTag('Forks', metadata.fork);
  tx.addTag('Timestamp', Date.now().toString());
  
  // Use dispatch() for bundled ANS-104 transactions (faster, cheaper)
  // Falls back to regular post if dispatch not available
  if (window.arweaveWallet) {
    try {
      const result = await window.arweaveWallet.dispatch(tx);
      console.log(`Spec dispatched as ${result.type}: ${result.id}`);
      return result.id;
    } catch (err) {
      console.warn('Dispatch failed, falling back to regular post:', err);
    }
  }
  
  // Sign and post
  await arweave.transactions.sign(tx);
  const response = await arweave.transactions.post(tx);
  
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`Failed to post transaction: ${response.status}`);
  }
  
  return tx.id;
}

/**
 * Create a stamp transaction (ANS-110 compliant)
 * @param {string} specId - The transaction ID of the spec to stamp
 * @returns {Promise<string>} The transaction ID of the stamp
 * @throws {Error} If wallet is not connected
 */
export async function stampSpec(specId) {
  if (!address) throw new Error('Wallet not connected');
  
  const data = JSON.stringify({ 
    specId, 
    timestamp: Date.now() 
  });
  
  const tx = await arweave.createTransaction({ data });
  
  tx.addTag('Content-Type', 'application/json');
  tx.addTag('App-Name', 'Specs-Portal');
  tx.addTag('App-Version', '2.0.0');
  tx.addTag('Type', 'stamp');
  tx.addTag('Ref', specId);
  tx.addTag('Timestamp', Date.now().toString());
  
  // Use dispatch() for bundled ANS-104 transactions (faster, cheaper)
  // Falls back to regular post if dispatch not available
  if (window.arweaveWallet) {
    try {
      const result = await window.arweaveWallet.dispatch(tx);
      console.log(`Stamp dispatched as ${result.type}: ${result.id}`);
      return result.id;
    } catch (err) {
      console.warn('Dispatch failed, falling back to regular post:', err);
    }
  }
  
  await arweave.transactions.sign(tx);
  const response = await arweave.transactions.post(tx);
  
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`Failed to stamp: ${response.status}`);
  }
  
  return tx.id;
}

/**
 * Get wallet balance
 * @returns {Promise<string>} Balance in AR
 */
export async function getBalance() {
  if (!address) return '0';
  const winston = await arweave.wallets.getBalance(address);
  return arweave.ar.winstonToAr(winston);
}

// Export arweave instance for advanced use
export { arweave };
