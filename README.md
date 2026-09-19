# Shardeum Token Explorer

A small Vercel-ready token directory for Shardeum.

## Deploy
1. Put these files in a GitHub repository.
2. In Vercel choose **Add New > Project** and import the repository.
3. Keep Framework Preset as **Other** and deploy.
4. No environment variables are required for this MVP.

## Data
`/api/tokens.js` proxies the Shardeum explorer's Blockscout-compatible `/api/v2/tokens` endpoint. The UI shows name, symbol, contract address, logo (when indexed), exchange rate (when supplied), and an explorer link.

## Important
This lists tokens indexed by the explorer; it does not prove that each token is actively trading. DEX price/liquidity/24h-volume requires a second DEX/pool data source or your own pool indexer.
