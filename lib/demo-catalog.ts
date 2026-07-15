export type DemoCategory = 'Compute' | 'RWA' | 'Stocks' | 'Prediction'
export type DemoRisk = 'Low Risk' | 'Medium Risk' | 'High Risk'
export type DemoScene = 'compute' | 'solar' | 'stocks' | 'prediction' | 'solar-dome'

export interface DemoProduct {
  id: string
  title: string
  subtitle: string
  category: DemoCategory
  risk: DemoRisk
  kind: DemoScene
  returnMetric: string
  returnLabel: string
  minimum: string
  liquidity: string
  availability: string
  note: string
  isDemo: boolean
}

export interface DemoProjectProfile {
  issuer: string
  location: string
  structure: string
  targetSize: string
  settlement: string
  updated: string
  thesis: string
  cashFlow: string
  risks: string[]
  milestones: Array<{ label: string; date: string; state: 'complete' | 'next' | 'planned' }>
  documents: Array<{ label: string; detail: string }>
}

export const demoProducts: DemoProduct[] = [
  { id: 'h100-inference-pool', title: 'H100 inference pool', subtitle: 'Enterprise inference capacity across Tier III sites', category: 'Compute', risk: 'Medium Risk', kind: 'compute', returnMetric: '18.2%', returnLabel: 'projected APY', minimum: '100 USDT', liquidity: 'Monthly window', availability: '72% capacity', note: 'Demo product for presentation', isDemo: true },
  { id: 'b200-training-lease', title: 'B200 training lease', subtitle: 'Reserved GPU clusters for model training demand', category: 'Compute', risk: 'High Risk', kind: 'compute', returnMetric: '22.6%', returnLabel: 'projected APY', minimum: '250 USDT', liquidity: '90-day term', availability: '41% capacity', note: 'Demo product for presentation', isDemo: true },
  { id: 'edge-vision-grid', title: 'Edge vision grid', subtitle: 'Distributed GPU capacity for computer-vision workloads', category: 'Compute', risk: 'Medium Risk', kind: 'compute', returnMetric: '16.4%', returnLabel: 'projected APY', minimum: '75 USDT', liquidity: 'Weekly queue', availability: '88% capacity', note: 'Demo product for presentation', isDemo: true },
  { id: 'liquid-cooling-revenue', title: 'Liquid cooling revenue', subtitle: 'Data-center cooling infrastructure revenue share', category: 'Compute', risk: 'Medium Risk', kind: 'compute', returnMetric: '14.8%', returnLabel: 'projected yield', minimum: '150 USDT', liquidity: 'Quarterly window', availability: '65% capacity', note: 'Demo product for presentation', isDemo: true },
  { id: 'solar-income-2027', title: 'Solar income 2027', subtitle: 'Contracted operating solar assets in the United States', category: 'RWA', risk: 'Low Risk', kind: 'solar', returnMetric: '12.0%', returnLabel: 'projected yield', minimum: '500 USDT', liquidity: 'Quarterly window', availability: 'Open', note: 'Demo product for presentation', isDemo: true },
  { id: 'port-logistics-note', title: 'Port logistics note', subtitle: 'Warehouse lease and terminal service cash-flow basket', category: 'RWA', risk: 'Medium Risk', kind: 'solar-dome', returnMetric: '13.7%', returnLabel: 'projected yield', minimum: '300 USDT', liquidity: '12-month term', availability: '58% subscribed', note: 'Demo product for presentation', isDemo: true },
  { id: 'tokenized-tbill-91d', title: 'Tokenized T-Bill 91D', subtitle: 'Short-duration US Treasury reference strategy', category: 'RWA', risk: 'Low Risk', kind: 'solar-dome', returnMetric: '5.1%', returnLabel: 'indicative yield', minimum: '50 USDT', liquidity: 'T+2 redemption', availability: 'Daily dealing', note: 'Demo product for presentation', isDemo: true },
  { id: 'private-credit-northstar', title: 'Private credit Northstar', subtitle: 'Senior-secured lending strategy with covenant monitoring', category: 'RWA', risk: 'Medium Risk', kind: 'solar-dome', returnMetric: '15.3%', returnLabel: 'projected yield', minimum: '1,000 USDT', liquidity: '18-month term', availability: '34% subscribed', note: 'Demo product for presentation', isDemo: true },
  { id: 'multifamily-refi', title: 'Multifamily refinance', subtitle: 'Senior lien exposure to stabilized residential assets', category: 'RWA', risk: 'Medium Risk', kind: 'solar', returnMetric: '11.4%', returnLabel: 'projected yield', minimum: '750 USDT', liquidity: 'Quarterly window', availability: 'Open', note: 'Demo product for presentation', isDemo: true },
  { id: 'ai-leaders-basket', title: 'AI leaders basket', subtitle: 'Tokenized reference basket of global AI infrastructure equities', category: 'Stocks', risk: 'Medium Risk', kind: 'stocks', returnMetric: '92', returnLabel: 'AI score', minimum: '50 USDT', liquidity: 'Market hours', availability: 'Market open', note: 'Demo product for presentation', isDemo: true },
  { id: 'semiconductor-supply-chain', title: 'Semiconductor supply chain', subtitle: 'Diversified compute hardware and networking exposure', category: 'Stocks', risk: 'High Risk', kind: 'stocks', returnMetric: '84', returnLabel: 'AI score', minimum: '50 USDT', liquidity: 'Market hours', availability: 'Market open', note: 'Demo product for presentation', isDemo: true },
  { id: 'global-dividend-quality', title: 'Global dividend quality', subtitle: 'Cash-generative global equities with quality screens', category: 'Stocks', risk: 'Low Risk', kind: 'stocks', returnMetric: '76', returnLabel: 'AI score', minimum: '50 USDT', liquidity: 'Market hours', availability: 'Market open', note: 'Demo product for presentation', isDemo: true },
]

