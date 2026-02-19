/**
 * SPECS Portal - HyperBEAM Native
 * Main Application Entry Point
 */

import { createRouter } from './utils.js';
import { isConnected, connect, disconnect, getAddress, getShortAddress } from './wallet.js';
import { renderSidebar } from './components/sidebar.js';
import { renderSpecList, appendSpecs } from './components/spec-list.js';
import { renderSpecView } from './components/spec-view.js';
import { renderSpecEditor } from './components/spec-editor.js';

// App state
const state = {
  current: 'ready',
  tx: null,
  walletAddress: null,
  cursor: null,
  hasNextPage: false
};

// DOM elements
const sidebar = document.getElementById('sidebar');
const pageContent = document.getElementById('page-content');
const topNav = document.getElementById('top-nav');
const connectBtn = document.getElementById('connect-btn');

/**
 * Update app state
 */
function updateState(updates) {
  Object.assign(state, updates);
  renderSidebar(sidebar, {
    ...state,
    onBack: () => window.location.hash = '/',
    onLearn: () => window.location.hash = '/learn',
    updateState
  });
}

/**
 * Render top navigation based on current page
 */
function renderTopNav() {
  const addr = getShortAddress();
  
  if (state.current === 'view' || state.current === 'stamping') {
    topNav.innerHTML = `
      <button id="back-btn" class="btn btn-ghost">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      ${state.current === 'stamping' ? '<span>Stamping...</span>' : `
        <div class="flex space-x-2 items-center">
          <span class="line-clamp-1 text-sm hidden md:block">${window.location.origin}/?tx=${state.tx || ''}</span>
          <button id="copy-btn" class="btn btn-sm btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
          </button>
        </div>
      `}
    `;
    
    topNav.querySelector('#back-btn')?.addEventListener('click', () => {
      window.location.hash = '/';
    });
    
    topNav.querySelector('#copy-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(`${window.location.origin}/?tx=${state.tx}`);
      // Could show toast here
    });
    
  } else if (state.current === 'learn') {
    topNav.innerHTML = `
      <button id="back-btn" class="btn btn-ghost">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
    `;
    
    topNav.querySelector('#back-btn')?.addEventListener('click', () => {
      window.location.hash = '/';
    });
    
  } else {
    // Home / Create
    topNav.innerHTML = `
      <label for="drawer-toggle" class="btn btn-ghost text-lg drawer-button lg:hidden">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-primary">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
        </svg>
      </label>
      
      <a href="#/create" class="btn btn-ghost btn-primary hidden lg:flex">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Create
      </a>
      
      <button id="wallet-btn" class="btn btn-ghost ${addr ? 'btn-primary' : 'btn-outline'}">
        ${addr ? addr : 'Connect Wallet'}
      </button>
    `;
    
    topNav.querySelector('#wallet-btn')?.addEventListener('click', async () => {
      if (isConnected()) {
        await disconnect();
        state.walletAddress = null;
        renderTopNav();
      } else {
        try {
          await connect();
          state.walletAddress = getAddress();
          renderTopNav();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }
}

/**
 * Page: Home (spec list)
 */
function showHome() {
  updateState({ current: 'ready', tx: null });
  renderTopNav();
  
  renderSpecList(pageContent, () => {
    // Load more handler
    appendSpecs(pageContent, state.cursor, (hasNext, lastCursor) => {
      state.hasNextPage = hasNext;
      state.cursor = lastCursor;
    });
  });
}

/**
 * Page: View spec
 */
function showSpec(params) {
  const specId = params[0];
  if (!specId) {
    window.location.hash = '/';
    return;
  }
  
  renderSpecView(pageContent, specId, { updateState });
  renderTopNav();
}

/**
 * Page: Create spec
 */
function showCreate() {
  updateState({ current: 'create', tx: null });
  renderTopNav();
  renderSpecEditor(pageContent, null, { updateState });
}

/**
 * Page: Remix spec
 */
function showRemix(params) {
  const specId = params[0];
  if (!specId) {
    window.location.hash = '/';
    return;
  }
  
  updateState({ current: 'remix', tx: specId });
  renderTopNav();
  renderSpecEditor(pageContent, specId, { updateState });
}

/**
 * Page: Related specs
 */
function showRelated(params) {
  const specId = params[0];
  if (!specId) {
    window.location.hash = '/';
    return;
  }
  
  updateState({ current: 'related', tx: specId });
  renderTopNav();
  
  // TODO: Implement related specs view
  pageContent.innerHTML = `
    <div class="text-center py-16">
      <h2 class="text-2xl font-bold mb-4">Related Specs</h2>
      <p class="text-gray-500">Coming soon...</p>
      <a href="#/" class="btn btn-outline mt-4">Go Home</a>
    </div>
  `;
}

/**
 * Page: Learn
 */
function showLearn() {
  updateState({ current: 'learn', tx: null });
  renderTopNav();
  
  pageContent.innerHTML = `
    <div class="prose max-w-none p-4 md:p-8">
      <h1>About SPECS Portal</h1>
      
      <p>
        <strong>SPECS</strong> is a decentralized specification portal built on 
        <a href="https://arweave.org" target="_blank">Arweave</a> and powered by 
        <a href="https://github.com/permaweb/HyperBEAM" target="_blank">HyperBEAM</a>.
      </p>
      
      <h2>What are Specs?</h2>
      <p>
        Specs are technical documents that define protocols, standards, and agreements.
        They live permanently on Arweave, ensuring that they can never be deleted or modified.
      </p>
      
      <h2>How it Works</h2>
      <ul>
        <li><strong>Create</strong> - Write your spec in Markdown and publish it to Arweave</li>
        <li><strong>Stamp</strong> - Show your support by stamping specs you find valuable</li>
        <li><strong>Remix</strong> - Fork existing specs to create new versions</li>
      </ul>
      
      <h2>Built With</h2>
      <ul>
        <li><a href="https://arweave.org" target="_blank">Arweave</a> - Permanent storage</li>
        <li><a href="https://github.com/permaweb/HyperBEAM" target="_blank">HyperBEAM</a> - Decentralized compute</li>
        <li><a href="https://wander.app" target="_blank">Wander</a> - Arweave wallet</li>
      </ul>
      
      <h2>Get Started</h2>
      <p>
        Connect your Arweave wallet and start creating specs today!
      </p>
      
      <div class="mt-8">
        <a href="#/create" class="btn btn-primary">Create Your First Spec</a>
      </div>
    </div>
  `;
}

/**
 * Initialize the app
 */
function init() {
  // Initialize sidebar
  renderSidebar(sidebar, {
    ...state,
    onBack: () => window.location.hash = '/',
    onLearn: () => window.location.hash = '/learn',
    updateState
  });
  
  // Set up router
  const router = createRouter({
    '/': showHome,
    '/spec': showSpec,
    '/create': showCreate,
    '/remix': showRemix,
    '/related': showRelated,
    '/learn': showLearn
  });
  
  // Check for connected wallet on load
  if (isConnected()) {
    state.walletAddress = getAddress();
  }
  
  // Handle URL params (e.g., ?tx=xxx)
  const params = new URLSearchParams(window.location.search);
  const txParam = params.get('tx');
  if (txParam) {
    window.location.hash = `/spec/${txParam}`;
  }
  
  // Wallet change listener
  window.addEventListener('walletChanged', (e) => {
    state.walletAddress = e.detail.address;
    renderTopNav();
  });
  
  console.log('SPECS Portal initialized');
}

// Start the app
init();