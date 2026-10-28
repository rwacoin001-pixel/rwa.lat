import type { AppLocale } from '@/lib/app-locales'

/** Batch-1 copy: markets, asset detail, order review, order status. `{x}` tokens are replaced by fill(). */
export type MarketCopy = {
  common: { back: string; close: string; clear: string; retry: string; unavailable: string; updated: string; source: string; signIn: string; errorGeneric: string; empty: string }
  markets: {
    kicker: string; title: string; lede: string; tabs: [string, string, string, string, string]; search: string
    investable: string; investableNote: string; directory: string; directoryNote: string
    classes: { all: string; rwa: string; compute: string; stocks: string; prediction: string }
    from: string; sort: { market_cap: string; change_24h: string; name: string }; noMatch: string; issuers: string; compare: string
    basketsEmpty: string; basketsEmptyBody: string; pairsEmpty: string; last: string; active: string; paused: string
    predictionOpen: string; discovery: string; discoveryNote: string; volume24h: string; closes: string; loadError: string
  }
  detail: {
    investable: string; research: string; unitPrice: string; stale: string; live: string; validUntil: string
    min: string; max: string; settlement: string; network: string; assetClass: string; version: string
    tabs: [string, string, string]; noDisclosures: string; invest: string; researchNote: string
    marketCap: string; change24h: string; change7d: string; change30d: string; volume: string; score: string; risk: string
    history: string; noHistory: string; issuer: string; region: string; website: string; sources: string; synced: string
    notFound: string; notFoundBody: string; quoteUnavailable: string; about: string; orderRules: string; orderRulesBody: string
  }
  review: {
    title: string; kicker: string; amount: string; amountNote: string; available: string; outcome: string; yes: string; no: string
    unitPrice: string; estQty: string; locked: string; after: string; refreshIn: string; expired: string; refresh: string
    risk: string; confirm: string; submitting: string; fees: string; eligibility: string
    errors: { min: string; max: string; balance: string; format: string; noProduct: string; risk: string; outcome: string }
    server: Record<string, string>
  }
  status: {
    title: string; detailTitle: string; states: Record<string, string>; headline: Record<string, string>; body: Record<string, string>
    requested: string; filled: string; quantity: string; unitPrice: string; submitted: string; completed: string; orderId: string
    timeline: string; live: string; viewAssets: string; viewDetail: string; backMarkets: string; none: string; noneBody: string
    released: string; reason: string; export: string; actors: Record<string, string>; records: string; product: string
  }
}

const en: MarketCopy = {
  common: { back: 'Back', close: 'Close', clear: 'Clear', retry: 'Retry', unavailable: 'Unavailable', updated: 'Updated {t}', source: 'Source', signIn: 'Sign in to invest', errorGeneric: 'Something went wrong. Please retry.', empty: 'Nothing here yet' },
  markets: {
    kicker: 'Markets · Live', title: 'Markets', lede: '{n} investable · {m} tracked', tabs: ['Assets', 'Baskets', 'Trade', 'Predictions', 'Quant'], search: 'Search name, symbol or issuer',
    investable: 'Investable', investableNote: 'Quoted by A-REIT and open for subscription.', directory: 'Market directory', directoryNote: 'Third-party market data · research only',
    classes: { all: 'All', rwa: 'Real assets', compute: 'Compute', stocks: 'Equities', prediction: 'Predictions' },
    from: 'From {v}', sort: { market_cap: 'Market cap', change_24h: '24h', name: 'Name' }, noMatch: 'No results for “{q}”', issuers: 'Issuers', compare: 'Compare',
    basketsEmpty: 'No baskets are open', basketsEmptyBody: 'Managed baskets appear here when a strategy is published.', pairsEmpty: 'No trading pairs are listed.', last: 'Last', active: 'Active', paused: 'Paused',
    predictionOpen: 'Open to orders', discovery: 'Public discovery', discoveryNote: 'Polymarket data, read only. Trading is not enabled.', volume24h: '24h vol.', closes: 'Closes {d}', loadError: 'Market data could not be loaded.',
  },
  detail: {
    investable: 'Investable', research: 'Research only', unitPrice: 'Indicative unit price', stale: 'Stale', live: 'Live quote', validUntil: 'Valid until {t}',
    min: 'Minimum', max: 'Maximum', settlement: 'Settlement', network: 'Network', assetClass: 'Asset class', version: 'Terms version',
    tabs: ['Overview', 'Valuation', 'Disclosures'], noDisclosures: 'No disclosure documents have been published for this product.', invest: 'Invest', researchNote: 'Tracked from public market data. Not available for subscription on A-REIT.',
    marketCap: 'Market cap', change24h: '24h', change7d: '7d', change30d: '30d', volume: '24h volume', score: 'Score', risk: 'Risk',
    history: 'Market cap · 90 days', noHistory: 'The source has not published a history for this asset.', issuer: 'Issuer', region: 'Region', website: 'Website', sources: 'Data sources', synced: 'Synced {t}',
    notFound: 'Asset not found', notFoundBody: 'This link may be out of date.', quoteUnavailable: 'Quote unavailable', about: 'About', orderRules: 'Order rules', orderRulesBody: 'Orders lock the amount from your available balance and settle at the quoted unit price. Eligibility is checked by the server when you confirm.',
  },
  review: {
    title: 'Review order', kicker: 'Order · Review', amount: 'Amount', amountNote: 'USD and USDT convert at 1:1; settled in USDT to 6 decimals.', available: 'Available {v}', outcome: 'Outcome', yes: 'Yes', no: 'No',
    unitPrice: 'Unit price', estQty: 'Estimated quantity', locked: 'Locked from balance', after: 'Balance after', refreshIn: 'Quote valid · {s}', expired: 'Quote expired', refresh: 'Refresh quote',
    risk: 'I understand the risks of this product and that confirming locks this amount from my available balance.', confirm: 'Confirm order', submitting: 'Submitting…', fees: 'Fees & limits', eligibility: 'Eligibility is checked by the server when you confirm.',
    errors: { min: 'Minimum is {v}', max: 'Maximum is {v}', balance: 'Exceeds your available balance', format: 'Enter an amount with up to 6 decimals', noProduct: 'Choose a product in Markets first.', risk: 'Please confirm the risk statement.', outcome: 'Choose an outcome.' },
    server: { ORDER_BELOW_MINIMUM: 'The amount is below the product minimum.', ORDER_ABOVE_MAXIMUM: 'The amount is above the product maximum.', ORDER_NOT_ELIGIBLE: 'Your account is not eligible for this product yet.', OPERATIONAL_SWITCH_DISABLED: 'New orders are paused by the operator.', QUOTE_STALE: 'The quote is stale. Refresh and try again.', WALLET_INSUFFICIENT_BALANCE: 'Insufficient available balance.', NETWORK_ERROR: 'Network unavailable. The order was not confirmed; retrying reuses the same request.', ORDER_QUANTITY_ZERO: 'The amount is too small for the current price.' },
  },
  status: {
    title: 'Order status', detailTitle: 'Order', states: { submitted: 'Submitted', accepted: 'Accepted', processing: 'Processing', filled: 'Filled', partially_filled: 'Partially filled', failed: 'Failed', cancelled: 'Cancelled' },
    headline: { submitted: 'Order received', accepted: 'Order accepted', processing: 'Executing', filled: 'Order filled', partially_filled: 'Partially filled', failed: 'Order failed', cancelled: 'Order cancelled' },
    body: { submitted: 'Funds are locked while the order waits for execution.', accepted: 'Funds are locked while the order waits for execution.', processing: 'The order is being executed at the locked price.', filled: 'The position is now in your assets.', partially_filled: 'Part of the order was filled. The remainder was released to your balance.', failed: 'Nothing was executed. Locked funds were released to your balance.', cancelled: 'The order was cancelled. Locked funds were released.' },
    requested: 'Requested', filled: 'Filled', quantity: 'Quantity', unitPrice: 'Unit price', submitted: 'Submitted', completed: 'Completed', orderId: 'Order ID',
    timeline: 'Timeline', live: 'Live · refreshes every {s}s', viewAssets: 'View my assets', viewDetail: 'Order details', backMarkets: 'Back to markets', none: 'No order selected', noneBody: 'Open an order from your records to see its status.',
    released: 'Released', reason: 'Reason', export: 'Export CSV', actors: { user: 'You', system: 'System', admin: 'Operations', operator: 'Operations' }, records: 'All orders', product: 'Product',
  },
}

