/** Observed C-end response shapes. Sources: contracts/samples/*.json.
 * Unknown fields/empty arrays are deliberately unverified, not invented contracts.
 * Replace unknown only after a non-empty sample or backend DTO verification. */

/** auth-demo-login.json */
export type AuthDemoLoginDto = { "userId": string; "sessionId": string; "token": string }

/** basket-disclosures.json */
export type BasketDisclosuresDto = Array<{ "id": string; "productType": string; "strategyId": unknown; "version": number; "title": string; "content": string; "effectiveFrom": string }>

/** basket-portfolios.json */
export type BasketPortfoliosDto = unknown[]

/** basket-redemptions.json */
export type BasketRedemptionsDto = unknown[]

/** basket-subscriptions.json */
export type BasketSubscriptionsDto = unknown[]

/** catalog-asset-classes.json */
export type CatalogAssetClassesDto = Array<{ "id": string; "display_name": string; "description": string | null; "state": string; "created_at": string; "deprecated_at": unknown }>

/** catalog-disclosures.json */
export type CatalogDisclosuresDto = unknown[]

/** catalog-product.json */
export type CatalogProductDto = { imageUrl?: string | null; "id": string; "assetClassId": string; "version": number; "externalRef": string; "displayName": string; "summary": string; "assetCode": string; "assetDecimals": number; "network": string; "minOrderAtomicAmount": string; "maxOrderAtomicAmount": string; "state": string }

/** catalog-products.json */
export type CatalogProductsDto = Array<{ imageUrl?: string | null; "id": string; "assetClassId": string; "version": number; "externalRef": string | null; "displayName": string; "summary": string | null; "assetCode": string; "assetDecimals": number; "network": string | null; "minOrderAtomicAmount": string | null; "maxOrderAtomicAmount": string | null; "state": string }>

/** catalog-quote.json */
export type CatalogQuoteDto = { "productId": string; "unitPriceAtomicAmount": string; "unitPriceDecimals": number; "currency": string; "source": string; "validUntil": string; "capturedAt": string; "stale": boolean }

/** community-comments.json */
export type CommunityCommentsDto = { "items": unknown[]; "nextBefore": unknown }

/** community-feed.json */
export type CommunityFeedDto = { "items": Array<{ "id": string; "body": string; "lang": string; "images": unknown[]; "topics": Array<string>; "likeCount": number; "commentCount": number; "viewCount": number; "publishedAt": string; "author": { "id": string; "handle": string; "displayName": string; "kind": string; "avatarUrl": unknown; "bio": string; "city": unknown; "countryCode": unknown } }>; "nextCursor": unknown }

/** community-post.json */
export type CommunityPostDto = { "post": { "id": string; "body": string; "lang": string; "images": unknown[]; "topics": Array<string>; "likeCount": number; "commentCount": number; "viewCount": number; "publishedAt": string; "author": { "id": string; "handle": string; "displayName": string; "kind": string; "avatarUrl": unknown; "bio": string; "city": unknown; "countryCode": unknown } }; "comments": unknown[]; "commentTotal": number }

/** community-topics.json */
export type CommunityTopicsDto = { "items": Array<{ "id": string; "slug": string; "title": string; "description": string }> }

/** kyc-status.json */
export type KycStatusDto = { "id": string; "userId": string; "state": string; "provider": string; "reasonCode": unknown; "submittedAt": string; "decidedAt": string; "expiresAt": unknown; "createdAt": string; "updatedAt": string }

/** ledger-balances.json */
export type LedgerBalancesDto = { "accounts": Array<{ "accountId": string; "purpose": string; "assetCode": string; "assetDecimals": number; "state": string; "atomicBalance": string; "lastEntryId": string | null; "updatedAt": string | null }>; "source": string }

/** ledger-transactions.json */
export type LedgerTransactionsDto = { "transactions": Array<{ "id": string; "transactionType": string; "referenceType": string; "referenceId": string; "effectiveAt": string; "createdAt": string; "entries": Array<{ "side": string; "normalSide": string; "entryId": string; "purpose": string; "accountId": string; "assetCode": string; "atomicAmount": string; "assetDecimals": number }> }>; "limit": number; "nextCursor": string | null }

