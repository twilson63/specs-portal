/**
 * HyperBEAM GraphQL Client
 * Communicates with ~query@1.0/graphql device
 */

// Configuration - can be overridden via window.HYPERBEAM_URL
const HYPERBEAM_URL = window.HYPERBEAM_URL || 'http://localhost:8734/~query@1.0/graphql';
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
 * Get paginated list of specs
 */
export async function getSpecs(first = 20, after = null) {
  const data = await query(`
    query GetSpecs($first: Int, $after: String) {
      transactions(
        first: $first
        after: $after
        tags: [
          { name: "App-Name", values: ["Specs-Portal"] }
          { name: "Spec-Type", values: ["spec"] }
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
 * Get stamp count for a spec
 */
export async function getStampCount(specId) {
  const data = await query(`
    query Stamps($specId: String!) {
      transactions(
        first: 1000
        tags: [
          { name: "App-Name", values: ["Specs-Portal"] }
          { name: "Spec-Type", values: ["stamp"] }
          { name: "Spec-Ref", values: [$specId] }
        ]
      ) {
        edges { node { id } }
      }
    }
  `, { specId });
  
  return data.transactions.edges.length;
}

/**
 * Check if user has stamped a spec
 */
export async function hasUserStamped(specId, userAddress) {
  if (!userAddress) return false;
  
  const data = await query(`
    query UserStamps($specId: String!, $owner: String!) {
      transactions(
        first: 1
        owners: [$owner]
        tags: [
          { name: "App-Name", values: ["Specs-Portal"] }
          { name: "Spec-Type", values: ["stamp"] }
          { name: "Spec-Ref", values: [$specId] }
        ]
      ) {
        edges { node { id } }
      }
    }
  `, { specId, owner: userAddress });
  
  return data.transactions.edges.length > 0;
}

/**
 * Get specs by owner
 */
export async function getSpecsByOwner(owner, first = 20) {
  const data = await query(`
    query GetSpecsByOwner($owner: String!, $first: Int) {
      transactions(
        first: $first
        owners: [$owner]
        tags: [
          { name: "App-Name", values: ["Specs-Portal"] }
          { name: "Spec-Type", values: ["spec"] }
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
 * Search specs by tag
 */
export async function searchSpecs(tagName, tagValue, first = 20) {
  const data = await query(`
    query SearchSpecs($tags: [TagFilter!]!, $first: Int) {
      transactions(
        first: $first
        tags: $tags
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
  `, { 
    tags: [
      { name: "App-Name", values: ["Specs-Portal"] },
      { name: "Spec-Type", values: ["spec"] },
      { name: tagName, values: [tagValue] }
    ],
    first 
  });
  
  return data.transactions;
}