const zh: MarketCopy = {
  common: { back: '返回', close: '关闭', clear: '清除', retry: '重试', unavailable: '暂不可用', updated: '更新于 {t}', source: '来源', signIn: '登录后投资', errorGeneric: '出现问题，请重试。', empty: '暂无内容' },
  markets: {
    kicker: '市场 · 实时', title: '市场', lede: '{n} 个可投资 · {m} 个追踪', tabs: ['资产', '篮子', '交易', '预测', '量化'], search: '搜索名称、代码或发行方',
    investable: '可投资', investableNote: '由 A-REIT 报价，开放申购。', directory: '市场名录', directoryNote: '第三方市场数据 · 仅供研究',
    classes: { all: '全部', rwa: '实物资产', compute: '算力', stocks: '股票', prediction: '预测' },
    from: '{v} 起投', sort: { market_cap: '市值', change_24h: '24 小时', name: '名称' }, noMatch: '没有与“{q}”匹配的结果', issuers: '发行方', compare: '比较',
    basketsEmpty: '暂无开放的篮子', basketsEmptyBody: '策略发布后，托管篮子会显示在这里。', pairsEmpty: '暂无上线的交易对。', last: '最新', active: '交易中', paused: '已暂停',
    predictionOpen: '可下单', discovery: '公开市场', discoveryNote: 'Polymarket 只读数据，未开放交易。', volume24h: '24h 成交', closes: '{d} 截止', loadError: '市场数据加载失败。',
  },
  detail: {
    investable: '可投资', research: '仅供研究', unitPrice: '参考单价', stale: '报价过期', live: '实时报价', validUntil: '有效至 {t}',
    min: '最低', max: '最高', settlement: '结算资产', network: '网络', assetClass: '资产类别', version: '条款版本',
    tabs: ['概览', '估值', '披露'], noDisclosures: '该产品尚未发布披露文件。', invest: '投资', researchNote: '数据来自公开市场，A-REIT 暂不提供申购。',
    marketCap: '市值', change24h: '24 小时', change7d: '7 天', change30d: '30 天', volume: '24h 成交量', score: '评分', risk: '风险',
    history: '市值 · 90 天', noHistory: '数据源尚未发布该资产的历史数据。', issuer: '发行方', region: '地区', website: '官网', sources: '数据来源', synced: '同步于 {t}',
    notFound: '未找到该资产', notFoundBody: '链接可能已失效。', quoteUnavailable: '报价暂不可用', about: '简介', orderRules: '下单规则', orderRulesBody: '下单时从可用余额锁定金额，并按报价单价成交。确认时由服务端校验投资资格。',
  },
  review: {
    title: '确认订单', kicker: '订单 · 确认', amount: '金额', amountNote: 'USD 与 USDT 按 1:1 换算；以 USDT 六位小数结算。', available: '可用 {v}', outcome: '选择结果', yes: '是', no: '否',
    unitPrice: '单价', estQty: '预计数量', locked: '从余额锁定', after: '下单后余额', refreshIn: '报价有效 · {s}', expired: '报价已过期', refresh: '刷新报价',
    risk: '我已了解该产品的风险，并知悉确认后将从可用余额中锁定此金额。', confirm: '确认下单', submitting: '提交中…', fees: '费用与限额', eligibility: '确认时由服务端校验投资资格。',
    errors: { min: '最低 {v}', max: '最高 {v}', balance: '超过可用余额', format: '请输入最多 6 位小数的金额', noProduct: '请先在市场中选择产品。', risk: '请确认风险声明。', outcome: '请选择结果。' },
    server: { ORDER_BELOW_MINIMUM: '金额低于产品最低限额。', ORDER_ABOVE_MAXIMUM: '金额高于产品最高限额。', ORDER_NOT_ELIGIBLE: '你的账户暂不符合该产品的投资资格。', OPERATIONAL_SWITCH_DISABLED: '运营方已暂停新订单。', QUOTE_STALE: '报价已过期，请刷新后重试。', WALLET_INSUFFICIENT_BALANCE: '可用余额不足。', NETWORK_ERROR: '网络不可用，订单未确认；重试会复用同一请求。', ORDER_QUANTITY_ZERO: '金额过小，按当前价格无法成交。' },
  },
  status: {
    title: '订单状态', detailTitle: '订单', states: { submitted: '已提交', accepted: '已受理', processing: '执行中', filled: '已成交', partially_filled: '部分成交', failed: '失败', cancelled: '已取消' },
    headline: { submitted: '订单已提交', accepted: '订单已受理', processing: '正在执行', filled: '订单已成交', partially_filled: '部分成交', failed: '订单失败', cancelled: '订单已取消' },
    body: { submitted: '资金已锁定，等待执行。', accepted: '资金已锁定，等待执行。', processing: '订单正按锁定价格执行。', filled: '持仓已计入我的资产。', partially_filled: '订单部分成交，剩余金额已退回余额。', failed: '订单未执行，锁定资金已退回余额。', cancelled: '订单已取消，锁定资金已退回。' },
    requested: '申请金额', filled: '成交金额', quantity: '数量', unitPrice: '单价', submitted: '提交时间', completed: '完成时间', orderId: '订单号',
    timeline: '时间线', live: '实时 · 每 {s} 秒刷新', viewAssets: '查看我的资产', viewDetail: '订单详情', backMarkets: '返回市场', none: '未选择订单', noneBody: '从订单记录中打开订单即可查看状态。',
    released: '已退回', reason: '原因', export: '导出 CSV', actors: { user: '你', system: '系统', admin: '运营', operator: '运营' }, records: '全部订单', product: '产品',
  },
}