/** market-context.json */
export type MarketContextDto = { "anchors": Array<{ "symbol": string; "name": string; "value": number; "unit": string; "change": number; "changePct": number; "changePeriod": string; "source": string; "asOf": string; "receivedAt": string; "marketStatus": string; "stale": boolean; "quoteId": string; "assetClass": string; "disclaimer": string }>; "secondary": Array<{ "symbol": string; "name": string; "value": number; "unit": string; "change": number | null; "changePct": number; "changePeriod": string; "source": string; "asOf": string | null; "receivedAt": string; "marketStatus": string; "stale": boolean; "quoteId": string; "assetClass": string; "disclaimer": string }>; "sections": { "tradfi": Array<{ "symbol": string; "name": string; "value": number; "unit": string; "change": number; "changePct": number; "changePeriod": string; "source": string; "asOf": string; "receivedAt": string; "marketStatus": string; "stale": boolean; "quoteId": string; "assetClass": string; "disclaimer": string }>; "fx": Array<{ "symbol": string; "name": string; "value": number; "unit": string; "change": unknown; "changePct": unknown; "changePeriod": string; "source": string; "asOf": string; "receivedAt": string; "marketStatus": string; "stale": boolean; "quoteId": string; "assetClass": string; "disclaimer": string }>; "crypto": Array<{ "symbol": string; "name": string; "value": number; "unit": string; "change": unknown; "changePct": number; "changePeriod": string; "source": string; "asOf": unknown; "receivedAt": string; "marketStatus": string; "stale": boolean; "quoteId": string; "assetClass": string; "disclaimer": string }>; "onchain": Array<{ "symbol": string; "name": string; "value": number; "unit": string; "change7d": number; "change30d": number; "source": string; "asOf": string; "stale": boolean }> }; "usdtPeg": { "price": number; "deviationBps": number; "status": string; "source": string; "asOf": unknown; "note": string }; "serverTime": string; "degraded": boolean; "degradedReasons": unknown[] }

/** notifications.json */
export type NotificationsDto = Array<{ "id": string; "recipientUserId": string; "channel": string; "kind": string; "title": string; "body": string; "readAt": unknown; "createdAt": string }>

/** orders.json */
export type OrdersDto = Array<{ "id": string; "userId": string; "productId": string; "productName": string; "assetClassId": string; "outcomeKey": string; "settlementAssetCode": string; "settlementAssetDecimals": number; "productAssetCode": string; "productAssetDecimals": number; "quoteCurrency": string | null; "quoteDecimals": number; "requestedAtomicAmount": string; "filledAtomicAmount": string; "filledQuantityAtomicAmount": string; "unitPriceAtomicAmount": string; "state": string; "failureReason": unknown; "submittedAt": string; "completedAt": string; "events": Array<{ "previousState": string | null; "nextState": string; "actorType": string; "reasonCode": unknown; "metadata": { "atomicAmount"?: string; "releasedAtomicAmount"?: string }; "createdAt": string }> }>

/** portfolio-history.json */
export type PortfolioHistoryDto = Array<{ "capturedAt": string; "totalValueAtomicAmount": string; "currency": string; "currencyDecimals": number }>

/** portfolio-positions.json */
export type PortfolioPositionsDto = Array<{ "productId": string; "outcomeKey": string; "assetCode": string; "assetDecimals": number; "quantityAtomicAmount": string; "costAtomicAmount"?: string; "cumulativeYieldAtomicAmount"?: string; "unitPriceAtomicAmount": string; "unitPriceDecimals": number; "currency": string; "valuedAt": string; "source": string }>

