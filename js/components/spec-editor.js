/**
 * Spec Editor Component
 */
import { createSpec, isConnected, connect, getAddress } from '../wallet.js';
import { getSpec, getSpecContent } from '../gql.js';
import { parseTags, escapeHtml } from '../utils.js';

/**
 * Render spec editor (create or remix)
 */
export async function renderSpecEditor(container, forkId = null, state) {
  const { updateState } = state;
  
  // Check wallet connection
  let connected = isConnected();
  
  let initialContent = '';
  let forkTags = {};
  
  // Load fork source if remixing
  if (forkId) {
    container.innerHTML = `
      <div class="text-center py-8">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <div class="text-gray-500 mt-2">Loading spec to remix...</div>
      </div>
    `;
    
    try {
      const [spec, content] = await Promise.all([
        getSpec(forkId),
        getSpecContent(forkId)
      ]);
      
      forkTags = parseTags(spec.tags);
      initialContent = content;
      
    } catch (err) {
      container.innerHTML = `
        <div class="text-center py-8">
          <div class="text-error mb-4">Failed to load spec for remix</div>
          <a href="#/" class="btn btn-outline">Go Home</a>
        </div>
      `;
      return;
    }
  }
  
  updateState({ current: forkId ? 'remix' : 'create' });
  
  container.innerHTML = `
    <div class="py-4 px-4 md:px-8">
      <h1 class="text-2xl font-bold text-primary font-mono mb-6">
        ${forkId ? 'Remix Spec' : 'Create New Spec'}
      </h1>
      
      ${!connected ? `
        <div class="alert alert-warning mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <div class="font-bold">Wallet Not Connected</div>
            <div class="text-sm">Connect your Arweave wallet to create specs</div>
          </div>
          <button id="connect-btn" class="btn btn-sm btn-primary">Connect Wallet</button>
        </div>
      ` : ''}
      
      <form id="spec-form" class="space-y-4">
        <!-- Title -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Title *</span>
          </label>
          <input 
            type="text" 
            name="title" 
            class="input input-bordered w-full" 
            placeholder="My Protocol Specification"
            value="${escapeHtml(forkTags.Title || '')}"
            required
          />
        </div>
        
        <!-- Group and Variant -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Group *</span>
            </label>
            <input 
              type="text" 
              name="group" 
              class="input input-bordered w-full" 
              placeholder="my-protocol"
              value="${escapeHtml(forkTags.Group || '')}"
              required
            />
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text font-semibold">Variant *</span>
            </label>
            <input 
              type="text" 
              name="variant" 
              class="input input-bordered w-full" 
              placeholder="1.0.0"
              value="${escapeHtml(forkTags.Variant || '1.0.0')}"
              required
            />
          </div>
        </div>
        
        <!-- Description -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Description</span>
          </label>
          <textarea 
            name="description" 
            class="textarea textarea-bordered w-full" 
            rows="2"
            placeholder="Brief description of this specification"
          >${escapeHtml(forkTags.Description || '')}</textarea>
        </div>
        
        <!-- Topics -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Topics (comma-separated)</span>
          </label>
          <input 
            type="text" 
            name="topics" 
            class="input input-bordered w-full" 
            placeholder="protocol, defi, arweave"
            value="${(forkTags.Topics || []).join(', ')}"
          />
        </div>
        
        <!-- Content -->
        <div class="form-control">
          <label class="label">
            <span class="label-text font-semibold">Content (Markdown) *</span>
          </label>
          <textarea 
            id="editor-content"
            name="content" 
            class="textarea textarea-bordered w-full font-mono text-sm" 
            rows="20"
            placeholder="# My Specification

Write your specification in markdown..."
            required
          >${escapeHtml(initialContent)}</textarea>
        </div>
        
        ${forkId ? `
          <input type="hidden" name="fork" value="${forkId}" />
        ` : ''}
        
        <!-- Actions -->
        <div class="flex gap-4 pt-4">
          <button type="submit" class="btn btn-primary flex-1" ${!connected ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            Publish to Arweave
          </button>
          <a href="#/" class="btn btn-outline">Cancel</a>
        </div>
      </form>
      
      <!-- Success Modal -->
      <dialog id="success-modal" class="modal">
        <div class="modal-box">
          <h3 class="font-bold text-lg text-success">Success!</h3>
          <p class="py-4">Your spec has been published to the Permaweb.</p>
          <p class="text-sm text-gray-500 mb-4">Transaction ID:</p>
          <code id="tx-id" class="block bg-base-200 p-2 rounded text-xs break-all"></code>
          <div class="modal-action">
            <a id="view-spec-btn" href="#" class="btn btn-primary">View Spec</a>
            <button class="btn" onclick="document.getElementById('success-modal').close()">Close</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  `;
  
  // Connect wallet button
  const connectBtn = container.querySelector('#connect-btn');
  connectBtn?.addEventListener('click', async () => {
    try {
      await connect();
      // Re-render the editor
      renderSpecEditor(container, forkId, state);
    } catch (err) {
      alert(`Failed to connect: ${err.message}`);
    }
  });
  
  // Form submit
  const form = container.querySelector('#spec-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isConnected()) {
      alert('Please connect your wallet first');
      return;
    }
    
    const formData = new FormData(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Publishing...';
      
      const specId = await createSpec(
        formData.get('content'),
        {
          title: formData.get('title'),
          group: formData.get('group'),
          variant: formData.get('variant'),
          description: formData.get('description'),
          topics: formData.get('topics').split(',').map(t => t.trim()).filter(Boolean),
          fork: formData.get('fork') || null
        }
      );
      
      // Show success modal
      const modal = document.getElementById('success-modal');
      const txIdEl = document.getElementById('tx-id');
      const viewBtn = document.getElementById('view-spec-btn');
      
      txIdEl.textContent = specId;
      viewBtn.href = `#/spec/${specId}`;
      modal.showModal();
      
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
        Publish to Arweave
      `;
      alert(`Failed to publish: ${err.message}`);
    }
  });
}