const hi: MarketCopy = {
  common: { back: 'वापस', close: 'बंद करें', clear: 'साफ़ करें', retry: 'फिर कोशिश करें', unavailable: 'उपलब्ध नहीं', updated: '{t} अपडेट', source: 'स्रोत', signIn: 'निवेश के लिए लॉग इन करें', errorGeneric: 'कुछ गलत हुआ। फिर कोशिश करें।', empty: 'अभी कुछ नहीं' },
  markets: {
    kicker: 'बाज़ार · लाइव', title: 'बाज़ार', lede: '{n} निवेश योग्य · {m} ट्रैक', tabs: ['संपत्ति', 'बास्केट', 'ट्रेड', 'पूर्वानुमान', 'क्वांट'], search: 'नाम, प्रतीक या जारीकर्ता खोजें',
    investable: 'निवेश योग्य', investableNote: 'A-REIT द्वारा कोट किया गया, सदस्यता के लिए खुला।', directory: 'बाज़ार निर्देशिका', directoryNote: 'तृतीय-पक्ष बाज़ार डेटा · केवल शोध',
    classes: { all: 'सभी', rwa: 'वास्तविक संपत्ति', compute: 'कंप्यूट', stocks: 'इक्विटी', prediction: 'पूर्वानुमान' },
    from: '{v} से', sort: { market_cap: 'मार्केट कैप', change_24h: '24 घं', name: 'नाम' }, noMatch: '“{q}” के लिए कोई परिणाम नहीं', issuers: 'जारीकर्ता', compare: 'तुलना',
    basketsEmpty: 'कोई बास्केट खुली नहीं', basketsEmptyBody: 'रणनीति प्रकाशित होने पर प्रबंधित बास्केट यहाँ दिखेंगी।', pairsEmpty: 'कोई ट्रेडिंग जोड़ी सूचीबद्ध नहीं।', last: 'अंतिम', active: 'सक्रिय', paused: 'रुका हुआ',
    predictionOpen: 'ऑर्डर के लिए खुला', discovery: 'सार्वजनिक खोज', discoveryNote: 'Polymarket डेटा, केवल पढ़ने के लिए। ट्रेडिंग सक्षम नहीं।', volume24h: '24घं वॉल्यूम', closes: '{d} को बंद', loadError: 'बाज़ार डेटा लोड नहीं हो सका।',
  },
  detail: {
    investable: 'निवेश योग्य', research: 'केवल शोध', unitPrice: 'संकेतक इकाई मूल्य', stale: 'पुराना', live: 'लाइव कोट', validUntil: '{t} तक मान्य',
    min: 'न्यूनतम', max: 'अधिकतम', settlement: 'निपटान', network: 'नेटवर्क', assetClass: 'संपत्ति वर्ग', version: 'शर्तों का संस्करण',
    tabs: ['अवलोकन', 'मूल्यांकन', 'प्रकटीकरण'], noDisclosures: 'इस उत्पाद के लिए कोई प्रकटीकरण दस्तावेज़ प्रकाशित नहीं हुआ है।', invest: 'निवेश करें', researchNote: 'सार्वजनिक बाज़ार डेटा से ट्रैक। A-REIT पर सदस्यता उपलब्ध नहीं।',
    marketCap: 'मार्केट कैप', change24h: '24 घं', change7d: '7 दिन', change30d: '30 दिन', volume: '24घं वॉल्यूम', score: 'स्कोर', risk: 'जोखिम',
    history: 'मार्केट कैप · 90 दिन', noHistory: 'स्रोत ने इस संपत्ति का इतिहास प्रकाशित नहीं किया है।', issuer: 'जारीकर्ता', region: 'क्षेत्र', website: 'वेबसाइट', sources: 'डेटा स्रोत', synced: '{t} सिंक',
    notFound: 'संपत्ति नहीं मिली', notFoundBody: 'यह लिंक पुराना हो सकता है।', quoteUnavailable: 'कोट उपलब्ध नहीं', about: 'परिचय', orderRules: 'ऑर्डर नियम', orderRulesBody: 'ऑर्डर आपकी उपलब्ध शेष राशि से रकम लॉक करता है और कोट किए गए इकाई मूल्य पर निपटता है। पुष्टि पर सर्वर पात्रता जाँचता है।',
  },
  review: {
    title: 'ऑर्डर की समीक्षा', kicker: 'ऑर्डर · समीक्षा', amount: 'राशि', amountNote: 'USD और USDT का रूपांतरण 1:1 है; निपटान USDT में 6 दशमलव तक होता है।', available: 'उपलब्ध {v}', outcome: 'परिणाम', yes: 'हाँ', no: 'नहीं',
    unitPrice: 'इकाई मूल्य', estQty: 'अनुमानित मात्रा', locked: 'शेष से लॉक', after: 'बाद की शेष राशि', refreshIn: 'कोट मान्य · {s}', expired: 'कोट समाप्त', refresh: 'कोट ताज़ा करें',
    risk: 'मैं इस उत्पाद के जोखिम समझता/समझती हूँ और जानता/जानती हूँ कि पुष्टि करने पर यह राशि मेरी उपलब्ध शेष से लॉक होगी।', confirm: 'ऑर्डर की पुष्टि करें', submitting: 'भेजा जा रहा है…', fees: 'शुल्क और सीमाएँ', eligibility: 'पुष्टि करने पर सर्वर पात्रता जाँचता है।',
    errors: { min: 'न्यूनतम {v}', max: 'अधिकतम {v}', balance: 'उपलब्ध शेष से अधिक', format: 'अधिकतम 6 दशमलव वाली राशि दर्ज करें', noProduct: 'पहले बाज़ार में उत्पाद चुनें।', risk: 'कृपया जोखिम कथन की पुष्टि करें।', outcome: 'परिणाम चुनें।' },
    server: { ORDER_BELOW_MINIMUM: 'राशि न्यूनतम से कम है।', ORDER_ABOVE_MAXIMUM: 'राशि अधिकतम से अधिक है।', ORDER_NOT_ELIGIBLE: 'आपका खाता अभी इस उत्पाद के लिए पात्र नहीं है।', OPERATIONAL_SWITCH_DISABLED: 'ऑपरेटर ने नए ऑर्डर रोक दिए हैं।', QUOTE_STALE: 'कोट पुराना है। ताज़ा करके फिर कोशिश करें।', WALLET_INSUFFICIENT_BALANCE: 'उपलब्ध शेष अपर्याप्त है।', NETWORK_ERROR: 'नेटवर्क उपलब्ध नहीं। ऑर्डर की पुष्टि नहीं हुई; दोबारा कोशिश उसी अनुरोध का उपयोग करेगी।', ORDER_QUANTITY_ZERO: 'मौजूदा मूल्य पर राशि बहुत कम है।' },
  },
  status: {
    title: 'ऑर्डर स्थिति', detailTitle: 'ऑर्डर', states: { submitted: 'जमा', accepted: 'स्वीकृत', processing: 'प्रक्रिया में', filled: 'पूर्ण', partially_filled: 'आंशिक पूर्ण', failed: 'विफल', cancelled: 'रद्द' },
    headline: { submitted: 'ऑर्डर प्राप्त', accepted: 'ऑर्डर स्वीकृत', processing: 'निष्पादन जारी', filled: 'ऑर्डर पूर्ण', partially_filled: 'आंशिक पूर्ण', failed: 'ऑर्डर विफल', cancelled: 'ऑर्डर रद्द' },
    body: { submitted: 'निष्पादन की प्रतीक्षा में राशि लॉक है।', accepted: 'निष्पादन की प्रतीक्षा में राशि लॉक है।', processing: 'ऑर्डर लॉक मूल्य पर निष्पादित हो रहा है।', filled: 'स्थिति अब आपकी संपत्ति में है।', partially_filled: 'ऑर्डर का कुछ भाग पूर्ण हुआ। शेष राशि आपकी शेष में लौटा दी गई।', failed: 'कुछ निष्पादित नहीं हुआ। लॉक राशि लौटा दी गई।', cancelled: 'ऑर्डर रद्द हुआ। लॉक राशि लौटा दी गई।' },
    requested: 'अनुरोधित', filled: 'पूर्ण', quantity: 'मात्रा', unitPrice: 'इकाई मूल्य', submitted: 'जमा समय', completed: 'पूर्ण समय', orderId: 'ऑर्डर आईडी',
    timeline: 'समयरेखा', live: 'लाइव · हर {s}से ताज़ा', viewAssets: 'मेरी संपत्ति देखें', viewDetail: 'ऑर्डर विवरण', backMarkets: 'बाज़ार पर लौटें', none: 'कोई ऑर्डर चयनित नहीं', noneBody: 'स्थिति देखने के लिए अपने रिकॉर्ड से ऑर्डर खोलें।',
    released: 'लौटाया गया', reason: 'कारण', export: 'CSV निर्यात', actors: { user: 'आप', system: 'सिस्टम', admin: 'संचालन', operator: 'संचालन' }, records: 'सभी ऑर्डर', product: 'उत्पाद',
  },
}