/** portfolio-snapshot-batch.json */
export type PortfolioSnapshotBatchDto = { "snapshotBatchId": string; "capturedAt": string; "snapshotCount": number; "positions": Array<{ "productId": string; "assetCode": string; "assetDecimals": number; "quantityAtomicAmount": string; "unitPriceAtomicAmount": string; "unitPriceDecimals": number; "currency": string; "valuedAt": string; "source": string }> }

/** portfolio-redemptions.json */
export type PortfolioRedemptionsDto = Array<{ "id": string; "productId": string; "assetCode": string; "quantityAtomicAmount": string; "estimatedUnitPriceAtomicAmount": string; "estimatedUnitPriceDecimals": number; "currency": string; "destinationAddress"?: string; "state": string; "requestedAt": string }>

/** rwa-assets.json */
export type RwaAssetsDto = { "items": Array<{ "slug": string; "name": string; "symbol": string; "assetClass": string; "logoUrl": string; "countryCode": string; "region": string; "rank": number; "isTokenized": boolean; "isVerified": boolean; "isFeatured": boolean; "eligibilityType": string; "redemptionType": string; "status": string; "issuer": { "slug": string; "name": string }; "priceUsd": unknown; "marketCapUsd": string; "tokenizedMarketCapUsd": unknown; "volume24hUsd": string; "change24hPct": string; "change7dPct": string; "change30dPct": string; "apy": unknown; "dataTimestamp": string; "score": number; "riskLevel": string }>; "total": number; "page": number; "limit": number }

/** rwa-categories.json */
export type RwaCategoriesDto = { "items": Array<{ "assetClass": string; "assetCount": number; "totalMarketCapUsd": string; "totalVolume24hUsd": string; "avgChange30dPct": string }> }

/** rwa-detail.json */
export type RwaDetailDto = { "slug": string; "name": string; "symbol": string; "assetClass": string; "logoUrl": string; "countryCode": string; "region": string; "rank": number; "isTokenized": boolean; "isVerified": boolean; "isFeatured": boolean; "eligibilityType": string; "redemptionType": string; "status": string; "issuer": { "slug": string; "name": string }; "priceUsd": unknown; "marketCapUsd": string; "tokenizedMarketCapUsd": unknown; "volume24hUsd": string; "change24hPct": string; "change7dPct": string; "change30dPct": string; "apy": unknown; "dataTimestamp": string; "score": { "yieldScore": string; "liquidityScore": string; "issuerScore": string; "collateralScore": string; "redemptionScore": string; "contractRiskScore": string; "concentrationScore": string; "marketRiskScore": string; "dataQualityScore": string; "overallScore": string; "riskLevel": string; "scoreVersion": string; "calculatedAt": string }; "riskLevel": string; "description": string; "websiteUrl": string; "sources": Array<{ "provider": string; "externalId": string; "externalSlug": string; "sourceUrl": string; "lastSyncedAt": string; "syncStatus": string }>; "contracts": unknown[]; "aiAnalysis": unknown }

/** rwa-history.json */
export type RwaHistoryDto = { "slug": string; "days": number; "points": Array<{ "date": string; "priceUsd": unknown; "marketCapUsd": unknown; "volumeUsd": unknown }> }

/** rwa-issuer.json */
export type RwaIssuerDto = { "slug": string; "name": string; "logoUrl": unknown; "websiteUrl": string; "tokenCount": number; "verified": boolean; "description": string; "totalMarketCapUsd": string; "assets": Array<{ "slug": string; "name": string; "symbol": string; "assetClass": string; "logoUrl": string; "countryCode": string; "region": string; "rank": number; "isTokenized": boolean; "isVerified": boolean; "isFeatured": boolean; "eligibilityType": string; "redemptionType": string; "status": string; "issuer": { "slug": string; "name": string }; "priceUsd": unknown; "marketCapUsd": string; "tokenizedMarketCapUsd": unknown; "volume24hUsd": string; "change24hPct": string; "change7dPct": string; "change30dPct": string; "apy": unknown; "dataTimestamp": string; "score": number; "riskLevel": string }> }

