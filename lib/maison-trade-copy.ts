import type { AppLocale } from '@/lib/app-locales'

/** Batch-1b copy: basket detail/order, pair trading, prediction detail. `{x}` tokens are replaced by fill(). */
export type TradeCopy = {
  basket: {
    kicker: string; nav: string; aum: string; units: string; min: string; risk: string; cash: string
    status: { pilot: string; active: string; other: string }
    holdings: string; noHoldings: string; target: string; actual: string; navHistory: string; navEmpty: string
    yours: string; subscribe: string; redeem: string; signIn: string
    notFound: string; notFoundBody: string; loadError: string; note: string
  }
  basketOrder: {
    subscribe: string; redeem: string; kicker: string; amount: string; units: string; available: string; held: string
    estUnits: string; estValue: string; navAt: string; disclosure: string; ack: string; noDisclosure: string; readMore: string
    confirm: string; confirmRedeem: string; submitting: string; doneSub: string; doneRedeem: string; doneBody: string; doneRedeemBody: string
    duplicate: string; toBasket: string; toAssets: string; eligibility: string
    errors: { format: string; unitsFormat: string; min: string; balance: string; held: string; ack: string }
    server: Record<string, string>
  }
  trade: {
    kicker: string; pairs: string; pairsBody: string; last: string; book: string; bids: string; asks: string; price: string; qty: string
    trades: string; noTrades: string; bookEmpty: string; chart: string; chartEmpty: string
    buy: string; sell: string; limit: string; market: string; total: string; min: string; tick: string
    place: string; placing: string; placed: string; myOrders: string; noOrders: string; cancel: string; cancelling: string; filled: string
    states: Record<string, string>; paused: string; notFound: string; notFoundBody: string; loadError: string; settlement: string; signIn: string
    errors: { qty: string; price: string; min: string }
    server: Record<string, string>
  }
  prediction: {
    kicker: string; closes: string; volume: string; liquidity: string; history: string; historyEmpty: string; book: string; rules: string
    stake: string; shares: string; payout: string; price: string; place: string; placing: string; done: string; doneBody: string
    feePlace: string; feePayout: string; netPayout: string
    disabled: string; notAccepting: string; limit: string; loadError: string; source: string; partial: string; wide: string; risk: string; signIn: string
    toMarkets: string; toAssets: string; noToken: string
    errors: { format: string; max: string; min: string }
    server: Record<string, string>
  }
}

const en: TradeCopy = {
  basket: {
    kicker: 'Basket · Managed portfolio', nav: 'NAV per unit', aum: 'Assets under management', units: 'Units outstanding', min: 'Minimum', risk: 'Risk level', cash: 'Cash buffer',
    status: { pilot: 'Pilot', active: 'Open', other: 'Not open' },
    holdings: 'Holdings', noHoldings: 'No holdings are reported for this basket yet.', target: 'Target', actual: 'Actual', navHistory: 'NAV history', navEmpty: 'Not enough NAV snapshots to chart yet.',
    yours: 'Your units', subscribe: 'Subscribe', redeem: 'Redeem', signIn: 'Sign in to subscribe',
    notFound: 'Basket not found', notFoundBody: 'It may have been closed or the link is out of date.', loadError: 'Basket data could not be loaded.',
    note: 'NAV is computed from the latest available prices of the holdings. It can fall as well as rise.',
  },
  basketOrder: {
    subscribe: 'Subscribe', redeem: 'Redeem', kicker: 'Basket · Order', amount: 'Amount', units: 'Units', available: 'Available {v}', held: 'You hold {v} units',
    estUnits: 'Est. units', estValue: 'Est. proceeds', navAt: 'NAV per unit', disclosure: 'Risk disclosure', ack: 'I have read and accept this disclosure (version {v}).', noDisclosure: 'No disclosure is published for this basket.', readMore: 'Read full text',
    confirm: 'Confirm subscription', confirmRedeem: 'Confirm redemption', submitting: 'Submitting…', doneSub: 'Subscription settled', doneRedeem: 'Redemption settled',
    doneBody: '{u} units at NAV {n}', doneRedeemBody: '{u} units · proceeds {v}', duplicate: 'This request was already processed. The original result is shown.', toBasket: 'Back to basket', toAssets: 'My assets',
    eligibility: 'Eligibility and risk checks run on the server when you confirm. Final units use the NAV at settlement.',
    errors: { format: 'Enter an amount with up to 6 decimals', unitsFormat: 'Enter units with up to 8 decimals', min: 'Minimum is {v}', balance: 'Exceeds your available balance', held: 'More than the units you hold', ack: 'Please accept the risk disclosure.' },
    server: {
      BASKET_AMOUNT_INVALID: 'The amount is not valid for this basket.', BASKET_UNITS_INVALID: 'The number of units is not valid.', OPERATIONAL_SWITCH_DISABLED: 'This action is paused by the operator.',
      INVESTMENT_NOT_ELIGIBLE: 'Your account is not eligible for new basket subscriptions yet.', BASKET_PORTFOLIO_NOT_ACTIVE: 'This basket is not open right now.', BASKET_DISCLOSURE_ACK_REQUIRED: 'Please accept the latest risk disclosure.',
      BASKET_RISK_BLOCKED: 'New subscriptions are temporarily blocked by risk checks.', BASKET_NAV_UNAVAILABLE: 'NAV is not available yet. Please try later.', BASKET_INSUFFICIENT_UNITS: 'Not enough units or settlement cash for this request.',
      BASKET_PORTFOLIO_NOT_FOUND: 'Basket not found.', INSUFFICIENT_FUNDING: 'Insufficient available balance.', NETWORK_ERROR: 'Network unavailable. Nothing was confirmed; retrying reuses the same request.',
    },
  },
  trade: {
    kicker: 'Pair · Order book', pairs: 'Trading pairs', pairsBody: 'Choose a pair to see its order book.', last: 'Last price', book: 'Order book', bids: 'Bids', asks: 'Asks', price: 'Price', qty: 'Quantity',
    trades: 'Recent trades', noTrades: 'No trades yet', bookEmpty: 'No resting orders', chart: 'Price', chartEmpty: 'Not enough fills to chart yet.',
    buy: 'Buy', sell: 'Sell', limit: 'Limit', market: 'Market', total: 'Est. total', min: 'Min {v}', tick: 'Tick {v}',
    place: 'Place order', placing: 'Placing…', placed: 'Order {s}', myOrders: 'My orders', noOrders: 'No orders on this pair', cancel: 'Cancel', cancelling: 'Cancelling…', filled: 'Filled {v}',
    states: { open: 'Open', partial: 'Partly filled', filled: 'Filled', cancelled: 'Cancelled', rejected: 'Rejected' },
    paused: 'Trading is paused for this pair.', notFound: 'Pair not found', notFoundBody: 'This pair may have been delisted.', loadError: 'Market data could not be loaded.',
    settlement: 'Settlement is not connected yet: fills on this book do not move your balance or positions.', signIn: 'Sign in to trade',
    errors: { qty: 'Enter a quantity', price: 'Enter a limit price', min: 'Minimum quantity is {v}' },
    server: {
      TRADING_PAIR_INACTIVE: 'This pair is not open for trading.', TRADING_BAD_QUANTITY: 'The quantity is not valid.', TRADING_BELOW_MIN: 'The quantity is below the minimum.', TRADING_BAD_PRICE: 'The price is not valid.',
      TRADING_ORDER_NOT_FOUND: 'Order not found.', TRADING_ORDER_NOT_CANCELLABLE: 'Only open orders can be cancelled.', TRADING_PAIR_NOT_FOUND: 'Pair not found.', INVESTMENT_NOT_ELIGIBLE: 'Your account is not eligible to trade yet.',
      NETWORK_ERROR: 'Network unavailable. Nothing was confirmed; retrying reuses the same request.',
    },
  },
  prediction: {
    kicker: 'Prediction · Polymarket', closes: 'Closes', volume: '24h volume', liquidity: 'Liquidity', history: 'Probability history', historyEmpty: 'No price history is available for this market.', book: 'Order book', rules: 'Resolution rules',
    stake: 'Stake amount', shares: 'Est. shares', payout: 'Est. winnings', price: 'Price', place: 'Place bet', placing: 'Placing…', done: 'Bet placed', doneBody: '{s} shares at {p}. It settles automatically at resolution.',
    feePlace: 'Fee on stake ({r})', feePayout: 'Fee on winnings ({r})', netPayout: 'Net payout if you win',
    disabled: 'Betting is currently disabled. Market data stays visible.', notAccepting: 'The source market is not accepting orders.', limit: 'Up to {v} per bet', loadError: 'Market data is unavailable right now.',
    source: 'Live via Polymarket', wide: 'The best available price ({p}) is far from the market probability ({m}): the order book is thin. You will pay the best available price.', partial: 'Partial data: some order-book or history fields are missing.', risk: 'I understand the full stake can be lost and that the price may move before confirmation.', signIn: 'Sign in to bet',
    toMarkets: 'Back to markets', toAssets: 'My assets', noToken: 'This outcome cannot be bet from your balance.',
    errors: { format: 'Enter a stake with up to 6 decimals', max: 'Maximum is {v}', min: 'Minimum is {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: 'Betting is currently disabled.', PREDICTION_MARKET_NOT_TRADEABLE: 'This market is not available for betting.', PREDICTION_PRICE_UNAVAILABLE: 'Price unavailable. Please retry shortly.',
      PREDICTION_SLIPPAGE_EXCEEDED: 'The price moved beyond the allowed slippage. Review the new price and retry.', PREDICTION_STAKE_LIMIT_EXCEEDED: 'The stake exceeds the per-bet limit.', PREDICTION_DAILY_LIMIT_EXCEEDED: 'Daily betting limit reached.',
      PREDICTION_MARKET_EXPOSURE_LIMIT: 'This market has reached its exposure limit.', PREDICTION_INSUFFICIENT_BALANCE: 'Insufficient available balance.', INVESTMENT_NOT_ELIGIBLE: 'Your account is not eligible for prediction markets yet.',
      NETWORK_ERROR: 'Network unavailable. Nothing was confirmed; retrying reuses the same request.',
    },
  },
}

