## USDC transfer analysis example

You can query your deployed subgraph from Node.js with the helper in `examples/analyze-transfers.ts`.

1. Set the Subgraph Studio endpoint (skip the first argument if you prefer using `SUBGRAPH_URL`):
   ```bash
   cd my-token-ethereum
   npx ts-node --compiler-options '{"module":"commonjs"}' examples/analyze-transfers.ts https://api.studio.thegraph.com/query/YOUR-ID/YOUR-SUBGRAPH/version/latest
   ```
2. Optional: override the number of transfers that will be analyzed (defaults to 25):
   ```bash
   TRANSFER_COUNT=50 npx ts-node --compiler-options '{"module":"commonjs"}' examples/analyze-transfers.ts https://api.studio.thegraph.com/query/YOUR-ID/YOUR-SUBGRAPH/version/latest
   ```

The script downloads the most recent transfers and prints:

- Total transfer count and aggregate USDC volume.
- The number of unique participant addresses.
- Top three senders and receivers ranked by transferred USDC.

> Tip: install `ts-node` locally (`yarn add -D ts-node`) if you plan to run the script often; this avoids the one-time download each time you use `npx`.
