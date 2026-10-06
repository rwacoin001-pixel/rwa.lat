/**
 * 衡序 · ten concept strategies (design handoff v2, 2026-09-29).
 *
 * Research content only: weights are research allocations, not holdings; stages are a suggested
 * release order, not a backend status. Terms come from the 2026-10-06 条款设计书; anything still open
 * (documents, NAV, yield, unset fees) is deliberately absent so the UI renders "TBA" instead of a number.
 */

export type HengxuId = 'chengyuan' | 'liujin' | 'zhongheng' | 'runheng' | 'hengcha' | 'yuanjian' | 'qiyuan' | 'xinghe' | 'tuojie' | 'shiyuan'
export type HengxuFilter = 'short' | 'long' | 'digital' | 'research'
export type HengxuHorizon = 'd90' | 'm12' | 'y3' | 'y5' | 'terms'
/** 1 稳健 · 2 均衡 · 3 进取 · 4 高风险; pending = awaits stress test; unrated = not yet graded. */
export type HengxuRisk = 1 | 2 | 3 | 4 | 'pending' | 'unrated'
export type HengxuStage = 'first' | 'second' | 'research' | 'special'
export type HengxuSleeve = 'tbill' | 'cash' | 'gold' | 'equity' | 'trend' | 'lending' | 'fixedTerm' | 'basis' | 'margin' | 'tech' | 'btc' | 'eth' | 'sol' | 'link' | 'aave' | 'ondo' | 'semis' | 'cloud' | 'power' | 'issued' | 'tbillCash'

export type HengxuText = {
  name: string
  subtitle: string
  oneLiner: string
  fit: string
  /** How the sleeve weights are implemented; candidates are never presented as selected holdings. */
  allocationNote?: string
  exit: string
  sources: string[]
  risks: string[]
  riskNote?: string
  /** What must be disclosed before launch (the handoff's 页面重点). */
  focus: string[]
  alt: string
  /** 业绩比较基准, built only from this product's own weights. */
  benchmark?: string
  /** Long-run central range, or why none is given. Never an expected return. */
  target?: string
  /** Bear / base / bull scenarios. */
  scenario?: string
  nav?: string
  /** Fee and lock-up framework when the numbers are set per series. */
  feeNote?: string
  /** Why a research product cannot launch yet. */
  blocker?: string
  /** Conditions to clear before launch or grading, beyond the disclosure list in `focus`. */
  conditions?: string[]
}

/** Fees in % (management per year), days, and minimum in USDT. Missing keys render "TBA". */
export type HengxuTerms = {
  mgmtFeePct?: number
  subFeePct?: number
  redFeePct?: number
  lockupDays?: number
  settleDays?: number
  minInvestment?: number
  /** Proposed before stress tests or execution acceptance; shown as "to be confirmed". */
  provisional?: boolean
}

/** Site-wide fee ladder by risk tier (条款设计书 §1, 2026-10-06); R4 matches the live AI RWA Core. */
const TIER: Record<1 | 2 | 3 | 4, HengxuTerms> = {
  1: { mgmtFeePct: 0.3, subFeePct: 0.1, redFeePct: 0.1, lockupDays: 0, settleDays: 2, minInvestment: 50 },
  2: { mgmtFeePct: 0.6, subFeePct: 0.2, redFeePct: 0.2, lockupDays: 7, settleDays: 2, minInvestment: 100 },
  3: { mgmtFeePct: 1, subFeePct: 0.3, redFeePct: 0.3, lockupDays: 7, settleDays: 2, minInvestment: 100 },
  4: { mgmtFeePct: 1.2, subFeePct: 0.3, redFeePct: 0.3, lockupDays: 7, settleDays: 2, minInvestment: 100 },
}

export type HengxuProduct = {
  id: HengxuId
  no: string
  short: string
  filters: HengxuFilter[]
  horizon: HengxuHorizon
  risk: HengxuRisk
  stage: HengxuStage
  /** Research weights in % of principal, sum 100, largest first. */
  allocation: [HengxuSleeve, number][]
  image: { src: string; width: number; height: number; focus: string }
  terms?: HengxuTerms
  zh: HengxuText
  en: HengxuText
}

const img = (name: string, width: number, height: number, focus = '50% 50%') => ({ src: `/media/products/hengxu-v2/derived/${name}`, width, height, focus })

