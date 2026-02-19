# SPECS Portal - HyperBEAM Native

A fully decentralized specification portal built on Arweave and HyperBEAM.

## Features

- **Pure Vanilla JS** - No framework dependencies
- **HyperBEAM GraphQL** - Direct queries to HyperBEAM's `~query@1.0/graphql` device
- **Arweave Storage** - Specs stored permanently on Arweave
- **Wander Wallet** - Connect your Arweave wallet to create and stamp specs

## Architecture

```
┌─────────────────────────────────────┐
│  Frontend (HTML/CSS/JS)              │
│  - Tailwind CSS + DaisyUI (CDN)      │
│  - Vanilla JavaScript modules        │
│  - Served from Arweave permaweb      │
└─────────────────┬───────────────────┘
                  │ GraphQL over HTTP
                  ▼
┌─────────────────────────────────────┐
│  HyperBEAM Node                      │
│  - ~query@1.0/graphql device         │
│  - Caches Arweave data locally       │
└─────────────────┬───────────────────┘
                  │ Reads from
                  ▼
┌─────────────────────────────────────┐
│  Arweave L1                          │
│  - Spec transactions with tags       │
│  - Stamp transactions                │
└─────────────────────────────────────┘
```

## Quick Start

### Development

1. Start a HyperBEAM node (or use a public one)
2. Serve the files locally:
   ```bash
   npx serve .
   ```
3. Open http://localhost:3000

### Configuration

Configure the HyperBEAM URL in `index.html` or override in `js/gql.js`:

```javascript
// Default configuration
const HYPERBEAM_URL = 'http://localhost:10000/~query@1.0/graphql';
const GATEWAY_URL = 'https://arweave.net';

// Override at runtime
window.HYPERBEAM_URL = 'https://your-hyperbeam-node/~query@1.0/graphql';
```

## Project Structure

```
specs-native/
├── index.html           # Main entry point (includes Tailwind + DaisyUI)
├── js/
│   ├── app.js           # Main application + router
│   ├── gql.js           # HyperBEAM GraphQL client
│   ├── wallet.js        # Arweave wallet integration
│   ├── utils.js         # Helper functions
│   └── components/
│       ├── sidebar.js   # Sidebar navigation
│       ├── spec-list.js # Spec list view
│       ├── spec-view.js # Individual spec view
│       └── spec-editor.js # Create/remix spec form
└── README.md
```

## Data Model

### Spec Transaction Tags
```
Content-Type: text/markdown
App-Name: Specs-Portal
Spec-Type: spec
Spec-Version: 1.0.0
Spec-Title: My Protocol Specification
Spec-Group: my-protocol
Spec-Variant: 1.0.0
Spec-Description: Brief description
Spec-Topics: protocol,defi,arweave
Spec-Authors: wallet-address-1,wallet-address-2
Spec-Fork: parent-spec-tx-id (optional)
Timestamp: 1708300000
```

### Stamp Transaction Tags
```
Content-Type: application/json
App-Name: Specs-Portal
Spec-Type: stamp
Spec-Ref: target-spec-tx-id
Timestamp: 1708300000
```

## Deployment

### Deploy to Arweave

Using permaweb-deploy:
```bash
npx permaweb-deploy . --wallet-keyfile ~/path/to/wallet.json --index index.html
```

Or using arweave CLI:
```bash
arweave deploy-dir . --wallet ~/path/to/wallet.json
```

### Set up ArNS (Optional)

Register a domain via ar.io:
```bash
# Map specs.ar to your transaction ID
```

## HyperBEAM Setup

### Install HyperBEAM
```bash
# Prerequisites: Erlang/OTP 27, rebar3
git clone https://github.com/permaweb/HyperBEAM.git
cd HyperBEAM
rebar3 compile
rebar3 shell
```

### Test GraphQL
```bash
curl -X POST http://localhost:10000/~query@1.0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ transactions(first: 5) { edges { node { id } } } }"}'
```

## License

MIT

## Links

- [Arweave](https://arweave.org)
- [HyperBEAM](https://github.com/permaweb/HyperBEAM)
- [Wander Wallet](https://wander.app)
- [Tailwind CSS](https://tailwindcss.com)
- [DaisyUI](https://daisyui.com)