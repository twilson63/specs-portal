/**
 * ================================================================
 * RESEARCH: Single GraphQL Query for Specs + Stamps
 * ================================================================
 * 
 * TESTED APPROACHES:
 * 
 * ✅ WORKS: GraphQL Aliases
 * - Using field aliases (e.g., "specs:", "stamps:") allows multiple 
 *   independent queries in a single request
 * - Tested against https://arweave.net/graphql - VALID
 * - This is the recommended approach
 * 
 * ❌ DOESN'T WORK: postEdges
 * - Arweave GraphQL does NOT expose postEdges on Transaction type
 * - Error: "Cannot query field 'postEdges' on type 'Transaction'"
 * 
 * ❌ DOESN'T WORK: Nested/Computed Fields
 * - No computed fields, no nested queries within transactions
 * 
 * RECOMMENDED SOLUTION:
 * Use GraphQL aliases to batch specs + stamps in one query:
 * 
 * ```graphql
 * query GetSpecsWithStamps($specIds: [String!]) {
 *   specs: transactions(first: 20, tags: [{name: "Type", values: ["spec"]}]) {
 *     edges { cursor node { id tags { name value } block { timestamp height } owner { address } } } }
 *   }
 *   stamps: transactions(first: 10000, tags: [{name: "Protocol-Name", values: ["Stamp", "stamp"]}, {name: "Data-Source", values: $specIds}]) {
 *     edges { node { tags { name value } } }
 *   }
 * }
 * ```
 * 
 * Then map stamps to specs client-side (same as getStampCounts).
 * ================================================================
 */

/**
 * HyperBEAM GraphQL Client
 * Uses ANS-110 for spec discoverability
 * https://cookbook.arweave.dev/references/specs/ans/ANS-110.html
 */

// Configuration - can be overridden via window.HYPERBEAM_URL
const HYPERBEAM_URL = window.HYPERBEAM_URL || 'https://arweave-search.goldsky.com/graphql';
const GATEWAY_URL = window.GATEWAY_URL || 'https://arweave.net';

// Stamp protocol constants
const STAMP_PROTOCOL_NAME = 'Stamp';

// Use Goldsky as primary (reliable), can override via window
const PRIMARY_GQL = window.HYPERBEAM_URL || 'https://arweave-search.goldsky.com/graphql';
const FALLBACK_GQL = 'https://arweave.net/graphql';

/**
 * Execute GraphQL query with timeout and fallback
 */
async function gqlWithFallback(query, variables) {
  // Helper to fetch with timeout
  const fetchWithTimeout = async (url, options, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  // Try primary first
  try {
    const result = await fetchWithTimeout(PRIMARY_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    }, 8000);
    
    if (result.ok) {
      const data = await result.json();
      if (!data.errors) return data;
    }
  } catch (e) {
    console.warn('Primary GraphQL failed, trying fallback:', e.message);
  }
  
  // Fallback to arweave.net
  try {
    const fallbackResult = await fetchWithTimeout(FALLBACK_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    }, 15000);
    
    return await fallbackResult.json();
  } catch (e) {
    console.error('All GraphQL endpoints failed');
    throw e;
  }
}

/**
 * Execute a GraphQL query against HyperBEAM (with fallback)
 */
export async function query(gql, variables = {}) {
  try {
    const json = await gqlWithFallback(gql, variables);
    
    if (json.errors) {
      console.error('GraphQL Error:', json.errors);
      throw new Error(json.errors[0].message);
    }
    
    return json.data;
  } catch (err) {
    console.error('Query failed:', err);
    throw err;
  }
}

/**
 * Get paginated list of specs (ANS-110 compliant)
 */
export async function getSpecs(first = 20, after = null) {
  const data = await query(`
    query GetSpecs($first: Int, $after: String) {
      transactions(
        first: $first
        after: $after
        tags: [
          { name: "Type", values: ["spec"] }
        ]
        sort: INGESTED_AT_DESC
      ) {
        pageInfo { hasNextPage }
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp height }
            owner { address }
          }
        }
      }
    }
  `, { first, after });
  
  return data.transactions;
}

/**
 * Get a single spec by ID
 */
export async function getSpec(id) {
  const data = await query(`
    query GetSpec($id: ID!) {
      transaction(id: $id) {
        id
        tags { name value }
        owner { address }
        block { timestamp height }
      }
    }
  `, { id });
  
  return data.transaction;
}

/**
 * Get spec content (markdown data) from Arweave gateway
 */
export async function getSpecContent(id) {
  const res = await fetch(`${GATEWAY_URL}/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch content: ${res.status}`);
  return res.text();
}

/**
 * Get stamp count for a spec using stamp protocol tags
 * Data-Source is the spec transaction ID
 */
export async function getStampCount(specId) {
  const data = await query(`
    query Stamps($specId: String!) {
      transactions(
        first: 1000
        tags: [
          { name: "Data-Source", values: [$specId] }
          { name: "Protocol-Name", values: ["${STAMP_PROTOCOL_NAME}", "stamp"] }
        ]
      ) {
        edges { node { id } }
      }
    }
  `, { specId });

  return data.transactions.edges.length;
}

/**
 * Get stamp counts for multiple specs in one query
 * Uses the new Stamp Protocol
 * @param {Array} specIds - Array of spec transaction IDs
 * @returns {Object} - Map of specId -> stamp count
 */
