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
 *   stamps: transactions(first: 10000, tags: [{name: "Type", values: ["stamp"]}, {name: "Ref", values: $specIds}]) {
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
const HYPERBEAM_URL = window.HYPERBEAM_URL || 'https://arweave.net/graphql';
const GATEWAY_URL = window.GATEWAY_URL || 'https://arweave.net';

/**
 * Execute a GraphQL query against HyperBEAM
 */
export async function query(gql, variables = {}) {
  try {
    const res = await fetch(HYPERBEAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables })
    });
    
    const json = await res.json();
    
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
 * Get stamp count for a spec (ANS-110 compliant)
 */
export async function getStampCount(specId) {
  const data = await query(`
    query Stamps($specId: String!) {
      transactions(
        first: 1000
        tags: [
          { name: "Type", values: ["stamp"] }
          { name: "Ref", values: [$specId] }
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
 * @param {Array} specIds - Array of spec transaction IDs
 * @returns {Object} - Map of specId -> stamp count
 */
export async function getStampCounts(specIds) {
  if (!specIds || specIds.length === 0) return {};
  
  const data = await query(`
    query GetStampCounts($refIds: [String!]) {
      transactions(
        first: 10000
        tags: [
          { name: "Type", values: ["stamp"] }
          { name: "Ref", values: $refIds }
        ]
      ) {
        edges {
          node {
            tags { name value }
          }
        }
      }
    }
  `, { refIds: specIds });
  
  // Count stamps per Ref
  const counts = {};
  for (const specId of specIds) {
    counts[specId] = 0;
  }
  
  for (const edge of data.transactions.edges) {
    const tags = edge.node.tags;
    const refTag = tags.find(t => t.name === 'Ref');
    if (refTag && counts.hasOwnProperty(refTag.value)) {
      counts[refTag.value]++;
    }
  }
  
  return counts;
}

/**
 * Get specs WITH their stamp counts in a SINGLE GraphQL query
 * Uses GraphQL aliases to batch both queries together
 * This is more efficient than calling getSpecs() + getStampCounts() separately
 * 
 * @param {number} first - Number of specs to fetch
 * @param {string|null} after - Cursor for pagination
 * @returns {Object} - { specs: TransactionConnection, stampCounts: Object<specId, count> }
 */
export async function getSpecsWithStamps(first = 20, after = null) {
  // Single GraphQL query using aliases - fetches specs AND stamps in ONE call
  const data = await query(`
    query GetSpecsWithStamps($first: Int, $after: String) {
      specs: transactions(
        first: $first
        after: $after
        tags: [{ name: "Type", values: ["spec"] }]
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
      stamps: transactions(
        first: 10000
        tags: [
          { name: "Type", values: ["stamp"] }
        ]
      ) {
        edges {
          node {
            tags { name value }
          }
        }
      }
    }
  `, { first, after });
  
  // Extract spec IDs from the returned specs
  const specIds = data.specs.edges.map(e => e.node.id);
  
  // Initialize counts for all spec IDs
  const stampCounts = {};
  for (const specId of specIds) {
    stampCounts[specId] = 0;
  }
  
  // Count stamps - filter client-side to only counts matching our specs
  // This is more efficient than N+1 queries, even if we fetch all stamps
  for (const edge of data.stamps.edges) {
    const tags = edge.node.tags;
    const refTag = tags.find(t => t.name === 'Ref');
    if (refTag && stampCounts.hasOwnProperty(refTag.value)) {
      stampCounts[refTag.value]++;
    }
  }
  
  return { 
    specs: data.specs, 
    stampCounts 
  };
}

/**
 * Check if user has stamped a spec (ANS-110 compliant)
 */
export async function hasUserStamped(specId, userAddress) {
  if (!userAddress) return false;
  
  const data = await query(`
    query UserStamps($specId: String!, $owner: String!) {
      transactions(
        first: 1
        owners: [$owner]
        tags: [
          { name: "Type", values: ["stamp"] }
          { name: "Ref", values: [$specId] }
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
    
    // Use GroupId as primary key, fallback to Title prefix
    const key = groupId || (title.length > 0 ? title.split(':')[0].trim() : edge.node.id);
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