const zh: TradeCopy = {
  basket: {
    kicker: '篮子 · 托管组合', nav: '单位净值', aum: '管理规模', units: '流通份额', min: '起投', risk: '风险等级', cash: '现金缓冲',
    status: { pilot: '试运行', active: '开放', other: '未开放' },
    holdings: '持仓', noHoldings: '该篮子暂未披露持仓。', target: '目标', actual: '实际', navHistory: '净值走势', navEmpty: '净值快照不足，暂无法绘图。',
    yours: '我的份额', subscribe: '申购', redeem: '赎回', signIn: '登录后申购',
    notFound: '未找到篮子', notFoundBody: '它可能已关闭，或链接已失效。', loadError: '篮子数据加载失败。',
    note: '净值按持仓最新可得价格计算，可能下跌也可能上涨。',
  },
  basketOrder: {
    subscribe: '申购', redeem: '赎回', kicker: '篮子 · 下单', amount: '金额', units: '份额', available: '可用 {v}', held: '持有 {v} 份',
    estUnits: '预计份额', estValue: '预计到账', navAt: '单位净值', disclosure: '风险揭示', ack: '我已阅读并接受该风险揭示（版本 {v}）。', noDisclosure: '该篮子暂未发布风险揭示。', readMore: '查看全文',
    confirm: '确认申购', confirmRedeem: '确认赎回', submitting: '提交中…', doneSub: '申购已结算', doneRedeem: '赎回已结算',
    doneBody: '按净值 {n} 获得 {u} 份', doneRedeemBody: '{u} 份 · 到账 {v}', duplicate: '该请求已处理过，以下为原结果。', toBasket: '返回篮子', toAssets: '我的资产',
    eligibility: '确认时由服务端检查资格与风控，最终份额以结算时净值为准。',
    errors: { format: '请输入最多 6 位小数的金额', unitsFormat: '请输入最多 8 位小数的份额', min: '最低 {v}', balance: '超过可用余额', held: '超过持有份额', ack: '请先接受风险揭示。' },
    server: {
      BASKET_AMOUNT_INVALID: '金额不符合该篮子要求。', BASKET_UNITS_INVALID: '份额数量无效。', OPERATIONAL_SWITCH_DISABLED: '该操作已被运营暂停。',
      INVESTMENT_NOT_ELIGIBLE: '您的账户暂不具备新申购资格。', BASKET_PORTFOLIO_NOT_ACTIVE: '该篮子当前未开放。', BASKET_DISCLOSURE_ACK_REQUIRED: '请先接受最新风险揭示。',
      BASKET_RISK_BLOCKED: '风控检查暂时阻止新申购。', BASKET_NAV_UNAVAILABLE: '暂无净值，请稍后再试。', BASKET_INSUFFICIENT_UNITS: '份额或结算现金不足。',
      BASKET_PORTFOLIO_NOT_FOUND: '未找到篮子。', INSUFFICIENT_FUNDING: '可用余额不足。', NETWORK_ERROR: '网络不可用，本次未确认；重试会复用同一请求。',
    },
  },
  trade: {
    kicker: '交易对 · 订单簿', pairs: '交易对', pairsBody: '选择一个交易对查看订单簿。', last: '最新价', book: '订单簿', bids: '买盘', asks: '卖盘', price: '价格', qty: '数量',
    trades: '最近成交', noTrades: '暂无成交', bookEmpty: '暂无挂单', chart: '价格', chartEmpty: '成交不足，暂无法绘图。',
    buy: '买入', sell: '卖出', limit: '限价', market: '市价', total: '预计总额', min: '最小 {v}', tick: '最小变动 {v}',
    place: '提交订单', placing: '提交中…', placed: '订单{s}', myOrders: '我的订单', noOrders: '该交易对暂无订单', cancel: '撤单', cancelling: '撤单中…', filled: '已成交 {v}',
    states: { open: '挂单中', partial: '部分成交', filled: '已成交', cancelled: '已撤销', rejected: '已拒绝' },
    paused: '该交易对已暂停交易。', notFound: '未找到交易对', notFoundBody: '该交易对可能已下架。', loadError: '行情数据加载失败。',
    settlement: '结算尚未接通：本订单簿的成交不会变动您的余额或持仓。', signIn: '登录后交易',
    errors: { qty: '请输入数量', price: '请输入限价', min: '最小数量为 {v}' },
    server: {
      TRADING_PAIR_INACTIVE: '该交易对未开放交易。', TRADING_BAD_QUANTITY: '数量无效。', TRADING_BELOW_MIN: '数量低于最小值。', TRADING_BAD_PRICE: '价格无效。',
      TRADING_ORDER_NOT_FOUND: '未找到订单。', TRADING_ORDER_NOT_CANCELLABLE: '只有挂单中的订单可以撤销。', TRADING_PAIR_NOT_FOUND: '未找到交易对。', INVESTMENT_NOT_ELIGIBLE: '您的账户暂不具备交易资格。',
      NETWORK_ERROR: '网络不可用，本次未确认；重试会复用同一请求。',
    },
  },
  prediction: {
    kicker: '预测 · Polymarket', closes: '截止', volume: '24 小时成交额', liquidity: '流动性', history: '概率走势', historyEmpty: '该市场暂无价格历史。', book: '订单簿', rules: '结算规则',
    stake: '下注金额', shares: '预计份数', payout: '预计中奖金额', price: '价格', place: '确认投注', placing: '提交中…', done: '投注成功', doneBody: '以 {p} 获得 {s} 份，开奖后自动结算。',
    feePlace: '下注费（{r}）', feePayout: '派彩费（{r}）', netPayout: '中奖净到账',
    disabled: '投注当前已关闭，行情仍可查看。', notAccepting: '源市场当前不接受订单。', limit: '单笔最多 {v}', loadError: '市场数据暂不可用。',
    source: '来自 Polymarket 实时数据', wide: '当前可成交价（{p}）与市场概率（{m}）相差较大：订单簿深度不足。下注将按可成交价执行。', partial: '数据不完整：部分订单簿或历史字段缺失。', risk: '我了解可能损失全部投注金额，且确认前价格可能变动。', signIn: '登录后投注',
    toMarkets: '返回市场', toAssets: '我的资产', noToken: '该结果暂不支持余额投注。',
    errors: { format: '请输入最多 6 位小数的金额', max: '最多 {v}', min: '最少 {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: '投注当前已关闭。', PREDICTION_MARKET_NOT_TRADEABLE: '该市场暂不支持投注。', PREDICTION_PRICE_UNAVAILABLE: '暂无价格，请稍后重试。',
      PREDICTION_SLIPPAGE_EXCEEDED: '价格变动超出允许滑点，请查看新价格后重试。', PREDICTION_STAKE_LIMIT_EXCEEDED: '超过单笔投注上限。', PREDICTION_DAILY_LIMIT_EXCEEDED: '已达今日投注上限。',
      PREDICTION_MARKET_EXPOSURE_LIMIT: '该市场已达敞口上限。', PREDICTION_INSUFFICIENT_BALANCE: '可用余额不足。', INVESTMENT_NOT_ELIGIBLE: '您的账户暂不具备预测市场资格。',
      NETWORK_ERROR: '网络不可用，本次未确认；重试会复用同一请求。',
    },
  },
}