/** rwa-issuers.json */
export type RwaIssuersDto = { "items": Array<{ "slug": string; "name": string; "logoUrl": unknown; "websiteUrl": string; "tokenCount": number; "verified": boolean; "assetCount": number; "totalMarketCapUsd": string }> }

/** rwa-networks.json */
export type RwaNetworksDto = { "items": unknown[] }

/** rwa-overview.json */
export type RwaOverviewDto = { "assetCount": number; "tokenizedAssetCount": number; "pricedAssetCount": number; "totalMarketCapUsd": string; "totalTvlUsd": string; "totalVolume24hUsd": string; "latestDataTimestamp": string; "issuerCount": number; "activeIssuerCount": number; "categoryDistribution": Array<{ "assetClass": string; "assetCount": number; "totalMarketCapUsd": string; "totalVolume24hUsd": string; "avgChange30dPct": string }> }

/** rwa-rankings.json */
export type RwaRankingsDto = { "metric": string; "items": Array<{ "slug": string; "name": string; "symbol": string; "assetClass": string; "logoUrl": string; "countryCode": string; "region": string; "rank": number; "isTokenized": boolean; "isVerified": boolean; "isFeatured": boolean; "eligibilityType": string; "redemptionType": string; "status": string; "issuer": { "slug": string; "name": string }; "priceUsd": unknown; "marketCapUsd": string; "tokenizedMarketCapUsd": unknown; "volume24hUsd": string; "change24hPct": string; "change7dPct": string; "change30dPct": string; "apy": unknown; "dataTimestamp": string; "score": number; "riskLevel": string; "position": number }> }

/** security-factors.json */
export type SecurityFactorsDto = { "totp": unknown[]; "passkeys": unknown[] }

/** summary.json */
export type SummaryDto = { "balance": { "asset": string; "availableAtomic": string; "decimals": number; "availableUsd": string }; "basket": { "portfolioCount": number; "positions": unknown[] }; "notifications": { "unread": number }; "updatedAt": string }

/** wallet-addresses.json */
export type WalletAddressesDto = { "entries": unknown[]; "policy": { "cooldownSeconds": number; "financialMode": boolean } }

/** wallet-networks.json */
export type WalletNetworksDto = { "networks": Array<{ "id": string; "displayName": string; "assetCode": string; "assetDecimals": number; "requiredConfirmations": number; "minimumDepositAtomic": string; "minimumWithdrawalAtomic": string; "withdrawalFeeAtomic": string; "estimatedArrivalMinutes": Array<number>; "warning": string; "configurationSource": string }>; "integration": { "custodyProvider": string; "adapterMode": string; "executionEnabled": boolean; "demoCreditEnabled": boolean; "demoExecutionEnabled": boolean; "realFunds": boolean; "financialMode": boolean; "withdrawalControls": { "addressBookRequired": boolean; "addressCooldownSeconds": number; "newDeviceCooldownSeconds": number; "approvalsRequired": number; "perTransactionLimitAtomic": unknown; "dailyLimitAtomic": unknown } } }

/** wallet.json */
export type WalletDto = { "asset": { "code": string; "decimals": number }; "balances": { "availableAtomic": string; "lockedAtomic": string; "pendingAtomic": string; "investedAtomic": string; "rewardPayableAtomic": string; "asOf": string }; "wallet": unknown; "recentActivity": unknown[]; "integration": { "custodyProvider": string; "adapterMode": string; "executionEnabled": boolean; "demoCreditEnabled": boolean; "demoExecutionEnabled": boolean; "realFunds": boolean; "financialMode": boolean; "withdrawalControls": { "addressBookRequired": boolean; "addressCooldownSeconds": number; "newDeviceCooldownSeconds": number; "approvalsRequired": number; "perTransactionLimitAtomic": unknown; "dailyLimitAtomic": unknown } } }

/** yield.json */
export type YieldDto = Array<{ "id": string; "atomicAmount": string; "state": string; "creditedAt": string; "batchId": string; "productId": string; "periodStart": string; "periodEnd": string }>