export const featuredProducts = demoProducts.filter((product) => ['h100-inference-pool', 'solar-income-2027', 'tokenized-tbill-91d', 'ai-leaders-basket'].includes(product.id))

export const projectProfiles: Record<string, DemoProjectProfile> = {
  'h100-inference-pool': {
    issuer: 'Aster Compute SPV I', location: 'Virginia & Texas, United States', structure: 'Revenue-share notes backed by contracted inference capacity', targetSize: 'USDT 2.4M', settlement: 'Daily accrual · monthly distribution', updated: 'Updated 11 Jul 2026 · Demo data',
    thesis: 'The pool purchases a defined share of H100 capacity reserved by enterprise inference customers. Revenue is tied to metered GPU-hours after colocation and orchestration costs.', cashFlow: 'June utilization averaged 98.1%. Illustrative net revenue is calculated from contracted workload reservations, less power, hosting and platform reserves.',
    risks: ['Customer concentration can reduce realized utilization.', 'Hardware replacement and energy costs can compress distributions.', 'Secondary liquidity is available only during the monthly window.'],
    milestones: [{ label: 'Capacity reservation signed', date: '14 Jun', state: 'complete' }, { label: 'First revenue snapshot', date: '31 Jul', state: 'next' }, { label: 'Monthly distribution', date: '05 Aug', state: 'planned' }],
    documents: [{ label: 'Investment memorandum', detail: 'Structure, fees and waterfall · Demo PDF' }, { label: 'Capacity report', detail: 'Utilization and reservation mix · Jul 2026' }, { label: 'Risk disclosure', detail: 'Hardware, counterparty and liquidity risks' }],
  },
  'b200-training-lease': {
    issuer: 'Aster Compute SPV II', location: 'Oregon, United States', structure: 'Fixed-term equipment lease participation', targetSize: 'USDT 3.1M', settlement: 'Monthly distribution after 90-day term', updated: 'Updated 11 Jul 2026 · Demo data',
    thesis: 'A fixed training-cluster lease captures higher contracted rates in exchange for a longer lockup and stricter dependency on delivery timing.', cashFlow: 'Illustrative payments begin only after rack acceptance. The projected rate assumes a completed 90-day customer reservation and no renewal premium.',
    risks: ['Delivery or commissioning delays defer revenue.', 'The 90-day term has no early redemption window.', 'Single-program demand may not renew after maturity.'],
    milestones: [{ label: 'Lease documentation complete', date: '03 Jul', state: 'complete' }, { label: 'Rack acceptance', date: '29 Jul', state: 'next' }, { label: 'First settlement', date: '31 Oct', state: 'planned' }],
    documents: [{ label: 'Lease summary', detail: 'Term, customer protections and reserve policy' }, { label: 'Commissioning checklist', detail: 'Delivery and acceptance milestones' }, { label: 'Risk disclosure', detail: 'Term, renewal and delivery risks' }],
  },
  'edge-vision-grid': {
    issuer: 'Edgeframe Network SPV', location: 'Singapore & Frankfurt', structure: 'Usage-linked distributed GPU revenue share', targetSize: 'USDT 1.2M', settlement: 'Weekly queue · monthly payout', updated: 'Updated 10 Jul 2026 · Demo data',
    thesis: 'The network aggregates shorter computer-vision workloads near customer data sources, trading large-cluster concentration for diversified utilization.', cashFlow: 'Illustrative income is based on completed verified tasks across edge nodes. A reserve is retained for node availability and customer service credits.',
    risks: ['Node availability can vary by region.', 'Short jobs create more variable revenue than reserved clusters.', 'Weekly exit requests may queue when demand is elevated.'],
    milestones: [{ label: 'EU node cohort added', date: '02 Jul', state: 'complete' }, { label: 'July utilization report', date: '22 Jul', state: 'next' }, { label: 'Distribution window', date: '01 Aug', state: 'planned' }],
    documents: [{ label: 'Network methodology', detail: 'Task verification and revenue attribution' }, { label: 'Regional availability', detail: 'Current node and workload coverage' }, { label: 'Risk disclosure', detail: 'Network, utilization and liquidity risks' }],
  },
  'liquid-cooling-revenue': {
    issuer: 'Thermal Grid Income SPV', location: 'Nevada, United States', structure: 'Infrastructure revenue participation', targetSize: 'USDT 1.8M', settlement: 'Quarterly window · monthly revenue estimate', updated: 'Updated 09 Jul 2026 · Demo data',
    thesis: 'This participation references cooling-service fees for dense AI racks, where contracted load and energy efficiency determine cash generation.', cashFlow: 'Illustrative revenue is derived from service invoices after maintenance reserves and site operating costs. Yield is not a guarantee.',
    risks: ['Maintenance events can reduce billable capacity.', 'Power pricing affects customer utilization decisions.', 'Quarterly liquidity may not suit short-horizon allocations.'],
    milestones: [{ label: 'Service contract renewed', date: '20 Jun', state: 'complete' }, { label: 'Cooling performance audit', date: '18 Jul', state: 'next' }, { label: 'Quarterly redemption window', date: '01 Oct', state: 'planned' }],
    documents: [{ label: 'Service agreement summary', detail: 'Fee model and operational reserve' }, { label: 'Efficiency report', detail: 'PUE and thermal performance · Demo' }, { label: 'Risk disclosure', detail: 'Operations, energy and liquidity risks' }],
  },
  'solar-income-2027': {
    issuer: 'Solara Income SPV 2027', location: 'Texas & Arizona, United States', structure: 'Contracted solar operating-asset participation', targetSize: 'USDT 4.6M', settlement: 'Monthly revenue · quarterly exit window', updated: 'Updated 11 Jul 2026 · Demo data',
    thesis: 'The strategy references operating solar projects with contracted offtake, combining generated-power revenue and a predefined maintenance reserve.', cashFlow: 'Illustrative distributions are calculated from power-sale receipts after O&M, insurance, tax and reserve allocations. The annualized yield is projected, not guaranteed.',
    risks: ['Weather and curtailment can affect generation.', 'Offtaker credit quality affects cash collection.', 'Redemption is only available in the quarterly window.'],
    milestones: [{ label: 'Q2 operating report published', date: '08 Jul', state: 'complete' }, { label: 'July production snapshot', date: '31 Jul', state: 'next' }, { label: 'Next redemption window', date: '30 Sep', state: 'planned' }],
    documents: [{ label: 'Offering memorandum', detail: 'Asset pool, cash waterfall and fee schedule' }, { label: 'Operating report', detail: 'Generation and offtake summary · Q2 2026' }, { label: 'Risk disclosure', detail: 'Generation, counterparty and liquidity risks' }],
  },
  'port-logistics-note': {
    issuer: 'Harborline Cashflow SPV', location: 'Busan & Rotterdam', structure: 'Warehouse lease and terminal-service note', targetSize: 'USDT 2.7M', settlement: 'Quarterly coupon · 12-month term', updated: 'Updated 10 Jul 2026 · Demo data',
    thesis: 'A diversified basket of contracted warehousing and terminal-service receivables provides defined-term income across two freight corridors.', cashFlow: 'Illustrative coupon capacity is based on lease receipts and service invoices after senior expenses and a covenant reserve.',
    risks: ['Trade volumes can affect renewal pricing.', 'The note is not redeemable before maturity.', 'Currency and counterparty exposure require monitoring.'],
    milestones: [{ label: 'Receivable pool verified', date: '05 Jul', state: 'complete' }, { label: 'Subscription close', date: '26 Jul', state: 'next' }, { label: 'First coupon observation', date: '30 Sep', state: 'planned' }],
    documents: [{ label: 'Note term sheet', detail: 'Priority, term and coupon mechanics' }, { label: 'Receivable pool summary', detail: 'Tenant and service diversification · Demo' }, { label: 'Risk disclosure', detail: 'Trade-cycle and illiquidity risks' }],
  },
  'tokenized-tbill-91d': {
    issuer: 'Atlas Treasury Series 91D', location: 'United States reference strategy', structure: 'Short-duration Treasury reference participation', targetSize: 'USDT 6.0M', settlement: 'T+2 redemption · daily dealing', updated: 'Updated 11 Jul 2026 · Demo data',
    thesis: 'A short-duration reference strategy is designed as a lower-volatility allocation and portfolio liquidity reserve, rather than a yield-maximizing position.', cashFlow: 'The indicative yield follows the reference portfolio’s short-duration Treasury accrual less stated administration costs. It can change with rates.',
    risks: ['Indicative yield can decline as reference rates change.', 'T+2 redemption remains subject to dealing and controls.', 'This Demo is not a custody or securities offering.'],
    milestones: [{ label: 'Daily NAV reference published', date: '11 Jul', state: 'complete' }, { label: 'Next dealing cut-off', date: '15 Jul', state: 'next' }, { label: 'T+2 redemption cycle', date: '17 Jul', state: 'planned' }],
    documents: [{ label: 'Reference methodology', detail: 'Duration, pricing and accrual approach' }, { label: 'Daily dealing note', detail: 'Cut-off, settlement and redemption process' }, { label: 'Risk disclosure', detail: 'Rate, dealing and reference-strategy risks' }],
  },
  'private-credit-northstar': {
    issuer: 'Northstar Credit SPV', location: 'United Kingdom & Singapore', structure: 'Senior-secured private-credit participation', targetSize: 'USDT 5.5M', settlement: 'Monthly interest · 18-month term', updated: 'Updated 09 Jul 2026 · Demo data',
    thesis: 'The illustrative pool focuses on senior-secured loans with covenant reporting, aiming to prioritize cash income and downside controls over immediate liquidity.', cashFlow: 'Projected income is sourced from borrower interest payments after servicing costs and loss reserves. No return amount is assured.',
    risks: ['Borrower performance may trigger covenant remediation.', 'Credit losses can reduce distributions and principal.', 'The 18-month term significantly limits liquidity.'],
    milestones: [{ label: 'Covenant review completed', date: '30 Jun', state: 'complete' }, { label: 'Borrower reporting cycle', date: '25 Jul', state: 'next' }, { label: 'First monthly distribution', date: '05 Aug', state: 'planned' }],
    documents: [{ label: 'Credit memorandum', detail: 'Security package and underwriting summary' }, { label: 'Covenant dashboard', detail: 'Illustrative reporting metrics · Jun 2026' }, { label: 'Risk disclosure', detail: 'Credit, valuation and liquidity risks' }],
  },
  'multifamily-refi': {
    issuer: 'Cedar Residential Finance SPV', location: 'Phoenix, United States', structure: 'Senior-lien refinance participation', targetSize: 'USDT 3.3M', settlement: 'Monthly interest · quarterly exit window', updated: 'Updated 08 Jul 2026 · Demo data',
    thesis: 'The strategy references senior-lien refinancing for stabilized residential assets, emphasizing rental coverage and defined collateral ranking.', cashFlow: 'Illustrative interest income is based on scheduled borrower payments after property-level reserves and servicing expenses.',
    risks: ['Property values and refinancing conditions can change.', 'Occupancy deterioration can affect debt coverage.', 'Quarterly liquidity does not guarantee immediate redemption.'],
    milestones: [{ label: 'Valuation review completed', date: '28 Jun', state: 'complete' }, { label: 'Occupancy report due', date: '20 Jul', state: 'next' }, { label: 'Quarterly exit window', date: '30 Sep', state: 'planned' }],
    documents: [{ label: 'Loan summary', detail: 'Collateral rank, covenants and maturity' }, { label: 'Property operating note', detail: 'Occupancy and rent coverage · Demo' }, { label: 'Risk disclosure', detail: 'Property, credit and liquidity risks' }],
  },
  'ai-leaders-basket': {
    issuer: 'Atlas Global Markets Reference', location: 'United States market reference', structure: 'Tokenized reference basket', targetSize: 'Open reference allocation', settlement: 'T+1 during supported market hours', updated: 'Updated 11 Jul 2026 · Demo data',
    thesis: 'A concentrated reference basket tracks global AI infrastructure leaders, led by semiconductor, networking and data-center exposure.', cashFlow: 'No income distribution is assumed. Illustrative performance follows reference prices during supported market hours, subject to the platform’s execution controls.',
    risks: ['Technology stocks can be volatile and highly correlated.', 'Market-hours and reference-price movements affect exits.', 'This Demo does not represent a live securities transaction.'],
    milestones: [{ label: 'AI score recalculated', date: '11 Jul', state: 'complete' }, { label: 'Earnings risk review', date: '22 Jul', state: 'next' }, { label: 'Portfolio rebalance', date: '01 Aug', state: 'planned' }],
    documents: [{ label: 'Basket methodology', detail: 'Constituents, weights and rebalance rules' }, { label: 'AI score note', detail: 'Signal inputs and limitations · Demo' }, { label: 'Risk disclosure', detail: 'Equity, market-hours and reference risks' }],
  },
  'semiconductor-supply-chain': {
    issuer: 'Atlas Global Markets Reference', location: 'Global market reference', structure: 'Tokenized supply-chain reference basket', targetSize: 'Open reference allocation', settlement: 'T+1 during supported market hours', updated: 'Updated 10 Jul 2026 · Demo data',
    thesis: 'The basket diversifies across compute hardware, networking and equipment suppliers while retaining cyclical exposure to semiconductor demand.', cashFlow: 'No contractual income is assumed. The Demo tracks illustrative reference-price performance, not a live execution venue.',
    risks: ['The semiconductor cycle can reverse rapidly.', 'Export restrictions can alter issuer outlooks.', 'High-risk category reflects concentration and volatility.'],
    milestones: [{ label: 'Supply-chain score updated', date: '10 Jul', state: 'complete' }, { label: 'Policy risk review', date: '24 Jul', state: 'next' }, { label: 'Weight rebalance', date: '01 Aug', state: 'planned' }],
    documents: [{ label: 'Basket methodology', detail: 'Issuer selection and weight limits' }, { label: 'Cycle monitor', detail: 'Illustrative demand and inventory signals' }, { label: 'Risk disclosure', detail: 'Cyclical, policy and market risks' }],
  },
  'global-dividend-quality': {
    issuer: 'Atlas Global Markets Reference', location: 'Global market reference', structure: 'Quality-dividend reference basket', targetSize: 'Open reference allocation', settlement: 'T+1 during supported market hours', updated: 'Updated 10 Jul 2026 · Demo data',
    thesis: 'The basket prioritizes cash-generative global issuers with balance-sheet and dividend-quality screens, balancing income orientation with public-market liquidity.', cashFlow: 'Illustrative performance combines reference-price movement and any underlying dividend treatment according to the published methodology.',
    risks: ['Dividend policies may change without notice.', 'Foreign exchange affects global reference prices.', 'Quality screens do not eliminate equity-market losses.'],
    milestones: [{ label: 'Quality screen refreshed', date: '10 Jul', state: 'complete' }, { label: 'Dividend calendar review', date: '19 Jul', state: 'next' }, { label: 'Monthly weight check', date: '01 Aug', state: 'planned' }],
    documents: [{ label: 'Basket methodology', detail: 'Quality screen and dividend treatment' }, { label: 'Income calendar', detail: 'Illustrative ex-date overview' }, { label: 'Risk disclosure', detail: 'Equity, FX and dividend risks' }],
  },
}