const hi: TradeCopy = {
  basket: {
    kicker: 'बास्केट · प्रबंधित पोर्टफ़ोलियो', nav: 'प्रति यूनिट NAV', aum: 'प्रबंधन के अधीन एसेट', units: 'बकाया यूनिट', min: 'न्यूनतम', risk: 'जोखिम स्तर', cash: 'नकद बफ़र',
    status: { pilot: 'पायलट', active: 'खुला', other: 'खुला नहीं' },
    holdings: 'होल्डिंग्स', noHoldings: 'इस बास्केट की कोई होल्डिंग अभी रिपोर्ट नहीं है।', target: 'लक्ष्य', actual: 'वास्तविक', navHistory: 'NAV इतिहास', navEmpty: 'चार्ट के लिए अभी पर्याप्त NAV स्नैपशॉट नहीं हैं।',
    yours: 'आपकी यूनिट', subscribe: 'सब्सक्राइब करें', redeem: 'रिडीम करें', signIn: 'सब्सक्राइब करने के लिए लॉग इन करें',
    notFound: 'बास्केट नहीं मिला', notFoundBody: 'यह बंद हो सकता है या लिंक पुराना है।', loadError: 'बास्केट डेटा लोड नहीं हो सका।',
    note: 'NAV होल्डिंग्स की नवीनतम उपलब्ध कीमतों से गणना होता है। यह घट भी सकता है और बढ़ भी सकता है।',
  },
  basketOrder: {
    subscribe: 'सब्सक्राइब करें', redeem: 'रिडीम करें', kicker: 'बास्केट · ऑर्डर', amount: 'राशि', units: 'यूनिट', available: 'उपलब्ध {v}', held: 'आपके पास {v} यूनिट',
    estUnits: 'अनुमानित यूनिट', estValue: 'अनुमानित प्राप्ति', navAt: 'प्रति यूनिट NAV', disclosure: 'जोखिम प्रकटीकरण', ack: 'मैंने यह प्रकटीकरण (संस्करण {v}) पढ़ लिया है और स्वीकार करता/करती हूँ।', noDisclosure: 'इस बास्केट के लिए कोई प्रकटीकरण प्रकाशित नहीं है।', readMore: 'पूरा पाठ पढ़ें',
    confirm: 'सब्सक्रिप्शन की पुष्टि करें', confirmRedeem: 'रिडेम्पशन की पुष्टि करें', submitting: 'सबमिट हो रहा है…', doneSub: 'सब्सक्रिप्शन सेटल हुआ', doneRedeem: 'रिडेम्पशन सेटल हुआ',
    doneBody: 'NAV {n} पर {u} यूनिट', doneRedeemBody: '{u} यूनिट · प्राप्ति {v}', duplicate: 'यह अनुरोध पहले ही प्रोसेस हो चुका है। मूल परिणाम दिखाया गया है।', toBasket: 'बास्केट पर वापस', toAssets: 'मेरे एसेट',
    eligibility: 'पुष्टि करते समय सर्वर पात्रता और जोखिम जाँच करता है। अंतिम यूनिट सेटलमेंट के NAV पर तय होती हैं।',
    errors: { format: 'अधिकतम 6 दशमलव वाली राशि दर्ज करें', unitsFormat: 'अधिकतम 8 दशमलव वाली यूनिट दर्ज करें', min: 'न्यूनतम {v}', balance: 'उपलब्ध बैलेंस से अधिक', held: 'आपकी यूनिट से अधिक', ack: 'कृपया जोखिम प्रकटीकरण स्वीकार करें।' },
    server: {
      BASKET_AMOUNT_INVALID: 'यह राशि इस बास्केट के लिए मान्य नहीं है।', BASKET_UNITS_INVALID: 'यूनिट की संख्या मान्य नहीं है।', OPERATIONAL_SWITCH_DISABLED: 'ऑपरेटर ने यह कार्य रोक दिया है।',
      INVESTMENT_NOT_ELIGIBLE: 'आपका खाता अभी नए बास्केट सब्सक्रिप्शन के लिए पात्र नहीं है।', BASKET_PORTFOLIO_NOT_ACTIVE: 'यह बास्केट अभी खुला नहीं है।', BASKET_DISCLOSURE_ACK_REQUIRED: 'कृपया नवीनतम जोखिम प्रकटीकरण स्वीकार करें।',
      BASKET_RISK_BLOCKED: 'जोखिम जाँच ने नए सब्सक्रिप्शन अस्थायी रूप से रोके हैं।', BASKET_NAV_UNAVAILABLE: 'NAV अभी उपलब्ध नहीं है। बाद में कोशिश करें।', BASKET_INSUFFICIENT_UNITS: 'इस अनुरोध के लिए पर्याप्त यूनिट या सेटलमेंट नकद नहीं है।',
      BASKET_PORTFOLIO_NOT_FOUND: 'बास्केट नहीं मिला।', INSUFFICIENT_FUNDING: 'उपलब्ध बैलेंस अपर्याप्त है।', NETWORK_ERROR: 'नेटवर्क उपलब्ध नहीं। कुछ भी पुष्टि नहीं हुआ; दोबारा कोशिश वही अनुरोध दोहराती है।',
    },
  },
  trade: {
    kicker: 'पेयर · ऑर्डर बुक', pairs: 'ट्रेडिंग पेयर', pairsBody: 'ऑर्डर बुक देखने के लिए एक पेयर चुनें।', last: 'अंतिम कीमत', book: 'ऑर्डर बुक', bids: 'बिड', asks: 'आस्क', price: 'कीमत', qty: 'मात्रा',
    trades: 'हाल के ट्रेड', noTrades: 'अभी कोई ट्रेड नहीं', bookEmpty: 'कोई लंबित ऑर्डर नहीं', chart: 'कीमत', chartEmpty: 'चार्ट के लिए अभी पर्याप्त फ़िल नहीं हैं।',
    buy: 'खरीदें', sell: 'बेचें', limit: 'लिमिट', market: 'मार्केट', total: 'अनुमानित कुल', min: 'न्यूनतम {v}', tick: 'टिक {v}',
    place: 'ऑर्डर दें', placing: 'भेजा जा रहा है…', placed: 'ऑर्डर {s}', myOrders: 'मेरे ऑर्डर', noOrders: 'इस पेयर पर कोई ऑर्डर नहीं', cancel: 'रद्द करें', cancelling: 'रद्द हो रहा है…', filled: 'भरा {v}',
    states: { open: 'खुला', partial: 'आंशिक रूप से भरा', filled: 'भरा', cancelled: 'रद्द', rejected: 'अस्वीकृत' },
    paused: 'इस पेयर पर ट्रेडिंग रुकी है।', notFound: 'पेयर नहीं मिला', notFoundBody: 'यह पेयर डीलिस्ट हो सकता है।', loadError: 'बाज़ार डेटा लोड नहीं हो सका।',
    settlement: 'सेटलमेंट अभी जुड़ा नहीं है: इस बुक पर फ़िल आपका बैलेंस या पोज़िशन नहीं बदलते।', signIn: 'ट्रेड करने के लिए लॉग इन करें',
    errors: { qty: 'मात्रा दर्ज करें', price: 'लिमिट कीमत दर्ज करें', min: 'न्यूनतम मात्रा {v} है' },
    server: {
      TRADING_PAIR_INACTIVE: 'यह पेयर ट्रेडिंग के लिए खुला नहीं है।', TRADING_BAD_QUANTITY: 'मात्रा मान्य नहीं है।', TRADING_BELOW_MIN: 'मात्रा न्यूनतम से कम है।', TRADING_BAD_PRICE: 'कीमत मान्य नहीं है।',
      TRADING_ORDER_NOT_FOUND: 'ऑर्डर नहीं मिला।', TRADING_ORDER_NOT_CANCELLABLE: 'केवल खुले ऑर्डर रद्द हो सकते हैं।', TRADING_PAIR_NOT_FOUND: 'पेयर नहीं मिला।', INVESTMENT_NOT_ELIGIBLE: 'आपका खाता अभी ट्रेडिंग के लिए पात्र नहीं है।',
      NETWORK_ERROR: 'नेटवर्क उपलब्ध नहीं। कुछ भी पुष्टि नहीं हुआ; दोबारा कोशिश वही अनुरोध दोहराती है।',
    },
  },
  prediction: {
    kicker: 'प्रेडिक्शन · Polymarket', closes: 'समापन', volume: '24 घंटे वॉल्यूम', liquidity: 'लिक्विडिटी', history: 'संभावना इतिहास', historyEmpty: 'इस बाज़ार का कोई मूल्य इतिहास उपलब्ध नहीं है।', book: 'ऑर्डर बुक', rules: 'निपटान नियम',
    stake: 'दांव राशि', shares: 'अनुमानित शेयर', payout: 'अनुमानित जीत', price: 'कीमत', place: 'दांव लगाएँ', placing: 'भेजा जा रहा है…', done: 'दांव लगा', doneBody: '{p} पर {s} शेयर। परिणाम पर यह स्वतः सेटल होगा।',
    feePlace: 'दांव पर शुल्क ({r})', feePayout: 'जीत पर शुल्क ({r})', netPayout: 'जीतने पर शुद्ध भुगतान',
    disabled: 'दांव अभी बंद है। बाज़ार डेटा दिखता रहेगा।', notAccepting: 'स्रोत बाज़ार अभी ऑर्डर नहीं ले रहा।', limit: 'प्रति दांव अधिकतम {v}', loadError: 'बाज़ार डेटा अभी उपलब्ध नहीं है।',
    source: 'Polymarket से लाइव', wide: 'सर्वोत्तम उपलब्ध मूल्य ({p}) बाज़ार संभावना ({m}) से काफ़ी अलग है: ऑर्डर बुक पतली है। आप सर्वोत्तम उपलब्ध मूल्य चुकाएँगे।', partial: 'आंशिक डेटा: कुछ ऑर्डर बुक या इतिहास फ़ील्ड उपलब्ध नहीं हैं।', risk: 'मैं समझता/समझती हूँ कि पूरी दांव राशि डूब सकती है और पुष्टि से पहले कीमत बदल सकती है।', signIn: 'दांव के लिए लॉग इन करें',
    toMarkets: 'बाज़ार पर वापस', toAssets: 'मेरे एसेट', noToken: 'इस परिणाम पर बैलेंस से दांव नहीं लगाया जा सकता।',
    errors: { format: 'अधिकतम 6 दशमलव वाली राशि दर्ज करें', max: 'अधिकतम {v}', min: 'न्यूनतम {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: 'दांव अभी बंद है।', PREDICTION_MARKET_NOT_TRADEABLE: 'यह बाज़ार दांव के लिए उपलब्ध नहीं है।', PREDICTION_PRICE_UNAVAILABLE: 'कीमत उपलब्ध नहीं। थोड़ी देर में कोशिश करें।',
      PREDICTION_SLIPPAGE_EXCEEDED: 'कीमत अनुमत स्लिपेज से आगे बढ़ गई। नई कीमत देखें और फिर कोशिश करें।', PREDICTION_STAKE_LIMIT_EXCEEDED: 'दांव प्रति-दांव सीमा से अधिक है।', PREDICTION_DAILY_LIMIT_EXCEEDED: 'दैनिक दांव सीमा पूरी हुई।',
      PREDICTION_MARKET_EXPOSURE_LIMIT: 'यह बाज़ार अपनी एक्सपोज़र सीमा पर है।', PREDICTION_INSUFFICIENT_BALANCE: 'उपलब्ध बैलेंस अपर्याप्त है।', INVESTMENT_NOT_ELIGIBLE: 'आपका खाता अभी प्रेडिक्शन बाज़ार के लिए पात्र नहीं है।',
      NETWORK_ERROR: 'नेटवर्क उपलब्ध नहीं। कुछ भी पुष्टि नहीं हुआ; दोबारा कोशिश वही अनुरोध दोहराती है।',
    },
  },
}