const es: MarketCopy = {
  common: { back: 'Atrás', close: 'Cerrar', clear: 'Borrar', retry: 'Reintentar', unavailable: 'No disponible', updated: 'Actualizado {t}', source: 'Fuente', signIn: 'Entra para invertir', errorGeneric: 'Algo salió mal. Reintenta.', empty: 'Aún no hay nada' },
  markets: {
    kicker: 'Mercados · En vivo', title: 'Mercados', lede: '{n} invertibles · {m} seguidos', tabs: ['Activos', 'Cestas', 'Trading', 'Predicciones', 'Quant'], search: 'Buscar nombre, símbolo o emisor',
    investable: 'Invertibles', investableNote: 'Cotizados por A-REIT y abiertos a suscripción.', directory: 'Directorio de mercado', directoryNote: 'Datos de terceros · solo investigación',
    classes: { all: 'Todo', rwa: 'Activos reales', compute: 'Cómputo', stocks: 'Acciones', prediction: 'Predicciones' },
    from: 'Desde {v}', sort: { market_cap: 'Capitalización', change_24h: '24 h', name: 'Nombre' }, noMatch: 'Sin resultados para «{q}»', issuers: 'Emisores', compare: 'Comparar',
    basketsEmpty: 'No hay cestas abiertas', basketsEmptyBody: 'Las cestas gestionadas aparecerán cuando se publique una estrategia.', pairsEmpty: 'No hay pares listados.', last: 'Último', active: 'Activo', paused: 'Pausado',
    predictionOpen: 'Abiertos a órdenes', discovery: 'Descubrimiento público', discoveryNote: 'Datos de Polymarket, solo lectura. El trading no está habilitado.', volume24h: 'Vol. 24 h', closes: 'Cierra {d}', loadError: 'No se pudieron cargar los datos de mercado.',
  },
  detail: {
    investable: 'Invertible', research: 'Solo investigación', unitPrice: 'Precio unitario indicativo', stale: 'Desactualizada', live: 'Cotización en vivo', validUntil: 'Válida hasta {t}',
    min: 'Mínimo', max: 'Máximo', settlement: 'Liquidación', network: 'Red', assetClass: 'Clase de activo', version: 'Versión de términos',
    tabs: ['Resumen', 'Valoración', 'Divulgaciones'], noDisclosures: 'No se han publicado documentos de divulgación para este producto.', invest: 'Invertir', researchNote: 'Seguido con datos públicos de mercado. No disponible para suscripción en A-REIT.',
    marketCap: 'Capitalización', change24h: '24 h', change7d: '7 d', change30d: '30 d', volume: 'Volumen 24 h', score: 'Puntuación', risk: 'Riesgo',
    history: 'Capitalización · 90 días', noHistory: 'La fuente no ha publicado historial para este activo.', issuer: 'Emisor', region: 'Región', website: 'Sitio web', sources: 'Fuentes de datos', synced: 'Sincronizado {t}',
    notFound: 'Activo no encontrado', notFoundBody: 'Este enlace puede estar desactualizado.', quoteUnavailable: 'Cotización no disponible', about: 'Acerca de', orderRules: 'Reglas de orden', orderRulesBody: 'La orden bloquea el importe de tu saldo disponible y se liquida al precio cotizado. El servidor comprueba la elegibilidad al confirmar.',
  },
  review: {
    title: 'Revisar orden', kicker: 'Orden · Revisión', amount: 'Importe', amountNote: 'USD y USDT se convierten 1:1; liquidación en USDT con 6 decimales.', available: 'Disponible {v}', outcome: 'Resultado', yes: 'Sí', no: 'No',
    unitPrice: 'Precio unitario', estQty: 'Cantidad estimada', locked: 'Bloqueado del saldo', after: 'Saldo después', refreshIn: 'Cotización válida · {s}', expired: 'Cotización vencida', refresh: 'Actualizar cotización',
    risk: 'Entiendo los riesgos de este producto y que al confirmar se bloquea este importe de mi saldo disponible.', confirm: 'Confirmar orden', submitting: 'Enviando…', fees: 'Comisiones y límites', eligibility: 'El servidor comprueba la elegibilidad al confirmar.',
    errors: { min: 'El mínimo es {v}', max: 'El máximo es {v}', balance: 'Supera tu saldo disponible', format: 'Introduce un importe con hasta 6 decimales', noProduct: 'Elige primero un producto en Mercados.', risk: 'Confirma la declaración de riesgo.', outcome: 'Elige un resultado.' },
    server: { ORDER_BELOW_MINIMUM: 'El importe está por debajo del mínimo.', ORDER_ABOVE_MAXIMUM: 'El importe supera el máximo.', ORDER_NOT_ELIGIBLE: 'Tu cuenta aún no es elegible para este producto.', OPERATIONAL_SWITCH_DISABLED: 'El operador ha pausado las nuevas órdenes.', QUOTE_STALE: 'La cotización está desactualizada. Actualiza y reintenta.', WALLET_INSUFFICIENT_BALANCE: 'Saldo disponible insuficiente.', NETWORK_ERROR: 'Sin red. La orden no se confirmó; al reintentar se reutiliza la misma solicitud.', ORDER_QUANTITY_ZERO: 'El importe es demasiado pequeño para el precio actual.' },
  },
  status: {
    title: 'Estado de la orden', detailTitle: 'Orden', states: { submitted: 'Enviada', accepted: 'Aceptada', processing: 'En proceso', filled: 'Ejecutada', partially_filled: 'Ejecución parcial', failed: 'Fallida', cancelled: 'Cancelada' },
    headline: { submitted: 'Orden recibida', accepted: 'Orden aceptada', processing: 'Ejecutando', filled: 'Orden ejecutada', partially_filled: 'Ejecución parcial', failed: 'La orden falló', cancelled: 'Orden cancelada' },
    body: { submitted: 'Los fondos quedan bloqueados mientras la orden espera ejecución.', accepted: 'Los fondos quedan bloqueados mientras la orden espera ejecución.', processing: 'La orden se ejecuta al precio bloqueado.', filled: 'La posición ya está en tus activos.', partially_filled: 'Parte de la orden se ejecutó. El resto volvió a tu saldo.', failed: 'No se ejecutó nada. Los fondos bloqueados volvieron a tu saldo.', cancelled: 'La orden se canceló. Los fondos bloqueados se liberaron.' },
    requested: 'Solicitado', filled: 'Ejecutado', quantity: 'Cantidad', unitPrice: 'Precio unitario', submitted: 'Enviada', completed: 'Completada', orderId: 'ID de orden',
    timeline: 'Cronología', live: 'En vivo · cada {s} s', viewAssets: 'Ver mis activos', viewDetail: 'Detalle de la orden', backMarkets: 'Volver a mercados', none: 'Ninguna orden seleccionada', noneBody: 'Abre una orden desde tu historial para ver su estado.',
    released: 'Liberado', reason: 'Motivo', export: 'Exportar CSV', actors: { user: 'Tú', system: 'Sistema', admin: 'Operaciones', operator: 'Operaciones' }, records: 'Todas las órdenes', product: 'Producto',
  },
}

