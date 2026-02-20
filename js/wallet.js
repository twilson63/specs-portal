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
 */
export function isConnected() {
  return address !== null;
}

/**
 * Get connected wallet address
 */
export function getAddress() {
  return address;
}

/**
 * Get shortened address display
 */
export function getShortAddress() {
  if (!address) return null;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Connect to Arweave wallet (Wander)
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
 */
function handleWalletSwitch(event) {
  address = event.detail.address;
  window.dispatchEvent(new CustomEvent('walletChanged', { detail: { address } }));
}

/**
 * Create and post a new spec transaction
 * Uses ANS-110 for spec discoverability
 * https://cookbook.arweave.net/references/specs/ans/ANS-110.html
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
  
  await arweave.transactions.sign(tx);
  const response = await arweave.transactions.post(tx);
  
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(`Failed to stamp: ${response.status}`);
  }
  
  return tx.id;
}

/**
 * Get wallet balance
 */
export async function getBalance() {
  if (!address) return '0';
  const winston = await arweave.wallets.getBalance(address);
  return arweave.ar.winstonToAr(winston);
}

// Export arweave instance for advanced use
export { arweave };