const es: TradeCopy = {
  basket: {
    kicker: 'Cesta · Cartera gestionada', nav: 'NAV por unidad', aum: 'Activos gestionados', units: 'Unidades en circulación', min: 'Mínimo', risk: 'Nivel de riesgo', cash: 'Colchón de efectivo',
    status: { pilot: 'Piloto', active: 'Abierta', other: 'No abierta' },
    holdings: 'Posiciones', noHoldings: 'Esta cesta aún no reporta posiciones.', target: 'Objetivo', actual: 'Real', navHistory: 'Historial del NAV', navEmpty: 'Aún no hay suficientes registros de NAV para graficar.',
    yours: 'Tus unidades', subscribe: 'Suscribir', redeem: 'Reembolsar', signIn: 'Inicia sesión para suscribir',
    notFound: 'Cesta no encontrada', notFoundBody: 'Puede que esté cerrada o que el enlace esté desactualizado.', loadError: 'No se pudieron cargar los datos de la cesta.',
    note: 'El NAV se calcula con los últimos precios disponibles de las posiciones. Puede bajar además de subir.',
  },
  basketOrder: {
    subscribe: 'Suscribir', redeem: 'Reembolsar', kicker: 'Cesta · Orden', amount: 'Importe', units: 'Unidades', available: 'Disponible {v}', held: 'Tienes {v} unidades',
    estUnits: 'Unidades estimadas', estValue: 'Importe estimado', navAt: 'NAV por unidad', disclosure: 'Divulgación de riesgos', ack: 'He leído y acepto esta divulgación (versión {v}).', noDisclosure: 'No hay divulgación publicada para esta cesta.', readMore: 'Leer texto completo',
    confirm: 'Confirmar suscripción', confirmRedeem: 'Confirmar reembolso', submitting: 'Enviando…', doneSub: 'Suscripción liquidada', doneRedeem: 'Reembolso liquidado',
    doneBody: '{u} unidades a NAV {n}', doneRedeemBody: '{u} unidades · importe {v}', duplicate: 'Esta solicitud ya se procesó. Se muestra el resultado original.', toBasket: 'Volver a la cesta', toAssets: 'Mis activos',
    eligibility: 'Al confirmar, el servidor comprueba la elegibilidad y el riesgo. Las unidades finales usan el NAV de liquidación.',
    errors: { format: 'Introduce un importe con hasta 6 decimales', unitsFormat: 'Introduce unidades con hasta 8 decimales', min: 'El mínimo es {v}', balance: 'Supera tu saldo disponible', held: 'Supera las unidades que tienes', ack: 'Acepta la divulgación de riesgos.' },
    server: {
      BASKET_AMOUNT_INVALID: 'El importe no es válido para esta cesta.', BASKET_UNITS_INVALID: 'El número de unidades no es válido.', OPERATIONAL_SWITCH_DISABLED: 'El operador ha pausado esta acción.',
      INVESTMENT_NOT_ELIGIBLE: 'Tu cuenta aún no es elegible para nuevas suscripciones.', BASKET_PORTFOLIO_NOT_ACTIVE: 'Esta cesta no está abierta ahora.', BASKET_DISCLOSURE_ACK_REQUIRED: 'Acepta la divulgación de riesgos más reciente.',
      BASKET_RISK_BLOCKED: 'Los controles de riesgo bloquean temporalmente nuevas suscripciones.', BASKET_NAV_UNAVAILABLE: 'El NAV aún no está disponible. Inténtalo más tarde.', BASKET_INSUFFICIENT_UNITS: 'No hay unidades o efectivo de liquidación suficientes.',
      BASKET_PORTFOLIO_NOT_FOUND: 'Cesta no encontrada.', INSUFFICIENT_FUNDING: 'Saldo disponible insuficiente.', NETWORK_ERROR: 'Red no disponible. No se confirmó nada; reintentar reutiliza la misma solicitud.',
    },
  },
  trade: {
    kicker: 'Par · Libro de órdenes', pairs: 'Pares de trading', pairsBody: 'Elige un par para ver su libro de órdenes.', last: 'Último precio', book: 'Libro de órdenes', bids: 'Compras', asks: 'Ventas', price: 'Precio', qty: 'Cantidad',
    trades: 'Operaciones recientes', noTrades: 'Aún no hay operaciones', bookEmpty: 'No hay órdenes en espera', chart: 'Precio', chartEmpty: 'Aún no hay suficientes ejecuciones para graficar.',
    buy: 'Comprar', sell: 'Vender', limit: 'Límite', market: 'Mercado', total: 'Total estimado', min: 'Mín. {v}', tick: 'Tick {v}',
    place: 'Enviar orden', placing: 'Enviando…', placed: 'Orden {s}', myOrders: 'Mis órdenes', noOrders: 'No hay órdenes en este par', cancel: 'Cancelar', cancelling: 'Cancelando…', filled: 'Ejecutado {v}',
    states: { open: 'Abierta', partial: 'Parcial', filled: 'Ejecutada', cancelled: 'Cancelada', rejected: 'Rechazada' },
    paused: 'El trading está pausado en este par.', notFound: 'Par no encontrado', notFoundBody: 'Puede que este par se haya retirado.', loadError: 'No se pudieron cargar los datos de mercado.',
    settlement: 'La liquidación aún no está conectada: las ejecuciones de este libro no mueven tu saldo ni tus posiciones.', signIn: 'Inicia sesión para operar',
    errors: { qty: 'Introduce una cantidad', price: 'Introduce un precio límite', min: 'La cantidad mínima es {v}' },
    server: {
      TRADING_PAIR_INACTIVE: 'Este par no está abierto.', TRADING_BAD_QUANTITY: 'La cantidad no es válida.', TRADING_BELOW_MIN: 'La cantidad está por debajo del mínimo.', TRADING_BAD_PRICE: 'El precio no es válido.',
      TRADING_ORDER_NOT_FOUND: 'Orden no encontrada.', TRADING_ORDER_NOT_CANCELLABLE: 'Solo se pueden cancelar órdenes abiertas.', TRADING_PAIR_NOT_FOUND: 'Par no encontrado.', INVESTMENT_NOT_ELIGIBLE: 'Tu cuenta aún no es elegible para operar.',
      NETWORK_ERROR: 'Red no disponible. No se confirmó nada; reintentar reutiliza la misma solicitud.',
    },
  },
  prediction: {
    kicker: 'Predicción · Polymarket', closes: 'Cierra', volume: 'Volumen 24 h', liquidity: 'Liquidez', history: 'Historial de probabilidad', historyEmpty: 'No hay historial de precios para este mercado.', book: 'Libro de órdenes', rules: 'Reglas de resolución',
    stake: 'Importe de apuesta', shares: 'Participaciones estimadas', payout: 'Ganancia estimada', price: 'Precio', place: 'Apostar', placing: 'Enviando…', done: 'Apuesta realizada', doneBody: '{s} participaciones a {p}. Se liquida automáticamente al resolverse.',
    feePlace: 'Comisión sobre la apuesta ({r})', feePayout: 'Comisión sobre las ganancias ({r})', netPayout: 'Pago neto si ganas',
    disabled: 'Las apuestas están desactivadas. Los datos siguen visibles.', notAccepting: 'El mercado de origen no acepta órdenes.', limit: 'Hasta {v} por apuesta', loadError: 'Los datos del mercado no están disponibles.',
    source: 'En vivo vía Polymarket', wide: 'El mejor precio disponible ({p}) está lejos de la probabilidad del mercado ({m}): el libro tiene poca profundidad. Pagarás el mejor precio disponible.', partial: 'Datos parciales: faltan campos del libro o del historial.', risk: 'Entiendo que puedo perder toda la apuesta y que el precio puede cambiar antes de confirmar.', signIn: 'Inicia sesión para apostar',
    toMarkets: 'Volver a mercados', toAssets: 'Mis activos', noToken: 'No se puede apostar con saldo en este resultado.',
    errors: { format: 'Introduce una apuesta con hasta 6 decimales', max: 'El máximo es {v}', min: 'El mínimo es {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: 'Las apuestas están desactivadas.', PREDICTION_MARKET_NOT_TRADEABLE: 'Este mercado no admite apuestas.', PREDICTION_PRICE_UNAVAILABLE: 'Precio no disponible. Reintenta en breve.',
      PREDICTION_SLIPPAGE_EXCEEDED: 'El precio superó el deslizamiento permitido. Revisa el nuevo precio y reintenta.', PREDICTION_STAKE_LIMIT_EXCEEDED: 'La apuesta supera el límite por operación.', PREDICTION_DAILY_LIMIT_EXCEEDED: 'Se alcanzó el límite diario.',
      PREDICTION_MARKET_EXPOSURE_LIMIT: 'Este mercado alcanzó su límite de exposición.', PREDICTION_INSUFFICIENT_BALANCE: 'Saldo disponible insuficiente.', INVESTMENT_NOT_ELIGIBLE: 'Tu cuenta aún no es elegible para mercados de predicción.',
      NETWORK_ERROR: 'Red no disponible. No se confirmó nada; reintentar reutiliza la misma solicitud.',
    },
  },
}