/** Card / detail sources: derived WebP from scripts/hengxu-derive.py; originals stay untouched. */
export const hengxuImage = (product: HengxuProduct, size: 720 | 1440) => `${product.image.src}-${size}.webp`

export const HENGXU_FEATURED: HengxuId = 'zhongheng'
export const HENGXU_PRODUCTS: HengxuProduct[] = [
  {
    id: 'chengyuan', no: '01', short: 'Reserve', filters: ['short'], horizon: 'd90', risk: 1, stage: 'first',
    allocation: [['tbill', 90], ['cash', 10]],
    image: img('chengyuan-reserve', 1536, 1024, '50% 62%'),
    terms: TIER[1],
    zh: {
      name: '澄源', subtitle: '美元短债',
      oneLiner: '把短期暂不用的资金配置到期限较短、透明度较高的美元工具。',
      fit: '预计至少持有 30–90 天、重视退出确定性的用户。',
      allocationNote: '候选参考 SGOV 或已获准持有的短期国债工具；最终条款只写入实际可交易的标的。',
      exit: '按公布窗口申购和确认份额，使用新增资金和到期现金降低交易频率。赎回时间由底层结算和资金路径决定。',
      sources: ['超短期国债利息（扣除基金费用后）', '结算现金的存放收益（如有）'],
      risks: ['利率变化与基金净值波动', '汇兑、托管与支付通道风险', '费用对小额本金的侵蚀'],
      riskNote: '稳健档不代表本金不会亏损。',
      focus: ['持仓期限', '全部费用', '历史净值', '赎回时间', '资金托管主体'],
      alt: '暖色石材台面上叠放的纸张与一根黄铜条，窗外晨光',
    },
    en: {
      name: 'Chengyuan', subtitle: 'USD Short Treasuries',
      oneLiner: 'Puts money you won’t need for a while into short-dated, transparent US dollar instruments.',
      fit: 'For money you expect to hold for at least 30–90 days, where a predictable exit matters most.',
      allocationNote: 'Reference candidate: SGOV or an approved short treasury vehicle. Only instruments that can actually be traded go into final terms.',
      exit: 'Subscriptions and units confirm in published windows; new money and maturing cash reduce trading. Redemption timing depends on underlying settlement and the funds route.',
      sources: ['Short treasury interest, after fund fees', 'Yield on settlement cash, if any'],
      risks: ['Rate moves and fund NAV changes', 'FX, custody and payment-rail risk', 'Fees eroding small balances'],
      riskNote: 'A conservative tier does not mean principal cannot fall.',
      focus: ['Holding tenor', 'All fees', 'NAV history', 'Redemption timing', 'Custodian of funds'],
      alt: 'Stacked paper and a brass bar on a warm stone counter in morning light',
    },
  },
  {
    id: 'liujin', no: '02', short: 'Gold', filters: ['long'], horizon: 'y3', risk: 2, stage: 'first',
    allocation: [['tbill', 60], ['gold', 35], ['cash', 5]],
    image: img('liujin-gold', 2048, 768, '44% 50%'),
    terms: TIER[2],
    zh: {
      name: '鎏金', subtitle: '黄金配置',
      oneLiner: '用黄金和短债构建价格表现不同的长期配置。',
      fit: '希望持有黄金、能接受价格波动的长期用户。',
      allocationNote: '黄金部分在黄金基金与 PAXG 等代币化工具中择一，依据成本、资格、托管和退出核验结果选择。',
      exit: '按阈值再平衡。黄金不出借，也不作为循环借贷的抵押品。',
      sources: ['黄金价格变动（价格收益，不是利息）', '超短债利息'],
      risks: ['黄金价格下跌', '工具与金价之间的追踪偏差', '代币发行方与托管风险'],
      focus: ['黄金价格收益与短债收益分开披露', '所选黄金工具与托管方', '再平衡阈值'],
      alt: '深色丝绒与大理石台座上的一块金矿石微距',
      benchmark: '60% × 短期美债（1–3 月期，扣费后）+ 35% × 伦敦金现（LBMA Gold PM，仅价格收益）+ 5% × 现金',
      scenario: '保守 −8%（黄金回撤 20% 且短债利率下行）/ 基准 +6% / 乐观 +15%（黄金上行）',
      nav: '成立后按日公布，不预填历史；黄金价格收益与短债利息分开披露。',
    },
    en: {
      name: 'Liujin', subtitle: 'Gold Allocation',
      oneLiner: 'Pairs gold with short treasuries for a long-term holding whose parts move differently.',
      fit: 'For long-term holders who want gold exposure and accept price swings.',
      allocationNote: 'The gold sleeve uses either a gold fund or a tokenised instrument such as PAXG, chosen on cost, eligibility, custody and exit checks.',
      exit: 'Rebalanced on thresholds. Gold is never lent out or pledged for looped borrowing.',
      sources: ['Gold price change (a price return, not interest)', 'Short treasury interest'],
      risks: ['Gold price declines', 'Tracking error against spot gold', 'Token issuer and custody risk'],
      focus: ['Gold price return and treasury yield shown separately', 'Chosen gold vehicle and custodian', 'Rebalancing thresholds'],
      alt: 'Macro of a gold nugget on a marble plinth against dark velvet',
      benchmark: '60% × short US Treasuries (1–3 month, after fees) + 35% × spot gold (LBMA Gold PM, price return only) + 5% × cash',
      scenario: 'Bear −8% (gold down 20% and short rates falling) / Base +6% / Bull +15% (gold rallies)',
      nav: 'Published daily from inception, with no back-filled history; gold price return and treasury interest shown separately.',
    },
  },
  {
    id: 'zhongheng', no: '03', short: 'Balance', filters: ['long'], horizon: 'y3', risk: 2, stage: 'first',
    allocation: [['equity', 40], ['tbill', 35], ['gold', 15], ['trend', 10]],
    image: img('zhongheng-balance', 2046, 769, '52% 50%'),
    terms: TIER[2],
    zh: {
      name: '中衡', subtitle: '全球多资产',
      oneLiner: '用全球股票、短债、黄金和趋势策略形成长期核心持仓。',
      fit: '不急于用钱、希望一款产品完成基本配置的用户。',
      allocationNote: '候选基金需穿透识别股票、衍生品与费用，避免看似分散、实则重复持有同一风险。',
      exit: '季度审查，权重超过最终核定的偏离阈值才交易；优先用新增资金调整配比。',
      sources: ['全球股票价格变动与分红', '超短债利息', '黄金价格变动', '趋势策略损益（可能为负）'],
      risks: ['股票与黄金同时下跌', '趋势策略连续亏损', '基金底层衍生品与叠加费用'],
      focus: ['四类资产占比', '总费用', '净值曲线', '历史最大回撤', '实际披露的风险等级'],
      alt: '奶油色底上的纸艺拼贴：折纸、线描地球、金色竖条与蓝色色块',
    },
    en: {
      name: 'Zhongheng', subtitle: 'Global Multi-Asset',
      oneLiner: 'Global equities, short treasuries, gold and a trend sleeve as one long-term core holding.',
      fit: 'For people in no hurry for the money who want one product to cover the basics.',
      allocationNote: 'Candidate funds are looked through for equities, derivatives and fees, so the mix is not the same risk held twice.',
      exit: 'Reviewed quarterly; trades only when a weight breaches the approved drift band, using new money first.',
      sources: ['Global equity price change and dividends', 'Short treasury interest', 'Gold price change', 'Trend sleeve gains or losses (can be negative)'],
      risks: ['Equities and gold falling together', 'Repeated trend-strategy losses', 'Derivatives and layered fees inside funds'],
      focus: ['Weights of the four sleeves', 'Total fees', 'NAV curve', 'Historical max drawdown', 'Disclosed risk grade'],
      alt: 'Paper collage on cream: a folded sheet, a line-drawn globe, a gold strip and a blue block',
    },
  },
  {
    id: 'runheng', no: '04', short: 'Income', filters: ['short', 'digital', 'research'], horizon: 'm12', risk: 'pending', stage: 'research',
    allocation: [['tbill', 75], ['lending', 10], ['cash', 10], ['fixedTerm', 5]],
    image: img('runheng-income', 1536, 1024, '42% 55%'),
    terms: { mgmtFeePct: 0.8, subFeePct: 0.2, redFeePct: 0.2, lockupDays: 0, settleDays: 2, minInvestment: 100, provisional: true },
    zh: {
      name: '润衡', subtitle: '链上收益',
      oneLiner: '在短债基础上，小幅配置链上借贷与到期型收益头寸。',
      fit: '了解智能合约与稳定币风险的用户。',
      allocationNote: 'Aave 类借贷市场与 Pendle 类到期工具只是研究方向；实际网络、合约、资金池和到期日须逐项核验。',
      exit: '不循环抵押，不因协议显示的 APY 升高而自动迁移；链上头寸的到期日与赎回窗口匹配。',
      sources: ['超短债利息', '稳定币借贷利息（浮动）', '到期型头寸持有到期的收益'],
      risks: ['智能合约漏洞', '稳定币脱锚', '资金池可用流动性不足', '收益率随市场变化'],
      riskNote: '压力测试完成前不标注为稳健。',
      focus: ['逐策略净收益来源', '可退出余额', '压力测试结果'],
      alt: '水彩画：山间两座圆形水池，金色水流从上层流入下层',
      target: '不提供年化：利率浮动且叠加协议风险，净收益来源逐项披露。',
      blocker: '链上借贷（Aave 类）与到期工具（Pendle 类）的网络、合约、资金池和到期日尚未逐项核验。',
      conditions: ['逐个协议核验网络、合约、资金池与到期日', '压力测试通过：稳定币脱锚、流动性枯竭、合约暂停', '明确「可退出余额」的计量与展示口径', '以上完成后，由待定级确定为均衡或进取档'],
    },
    en: {
      name: 'Runheng', subtitle: 'On-chain Income',
      oneLiner: 'Short treasuries at the core, with a small sleeve of on-chain lending and fixed-maturity positions.',
      fit: 'For people who understand smart-contract and stablecoin risk.',
      allocationNote: 'Aave-style lending and Pendle-style fixed-maturity tools are research directions only; each network, contract, pool and maturity needs its own review.',
      exit: 'No looped collateral and no automatic migration when a protocol shows a higher APY. On-chain maturities are matched to redemption windows.',
      sources: ['Short treasury interest', 'Stablecoin lending interest (variable)', 'Fixed-maturity yield when held to maturity'],
      risks: ['Smart-contract failure', 'Stablecoin de-peg', 'Thin available liquidity in pools', 'Yields that change with the market'],
      riskNote: 'Not labelled conservative until stress tests are complete.',
      focus: ['Net return by strategy', 'Withdrawable balance', 'Stress-test results'],
      alt: 'Watercolour of two round hillside pools, golden water flowing from the upper to the lower',
      target: 'No annualised figure: rates float and carry protocol risk, so net return is disclosed source by source.',
      blocker: 'The networks, contracts, pools and maturities of the Aave-style lending and Pendle-style fixed-maturity tools have not yet been checked one by one.',
      conditions: ['Each protocol’s network, contract, pool and maturity verified', 'Stress tests passed: stablecoin de-peg, liquidity drought, contract pause', 'How the withdrawable balance is measured and shown is defined', 'Then graded from pending to Balanced or Growth'],
    },
  },
  {
    id: 'hengcha', no: '05', short: 'Carry', filters: ['short', 'research'], horizon: 'm12', risk: 'pending', stage: 'research',
    allocation: [['tbill', 55], ['basis', 30], ['margin', 15]],
    image: img('hengcha-carry', 1916, 821, '50% 50%'),
    terms: { mgmtFeePct: 0.9, subFeePct: 0.3, redFeePct: 0.3, lockupDays: 7, settleDays: 2, minInvestment: 200, provisional: true },
    zh: {
      name: '衡差', subtitle: '期现策略',
      oneLiner: '在严格匹配现货与期货的前提下，研究扣费后的价差收益。',
      fit: '理解保证金和交易对手风险的用户。',
      allocationNote: '30% 是投入策略的资本，不是期货名义仓位；总敞口、杠杆和保证金占用将另行公布。',
      exit: '预先设定可交易合约、对冲误差、最小净价差、平仓阈值与停机规则；任一腿无法执行时暂停新订单。',
      sources: ['现货与期货之间的价差（扣费后）', '超短债利息'],
      risks: ['基差变化', '强制平仓', '交易所或托管方故障', '跨场所转账延迟'],
      riskNote: '真实执行与监控链路验收前，仅展示研究页。',
      focus: ['价差来源', '资金占用', '压力情景', '赎回限制'],
      alt: '藏蓝底上的技术版画：金、银两条线路汇合为一点',
      blocker: '真实执行与监控链路（两条腿的成交、对冲误差、停机规则）尚未验收。',
      conditions: ['保证金与强平规则写入产品页', '固化最小净价差、平仓阈值与停机规则', '实测跨场所转账延迟', '执行链路验收后才定级（基差策略通常为均衡至进取档）；定级前不放入稳健档'],
    },
    en: {
      name: 'Hengcha', subtitle: 'Cash-and-Carry',
      oneLiner: 'Researches the after-fee spread between strictly matched spot and futures positions.',
      fit: 'For people who understand margin and counterparty risk.',
      allocationNote: 'The 30% is capital committed to the strategy, not futures notional. Gross exposure, leverage and margin use will be published separately.',
      exit: 'Tradable contracts, hedge error, minimum net spread, unwind thresholds and kill-switch rules are set in advance; new orders pause if either leg cannot execute.',
      sources: ['Spot–futures spread, after fees', 'Short treasury interest'],
      risks: ['Basis moves', 'Forced liquidation', 'Exchange or custodian failure', 'Delays moving funds between venues'],
      riskNote: 'Shown as research only until live execution and monitoring are accepted.',
      focus: ['Where the spread comes from', 'Capital in use', 'Stress scenarios', 'Redemption limits'],
      alt: 'Technical print on navy: a gold line and a silver line converging to one point',
      blocker: 'Live execution and monitoring (fills on both legs, hedge error, kill-switch rules) have not yet been accepted.',
      conditions: ['Margin and liquidation rules written into the product page', 'Minimum net spread, unwind thresholds and kill-switch rules fixed', 'Transfer delays between venues measured', 'Graded only after execution is accepted (basis strategies usually land Balanced to Growth); never in the conservative tier before then'],
    },
  },
  {
    id: 'yuanjian', no: '06', short: 'Growth', filters: ['long'], horizon: 'y5', risk: 3, stage: 'first',
    allocation: [['equity', 60], ['tech', 15], ['tbill', 15], ['btc', 10]],
    image: img('yuanjian-growth', 1916, 821, '50% 50%'),
    terms: TIER[3],
    zh: {
      name: '远见', subtitle: '全球成长',
      oneLiner: '以全球股票为主，有限加入科技和 BTC，争取长期增长。',
      fit: '预计持有五年以上、接受显著净值波动的用户。',
      allocationNote: '全球股票基金本身已包含科技公司，组合风险按穿透后的科技总仓位计算。',
      exit: '定期评估持仓重叠与集中度；BTC 部分先用现货，不叠加借贷。',
      sources: ['全球与科技股票价格变动及分红', 'BTC 价格变动', '超短债利息'],
      risks: ['科技股与 BTC 在风险偏好下降时同时下跌', '五年建议期限不保证五年后盈利', '净值波动显著'],
      focus: ['穿透后的科技与 BTC 总敞口', '净值与累计总回报', '不展示预设收益率'],
      alt: '晨光中的温室，窗外是海湾与远山，室内一株橄榄树',
    },
    en: {
      name: 'Yuanjian', subtitle: 'Global Growth',
      oneLiner: 'Mostly global equities, with a measured add of tech and BTC, aiming for long-run growth.',
      fit: 'For people holding five years or more who accept large NAV swings.',
      allocationNote: 'Global equity funds already hold tech companies; risk is measured on total look-through tech exposure.',
      exit: 'Overlap and concentration are reviewed regularly. BTC starts as spot only, with no borrowing on top.',
      sources: ['Global and tech equity price change and dividends', 'BTC price change', 'Short treasury interest'],
      risks: ['Tech and BTC falling together when risk appetite drops', 'A five-year horizon does not guarantee a gain after five years', 'Large NAV swings'],
      focus: ['Look-through tech and BTC exposure', 'NAV and cumulative total return', 'No preset yield figure'],
      alt: 'A greenhouse at sunrise with an olive tree, a bay and hills beyond the glass',
    },
  },
  {
    id: 'qiyuan', no: '07', short: 'Innovation', filters: ['long'], horizon: 'y5', risk: 3, stage: 'first',
    allocation: [['semis', 30], ['cloud', 20], ['equity', 20], ['power', 15], ['tbill', 15]],
    image: img('qiyuan-innovation', 1918, 820, '62% 50%'),
    terms: TIER[3],
    zh: {
      name: '启元', subtitle: '科技基础设施',
      oneLiner: '集中研究计算、网络及电力基础设施相关企业。',
      fit: '主动选择高行业集中度的长期用户。',
      allocationNote: '各子行业以明确的基金或股票篮子实现，避免只用同一批科技巨头包装成三个分类。',
      exit: '单一公司穿透权重初拟不高于组合净值 8%，最终阈值需经回测和审批。',
      sources: ['主题股票价格变动与分红', '全球股票价格变动', '超短债利息'],
      risks: ['估值收缩', '技术周期下行', '出口限制', '电力需求兑现不及预期'],
      focus: ['主题与非主题配置', '前十大公司穿透持仓', '与远见的重叠度'],
      alt: '数据中心设备纪实微距：铜制散热鳍片与管道，旁边是机柜长廊',
      benchmark: '30% × 半导体指数 + 20% × 云与软件指数 + 20% × MSCI 世界 + 15% × 电力基础设施指数 + 15% × 短期美债',
      target: '10% – 18% / 年（重权益 + 主题溢价，波动大）',
      scenario: '保守 −30%（估值收缩 + 技术周期下行）/ 基准 +12% / 乐观 +35%',
      conditions: ['四个子行业的具体基金或股票篮子', '单一公司穿透权重不高于净值 8%，经回测确认'],
    },
    en: {
      name: 'Qiyuan', subtitle: 'Tech Infrastructure',
      oneLiner: 'Concentrates on companies behind compute, networks and power infrastructure.',
      fit: 'For long-term holders who deliberately choose high sector concentration.',
      allocationNote: 'Each sub-sector uses a defined fund or stock basket, so the same few tech giants are not relabelled three ways.',
      exit: 'Any single company’s look-through weight is initially capped at 8% of NAV; the final cap needs backtesting and approval.',
      sources: ['Theme equity price change and dividends', 'Global equity price change', 'Short treasury interest'],
      risks: ['Valuation compression', 'Technology down-cycles', 'Export controls', 'Power demand falling short'],
      focus: ['Theme vs non-theme weights', 'Top-ten look-through holdings', 'Overlap with Yuanjian'],
      alt: 'Documentary macro of data-centre hardware: copper cooling fins and pipes beside a row of racks',
      benchmark: '30% × semiconductor index + 20% × cloud & software index + 20% × MSCI World + 15% × power infrastructure index + 15% × short US Treasuries',
      target: '10% – 18% a year (equity-heavy plus a theme premium; highly volatile)',
      scenario: 'Bear −30% (valuation compression and a tech down-cycle) / Base +12% / Bull +35%',
      conditions: ['A defined fund or stock basket for each of the four sub-sectors', 'Single-company look-through weight capped at 8% of NAV, confirmed by backtest'],
    },
  },
  {
    id: 'xinghe', no: '08', short: 'Digital', filters: ['long', 'digital'], horizon: 'y5', risk: 4, stage: 'first',
    allocation: [['btc', 40], ['eth', 25], ['tbill', 20], ['sol', 10], ['cash', 5]],
    image: img('xinghe-digital', 1916, 821, '40% 50%'),
    terms: TIER[4],
    zh: {
      name: '星河', subtitle: '数字核心',
      oneLiner: '以 BTC、ETH 为主，加入少量 SOL 和短债的数字资产组合。',
      fit: '可承受大幅波动的长期用户。',
      exit: '首版仅持有现货；链、交易所与托管敞口分别计量。',
      sources: ['BTC、ETH、SOL 价格变动', '超短债利息'],
      risks: ['币价大幅下跌', '交易所暂停服务', '链上与托管故障', '持有短债不构成最大亏损保证'],
      focus: ['24 小时行情与可执行报价分开展示', '持仓与托管信息', '币价与组合净值'],
      alt: '深蓝空间中两根发光的石柱，倒映在光滑地面上',
      benchmark: '40% × BTC + 25% × ETH + 10% × SOL + 20% × 短期美债 + 5% × 现金',
      target: '不设年度中枢：加密资产没有稳定的长期中枢。',
      scenario: '保守 −70% / 基准 −20% ~ +25% / 乐观 +80%（区间之宽本身就是该产品的风险特征）',
      conditions: ['交易所与托管方', '链上与托管敞口分别计量并公布'],
    },
    en: {
      name: 'Xinghe', subtitle: 'Digital Core',
      oneLiner: 'A digital-asset mix led by BTC and ETH, with a little SOL and short treasuries.',
      fit: 'For long-term holders who can live with deep drawdowns.',
      exit: 'Spot only in the first version; chain, exchange and custody exposure are measured separately.',
      sources: ['BTC, ETH and SOL price change', 'Short treasury interest'],
      risks: ['Sharp crypto price falls', 'Exchange suspensions', 'On-chain and custody failures', 'Holding treasuries does not cap the maximum loss'],
      focus: ['24h market data kept apart from executable quotes', 'Holdings and custody', 'Coin prices vs portfolio NAV'],
      alt: 'Two lit stone pillars in a deep blue hall, reflected in a polished floor',
      benchmark: '40% × BTC + 25% × ETH + 10% × SOL + 20% × short US Treasuries + 5% × cash',
      target: 'No annual central range: crypto has no stable long-run centre.',
      scenario: 'Bear −70% / Base −20% to +25% / Bull +80% (the width of the range is itself the risk profile)',
      conditions: ['Exchanges and custodians', 'On-chain and custody exposure measured and published separately'],
    },
  },
  {
    id: 'tuojie', no: '09', short: 'Frontier', filters: ['digital', 'research'], horizon: 'y5', risk: 4, stage: 'research',
    allocation: [['btc', 25], ['eth', 25], ['sol', 15], ['tbillCash', 15], ['link', 10], ['aave', 5], ['ondo', 5]],
    image: img('tuojie-frontier', 2043, 770, '50% 50%'),
    terms: { mgmtFeePct: 1.5, subFeePct: 0.5, redFeePct: 0.5, lockupDays: 15, settleDays: 2, minInvestment: 200, provisional: true },
    zh: {
      name: '拓界', subtitle: '数字创新',
      oneLiner: '在主流币基础上，选择具有可核验用途与流动性的公链和协议代币。',
      fit: '明确愿意承担项目失败和代币稀释风险的用户。',
      allocationNote: '候选代币不会自动入选，需核验流通量、未来解锁、持有人实际权益与可成交深度。ONDO 是治理代币，不代表 Ondo 国债产品的权益；AAVE 也不是 Aave 存款凭证。',
      exit: '单一非 BTC/ETH 代币的上限与最低流动性由后台规则审批；出现重大解锁、合约风险或无法估值时暂停加仓。',
      sources: ['代币价格变动', '超短债利息'],
      risks: ['代币解锁与稀释', '资产间相关性上升', '项目失败', '交易深度不足'],
      focus: ['项目代币与收益资产的区别', '流通与解锁资料', '集中度'],
      alt: '藏蓝底上的多色套印抽象画：几何节点由细线连成网络',
      blocker: '候选代币（LINK、AAVE、ONDO）的流通量、解锁、持有人实际权益与可成交深度尚未核验。',
      conditions: ['逐币核验并公开流通量与解锁资料', '明确项目代币不等于收益资产', '单一非 BTC/ETH 代币上限与最低流动性规则落地', '重大解锁、合约风险或无法估值时暂停加仓的机制完成验收'],
    },
    en: {
      name: 'Tuojie', subtitle: 'Digital Frontier',
      oneLiner: 'Adds layer-1 and protocol tokens with verifiable use and liquidity on top of the majors.',
      fit: 'For people who knowingly accept project failure and token dilution.',
      allocationNote: 'Candidates are not included automatically: supply, future unlocks, real holder rights and tradable depth are checked first. ONDO is a governance token, not a claim on Ondo’s treasury products; AAVE is not an Aave deposit receipt.',
      exit: 'Caps and minimum liquidity for any non-BTC/ETH token are approved by back-office rules; adding stops on major unlocks, contract risk or when a price cannot be established.',
      sources: ['Token price change', 'Short treasury interest'],
      risks: ['Unlocks and dilution', 'Rising correlation', 'Project failure', 'Thin trading depth'],
      focus: ['Project tokens vs yield-bearing assets', 'Supply and unlock data', 'Concentration'],
      alt: 'Multi-colour overprint abstract on navy: geometric nodes joined by fine lines',
      blocker: 'Supply, unlocks, real holder rights and tradable depth for the candidate tokens (LINK, AAVE, ONDO) are not yet verified.',
      conditions: ['Each token verified, with supply and unlock data published', 'Project tokens clearly separated from yield-bearing assets', 'Caps on any non-BTC/ETH token and minimum liquidity rules in force', 'The pause-on-unlock, contract-risk or no-price mechanism accepted'],
    },
  },
  {
    id: 'shiyuan', no: '10', short: 'Real Asset', filters: ['research'], horizon: 'terms', risk: 'unrated', stage: 'special',
    allocation: [['tbill', 85], ['issued', 10], ['cash', 5]],
    image: img('shiyuan-real-asset', 1774, 887, '58% 50%'),
    zh: {
      name: '实源', subtitle: '资产收益',
      oneLiner: '为平台拟发行、具有明确底层资产或现金流权益的代币建立独立产品系列。',
      fit: '按期次发行，形式为「实源 01 · 资产类型」；资产类型确认前不列示任何示例项目。',
      allocationNote: '10% 是初拟研究上限，不是必须买满的比例；权利、价格与退出规则成立之前，该部分保持现金或短债。',
      exit: '关联方转让价格由独立方复核，不以平台单方报价抬高净值；价格下跌后不机械补仓，现金回收与赎回期限匹配。',
      sources: ['底层资产现金流（按各期次权利）', '超短债利息'],
      risks: ['关联交易', '资产价值与收入不达预期', '缺少二级市场', '集中赎回', '自发行代币全损即约造成组合 10% 损失'],
      riskNote: '尚未定级，不默认放入稳健档。',
      focus: ['发行人与关联关系', '底层资产清单、权属与现金流证据', '持有人拥有资产权益、收入分成权、赎回权中的哪几项', '偿付顺序', '总发行量与剩余可发行量', '估值、减值与审计方法', '合同期限与赎回条件'],
      alt: '暖白墙前木台上的一块石英棱柱与一把铜钥匙',
      feeNote: '每期单独定价与披露：管理费按基础费加业绩报酬逐期确定，锁定期按底层资产期限确定。',
      blocker: '按「实源 01 · 资产类型」逐期发行，目前没有已确认的资产类型，因此没有可上线的标的。',
      conditions: ['以上披露项须逐期满足，方可发行该期'],
    },
    en: {
      name: 'Shiyuan', subtitle: 'Real Asset Income',
      oneLiner: 'A separate series for platform-issued tokens with a defined claim on underlying assets or cash flows.',
      fit: 'Issued in numbered series, such as “Shiyuan 01 · asset type”. No example project is listed until an asset type is confirmed.',
      allocationNote: 'The 10% is an initial research ceiling, not a target to fill. Until rights, pricing and exit rules are in place, it stays in cash or treasuries.',
      exit: 'Related-party transfer prices are independently reviewed and the platform cannot mark NAV up on its own quote. No mechanical buying after price drops; cash recovery is matched to redemption terms.',
      sources: ['Underlying cash flows, per series rights', 'Short treasury interest'],
      risks: ['Related-party dealing', 'Asset value or income falling short', 'No secondary market', 'Concentrated redemptions', 'A total loss on the issued token alone is roughly a 10% portfolio loss'],
      riskNote: 'Not yet graded, and not placed in a conservative tier by default.',
      focus: ['Issuer and related parties', 'Asset list, title and cash-flow evidence', 'Which of asset claim, revenue share and redemption right holders get', 'Payment priority', 'Total and remaining issuance', 'Valuation, impairment and audit method', 'Term and redemption conditions'],
      alt: 'A quartz prism and a copper key on a wooden block before a warm white wall',
      feeNote: 'Each series is priced and disclosed on its own: the management fee (a base fee plus a performance fee) and the lock-up, which follows the underlying asset’s term, are set per series.',
      blocker: 'Issued series by series as “Shiyuan 01 · asset type”; no asset type is confirmed yet, so there is nothing to launch.',
      conditions: ['Every disclosure above must be met for each series before it is issued'],
    },
  },
]

export const hengxuById = (id: string | null | undefined) => HENGXU_PRODUCTS.find((product) => product.id === id) ?? null
