import { Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { DataSource } from 'typeorm'
import { KnowledgeSource, knowledgeSearchPatterns } from './ai-knowledge.policy'
import { PAGE_DIRECTORY, PLATFORM_GUIDES, GUIDE_LOCALE_TERMS } from './ai-platform-guide'
import { predictionFeeConfig } from '../prediction/prediction-fees'

type Query = { kind: 'products' | 'baskets' | 'reference-assets' | 'predictions' | 'articles' | 'profile'; patterns: string[]; locale: string }
export type LiveKnowledgeSource = KnowledgeSource & { liveQuery?: Query }
const ALIASES: Array<[RegExp, string[]]> = [
  [/黄金|金价|gold/i, ['gold', 'xau', 'paxg']], [/白银|silver/i, ['silver', 'xag']],
  [/英伟达|nvidia/i, ['nvidia', 'nvda']], [/谷歌|google|alphabet/i, ['alphabet', 'googl']],
  [/苹果|apple/i, ['apple', 'aapl']], [/标普|spy|s&p/i, ['spy', 's&p', 'sp500']],
  [/纳斯达克|qqq|nasdaq/i, ['qqq', 'nasdaq']], [/spacex|太空/i, ['spacex']],
  [/中期|选举|election/i, ['election', 'senate', 'house', 'president']],
]
function search(question: string) {
  const terms = knowledgeSearchPatterns(question)
  for (const [pattern, aliases] of ALIASES) if (pattern.test(question)) terms.push(...aliases.map(alias => `%${alias.replace(/[\\%_]/g, '\\$&')}%`))
  return [...new Set(terms)].slice(0, 36)
}
function relevance(question: string, text: string) {
  return search(question).reduce((sum, pattern) => sum + (text.toLowerCase().includes(pattern.slice(1, -1).replace(/\\/g, '')) ? 1 : 0), 0)
}
function source(key: string, title: string, body: string, locale: string, url: string, query?: Query): LiveKnowledgeSource {
  const digest = createHash('sha256').update(body).digest('hex')
  const h = createHash('sha256').update(key).digest('hex')
  const id = `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`
  return { id, sourceId: `live:${key}:${digest.slice(0,24)}`, revision: parseInt(digest.slice(0,7),16) + 1,
    title, summary: '', body, locale, category: `platform-${key}`, productIds: [], publishedAt: new Date().toISOString(), url,
    ...(query ? { liveQuery: query } : {}) }
}

/** Public, read-only snapshots; publication is visible on the next question without a sync job. */
@Injectable()
export class AiPlatformKnowledgeService {
  constructor(private readonly ds: DataSource) {}
  async retrieve(question: string, locale: string): Promise<LiveKnowledgeSource[]> {
    const navigation = source('pages', 'A-REIT 页面与操作入口', JSON.stringify({
      pages: PAGE_DIRECTORY,
      additionalPages: [{ title: 'AI 客服与投资授权', path: '/ai-assistant' }, { title: '条款 Terms', path: '/terms' }, { title: '隐私 Privacy', path: '/privacy' }],
      note: 'Navigation only. A route is not proof of an enabled execution channel. Replace placeholders only with supplied record URLs.'
    }), locale, '/home')
    const guides = [...PLATFORM_GUIDES].map(guide => ({ guide, score: relevance(question, `${guide.title} ${guide.tags} ${GUIDE_LOCALE_TERMS[guide.key] ?? ''}`) }))
      .sort((a,b) => b.score - a.score).slice(0,3).map(({guide}) => source(`guide-${guide.key}`, guide.title, guide.body, locale, guide.url))
    const patterns = search(question)
    const queries: Query[] = (['products','baskets','profile'] as const).map(kind => ({ kind, patterns, locale }))
    if (patterns.length) queries.push(...(['reference-assets','predictions','articles'] as const).map(kind => ({kind,patterns,locale})))
    const snapshots = await Promise.all(queries.map(query => this.snapshot(query)))
    return [navigation,...guides,...snapshots.filter((item): item is LiveKnowledgeSource => item !== null),
      source('prediction-fees', '当前预测手续费 Current prediction fees', JSON.stringify(predictionFeeConfig()), locale, '/fees-and-limits')]
  }
  async stillCurrent(sources: KnowledgeSource[]): Promise<boolean> {
    const checks = await Promise.all(sources.filter(s => s.sourceId.startsWith('live:')).map(async item => {
      const live = item as LiveKnowledgeSource
      if (live.liveQuery) return (await this.snapshot(live.liveQuery))?.sourceId === item.sourceId
      if (item.category === 'platform-prediction-fees') return source('prediction-fees','',JSON.stringify(predictionFeeConfig()),item.locale,'/fees-and-limits').sourceId === item.sourceId
      return true
    }))
    return checks.every(Boolean)
  }
  private async snapshot(query: Query): Promise<LiveKnowledgeSource | null> {
    const { kind, patterns, locale } = query
    let rows: Array<Record<string, any>>
    let url = '/markets', note = ''
    if (kind === 'products') {
      rows = await this.ds.query(`SELECT p.id,p.display_name AS name,left(p.summary,3000) AS summary,p.asset_class_id AS "assetClass",p.asset_code AS symbol,p.asset_decimals AS decimals,p.network,p.state,p.version,
        (SELECT jsonb_agg(jsonb_build_object('title',d.title,'kind',d.kind,'locale',d.locale,'publishedAt',d.published_at) ORDER BY d.published_at DESC)
          FROM app.disclosure_files d WHERE d.product_id=p.id AND d.state='active' AND p.state='published') AS disclosures,
        p.min_order_atomic_amount::text AS "minimumAtomic",p.max_order_atomic_amount::text AS "maximumAtomic",
        p.quote_binding_json->>'issuerName' AS issuer,p.quote_binding_json->>'tokenName' AS "tokenName",
        q.unit_price_atomic_amount::text AS "quoteAtomic",q.unit_price_decimals AS "quoteDecimals",q.currency,q.source AS "quoteSource",q.captured_at AS "quoteCapturedAt",q.valid_until AS "quoteValidUntil",
        (p.state='published' AND q.valid_until>now() AND q.captured_at<=now() AND COALESCE((p.quote_binding_json->>'enabled')::boolean,true)) AS "orderableQuote"
        FROM app.products p LEFT JOIN LATERAL (SELECT * FROM app.price_quotes pq WHERE pq.product_id=p.id AND pq.asset_code=p.asset_code
        AND (p.quote_binding_json IS NULL OR pq.source = concat('automatic:defillama:binding:',p.quote_binding_json->>'bindingId')) ORDER BY valid_until DESC,id LIMIT 1) q ON true
        WHERE p.state IN ('published','suspended') ORDER BY CASE WHEN p.display_name ILIKE ANY($1::text[]) OR p.asset_code ILIKE ANY($1::text[]) THEN 0 ELSE 1 END,p.published_at DESC NULLS LAST,p.id LIMIT 64`, [patterns])
      rows = rows.map(row => ({...row, url: `/asset/${encodeURIComponent(row.id)}`}))
      note = 'Public catalog. Divide atomic amounts by 10^their decimals. orderableQuote is quote readiness, not eligibility, channel readiness or execution proof. Never infer an issuer/broker from a name. Suspended products cannot accept purchases. Bounded snapshot, not proof that unlisted products do not exist.'
    } else if (kind === 'baskets') {
      rows = await this.ds.query(`SELECT p.id,p.name,p.status,s.name AS strategy,left(s.description,3000) AS description,s.risk_level AS "riskLevel",s.minimum_subscription_usd::text AS "minimumSubscriptionUsd",s.minimum_redemption_usd::text AS "minimumRedemptionUsd",s.rebalance_frequency AS "rebalanceFrequency",p.nav_per_unit::text AS "navPerUnit",p.updated_at AS "asOf"
        FROM app.basket_portfolios p JOIN app.basket_strategies s ON s.id=p.strategy_id WHERE p.status IN ('pilot','active')
        ORDER BY CASE WHEN p.name ILIKE ANY($1::text[]) OR s.name ILIKE ANY($1::text[]) THEN 0 ELSE 1 END,p.created_at DESC,p.id LIMIT 32`, [patterns])
      rows = rows.map(row => ({...row,url:`/basket/${encodeURIComponent(row.id)}`})); url='/markets?tab=baskets'
      note = 'Public pilot/active portfolios, not user holdings. NAV is dated snapshot, not guaranteed yield. Subscriptions require enabled operations, disclosures and suitability.'
    } else if (kind === 'reference-assets') {
      rows = await this.ds.query(`SELECT a.slug,a.name,a.symbol,a.asset_class AS "assetClass",a.eligibility_type AS "eligibilityType",a.redemption_type AS "redemptionType",i.name AS issuer,
        m.price_usd::text AS "priceUsd",m.apy::text AS apy,m.data_timestamp AS "asOf"
        FROM app.rwa_assets a LEFT JOIN app.rwa_issuers i ON i.id=a.issuer_id LEFT JOIN app.rwa_asset_metrics m ON m.asset_id=a.id
        WHERE a.status='active' AND (a.name ILIKE ANY($1::text[]) OR a.symbol ILIKE ANY($1::text[]) OR a.slug ILIKE ANY($1::text[])) ORDER BY a.rwa_rank NULLS LAST,a.id LIMIT 5`, [patterns])
      rows=rows.map(row=>({...row,url:`/asset/${encodeURIComponent(row.slug)}`}))
      note='Reference data. Listing/price/APY is not proof of a purchasable product, execution or guaranteed return; inspect timestamp.'
    } else if (kind === 'predictions') {
      rows = await this.ds.query(`SELECT id,gamma_market_id AS "gammaMarketId",question,slug,state,restricted,market_end_at AS "endsAt",resolution_source AS "resolutionSource",last_synced_at AS "asOf",left(raw_payload->>'description',4000) AS rules
        FROM app.polymarket_market_mappings WHERE state IN ('active','closed','resolved') AND (question ILIKE ANY($1::text[]) OR slug ILIKE ANY($1::text[])) ORDER BY last_synced_at DESC,id LIMIT 5`,[patterns])
      rows=rows.map(row=>({...row,url:`/prediction/${encodeURIComponent(row.gammaMarketId)}`})); url='/markets?tab=predictions'
      note='Synced market/rules. Order screen must obtain an executable quote. Closed/resolved markets are not open for betting.'
    } else if (kind === 'articles') {
      rows = await this.ds.query(`SELECT slug,locale,published->>'title' AS title,published->>'summary' AS summary,left(published->>'body',5000) AS body,published_revision AS revision
        FROM app.learning_articles WHERE published IS NOT NULL AND archived_at IS NULL AND locale=$2
        AND (published->>'title' ILIKE ANY($1::text[]) OR published->>'summary' ILIKE ANY($1::text[]) OR published->>'body' ILIKE ANY($1::text[])) ORDER BY published_at DESC,id LIMIT 2`,[patterns,locale])
      rows=rows.map(row=>({...row,url:`/learn/${encodeURIComponent(row.slug)}`})); url='/learn'
      note='Published learning content, not instructions or an investment mandate.'
    } else {
      rows = await this.ds.query(`SELECT published_revision AS revision,published_at AS "publishedAt",published->>'legalName' AS "legalName",published->>'jurisdiction' AS jurisdiction,published->>'supportEmail' AS "supportEmail",published->>'description' AS description,published->'allowedRegions' AS "allowedRegions",published->'investorTypes' AS "investorTypes"
        FROM app.platform_configuration WHERE id=true AND published IS NOT NULL`)
      url='/trust';note='Operator-published profile, not independent proof of licenses/affiliations. No draft/nonpublic documents.'
    }
    if (!rows.length && ['reference-assets','predictions','articles'].includes(kind)) return null
    const titles: Record<Query['kind'],string> = {products:'当前资产产品 Current products',baskets:'篮子组合 Basket portfolios','reference-assets':'资产市场资料 Market research',predictions:'预测市场与规则 Predictions',articles:'学习文章 Learning articles',profile:'平台主体与准入 Platform profile'}
    return source(kind,titles[kind],JSON.stringify({note,records:rows}),locale,url,query)
  }
}