const ar: TradeCopy = {
  basket: {
    kicker: 'سلة · محفظة مُدارة', nav: 'صافي قيمة الوحدة', aum: 'الأصول المُدارة', units: 'الوحدات القائمة', min: 'الحد الأدنى', risk: 'مستوى المخاطر', cash: 'احتياطي نقدي',
    status: { pilot: 'تجريبية', active: 'مفتوحة', other: 'غير مفتوحة' },
    holdings: 'المكونات', noHoldings: 'لم تُعلَن مكونات لهذه السلة بعد.', target: 'المستهدف', actual: 'الفعلي', navHistory: 'سجل صافي القيمة', navEmpty: 'لا توجد لقطات كافية لصافي القيمة لرسم المخطط.',
    yours: 'وحداتك', subscribe: 'اكتتاب', redeem: 'استرداد', signIn: 'سجّل الدخول للاكتتاب',
    notFound: 'السلة غير موجودة', notFoundBody: 'ربما أُغلقت أو أن الرابط قديم.', loadError: 'تعذّر تحميل بيانات السلة.',
    note: 'يُحتسب صافي القيمة من أحدث الأسعار المتاحة للمكونات، وقد ينخفض كما قد يرتفع.',
  },
  basketOrder: {
    subscribe: 'اكتتاب', redeem: 'استرداد', kicker: 'سلة · طلب', amount: 'المبلغ', units: 'الوحدات', available: 'المتاح {v}', held: 'تملك {v} وحدة',
    estUnits: 'الوحدات التقديرية', estValue: 'العائد التقديري', navAt: 'صافي قيمة الوحدة', disclosure: 'إفصاح المخاطر', ack: 'قرأت هذا الإفصاح (الإصدار {v}) وأوافق عليه.', noDisclosure: 'لا يوجد إفصاح منشور لهذه السلة.', readMore: 'قراءة النص الكامل',
    confirm: 'تأكيد الاكتتاب', confirmRedeem: 'تأكيد الاسترداد', submitting: 'جارٍ الإرسال…', doneSub: 'تمت تسوية الاكتتاب', doneRedeem: 'تمت تسوية الاسترداد',
    doneBody: '{u} وحدة بصافي قيمة {n}', doneRedeemBody: '{u} وحدة · العائد {v}', duplicate: 'تمت معالجة هذا الطلب سابقًا. تُعرض النتيجة الأصلية.', toBasket: 'العودة إلى السلة', toAssets: 'أصولي',
    eligibility: 'يتحقق الخادم من الأهلية والمخاطر عند التأكيد. تُحدَّد الوحدات النهائية بصافي القيمة عند التسوية.',
    errors: { format: 'أدخل مبلغًا بست خانات عشرية كحد أقصى', unitsFormat: 'أدخل وحدات بثماني خانات عشرية كحد أقصى', min: 'الحد الأدنى {v}', balance: 'يتجاوز رصيدك المتاح', held: 'يتجاوز الوحدات التي تملكها', ack: 'يرجى قبول إفصاح المخاطر.' },
    server: {
      BASKET_AMOUNT_INVALID: 'المبلغ غير صالح لهذه السلة.', BASKET_UNITS_INVALID: 'عدد الوحدات غير صالح.', OPERATIONAL_SWITCH_DISABLED: 'أوقف المشغّل هذا الإجراء مؤقتًا.',
      INVESTMENT_NOT_ELIGIBLE: 'حسابك غير مؤهل بعد لاكتتابات جديدة.', BASKET_PORTFOLIO_NOT_ACTIVE: 'هذه السلة غير مفتوحة الآن.', BASKET_DISCLOSURE_ACK_REQUIRED: 'يرجى قبول أحدث إفصاح للمخاطر.',
      BASKET_RISK_BLOCKED: 'فحوص المخاطر تمنع مؤقتًا الاكتتابات الجديدة.', BASKET_NAV_UNAVAILABLE: 'صافي القيمة غير متاح بعد. حاول لاحقًا.', BASKET_INSUFFICIENT_UNITS: 'لا توجد وحدات أو نقد تسوية كافٍ لهذا الطلب.',
      BASKET_PORTFOLIO_NOT_FOUND: 'السلة غير موجودة.', INSUFFICIENT_FUNDING: 'الرصيد المتاح غير كافٍ.', NETWORK_ERROR: 'الشبكة غير متاحة. لم يُؤكَّد شيء؛ إعادة المحاولة تستخدم الطلب نفسه.',
    },
  },
  trade: {
    kicker: 'زوج · دفتر الأوامر', pairs: 'أزواج التداول', pairsBody: 'اختر زوجًا لعرض دفتر أوامره.', last: 'آخر سعر', book: 'دفتر الأوامر', bids: 'الشراء', asks: 'البيع', price: 'السعر', qty: 'الكمية',
    trades: 'أحدث الصفقات', noTrades: 'لا صفقات بعد', bookEmpty: 'لا أوامر معلّقة', chart: 'السعر', chartEmpty: 'لا توجد صفقات كافية لرسم المخطط.',
    buy: 'شراء', sell: 'بيع', limit: 'محدد', market: 'سوق', total: 'الإجمالي التقديري', min: 'الحد الأدنى {v}', tick: 'وحدة السعر {v}',
    place: 'إرسال الأمر', placing: 'جارٍ الإرسال…', placed: 'الأمر {s}', myOrders: 'أوامري', noOrders: 'لا أوامر على هذا الزوج', cancel: 'إلغاء', cancelling: 'جارٍ الإلغاء…', filled: 'نُفِّذ {v}',
    states: { open: 'مفتوح', partial: 'منفّذ جزئيًا', filled: 'منفّذ', cancelled: 'ملغى', rejected: 'مرفوض' },
    paused: 'التداول متوقف على هذا الزوج.', notFound: 'الزوج غير موجود', notFoundBody: 'ربما أُزيل هذا الزوج من الإدراج.', loadError: 'تعذّر تحميل بيانات السوق.',
    settlement: 'التسوية غير موصولة بعد: عمليات التنفيذ في هذا الدفتر لا تغيّر رصيدك أو مراكزك.', signIn: 'سجّل الدخول للتداول',
    errors: { qty: 'أدخل الكمية', price: 'أدخل السعر المحدد', min: 'الحد الأدنى للكمية {v}' },
    server: {
      TRADING_PAIR_INACTIVE: 'هذا الزوج غير مفتوح للتداول.', TRADING_BAD_QUANTITY: 'الكمية غير صالحة.', TRADING_BELOW_MIN: 'الكمية أقل من الحد الأدنى.', TRADING_BAD_PRICE: 'السعر غير صالح.',
      TRADING_ORDER_NOT_FOUND: 'الأمر غير موجود.', TRADING_ORDER_NOT_CANCELLABLE: 'يمكن إلغاء الأوامر المفتوحة فقط.', TRADING_PAIR_NOT_FOUND: 'الزوج غير موجود.', INVESTMENT_NOT_ELIGIBLE: 'حسابك غير مؤهل للتداول بعد.',
      NETWORK_ERROR: 'الشبكة غير متاحة. لم يُؤكَّد شيء؛ إعادة المحاولة تستخدم الطلب نفسه.',
    },
  },
  prediction: {
    kicker: 'توقّع · Polymarket', closes: 'يُغلق', volume: 'حجم 24 ساعة', liquidity: 'السيولة', history: 'سجل الاحتمال', historyEmpty: 'لا يتوفر سجل أسعار لهذا السوق.', book: 'دفتر الأوامر', rules: 'قواعد الحسم',
    stake: 'مبلغ الرهان', shares: 'الحصص التقديرية', payout: 'الأرباح التقديرية', price: 'السعر', place: 'تأكيد الرهان', placing: 'جارٍ الإرسال…', done: 'تم الرهان', doneBody: '{s} حصة بسعر {p}. تتم التسوية تلقائيًا عند الحسم.',
    feePlace: 'رسوم على الرهان ({r})', feePayout: 'رسوم على الأرباح ({r})', netPayout: 'صافي العائد عند الفوز',
    disabled: 'الرهان معطّل حاليًا. تبقى بيانات السوق ظاهرة.', notAccepting: 'السوق المصدر لا يقبل أوامر.', limit: 'حتى {v} لكل رهان', loadError: 'بيانات السوق غير متاحة حاليًا.',
    source: 'مباشر عبر Polymarket', wide: 'أفضل سعر متاح ({p}) بعيد عن احتمال السوق ({m}): دفتر الأوامر ضعيف السيولة. ستدفع أفضل سعر متاح.', partial: 'بيانات جزئية: بعض حقول الدفتر أو السجل غير متوفرة.', risk: 'أدرك أنني قد أخسر كامل مبلغ الرهان وأن السعر قد يتغير قبل التأكيد.', signIn: 'سجّل الدخول للرهان',
    toMarkets: 'العودة إلى الأسواق', toAssets: 'أصولي', noToken: 'لا يمكن الرهان على هذه النتيجة من رصيدك.',
    errors: { format: 'أدخل مبلغًا بست خانات عشرية كحد أقصى', max: 'الحد الأقصى {v}', min: 'الحد الأدنى {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: 'الرهان معطّل حاليًا.', PREDICTION_MARKET_NOT_TRADEABLE: 'هذا السوق غير متاح للرهان.', PREDICTION_PRICE_UNAVAILABLE: 'السعر غير متاح. أعد المحاولة بعد قليل.',
      PREDICTION_SLIPPAGE_EXCEEDED: 'تحرك السعر أبعد من الانزلاق المسموح. راجع السعر الجديد وأعد المحاولة.', PREDICTION_STAKE_LIMIT_EXCEEDED: 'المبلغ يتجاوز حد الرهان الواحد.', PREDICTION_DAILY_LIMIT_EXCEEDED: 'بلغت حد الرهان اليومي.',
      PREDICTION_MARKET_EXPOSURE_LIMIT: 'بلغ هذا السوق حد التعرض.', PREDICTION_INSUFFICIENT_BALANCE: 'الرصيد المتاح غير كافٍ.', INVESTMENT_NOT_ELIGIBLE: 'حسابك غير مؤهل لأسواق التوقع بعد.',
      NETWORK_ERROR: 'الشبكة غير متاحة. لم يُؤكَّد شيء؛ إعادة المحاولة تستخدم الطلب نفسه.',
    },
  },
}