const ar: MarketCopy = {
  common: { back: 'رجوع', close: 'إغلاق', clear: 'مسح', retry: 'إعادة المحاولة', unavailable: 'غير متاح', updated: 'حُدّث {t}', source: 'المصدر', signIn: 'سجّل الدخول للاستثمار', errorGeneric: 'حدث خطأ. أعد المحاولة.', empty: 'لا يوجد شيء بعد' },
  markets: {
    kicker: 'الأسواق · مباشر', title: 'الأسواق', lede: '{n} قابلة للاستثمار · {m} متابَعة', tabs: ['الأصول', 'السلال', 'التداول', 'التوقعات', 'كمّي'], search: 'ابحث بالاسم أو الرمز أو المُصدِر',
    investable: 'قابلة للاستثمار', investableNote: 'مسعّرة من A-REIT ومتاحة للاكتتاب.', directory: 'دليل السوق', directoryNote: 'بيانات سوق من طرف ثالث · للبحث فقط',
    classes: { all: 'الكل', rwa: 'أصول حقيقية', compute: 'الحوسبة', stocks: 'الأسهم', prediction: 'التوقعات' },
    from: 'ابتداءً من {v}', sort: { market_cap: 'القيمة السوقية', change_24h: '24 س', name: 'الاسم' }, noMatch: 'لا نتائج لـ «{q}»', issuers: 'المُصدِرون', compare: 'مقارنة',
    basketsEmpty: 'لا توجد سلال مفتوحة', basketsEmptyBody: 'تظهر السلال المُدارة هنا عند نشر استراتيجية.', pairsEmpty: 'لا توجد أزواج تداول مدرجة.', last: 'الأخير', active: 'نشط', paused: 'متوقف',
    predictionOpen: 'مفتوحة للأوامر', discovery: 'استكشاف عام', discoveryNote: 'بيانات Polymarket للقراءة فقط. التداول غير مفعّل.', volume24h: 'حجم 24 س', closes: 'يغلق {d}', loadError: 'تعذّر تحميل بيانات السوق.',
  },
  detail: {
    investable: 'قابل للاستثمار', research: 'للبحث فقط', unitPrice: 'سعر الوحدة الاسترشادي', stale: 'قديم', live: 'تسعير مباشر', validUntil: 'صالح حتى {t}',
    min: 'الحد الأدنى', max: 'الحد الأقصى', settlement: 'التسوية', network: 'الشبكة', assetClass: 'فئة الأصل', version: 'إصدار الشروط',
    tabs: ['نظرة عامة', 'التقييم', 'الإفصاحات'], noDisclosures: 'لم تُنشر وثائق إفصاح لهذا المنتج.', invest: 'استثمر', researchNote: 'متابَع من بيانات السوق العامة. غير متاح للاكتتاب على A-REIT.',
    marketCap: 'القيمة السوقية', change24h: '24 س', change7d: '7 أيام', change30d: '30 يومًا', volume: 'حجم 24 س', score: 'التقييم', risk: 'المخاطر',
    history: 'القيمة السوقية · 90 يومًا', noHistory: 'لم ينشر المصدر سجلًا لهذا الأصل.', issuer: 'المُصدِر', region: 'المنطقة', website: 'الموقع', sources: 'مصادر البيانات', synced: 'مُزامَن {t}',
    notFound: 'الأصل غير موجود', notFoundBody: 'قد يكون هذا الرابط قديمًا.', quoteUnavailable: 'التسعير غير متاح', about: 'نبذة', orderRules: 'قواعد الأوامر', orderRulesBody: 'يحجز الأمر المبلغ من رصيدك المتاح ويُسوّى بسعر الوحدة المسعّر. يتحقق الخادم من الأهلية عند التأكيد.',
  },
  review: {
    title: 'مراجعة الأمر', kicker: 'الأمر · مراجعة', amount: 'المبلغ', amountNote: 'يُحوَّل USD وUSDT بنسبة 1:1؛ وتتم التسوية بـUSDT حتى 6 منازل عشرية.', available: 'المتاح {v}', outcome: 'النتيجة', yes: 'نعم', no: 'لا',
    unitPrice: 'سعر الوحدة', estQty: 'الكمية التقديرية', locked: 'محجوز من الرصيد', after: 'الرصيد بعد الأمر', refreshIn: 'التسعير صالح · {s}', expired: 'انتهى التسعير', refresh: 'تحديث التسعير',
    risk: 'أفهم مخاطر هذا المنتج وأن التأكيد يحجز هذا المبلغ من رصيدي المتاح.', confirm: 'تأكيد الأمر', submitting: 'جارٍ الإرسال…', fees: 'الرسوم والحدود', eligibility: 'يتحقق الخادم من الأهلية عند التأكيد.',
    errors: { min: 'الحد الأدنى {v}', max: 'الحد الأقصى {v}', balance: 'يتجاوز رصيدك المتاح', format: 'أدخل مبلغًا بما يصل إلى 6 منازل عشرية', noProduct: 'اختر منتجًا من الأسواق أولًا.', risk: 'يرجى تأكيد بيان المخاطر.', outcome: 'اختر نتيجة.' },
    server: { ORDER_BELOW_MINIMUM: 'المبلغ أقل من الحد الأدنى.', ORDER_ABOVE_MAXIMUM: 'المبلغ أعلى من الحد الأقصى.', ORDER_NOT_ELIGIBLE: 'حسابك غير مؤهل لهذا المنتج بعد.', OPERATIONAL_SWITCH_DISABLED: 'أوقف المشغّل الأوامر الجديدة مؤقتًا.', QUOTE_STALE: 'التسعير قديم. حدّثه وأعد المحاولة.', WALLET_INSUFFICIENT_BALANCE: 'الرصيد المتاح غير كافٍ.', NETWORK_ERROR: 'الشبكة غير متاحة. لم يُؤكَّد الأمر؛ إعادة المحاولة تستخدم الطلب نفسه.', ORDER_QUANTITY_ZERO: 'المبلغ صغير جدًا بالسعر الحالي.' },
  },
  status: {
    title: 'حالة الأمر', detailTitle: 'الأمر', states: { submitted: 'مُرسَل', accepted: 'مقبول', processing: 'قيد التنفيذ', filled: 'منفّذ', partially_filled: 'منفّذ جزئيًا', failed: 'فشل', cancelled: 'ملغى' },
    headline: { submitted: 'تم استلام الأمر', accepted: 'تم قبول الأمر', processing: 'جارٍ التنفيذ', filled: 'تم تنفيذ الأمر', partially_filled: 'تنفيذ جزئي', failed: 'فشل الأمر', cancelled: 'أُلغي الأمر' },
    body: { submitted: 'الأموال محجوزة بانتظار التنفيذ.', accepted: 'الأموال محجوزة بانتظار التنفيذ.', processing: 'يُنفَّذ الأمر بالسعر المحجوز.', filled: 'أصبح المركز ضمن أصولك.', partially_filled: 'نُفّذ جزء من الأمر وأُعيد الباقي إلى رصيدك.', failed: 'لم يُنفَّذ شيء. أُعيدت الأموال المحجوزة إلى رصيدك.', cancelled: 'أُلغي الأمر وأُفرج عن الأموال المحجوزة.' },
    requested: 'المطلوب', filled: 'المنفّذ', quantity: 'الكمية', unitPrice: 'سعر الوحدة', submitted: 'وقت الإرسال', completed: 'وقت الإكمال', orderId: 'رقم الأمر',
    timeline: 'الخط الزمني', live: 'مباشر · يتحدّث كل {s} ث', viewAssets: 'عرض أصولي', viewDetail: 'تفاصيل الأمر', backMarkets: 'العودة إلى الأسواق', none: 'لم يُحدَّد أمر', noneBody: 'افتح أمرًا من سجلّك لعرض حالته.',
    released: 'مُفرَج عنه', reason: 'السبب', export: 'تصدير CSV', actors: { user: 'أنت', system: 'النظام', admin: 'العمليات', operator: 'العمليات' }, records: 'كل الأوامر', product: 'المنتج',
  },
}

