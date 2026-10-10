// 72 条旧路径重定向（S1 批次 4·来自 ClaudeCode-定稿方案 §3.3 迁移表）
// 规则顺序：具体路径在前、has 规则在前，兜底在后。
// permanent:true → 308。
const legacyRedirects = [
  // ── L0 公开 ──
  { source: '/onboarding/overview', destination: '/onboarding', permanent: true },

  // ── 投资域 → 市场（具体在前·兜底在后）──
  { source: '/invest/baskets', destination: '/markets?tab=baskets', permanent: true },
  {
    source: '/invest/basket/subscribe',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/basket/:id/order?side=subscribe',
    permanent: true,
  },
  {
    source: '/invest/basket/redeem',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/basket/:id/order?side=redeem',
    permanent: true,
  },
  {
    source: '/invest/basket/disclosures',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/basket/:id?tab=disclosures',
    permanent: true,
  },
  { source: '/invest/basket/disclosures', destination: '/trust/product-disclosures', permanent: true },
  { source: '/invest/basket/recommend', destination: '/plan/new', permanent: true },
  {
    source: '/invest/basket',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/basket/:id',
    permanent: true,
  },
  { source: '/invest/basket', destination: '/markets?tab=baskets', permanent: true },
  {
    source: '/invest/rwa',
    has: [{ type: 'query', key: 'slug', value: '(?<slug>.*)' }],
    destination: '/asset/:slug',
    permanent: true,
  },
  { source: '/invest/rwa', destination: '/markets?tab=assets', permanent: true },
  {
    source: '/invest/compute',
    has: [{ type: 'query', key: 'slug', value: '(?<slug>.*)' }],
    destination: '/asset/:slug',
    permanent: true,
  },
  { source: '/invest/compute', destination: '/markets?tab=assets', permanent: true },
  {
    source: '/invest/stocks',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/basket/:id',
    permanent: true,
  },
  { source: '/invest/stocks', destination: '/markets?tab=baskets', permanent: true },
  {
    source: '/invest/prediction',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/prediction/:id',
    permanent: true,
  },
  { source: '/invest/prediction', destination: '/markets?tab=predictions', permanent: true },
  {
    source: '/invest/valuation',
    has: [{ type: 'query', key: 'slug', value: '(?<slug>.*)' }],
    destination: '/asset/:slug?tab=valuation',
    permanent: true,
  },
  { source: '/invest/disclosures', destination: '/trust/product-disclosures', permanent: true },
  { source: '/invest', destination: '/markets', permanent: false },

  // ── 组合 / 钱包 → 资产 ──
  { source: '/portfolio/positions', destination: '/assets?tab=positions', permanent: true },
  { source: '/portfolio/yield-calendar', destination: '/assets/yield-calendar', permanent: true },
  { source: '/portfolio/rebalance', destination: '/assets/rebalance', permanent: true },
  { source: '/portfolio', destination: '/assets?tab=overview', permanent: true },
  { source: '/wallet/deposit', destination: '/assets/cash/deposit', permanent: true },
  { source: '/wallet/withdraw', destination: '/assets/cash/withdraw', permanent: true },
  { source: '/wallet/transfer', destination: '/assets/cash/transfer', permanent: true },
  { source: '/wallet/confirmation', destination: '/assets/cash', permanent: true },
  { source: '/wallet/address-book', destination: '/assets/cash/address-book', permanent: true },
  { source: '/wallet/usdt', destination: '/assets/cash', permanent: true },
  { source: '/wallet', destination: '/assets?tab=cash', permanent: true },
  { source: '/activity', destination: '/assets?tab=activity', permanent: true },
  { source: '/statements', destination: '/assets/statements', permanent: true },

  // ── 二级市场 / 交易 ──
  { source: '/secondary', destination: '/markets?tab=trade&legacy=secondary', permanent: true },
  {
    source: '/trade',
    has: [{ type: 'query', key: 'symbol', value: '(?<symbol>.*)' }],
    destination: '/trade/:symbol',
    permanent: true,
  },
  { source: '/trade', destination: '/markets?tab=trade', permanent: true },

  // ── 订单轨道 ──
  { source: '/orders/processing', destination: '/orders/status', permanent: true },
  { source: '/orders/success', destination: '/orders/status', permanent: true },
  { source: '/orders/partial', destination: '/orders/status', permanent: true },
  { source: '/orders/failed', destination: '/orders/status', permanent: true },
  {
    source: '/orders/receipt',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/orders/:id?action=share',
    permanent: true,
  },
  {
    source: '/orders/detail',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/orders/:id',
    permanent: true,
  },

  // ── Profile 域 ──
  { source: '/profile/kyc', destination: '/profile/verification/kyc', permanent: true },
  { source: '/profile/eligibility', destination: '/profile/verification/eligibility', permanent: true },
  { source: '/profile/risk-profile', destination: '/profile/verification/risk-profile', permanent: true },
  { source: '/profile/records', destination: '/profile/documents', permanent: true },
  {
    source: '/profile/support/ticket',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/profile/support/ticket/:id',
    permanent: true,
  },
  { source: '/profile/marketing', destination: '/profile/settings?section=marketing', permanent: true },

  // ── 信任与安全 ──
  { source: '/status', destination: '/trust/status', permanent: true },
  { source: '/security/official-channels', destination: '/trust/official-channels', permanent: true },
  { source: '/security/report-scam', destination: '/trust/report-scam', permanent: true },

  // ── 社区 / AI ──
  {
    source: '/community/post',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/community/post/:id',
    permanent: true,
  },
  {
    source: '/community/member',
    has: [{ type: 'query', key: 'handle', value: '(?<handle>.*)' }],
    destination: '/community/member/:handle',
    permanent: true,
  },
  {
    source: '/ai/plan',
    has: [{ type: 'query', key: 'id', value: '(?<id>.*)' }],
    destination: '/ai/plan/:id',
    permanent: true,
  },
  { source: '/ai/plan', destination: '/ai', permanent: true },
]

/** @type {import('next').NextConfig} */
const localProxy = process.env.RWA_LOCAL_PROXY === '1'
// 代理目标可配置：默认线上；本地联调时用 RWA_PROXY_TARGET=http://127.0.0.1:4000
const proxyTarget = process.env.RWA_PROXY_TARGET || 'https://api.a-reit.com'

const nextConfig = {
  // OpenNext consumes the standalone server output for Cloudflare Workers builds.
  output: "standalone",
  // The local development badge overlaps the app's top-left back button.
  devIndicators: false,
  // Next 16 blocks cross-origin dev-resource requests; the app is routinely opened on both
  // loopback spellings during local work, so allow them explicitly (development only).
  allowedDevOrigins: ['127.0.0.1', 'localhost', '[::1]'],
  experimental: {
    // Keep local Windows production builds deterministic and avoid worker-spawn exhaustion.
    cpus: 1,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // S1 批次 4：72 个旧 URL 场景由 55 条 308 规则覆盖（见迁移表）
  async redirects() {
    return legacyRedirects
  },
  // 本地开发联调：把 /v1/** 同源代理到线上核心 API（浏览器不触发 CORS，
  // 也不依赖本机直连 Polymarket）。仅当 RWA_LOCAL_PROXY=1 时启用。
  ...(localProxy
    ? {
        async rewrites() {
          return [
            { source: "/v1/:path*", destination: `${proxyTarget}/v1/:path*` },
          ]
        },
      }
    : {}),
}

export default nextConfig