export async function getStampCounts(specIds) {
  if (!specIds || specIds.length === 0) return {};

  // Query each spec directly to avoid indexer caps on wide multi-value tag filters.
  // This keeps list counts consistent with getStampCount(specId) used in detail view.
  const entries = await Promise.all(
    specIds.map(async (specId) => {
      const count = await getStampCount(specId);
      return [specId, count];
    })
  );

  return Object.fromEntries(entries);
}

/**
 * Get specs with their stamp counts
 * Uses targeted queries for reliable per-spec counting
 * 
 * @param {number} first - Number of specs to fetch
 * @param {string|null} after - Cursor for pagination
 * @returns {Object} - { specs: TransactionConnection, stampCounts: Object<specId, count> }
 */
export async function getSpecsWithStamps(first = 20, after = null) {
  // Two targeted queries are more reliable here than one wide stamp query,
  // because indexers may cap `first` and return only a recent stamp window.
  const specs = await getSpecs(first, after);
  const specIds = specs.edges.map(e => e.node.id);
  const stampCounts = await getStampCounts(specIds);

  // Deduplicate specs (keep most recent version per GroupId/Title)
  const dedupedEdges = deduplicateSpecs(specs.edges);

  // Sort by stamp count (highest first)
  dedupedEdges.sort((a, b) => {
    const countA = stampCounts[a.node.id] || 0;
    const countB = stampCounts[b.node.id] || 0;
    return countB - countA;
  });

  // Create new specs object with deduplicated and sorted edges
  const sortedSpecs = { ...specs, edges: dedupedEdges };

  return { 
    specs: sortedSpecs, 
    stampCounts 
  };
}

/**
 * Check if user has stamped a spec using the new Stamp Protocol
 * Prevents same wallet address from stamping the same resource more than once
 */
export async function hasUserStamped(specId, userAddress) {
  if (!userAddress) return false;
  
  const data = await query(`
    query UserStamps($specId: String!, $owner: String!) {
      transactions(
        first: 100
        owners: [$owner]
        tags: [
          { name: "Data-Source", values: [$specId] }
          { name: "Protocol-Name", values: ["${STAMP_PROTOCOL_NAME}", "stamp"] }
        ]
      ) {
        edges { node { id } }
      }
    }
  `, { specId, owner: userAddress });

  return data.transactions.edges.length > 0;
}

/**
 * Get specs by owner (ANS-110 compliant)
 */
export async function getSpecsByOwner(owner, first = 20) {
  const data = await query(`
    query GetSpecsByOwner($owner: String!, $first: Int) {
      transactions(
        first: $first
        owners: [$owner]
        tags: [
          { name: "Type", values: ["spec"] }
        ]
        sort: INGESTED_AT_DESC
      ) {
        pageInfo { hasNextPage }
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp height }
            owner { address }
          }
        }
      }
    }
  `, { owner, first });
  
  return data.transactions;
}

/**
 * Search specs by topic (ANS-110 compliant)
 */
export async function searchSpecs(topic, first = 20) {
  const data = await query(`
    query SearchSpecs($topic: String!, $first: Int) {
      transactions(
        first: $first
        tags: [
          { name: "Type", values: ["spec"] }
          { name: "Topics", values: [$topic] }
        ]
        sort: INGESTED_AT_DESC
      ) {
        pageInfo { hasNextPage }
        edges {
          cursor
          node {
            id
            tags { name value }
            block { timestamp height }
            owner { address }
          }
        }
      }
    }
  `, { topic, first });
  
  return data.transactions;
}

/**
 * Deduplicate specs - keeps only the most recent version per GroupId/Title
 * @param {Array} edges - Array of spec transaction edges
 * @returns {Array} - Deduplicated edges
 */
export function deduplicateSpecs(edges) {
  if (!edges || edges.length === 0) return [];
  
  const seen = new Map();
  
  for (const edge of edges) {
    const tags = parseTags(edge.node.tags);
    const groupId = tags.GroupId;
    const title = tags.Title || '';
    
    // Use GroupId as primary key, fallback to full Title, then ID
    let key = groupId;
    if (!key && title.length > 0) {
      // Normalize title: lowercase, trim, remove extra spaces
      key = title.toLowerCase().trim().replace(/\s+/g, ' ');
    }
    if (!key) {
      key = edge.node.id;
    }
    
    const height = edge.node.block?.height || 0;
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, { edge, height });
    } else if (height > existing.height) {
      // Replace with newer version
      seen.set(key, { edge, height });
    }
  }
  
  // Return deduplicated edges sorted by timestamp (most recent first)
  const result = Array.from(seen.values())
    .sort((a, b) => b.height - a.height)
    .map(v => v.edge);
  
  return result;
}

/**
 * Parse tags helper (inline for deduplication use)
 */
function parseTags(tags) {
  const result = {};
  if (!tags || !Array.isArray(tags)) return result;
  for (const tag of tags) {
    let value = tag.value;
    if (tag.name === 'Topics' || tag.name === 'Authors' || tag.name === 'Forks') {
      value = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
    }
    result[tag.name] = value;
  }
  return result;
}
// ============================================================
// RESEARCH: Single GraphQL Query for Specs + Stamps
// ============================================================
//
// Arweave GraphQL does NOT support JOIN-like queries.
// You cannot get specs and their stamp counts in one query.
//
// The approach must be:
// 1. Query specs: transactions(tags: [{name: "Type", values: ["spec"]}])
// 2. Query stamps: transactions(tags: [{name: "Type", values: ["stamp"]}])
// 3. Join client-side (our current approach with getStampCounts)
//
// Tested: Arweave GraphQL (arweave.net/graphql)
// Result: No postEdges, no nested queries, no computed fields.
// ============================================================