const fr: MarketCopy = {
  common: { back: 'Retour', close: 'Fermer', clear: 'Effacer', retry: 'Réessayer', unavailable: 'Indisponible', updated: 'Mis à jour {t}', source: 'Source', signIn: 'Connectez-vous pour investir', errorGeneric: 'Une erreur est survenue. Réessayez.', empty: 'Rien pour le moment' },
  markets: {
    kicker: 'Marchés · En direct', title: 'Marchés', lede: '{n} investissables · {m} suivis', tabs: ['Actifs', 'Paniers', 'Trading', 'Prédictions', 'Quant'], search: 'Rechercher nom, symbole ou émetteur',
    investable: 'Investissables', investableNote: 'Cotés par A-REIT et ouverts à la souscription.', directory: 'Annuaire du marché', directoryNote: 'Données tierces · recherche uniquement',
    classes: { all: 'Tout', rwa: 'Actifs réels', compute: 'Calcul', stocks: 'Actions', prediction: 'Prédictions' },
    from: 'Dès {v}', sort: { market_cap: 'Capitalisation', change_24h: '24 h', name: 'Nom' }, noMatch: 'Aucun résultat pour « {q} »', issuers: 'Émetteurs', compare: 'Comparer',
    basketsEmpty: 'Aucun panier ouvert', basketsEmptyBody: 'Les paniers gérés apparaîtront lorsqu’une stratégie sera publiée.', pairsEmpty: 'Aucune paire listée.', last: 'Dernier', active: 'Actif', paused: 'En pause',
    predictionOpen: 'Ouverts aux ordres', discovery: 'Découverte publique', discoveryNote: 'Données Polymarket en lecture seule. Le trading n’est pas activé.', volume24h: 'Vol. 24 h', closes: 'Clôture {d}', loadError: 'Impossible de charger les données de marché.',
  },
  detail: {
    investable: 'Investissable', research: 'Recherche uniquement', unitPrice: 'Prix unitaire indicatif', stale: 'Périmée', live: 'Cotation en direct', validUntil: 'Valable jusqu’à {t}',
    min: 'Minimum', max: 'Maximum', settlement: 'Règlement', network: 'Réseau', assetClass: 'Classe d’actifs', version: 'Version des conditions',
    tabs: ['Aperçu', 'Valorisation', 'Informations'], noDisclosures: 'Aucun document d’information n’a été publié pour ce produit.', invest: 'Investir', researchNote: 'Suivi à partir de données publiques. Non disponible à la souscription sur A-REIT.',
    marketCap: 'Capitalisation', change24h: '24 h', change7d: '7 j', change30d: '30 j', volume: 'Volume 24 h', score: 'Score', risk: 'Risque',
    history: 'Capitalisation · 90 jours', noHistory: 'La source n’a pas publié d’historique pour cet actif.', issuer: 'Émetteur', region: 'Région', website: 'Site web', sources: 'Sources de données', synced: 'Synchronisé {t}',
    notFound: 'Actif introuvable', notFoundBody: 'Ce lien est peut-être obsolète.', quoteUnavailable: 'Cotation indisponible', about: 'À propos', orderRules: 'Règles d’ordre', orderRulesBody: 'L’ordre bloque le montant sur votre solde disponible et se règle au prix unitaire coté. Le serveur vérifie l’éligibilité à la confirmation.',
  },
  review: {
    title: 'Vérifier l’ordre', kicker: 'Ordre · Vérification', amount: 'Montant', amountNote: 'USD et USDT sont convertis au taux de 1:1 ; règlement en USDT à 6 décimales.', available: 'Disponible {v}', outcome: 'Issue', yes: 'Oui', no: 'Non',
    unitPrice: 'Prix unitaire', estQty: 'Quantité estimée', locked: 'Bloqué sur le solde', after: 'Solde après', refreshIn: 'Cotation valable · {s}', expired: 'Cotation expirée', refresh: 'Actualiser la cotation',
    risk: 'Je comprends les risques de ce produit et que la confirmation bloque ce montant sur mon solde disponible.', confirm: 'Confirmer l’ordre', submitting: 'Envoi…', fees: 'Frais et limites', eligibility: 'Le serveur vérifie l’éligibilité à la confirmation.',
    errors: { min: 'Le minimum est {v}', max: 'Le maximum est {v}', balance: 'Dépasse votre solde disponible', format: 'Saisissez un montant avec 6 décimales au plus', noProduct: 'Choisissez d’abord un produit dans Marchés.', risk: 'Veuillez confirmer la déclaration de risque.', outcome: 'Choisissez une issue.' },
    server: { ORDER_BELOW_MINIMUM: 'Le montant est inférieur au minimum.', ORDER_ABOVE_MAXIMUM: 'Le montant dépasse le maximum.', ORDER_NOT_ELIGIBLE: 'Votre compte n’est pas encore éligible à ce produit.', OPERATIONAL_SWITCH_DISABLED: 'L’opérateur a suspendu les nouveaux ordres.', QUOTE_STALE: 'La cotation est périmée. Actualisez puis réessayez.', WALLET_INSUFFICIENT_BALANCE: 'Solde disponible insuffisant.', NETWORK_ERROR: 'Réseau indisponible. L’ordre n’a pas été confirmé ; réessayer réutilise la même requête.', ORDER_QUANTITY_ZERO: 'Le montant est trop faible pour le prix actuel.' },
  },
  status: {
    title: 'Statut de l’ordre', detailTitle: 'Ordre', states: { submitted: 'Soumis', accepted: 'Accepté', processing: 'En cours', filled: 'Exécuté', partially_filled: 'Exécution partielle', failed: 'Échoué', cancelled: 'Annulé' },
    headline: { submitted: 'Ordre reçu', accepted: 'Ordre accepté', processing: 'Exécution en cours', filled: 'Ordre exécuté', partially_filled: 'Exécution partielle', failed: 'L’ordre a échoué', cancelled: 'Ordre annulé' },
    body: { submitted: 'Les fonds sont bloqués en attendant l’exécution.', accepted: 'Les fonds sont bloqués en attendant l’exécution.', processing: 'L’ordre s’exécute au prix bloqué.', filled: 'La position figure désormais dans vos actifs.', partially_filled: 'Une partie de l’ordre a été exécutée. Le reste a été restitué à votre solde.', failed: 'Rien n’a été exécuté. Les fonds bloqués ont été restitués.', cancelled: 'L’ordre a été annulé. Les fonds bloqués ont été libérés.' },
    requested: 'Demandé', filled: 'Exécuté', quantity: 'Quantité', unitPrice: 'Prix unitaire', submitted: 'Soumis le', completed: 'Terminé le', orderId: 'N° d’ordre',
    timeline: 'Chronologie', live: 'En direct · toutes les {s} s', viewAssets: 'Voir mes actifs', viewDetail: 'Détail de l’ordre', backMarkets: 'Retour aux marchés', none: 'Aucun ordre sélectionné', noneBody: 'Ouvrez un ordre depuis votre historique pour voir son statut.',
    released: 'Libéré', reason: 'Motif', export: 'Exporter en CSV', actors: { user: 'Vous', system: 'Système', admin: 'Opérations', operator: 'Opérations' }, records: 'Tous les ordres', product: 'Produit',
  },
}

