# SPECS Schema (ANS-110 Compliant)

Specification document tagging schema based on [ANS-110](https://cookbook.arweave.net/references/specs/ans/ANS-110.html).

## Required Tags

| Tag | Description | Max Length |
|-----|-------------|------------|
| `Type` | Must be `spec` | - |
| `Title` | Human-readable spec name | 150 chars |

## Optional Tags

| Tag | Description | Max Length |
|-----|-------------|------------|
| `Topics` | Comma-separated topics for filtering | - |
| `Description` | Detailed description | 300 chars |

## Additional Tags (Optional)

| Tag | Description |
|-----|-------------|
| `Authors` | Comma-separated wallet addresses |
| `Variant` | Version string (e.g., `1.0.0`) |
| `GroupId` | Group/protocol name |
| `License` | License identifier (e.g., MIT, Apache-2.0) |
| `Forks` | Parent spec transaction ID (for forked specs) |

## Example

```
Content-Type: text/markdown
Type: spec
Title: Payment API Specification
Topics: api,payments,backend
Description: REST API for processing payments across all channels
Authors: wallet-address-1,wallet-address-2
Variant: 2.1.0
GroupId: payments-protocol
License: MIT
```

## GraphQL Query

```graphql
query {
  transactions(
    first: 100
    tags: [
      { name: "Type", values: ["spec"] }
    ]
    sort: INGESTED_DESC
  ) {
    edges {
      node {
        id
        tags { name value }
        block { timestamp }
        owner { address }
      }
    }
  }
}
```

## Filtering by Topic

```graphql
query {
  transactions(
    first: 100
    tags: [
      { name: "Type", values: ["spec"] }
      { name: "Topics", values: ["payments"] }
    ]
  ) {
    edges { node { id tags { name value } } }
  }
}
```

## Local Development

```bash
# Query Arweave mainnet
curl -X POST https://arweave.net/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { transactions(first: 10, tags: [{name: \"Type\", values: [\"spec\"]}]) { edges { node { id tags { name value } } } } }"}'

# Query HyperBEAM (local or public node)
curl -X POST http://localhost:10000/~query@1.0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { transactions(first: 10, tags: [{name: \"Type\", values: [\"spec\"]}]) { edges { node { id tags { name value } } } } }"}'
```
