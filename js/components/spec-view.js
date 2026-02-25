/**
 * Spec View Component
 */
import { getSpec, getSpecContent, getStampCount, hasUserStamped } from '../gql.js';
import { stampSpec, isConnected, getAddress, connect } from '../wallet.js';
import { parseTags, formatTimestamp, shortHash, renderMarkdown, escapeHtml } from '../utils.js';
import { addPendingStamp, removePendingStamp, isPendingStamp, addUserStamp, hasUserStamped as hasUserStampedLocal } from '../pending-stamps.js';

/**
 * Render spec view page
 * @param {HTMLElement} container - Container element to render into
 * @param {string} specId - The spec transaction ID
 * @param {Object} state - Application state object
 * @param {Function} state.updateState - Function to update application state
 * @returns {Promise<void>}
 */
export async function renderSpecView(container, specId, state) {
  const { updateState } = state;
  
  container.innerHTML = `
    <div class="text-center py-8">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  `;
  
  try {
    const [spec, content, stampCount] = await Promise.all([
      getSpec(specId),
      getSpecContent(specId),
      getStampCount(specId)
    ]);
    
    const tags = parseTags(spec.tags);
    const userAddress = getAddress();
    // Check both on-chain and localStorage for existing stamps
    const userHasStampedOnChain = userAddress ? await hasUserStamped(specId, userAddress) : false;
    const userHasStampedLocal = hasUserStampedLocal(specId);
    const userHasStamped = userHasStampedOnChain || userHasStampedLocal;
    
    // Update sidebar state
    updateState({ current: 'view', tx: specId });
    
    renderSpec(container, {
      id: specId,
      tags,
      content,
      stampCount,
      owner: spec.owner?.address,
      block: spec.block,
      userHasStamped,
      userAddress
    });
    
  } catch (err) {
    container.innerHTML = `
      <div class="text-center py-8">
        <div class="text-error mb-4">Failed to load spec</div>
        <div class="text-gray-500 text-sm">${err.message}</div>
        <a href="#/" class="btn btn-outline mt-4">Go Home</a>
      </div>
    `;
  }
}

/**
 * Render full spec view
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} data - Spec data object
 * @param {string} data.id - Spec transaction ID
 * @param {Object} data.tags - Parsed tags from GraphQL
 * @param {string} data.content - Markdown content
 * @param {number} data.stampCount - Number of stamps
 * @param {string} data.owner - Spec owner address
 * @param {Object} data.block - Block info with timestamp and height
 * @param {boolean} data.userHasStamped - Whether current user has stamped
 * @param {string} data.userAddress - Current user address
 */
function renderSpec(container, data) {
  const { id, tags, content, stampCount, owner, block, userHasStamped, userAddress } = data;
  const date = formatTimestamp(block?.timestamp || tags.Timestamp);
  const height = block?.height || 'Pending';
  
  container.innerHTML = `
    <article class="p-4 md:p-8">
      <!-- Header -->
      <header class="mb-6">
        <h1 class="text-3xl font-bold text-primary font-mono mb-2">
          ${escapeHtml(tags.Title || 'Untitled')}
        </h1>
        
        <div class="flex flex-wrap gap-4 text-gray-500 text-sm">
          ${tags.Group ? `<span class="badge badge-primary badge-outline">${escapeHtml(tags.Group)}</span>` : ''}
          ${tags.Variant ? `<span class="badge badge-secondary badge-outline">v${escapeHtml(tags.Variant)}</span>` : ''}
        </div>
      </header>
      
      <!-- Meta Info -->
      <div class="bg-base-200 rounded-lg p-4 mb-6 space-y-2">
        ${tags.Authors?.length ? `
          <div class="text-sm">
            <span class="font-semibold">Authors:</span>
            ${tags.Authors.map(a => `<code class="bg-base-300 px-2 py-1 rounded ml-2">${shortHash(a, 8, 6)}</code>`).join('')}
          </div>
        ` : ''}
        
        ${tags.Topics?.length ? `
          <div class="text-sm">
            <span class="font-semibold">Topics:</span>
            ${tags.Topics.map(t => `<span class="badge badge-sm badge-outline ml-1">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="flex flex-wrap gap-4 text-sm text-gray-500">
          <span>Owner: <code class="bg-base-300 px-2 py-1 rounded">${shortHash(owner, 8, 6)}</code></span>
          ${tags.Fork ? `<span>Forked from: <a href="#/spec/${tags.Fork}" class="link link-primary">${shortHash(tags.Fork)}</a></span>` : ''}
        </div>
        
        <div class="flex flex-wrap gap-4 text-sm text-gray-500">
          <span>Date: ${date}</span>
          <span>Height: ${height}</span>
          <span>TX: <a href="https://viewblock.io/arweave/tx/${id}" target="_blank" class="link">${shortHash(id)}</a></span>
        </div>
      </div>
      
      <!-- Actions -->
      <div class="flex flex-wrap gap-2 mb-6">
        <button id="stamp-btn" class="btn btn-primary ${userHasStamped || isPendingStamp(id) ? 'btn-disabled' : ''}" data-spec-id="${id}">
          ${isPendingStamp(id) ? `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 animate-spin">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending...
          ` : `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
            </svg>
            Stamp ${userHasStamped ? '(Stamped)' : `(${stampCount})`}
          `}
        </button>
        
        <a href="#/remix/${id}" class="btn btn-secondary">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Remix
        </a>
        
        <a href="https://arweave.net/${id}" target="_blank" class="btn btn-outline">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          View on Arweave
        </a>
      </div>
      
      <!-- Content -->
      <div class="markdown-content prose max-w-none">
        ${renderMarkdown(content)}
      </div>
    </article>
  `;
  
  // Stamp button handler
  const stampBtn = container.querySelector('#stamp-btn');
  stampBtn?.addEventListener('click', async () => {
    if (userHasStamped) return;
    
    try {
      if (!isConnected()) {
        await connect();
      }
      
      stampBtn.disabled = true;
      stampBtn.innerHTML = '<span class="loading loading-spinner loading-sm"></span> Stamping...';
      
      await stampSpec(id);
      addPendingStamp(id);
      addUserStamp(id); // Track locally to prevent duplicate stamping
      
      stampBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
        </svg>
        Stamped!
      `;
      stampBtn.classList.add('btn-disabled');
      
    } catch (err) {
      stampBtn.disabled = false;
      stampBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.633 10.5c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75A2.25 2.25 0 0116.5 4.5c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" />
        </svg>
        Stamp (${stampCount})
      `;
      alert(`Failed to stamp: ${err.message}`);
    }
  });
}