const pt: MarketCopy = {
  common: { back: 'Voltar', close: 'Fechar', clear: 'Limpar', retry: 'Tentar novamente', unavailable: 'Indisponível', updated: 'Atualizado {t}', source: 'Fonte', signIn: 'Entre para investir', errorGeneric: 'Algo deu errado. Tente novamente.', empty: 'Nada por aqui ainda' },
  markets: {
    kicker: 'Mercados · Ao vivo', title: 'Mercados', lede: '{n} investíveis · {m} acompanhados', tabs: ['Ativos', 'Cestas', 'Negociação', 'Previsões', 'Quant'], search: 'Buscar nome, símbolo ou emissor',
    investable: 'Investíveis', investableNote: 'Cotados pela A-REIT e abertos para subscrição.', directory: 'Diretório de mercado', directoryNote: 'Dados de terceiros · apenas pesquisa',
    classes: { all: 'Todos', rwa: 'Ativos reais', compute: 'Computação', stocks: 'Ações', prediction: 'Previsões' },
    from: 'A partir de {v}', sort: { market_cap: 'Valor de mercado', change_24h: '24 h', name: 'Nome' }, noMatch: 'Nenhum resultado para “{q}”', issuers: 'Emissores', compare: 'Comparar',
    basketsEmpty: 'Nenhuma cesta aberta', basketsEmptyBody: 'As cestas geridas aparecem aqui quando uma estratégia é publicada.', pairsEmpty: 'Nenhum par listado.', last: 'Último', active: 'Ativo', paused: 'Pausado',
    predictionOpen: 'Abertos a ordens', discovery: 'Descoberta pública', discoveryNote: 'Dados da Polymarket, somente leitura. A negociação não está ativada.', volume24h: 'Vol. 24 h', closes: 'Encerra {d}', loadError: 'Não foi possível carregar os dados de mercado.',
  },
  detail: {
    investable: 'Investível', research: 'Apenas pesquisa', unitPrice: 'Preço unitário indicativo', stale: 'Desatualizada', live: 'Cotação ao vivo', validUntil: 'Válida até {t}',
    min: 'Mínimo', max: 'Máximo', settlement: 'Liquidação', network: 'Rede', assetClass: 'Classe de ativo', version: 'Versão dos termos',
    tabs: ['Visão geral', 'Avaliação', 'Divulgações'], noDisclosures: 'Nenhum documento de divulgação foi publicado para este produto.', invest: 'Investir', researchNote: 'Acompanhado com dados públicos de mercado. Não disponível para subscrição na A-REIT.',
    marketCap: 'Valor de mercado', change24h: '24 h', change7d: '7 d', change30d: '30 d', volume: 'Volume 24 h', score: 'Pontuação', risk: 'Risco',
    history: 'Valor de mercado · 90 dias', noHistory: 'A fonte não publicou histórico para este ativo.', issuer: 'Emissor', region: 'Região', website: 'Site', sources: 'Fontes de dados', synced: 'Sincronizado {t}',
    notFound: 'Ativo não encontrado', notFoundBody: 'Este link pode estar desatualizado.', quoteUnavailable: 'Cotação indisponível', about: 'Sobre', orderRules: 'Regras da ordem', orderRulesBody: 'A ordem bloqueia o valor do seu saldo disponível e liquida ao preço unitário cotado. O servidor verifica a elegibilidade ao confirmar.',
  },
  review: {
    title: 'Revisar ordem', kicker: 'Ordem · Revisão', amount: 'Valor', amountNote: 'USD e USDT são convertidos à taxa de 1:1; liquidação em USDT com 6 casas decimais.', available: 'Disponível {v}', outcome: 'Resultado', yes: 'Sim', no: 'Não',
    unitPrice: 'Preço unitário', estQty: 'Quantidade estimada', locked: 'Bloqueado do saldo', after: 'Saldo depois', refreshIn: 'Cotação válida · {s}', expired: 'Cotação expirada', refresh: 'Atualizar cotação',
    risk: 'Entendo os riscos deste produto e que confirmar bloqueia este valor do meu saldo disponível.', confirm: 'Confirmar ordem', submitting: 'Enviando…', fees: 'Taxas e limites', eligibility: 'O servidor verifica a elegibilidade ao confirmar.',
    errors: { min: 'O mínimo é {v}', max: 'O máximo é {v}', balance: 'Excede seu saldo disponível', format: 'Informe um valor com até 6 casas decimais', noProduct: 'Escolha primeiro um produto em Mercados.', risk: 'Confirme a declaração de risco.', outcome: 'Escolha um resultado.' },
    server: { ORDER_BELOW_MINIMUM: 'O valor está abaixo do mínimo.', ORDER_ABOVE_MAXIMUM: 'O valor está acima do máximo.', ORDER_NOT_ELIGIBLE: 'Sua conta ainda não é elegível para este produto.', OPERATIONAL_SWITCH_DISABLED: 'O operador pausou novas ordens.', QUOTE_STALE: 'A cotação está desatualizada. Atualize e tente novamente.', WALLET_INSUFFICIENT_BALANCE: 'Saldo disponível insuficiente.', NETWORK_ERROR: 'Sem rede. A ordem não foi confirmada; tentar novamente reutiliza a mesma solicitação.', ORDER_QUANTITY_ZERO: 'O valor é pequeno demais para o preço atual.' },
  },
  status: {
    title: 'Status da ordem', detailTitle: 'Ordem', states: { submitted: 'Enviada', accepted: 'Aceita', processing: 'Em execução', filled: 'Executada', partially_filled: 'Execução parcial', failed: 'Falhou', cancelled: 'Cancelada' },
    headline: { submitted: 'Ordem recebida', accepted: 'Ordem aceita', processing: 'Executando', filled: 'Ordem executada', partially_filled: 'Execução parcial', failed: 'A ordem falhou', cancelled: 'Ordem cancelada' },
    body: { submitted: 'Os fundos ficam bloqueados enquanto a ordem aguarda execução.', accepted: 'Os fundos ficam bloqueados enquanto a ordem aguarda execução.', processing: 'A ordem está sendo executada ao preço bloqueado.', filled: 'A posição já está nos seus ativos.', partially_filled: 'Parte da ordem foi executada. O restante voltou ao seu saldo.', failed: 'Nada foi executado. Os fundos bloqueados voltaram ao seu saldo.', cancelled: 'A ordem foi cancelada. Os fundos bloqueados foram liberados.' },
    requested: 'Solicitado', filled: 'Executado', quantity: 'Quantidade', unitPrice: 'Preço unitário', submitted: 'Enviada em', completed: 'Concluída em', orderId: 'ID da ordem',
    timeline: 'Linha do tempo', live: 'Ao vivo · a cada {s} s', viewAssets: 'Ver meus ativos', viewDetail: 'Detalhes da ordem', backMarkets: 'Voltar aos mercados', none: 'Nenhuma ordem selecionada', noneBody: 'Abra uma ordem no seu histórico para ver o status.',
    released: 'Liberado', reason: 'Motivo', export: 'Exportar CSV', actors: { user: 'Você', system: 'Sistema', admin: 'Operações', operator: 'Operações' }, records: 'Todas as ordens', product: 'Produto',
  },
}

