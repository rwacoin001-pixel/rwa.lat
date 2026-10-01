# Purchase channel audit

Read-only production audit, 2026-10-02 (Asia/Shanghai).

## Current facts

- `orders.acceptance` and `prediction.betting` enabled. This is permission to submit, not proof of external execution.
- All eight published catalog products lack exact issuer/token bindings and fresh quotes: tokenized gold, tokenized silver, S&P 500, Nasdaq-100, Nvidia, Alphabet, Apple, SpaceX.
- `CATALOG_AUTO_QUOTES_ENABLED=true`; existing DeFiLlama exact-contract quote logic requires verified binding metadata and fresh source data. It cannot quote these unbound products.
- Custody mode is `manual`; no installed live external custody adapter in this release. Real deposit tracking is distinct from asset purchase execution.
- Ordinary asset settlement uses `manual-settlement.service.ts`, real external reference and clean uploaded execution evidence, then review before ledger/holding posting.
- Trading service matches platform orders internally. This is not a broker/exchange routing integration.
- Runtime environment inspection found no configured Binance/OKX/Alpaca/IBKR/Polymarket trading-key variables; no secret values were output. This inspection is not proof that no external account exists elsewhere.
- Prediction betting uses an internal ledger with external market data/resolution; it does not buy users' positions on Polymarket.

## Decision still required

The user requested existing-channel verification before deciding. No funds gates, stale-quote guards or fake fill logic were removed.

Choose either verifiable manual procurement with asset-specific valid quotes and settlement evidence, or integrate a specified issuer/token and an actual execution/custody account. Catalog/research-only directory rows must not imply real buying until the full execution path exists. SpaceX needs a verifiable instrument and transfer rights; do not substitute a public-stock quote.

## Translation / scanner delivery

Direct DeepSeek is configured on the API; key stays server-side. Dynamic event titles/options, public/local discussion bodies and main product introductions use target app locale with persisted source-hash cache and original fallback. Selected new UI labels use the same cached translation endpoint. Existing static locale dictionaries are retained. This is not a seven-language native linguistic sign-off or an exhaustive claim that every page string has been translated.

Transfer scan reads local camera frames or chosen images with vendored jsQR 1.4.0 (Apache-2.0 license included), validates platform transfer path and recipient UUID, and fills recipient only. It never follows arbitrary QR links or auto-transfers. Camera stops on unmount/hidden app. Real QR decoding and invalid-code tests passed; mobile camera/PWA acceptance remains pending.