const fr: TradeCopy = {
  basket: {
    kicker: 'Panier · Portefeuille géré', nav: 'VL par part', aum: 'Encours géré', units: 'Parts en circulation', min: 'Minimum', risk: 'Niveau de risque', cash: 'Coussin de trésorerie',
    status: { pilot: 'Pilote', active: 'Ouvert', other: 'Non ouvert' },
    holdings: 'Positions', noHoldings: 'Aucune position n’est encore déclarée pour ce panier.', target: 'Cible', actual: 'Réel', navHistory: 'Historique de la VL', navEmpty: 'Pas encore assez de relevés de VL pour tracer un graphique.',
    yours: 'Vos parts', subscribe: 'Souscrire', redeem: 'Racheter', signIn: 'Connectez-vous pour souscrire',
    notFound: 'Panier introuvable', notFoundBody: 'Il a peut-être été fermé ou le lien est obsolète.', loadError: 'Impossible de charger les données du panier.',
    note: 'La VL est calculée à partir des derniers prix disponibles des positions. Elle peut baisser comme monter.',
  },
  basketOrder: {
    subscribe: 'Souscrire', redeem: 'Racheter', kicker: 'Panier · Ordre', amount: 'Montant', units: 'Parts', available: 'Disponible {v}', held: 'Vous détenez {v} parts',
    estUnits: 'Parts estimées', estValue: 'Produit estimé', navAt: 'VL par part', disclosure: 'Avertissement sur les risques', ack: 'J’ai lu et j’accepte cet avertissement (version {v}).', noDisclosure: 'Aucun avertissement n’est publié pour ce panier.', readMore: 'Lire le texte complet',
    confirm: 'Confirmer la souscription', confirmRedeem: 'Confirmer le rachat', submitting: 'Envoi…', doneSub: 'Souscription réglée', doneRedeem: 'Rachat réglé',
    doneBody: '{u} parts à la VL {n}', doneRedeemBody: '{u} parts · produit {v}', duplicate: 'Cette demande a déjà été traitée. Le résultat d’origine est affiché.', toBasket: 'Retour au panier', toAssets: 'Mes actifs',
    eligibility: 'L’éligibilité et les contrôles de risque sont vérifiés par le serveur à la confirmation. Les parts finales utilisent la VL au règlement.',
    errors: { format: 'Saisissez un montant avec 6 décimales au plus', unitsFormat: 'Saisissez des parts avec 8 décimales au plus', min: 'Le minimum est {v}', balance: 'Dépasse votre solde disponible', held: 'Dépasse vos parts détenues', ack: 'Veuillez accepter l’avertissement sur les risques.' },
    server: {
      BASKET_AMOUNT_INVALID: 'Le montant n’est pas valide pour ce panier.', BASKET_UNITS_INVALID: 'Le nombre de parts n’est pas valide.', OPERATIONAL_SWITCH_DISABLED: 'Cette action est suspendue par l’opérateur.',
      INVESTMENT_NOT_ELIGIBLE: 'Votre compte n’est pas encore éligible aux nouvelles souscriptions.', BASKET_PORTFOLIO_NOT_ACTIVE: 'Ce panier n’est pas ouvert actuellement.', BASKET_DISCLOSURE_ACK_REQUIRED: 'Veuillez accepter le dernier avertissement sur les risques.',
      BASKET_RISK_BLOCKED: 'Les contrôles de risque bloquent temporairement les nouvelles souscriptions.', BASKET_NAV_UNAVAILABLE: 'La VL n’est pas encore disponible. Réessayez plus tard.', BASKET_INSUFFICIENT_UNITS: 'Parts ou trésorerie de règlement insuffisantes.',
      BASKET_PORTFOLIO_NOT_FOUND: 'Panier introuvable.', INSUFFICIENT_FUNDING: 'Solde disponible insuffisant.', NETWORK_ERROR: 'Réseau indisponible. Rien n’a été confirmé ; réessayer réutilise la même demande.',
    },
  },
  trade: {
    kicker: 'Paire · Carnet d’ordres', pairs: 'Paires de trading', pairsBody: 'Choisissez une paire pour voir son carnet d’ordres.', last: 'Dernier prix', book: 'Carnet d’ordres', bids: 'Achats', asks: 'Ventes', price: 'Prix', qty: 'Quantité',
    trades: 'Transactions récentes', noTrades: 'Aucune transaction', bookEmpty: 'Aucun ordre en attente', chart: 'Prix', chartEmpty: 'Pas encore assez d’exécutions pour tracer un graphique.',
    buy: 'Acheter', sell: 'Vendre', limit: 'Limite', market: 'Marché', total: 'Total estimé', min: 'Min. {v}', tick: 'Pas {v}',
    place: 'Passer l’ordre', placing: 'Envoi…', placed: 'Ordre {s}', myOrders: 'Mes ordres', noOrders: 'Aucun ordre sur cette paire', cancel: 'Annuler', cancelling: 'Annulation…', filled: 'Exécuté {v}',
    states: { open: 'Ouvert', partial: 'Partiel', filled: 'Exécuté', cancelled: 'Annulé', rejected: 'Rejeté' },
    paused: 'Le trading est suspendu sur cette paire.', notFound: 'Paire introuvable', notFoundBody: 'Cette paire a peut-être été retirée.', loadError: 'Impossible de charger les données de marché.',
    settlement: 'Le règlement n’est pas encore raccordé : les exécutions de ce carnet ne modifient ni votre solde ni vos positions.', signIn: 'Connectez-vous pour trader',
    errors: { qty: 'Saisissez une quantité', price: 'Saisissez un prix limite', min: 'La quantité minimale est {v}' },
    server: {
      TRADING_PAIR_INACTIVE: 'Cette paire n’est pas ouverte.', TRADING_BAD_QUANTITY: 'La quantité n’est pas valide.', TRADING_BELOW_MIN: 'La quantité est inférieure au minimum.', TRADING_BAD_PRICE: 'Le prix n’est pas valide.',
      TRADING_ORDER_NOT_FOUND: 'Ordre introuvable.', TRADING_ORDER_NOT_CANCELLABLE: 'Seuls les ordres ouverts peuvent être annulés.', TRADING_PAIR_NOT_FOUND: 'Paire introuvable.', INVESTMENT_NOT_ELIGIBLE: 'Votre compte n’est pas encore éligible au trading.',
      NETWORK_ERROR: 'Réseau indisponible. Rien n’a été confirmé ; réessayer réutilise la même demande.',
    },
  },
  prediction: {
    kicker: 'Prédiction · Polymarket', closes: 'Clôture', volume: 'Volume 24 h', liquidity: 'Liquidité', history: 'Historique de probabilité', historyEmpty: 'Aucun historique de prix pour ce marché.', book: 'Carnet d’ordres', rules: 'Règles de résolution',
    stake: 'Montant misé', shares: 'Parts estimées', payout: 'Gains estimés', price: 'Prix', place: 'Parier', placing: 'Envoi…', done: 'Pari placé', doneBody: '{s} parts à {p}. Le règlement est automatique à la résolution.',
    feePlace: 'Frais sur la mise ({r})', feePayout: 'Frais sur les gains ({r})', netPayout: 'Paiement net en cas de gain',
    disabled: 'Les paris sont désactivés. Les données restent visibles.', notAccepting: 'Le marché source n’accepte pas d’ordres.', limit: 'Jusqu’à {v} par pari', loadError: 'Les données du marché sont indisponibles.',
    source: 'En direct via Polymarket', wide: 'Le meilleur prix disponible ({p}) est loin de la probabilité du marché ({m}) : le carnet est peu profond. Vous paierez le meilleur prix disponible.', partial: 'Données partielles : certains champs du carnet ou de l’historique manquent.', risk: 'Je comprends que je peux perdre toute la mise et que le prix peut évoluer avant confirmation.', signIn: 'Connectez-vous pour parier',
    toMarkets: 'Retour aux marchés', toAssets: 'Mes actifs', noToken: 'Impossible de parier sur ce résultat avec votre solde.',
    errors: { format: 'Saisissez une mise avec 6 décimales au plus', max: 'Le maximum est {v}', min: 'Le minimum est {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: 'Les paris sont désactivés.', PREDICTION_MARKET_NOT_TRADEABLE: 'Ce marché n’accepte pas de paris.', PREDICTION_PRICE_UNAVAILABLE: 'Prix indisponible. Réessayez sous peu.',
      PREDICTION_SLIPPAGE_EXCEEDED: 'Le prix a dépassé le glissement autorisé. Vérifiez le nouveau prix et réessayez.', PREDICTION_STAKE_LIMIT_EXCEEDED: 'La mise dépasse la limite par pari.', PREDICTION_DAILY_LIMIT_EXCEEDED: 'Limite quotidienne atteinte.',
      PREDICTION_MARKET_EXPOSURE_LIMIT: 'Ce marché a atteint sa limite d’exposition.', PREDICTION_INSUFFICIENT_BALANCE: 'Solde disponible insuffisant.', INVESTMENT_NOT_ELIGIBLE: 'Votre compte n’est pas encore éligible aux marchés de prédiction.',
      NETWORK_ERROR: 'Réseau indisponible. Rien n’a été confirmé ; réessayer réutilise la même demande.',
    },
  },
}