export const marketCopy: Record<AppLocale, MarketCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))

/** Fallback for ids without a label: `private_credit` → `Private credit`. */
const humanize = (id: string) => { const text = id.replace(/[_-]+/g, ' ').trim(); return text.charAt(0).toUpperCase() + text.slice(1) }

/** Display names for catalog asset-class ids (the API sends raw ids such as `commodity`). */
const assetClassLabels: Record<AppLocale, Record<string, string>> = {
  en: { treasury: 'Treasuries', stable_value: 'Stable value', private_credit: 'Private credit', real_estate: 'Real estate', fund: 'Funds', bond: 'Bonds', equity: 'Equity', commodity: 'Commodities', infrastructure: 'Infrastructure' },
  'zh-CN': { treasury: '国债', stable_value: '稳定价值', private_credit: '私人信贷', real_estate: '房地产', fund: '基金', bond: '债券', equity: '股权', commodity: '大宗商品', infrastructure: '基础设施' },
  hi: { treasury: 'ट्रेज़री', stable_value: 'स्थिर मूल्य', private_credit: 'निजी ऋण', real_estate: 'रियल एस्टेट', fund: 'फंड', bond: 'बॉन्ड', equity: 'इक्विटी', commodity: 'कमोडिटी', infrastructure: 'अवसंरचना' },
  es: { treasury: 'Tesoro', stable_value: 'Valor estable', private_credit: 'Crédito privado', real_estate: 'Inmuebles', fund: 'Fondos', bond: 'Bonos', equity: 'Acciones', commodity: 'Materias primas', infrastructure: 'Infraestructura' },
  ar: { treasury: 'سندات الخزانة', stable_value: 'قيمة مستقرة', private_credit: 'ائتمان خاص', real_estate: 'عقارات', fund: 'صناديق', bond: 'سندات', equity: 'أسهم', commodity: 'سلع', infrastructure: 'بنية تحتية' },
  fr: { treasury: 'Trésor', stable_value: 'Valeur stable', private_credit: 'Crédit privé', real_estate: 'Immobilier', fund: 'Fonds', bond: 'Obligations', equity: 'Actions', commodity: 'Matières premières', infrastructure: 'Infrastructure' },
  pt: { treasury: 'Tesouro', stable_value: 'Valor estável', private_credit: 'Crédito privado', real_estate: 'Imóveis', fund: 'Fundos', bond: 'Títulos', equity: 'Ações', commodity: 'Commodities', infrastructure: 'Infraestrutura' },
}

export function assetClassLabel(assetClass: string, locale: AppLocale) {
  return assetClassLabels[locale][assetClass] ?? humanize(assetClass)
}

/** Network names are proper nouns and read the same in every locale; ids arrive lowercase (`ethereum`). */
const networkLabels: Record<string, string> = { ethereum: 'Ethereum', tron: 'TRON', arbitrum: 'Arbitrum', polygon: 'Polygon', base: 'Base', optimism: 'Optimism', bsc: 'BNB Chain', solana: 'Solana', avalanche: 'Avalanche' }

export function networkLabel(network: string | null | undefined) {
  if (!network) return '—'
  return networkLabels[network.toLowerCase()] ?? humanize(network)
}
