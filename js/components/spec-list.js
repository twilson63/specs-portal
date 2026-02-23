/**
 * Spec List Component
 */
import { getSpecsWithStamps, deduplicateSpecs } from '../gql.js';
import { parseTags, formatTimestamp, shortHash } from '../utils.js';
import { isPendingStamp } from '../pending-stamps.js';

/**
 * Render spec list page
 * @param {HTMLElement} container - Container element to render into
 * @param {Function} [onLoadMore] - Callback for load more button
 * @returns {Promise<void>}
 */
export async function renderSpecList(container, onLoadMore) {
  container.innerHTML = `
    <div id="spec-list" class="divide-y divide-slate-200">
      <div class="text-center py-8">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    </div>
  `;
  
  try {
    // Single GraphQL call to get specs AND stamp counts (already deduplicated and sorted)
    const { specs: result, stampCounts } = await getSpecsWithStamps(50);
    const specs = result.edges; // Already deduplicated and sorted by stamp count in gql.js
    const hasNextPage = false;
    
    // Add pending stamps to counts
    for (const spec of specs) {
      const specId = spec.node.id;
      if (isPendingStamp(specId)) {
        stampCounts[specId] = (stampCounts[specId] || 0) + 1;
      }
    }
    
    renderSpecs(container, specs, stampCounts, hasNextPage, onLoadMore);
    
  } catch (err) {
    container.innerHTML = `
      <div class="text-center py-8">
        <div class="text-error mb-4">Failed to load specs</div>
        <div class="text-gray-500 text-sm">${err.message}</div>
        <button id="retry-btn" class="btn btn-outline mt-4">Retry</button>
      </div>
    `;
    
    container.querySelector('#retry-btn')?.addEventListener('click', () => {
      renderSpecList(container, onLoadMore);
    });
  }
}

/**
 * Render the list of spec cards
 * @param {HTMLElement} container - Container element to render into
 * @param {Array} specs - Array of spec edges from GraphQL
 * @param {Object} stampCounts - Map of specId to stamp count
 * @param {boolean} hasNextPage - Whether more specs are available
 * @param {Function} [onLoadMore] - Callback for load more button
 */
function renderSpecs(container, specs, stampCounts, hasNextPage, onLoadMore) {
  if (specs.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="text-2xl text-gray-400 mb-2">No specs yet</div>
        <div class="text-gray-500">Be the first to create one!</div>
        <a href="#/create" class="btn btn-primary mt-4">Create Spec</a>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    ${specs.map(edge => renderSpecCard(edge.node, stampCounts)).join('')}
    ${hasNextPage ? `
      <div class="text-center py-4">
        <button id="load-more-btn" class="btn btn-outline">Load More</button>
      </div>
    ` : ''}
  `;
  
  // Add click handlers for spec cards
  container.querySelectorAll('.spec-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = `/spec/${card.dataset.id}`;
    });
  });
  
  // Load more handler
  const loadMoreBtn = container.querySelector('#load-more-btn');
  if (loadMoreBtn && onLoadMore) {
    loadMoreBtn.addEventListener('click', onLoadMore);
  }
}

/**
 * Render individual spec card (ANS-110 compliant)
 * @param {Object} node - Transaction node from GraphQL
 * @param {Object} [stampCounts={}] - Map of specId to stamp count
 * @returns {string} HTML string for the spec card
 */
function renderSpecCard(node, stampCounts = {}) {
  const tags = parseTags(node.tags);
  const date = formatTimestamp(node.block?.timestamp || tags.Timestamp);
  const height = node.block?.height || 'Pending';
  const stamps = stampCounts[node.id] || 0;
  const pending = isPendingStamp(node.id);
  
  return `
    <div class="spec-card pt-4 border-b-2 border-slate-200 hover:bg-gray-50 cursor-pointer" data-id="${node.id}">
      <div class="py-2 px-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1">
            <h1 class="pl-2 md:pl-8 text-xl text-primary">
              ${escapeHtml(tags.Title || 'Untitled')}
              ${tags.GroupId ? `<span class="text-gray-500 text-base ml-2">(${escapeHtml(tags.GroupId)})</span>` : ''}
              ${pending ? `<span class="badge badge-sm badge-warning ml-2">pending</span>` : ''}
            </h1>
          </div>
          <div>
            <a class="btn btn-sm btn-ghost float-right btn-primary" href="#/spec/${node.id}" onclick="event.stopPropagation()">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          </div>
        </div>
        
        ${tags.Description ? `
          <p class="text-gray-600 px-2 md:px-8 mt-1 line-clamp-2">${escapeHtml(tags.Description)}</p>
        ` : ''}
        
        <div class="flex mt-2 space-x-6 text-gray-500 text-sm px-2 md:px-8">
          <a target="_blank" rel="noopener" href="https://viewblock.io/arweave/tx/${node.id}" class="link hover:text-primary" onclick="event.stopPropagation()">
            <span class="hidden md:inline font-mono">${shortHash(node.id)}</span>
          </a>
          <span>Stamps: (${stamps})</span>
          <span>Date: ${date}</span>
          <span class="hidden md:inline">Height: ${height}</span>
        </div>
        
        ${tags.Topics?.length ? `
          <div class="flex flex-wrap gap-1 mt-2 px-2 md:px-8">
            ${tags.Topics.map(t => `<span class="badge badge-sm badge-outline">${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML-safe text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Append more specs (for pagination)
 * Note: pagination is handled via client-side deduplication with more results
 * @param {HTMLElement} container - Container element
 * @param {string} cursor - Pagination cursor
 * @param {Function} onDone - Callback when done
 */
export async function appendSpecs(container, cursor, onDone) {
  // Pagination disabled - all deduplication happens client-side
  // This function kept for API compatibility
  onDone(false, null);
}