const pt: TradeCopy = {
  basket: {
    kicker: 'Cesta · Carteira gerida', nav: 'NAV por unidade', aum: 'Ativos sob gestão', units: 'Unidades em circulação', min: 'Mínimo', risk: 'Nível de risco', cash: 'Reserva de caixa',
    status: { pilot: 'Piloto', active: 'Aberta', other: 'Não aberta' },
    holdings: 'Posições', noHoldings: 'Esta cesta ainda não reporta posições.', target: 'Alvo', actual: 'Real', navHistory: 'Histórico do NAV', navEmpty: 'Ainda não há registros de NAV suficientes para o gráfico.',
    yours: 'Suas unidades', subscribe: 'Subscrever', redeem: 'Resgatar', signIn: 'Entre para subscrever',
    notFound: 'Cesta não encontrada', notFoundBody: 'Ela pode ter sido encerrada ou o link está desatualizado.', loadError: 'Não foi possível carregar os dados da cesta.',
    note: 'O NAV é calculado com os preços mais recentes das posições. Pode cair tanto quanto subir.',
  },
  basketOrder: {
    subscribe: 'Subscrever', redeem: 'Resgatar', kicker: 'Cesta · Ordem', amount: 'Valor', units: 'Unidades', available: 'Disponível {v}', held: 'Você tem {v} unidades',
    estUnits: 'Unidades estimadas', estValue: 'Valor estimado', navAt: 'NAV por unidade', disclosure: 'Divulgação de riscos', ack: 'Li e aceito esta divulgação (versão {v}).', noDisclosure: 'Não há divulgação publicada para esta cesta.', readMore: 'Ler texto completo',
    confirm: 'Confirmar subscrição', confirmRedeem: 'Confirmar resgate', submitting: 'Enviando…', doneSub: 'Subscrição liquidada', doneRedeem: 'Resgate liquidado',
    doneBody: '{u} unidades a NAV {n}', doneRedeemBody: '{u} unidades · valor {v}', duplicate: 'Este pedido já foi processado. O resultado original é exibido.', toBasket: 'Voltar à cesta', toAssets: 'Meus ativos',
    eligibility: 'Ao confirmar, o servidor verifica elegibilidade e risco. As unidades finais usam o NAV da liquidação.',
    errors: { format: 'Informe um valor com até 6 casas decimais', unitsFormat: 'Informe unidades com até 8 casas decimais', min: 'O mínimo é {v}', balance: 'Excede seu saldo disponível', held: 'Excede suas unidades', ack: 'Aceite a divulgação de riscos.' },
    server: {
      BASKET_AMOUNT_INVALID: 'O valor não é válido para esta cesta.', BASKET_UNITS_INVALID: 'O número de unidades não é válido.', OPERATIONAL_SWITCH_DISABLED: 'Esta ação foi pausada pelo operador.',
      INVESTMENT_NOT_ELIGIBLE: 'Sua conta ainda não é elegível para novas subscrições.', BASKET_PORTFOLIO_NOT_ACTIVE: 'Esta cesta não está aberta agora.', BASKET_DISCLOSURE_ACK_REQUIRED: 'Aceite a divulgação de riscos mais recente.',
      BASKET_RISK_BLOCKED: 'Os controles de risco bloqueiam temporariamente novas subscrições.', BASKET_NAV_UNAVAILABLE: 'O NAV ainda não está disponível. Tente mais tarde.', BASKET_INSUFFICIENT_UNITS: 'Unidades ou caixa de liquidação insuficientes.',
      BASKET_PORTFOLIO_NOT_FOUND: 'Cesta não encontrada.', INSUFFICIENT_FUNDING: 'Saldo disponível insuficiente.', NETWORK_ERROR: 'Rede indisponível. Nada foi confirmado; tentar novamente reutiliza o mesmo pedido.',
    },
  },
  trade: {
    kicker: 'Par · Livro de ofertas', pairs: 'Pares de negociação', pairsBody: 'Escolha um par para ver o livro de ofertas.', last: 'Último preço', book: 'Livro de ofertas', bids: 'Compras', asks: 'Vendas', price: 'Preço', qty: 'Quantidade',
    trades: 'Negócios recentes', noTrades: 'Ainda sem negócios', bookEmpty: 'Sem ordens pendentes', chart: 'Preço', chartEmpty: 'Ainda não há execuções suficientes para o gráfico.',
    buy: 'Comprar', sell: 'Vender', limit: 'Limite', market: 'Mercado', total: 'Total estimado', min: 'Mín. {v}', tick: 'Tick {v}',
    place: 'Enviar ordem', placing: 'Enviando…', placed: 'Ordem {s}', myOrders: 'Minhas ordens', noOrders: 'Sem ordens neste par', cancel: 'Cancelar', cancelling: 'Cancelando…', filled: 'Executado {v}',
    states: { open: 'Aberta', partial: 'Parcial', filled: 'Executada', cancelled: 'Cancelada', rejected: 'Rejeitada' },
    paused: 'A negociação está pausada neste par.', notFound: 'Par não encontrado', notFoundBody: 'Este par pode ter sido deslistado.', loadError: 'Não foi possível carregar os dados de mercado.',
    settlement: 'A liquidação ainda não está conectada: execuções neste livro não alteram seu saldo nem suas posições.', signIn: 'Entre para negociar',
    errors: { qty: 'Informe a quantidade', price: 'Informe o preço limite', min: 'A quantidade mínima é {v}' },
    server: {
      TRADING_PAIR_INACTIVE: 'Este par não está aberto.', TRADING_BAD_QUANTITY: 'A quantidade não é válida.', TRADING_BELOW_MIN: 'A quantidade está abaixo do mínimo.', TRADING_BAD_PRICE: 'O preço não é válido.',
      TRADING_ORDER_NOT_FOUND: 'Ordem não encontrada.', TRADING_ORDER_NOT_CANCELLABLE: 'Só ordens abertas podem ser canceladas.', TRADING_PAIR_NOT_FOUND: 'Par não encontrado.', INVESTMENT_NOT_ELIGIBLE: 'Sua conta ainda não é elegível para negociar.',
      NETWORK_ERROR: 'Rede indisponível. Nada foi confirmado; tentar novamente reutiliza o mesmo pedido.',
    },
  },
  prediction: {
    kicker: 'Previsão · Polymarket', closes: 'Encerra', volume: 'Volume 24 h', liquidity: 'Liquidez', history: 'Histórico de probabilidade', historyEmpty: 'Não há histórico de preços para este mercado.', book: 'Livro de ofertas', rules: 'Regras de resolução',
    stake: 'Valor da aposta', shares: 'Cotas estimadas', payout: 'Ganhos estimados', price: 'Preço', place: 'Apostar', placing: 'Enviando…', done: 'Aposta feita', doneBody: '{s} cotas a {p}. A liquidação é automática na resolução.',
    feePlace: 'Taxa sobre a aposta ({r})', feePayout: 'Taxa sobre os ganhos ({r})', netPayout: 'Pagamento líquido se ganhar',
    disabled: 'As apostas estão desativadas. Os dados continuam visíveis.', notAccepting: 'O mercado de origem não aceita ordens.', limit: 'Até {v} por aposta', loadError: 'Os dados do mercado estão indisponíveis.',
    source: 'Ao vivo via Polymarket', wide: 'O melhor preço disponível ({p}) está longe da probabilidade do mercado ({m}): o livro tem pouca profundidade. Você pagará o melhor preço disponível.', partial: 'Dados parciais: faltam campos do livro ou do histórico.', risk: 'Entendo que posso perder toda a aposta e que o preço pode mudar antes da confirmação.', signIn: 'Entre para apostar',
    toMarkets: 'Voltar aos mercados', toAssets: 'Meus ativos', noToken: 'Não é possível apostar com saldo neste resultado.',
    errors: { format: 'Informe uma aposta com até 6 casas decimais', max: 'O máximo é {v}', min: 'O mínimo é {v}' },
    server: {
      PREDICTION_BETTING_DISABLED: 'As apostas estão desativadas.', PREDICTION_MARKET_NOT_TRADEABLE: 'Este mercado não aceita apostas.', PREDICTION_PRICE_UNAVAILABLE: 'Preço indisponível. Tente em instantes.',
      PREDICTION_SLIPPAGE_EXCEEDED: 'O preço ultrapassou o deslizamento permitido. Revise o novo preço e tente novamente.', PREDICTION_STAKE_LIMIT_EXCEEDED: 'A aposta excede o limite por operação.', PREDICTION_DAILY_LIMIT_EXCEEDED: 'Limite diário atingido.',
      PREDICTION_MARKET_EXPOSURE_LIMIT: 'Este mercado atingiu o limite de exposição.', PREDICTION_INSUFFICIENT_BALANCE: 'Saldo disponível insuficiente.', INVESTMENT_NOT_ELIGIBLE: 'Sua conta ainda não é elegível para mercados de previsão.',
      NETWORK_ERROR: 'Rede indisponível. Nada foi confirmado; tentar novamente reutiliza o mesmo pedido.',
    },
  },
}

export const tradeCopy: Record<AppLocale, TradeCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
