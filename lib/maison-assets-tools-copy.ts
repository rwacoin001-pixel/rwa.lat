import type { AppLocale } from '@/lib/app-locales'

/**
 * Asset tools copy: statements, yield calendar, rebalance, recurring and position redemption.
 * `{x}` tokens go through fill(). Month and weekday names come from Intl, not from here.
 */
export type AssetToolsCopy = {
  statements: {
    kicker: string; title: string; lede: string; month: string; noMonths: string; noMonthsBody: string
    inflow: string; outflow: string; net: string; entries: string; byType: string; byTypeNote: string; lines: string
    export: string; exportNote: string; partial: string; partialBody: string; scope: string; tz: string
    official: string; officialBody: string
  }
  calendar: {
    kicker: string; title: string; lede: string; prev: string; next: string; monthTotal: string; allTime: string; credits: string
    byProduct: string; list: string; listDay: string; wholeMonth: string; empty: string; emptyBody: string; none: string; noneBody: string
    open: string; openNote: string; upcoming: string; upcomingBody: string; period: string; credited: string
    states: Record<'pending' | 'credited' | 'failed', string>
  }
  rebalance: {
    kicker: string; title: string; lede: string; total: string; current: string; target: string; delta: string
    buy: string; sell: string; hold: string; sum: string; sumOff: string; equal: string; reset: string
    reference: string; unpriced: string; execute: string; executeBody: string; needTwo: string; needTwoBody: string; open: string; targetFor: string
  }
  recurring: { kicker: string; title: string; lede: string; unavailable: string; unavailableBody: string; nothing: string; markets: string; assets: string }
  redeem: {
    action: string; kicker: string; title: string; held: string; inRequests: string; redeemable: string; qty: string
    estimate: string; price: string; consent: string; submit: string; submitting: string; close: string
    done: string; doneBody: string; list: string; listNote: string; empty: string; requested: string; estAt: string
    cancel: string; confirmCancel: string; cancelling: string; invalid: string; over: string; nothing: string; noQuote: string
    states: Record<'requested' | 'queued' | 'executing' | 'completed' | 'failed' | 'canceled', string>
    errors: Record<string, string>
  }
}

const en: AssetToolsCopy = {
  statements: {
    kicker: 'Records', title: 'Statements', lede: 'Monthly summary of your ledger activity, with an exact CSV export.', month: 'Month', noMonths: 'No ledger activity yet', noMonthsBody: 'Months appear here once your account has ledger entries.',
    inflow: 'In', outflow: 'Out', net: 'Net', entries: 'Entries', byType: 'By type', byTypeNote: 'Change in available balance', lines: 'Entries',
    export: 'Export CSV', exportNote: 'Exact atomic amounts, one line per ledger entry, for the selected month.', partial: 'Partial month', partialBody: 'The ledger returns at most {n} entries, so earlier activity in this month may be missing.',
    scope: 'Built from your latest {n} ledger entries.', tz: 'Months follow your device time zone.',
    official: 'Official statements are not available', officialBody: 'There is no statement service yet: no signed PDF and no opening or closing balances. This page summarises ledger activity only.',
  },
  calendar: {
    kicker: 'Income', title: 'Yield calendar', lede: 'Distributions credited to your account, by the day they arrived.', prev: 'Previous month', next: 'Next month', monthTotal: 'This month', allTime: 'All credited', credits: 'Credits',
    byProduct: 'By product', list: 'Credits', listDay: 'Credits on {d}', wholeMonth: 'Whole month', empty: 'No credits this month', emptyBody: 'Use the arrows to see other months.', none: 'No income yet', noneBody: 'Distributions appear here once they are credited to your account.',
    open: 'Not credited', openNote: 'Pending or failed allocations; not in the totals.', upcoming: 'Upcoming distributions are not available', upcomingBody: 'There is no distribution schedule service yet, so future payment dates are not shown.', period: 'Period', credited: 'Credited',
    states: { pending: 'Pending', credited: 'Credited', failed: 'Failed' },
  },
  rebalance: {
    kicker: 'Tools', title: 'Rebalance', lede: 'Set target weights and see the reference change for each position.', total: 'Priced positions', current: 'Current', target: 'Target', delta: 'Reference change',
    buy: 'Add', sell: 'Reduce', hold: 'No change', sum: 'Targets total {v}', sumOff: 'Targets must add up to 100%.', equal: 'Equal weight', reset: 'Reset to current',
    reference: 'Reference estimate from latest quotes; fees and minimums are checked again during execution. Sells and buys require separate confirmation.', unpriced: '{n} position(s) without a quote are excluded.',
    execute: 'Rebalancing cannot be executed here', executeBody: 'There is no rebalance service for individual portfolios yet, so nothing is submitted from this page. Use Invest more or Redeem on each position.',
    needTwo: 'Needs at least two priced positions', needTwoBody: 'Rebalancing compares weights across positions.', open: 'Open position', targetFor: 'Target weight for {n}',
  },
  recurring: {
    kicker: 'Tools', title: 'Recurring investment', lede: 'Automatic investments on a schedule.', unavailable: 'Recurring investment is not available yet',
    unavailableBody: 'There is no scheduling service for automatic investments yet. You can still invest manually in any listed product.', nothing: 'Nothing is scheduled and no funds are reserved.', markets: 'Browse markets', assets: 'My assets',
  },
  redeem: {
    action: 'Redeem', kicker: 'Redemption request', title: 'Redeem', held: 'Held', inRequests: 'In open requests', redeemable: 'Redeemable', qty: 'Quantity',
    estimate: 'Estimated proceeds', price: 'Latest quote', consent: 'I understand this records a request. The payout uses the price at completion and may differ from this estimate. I can cancel while it is requested or queued.',
    submit: 'Submit request', submitting: 'Submitting…', close: 'Close', done: 'Request recorded', doneBody: 'State: {s}. Proceeds are credited to available cash when the request completes.',
    list: 'Redemption requests', listNote: 'For this product', empty: 'No redemption requests', requested: 'Requested {t}', estAt: 'Est. price {v}',
    cancel: 'Cancel', confirmCancel: 'Confirm cancel', cancelling: 'Cancelling…', invalid: 'Enter a quantity above 0 with at most {n} decimals.', over: 'More than the redeemable quantity.',
    nothing: 'Nothing left to redeem: open requests already cover your holding.', noQuote: 'No current quote, so the estimate is unavailable.',
    states: { requested: 'Requested', queued: 'Queued', executing: 'Executing', completed: 'Completed', failed: 'Failed', canceled: 'Cancelled' },
    errors: { PRODUCT_NOT_FOUND: 'This product no longer exists.', QUOTE_STALE: 'No current quote for this product; try again later.', REDEMPTION_NOT_FOUND: 'Request not found.', REDEMPTION_STATE_INVALID: 'This request can no longer be cancelled.' },
  },
}

const zh: AssetToolsCopy = {
  statements: {
    kicker: '记录', title: '对账单', lede: '按月汇总账本流水，可导出精确 CSV。', month: '月份', noMonths: '暂无账本流水', noMonthsBody: '账户产生账本记录后，这里会按月显示。',
    inflow: '流入', outflow: '流出', net: '净额', entries: '条目', byType: '按类型', byTypeNote: '可用余额变动', lines: '流水明细',
    export: '导出 CSV', exportNote: '所选月份，每条账本分录一行，金额为精确原子单位。', partial: '月份不完整', partialBody: '账本接口最多返回 {n} 条，本月更早的记录可能未包含。',
    scope: '基于最近 {n} 条账本记录。', tz: '月份按本机时区划分。',
    official: '暂不提供正式对账单', officialBody: '目前没有对账单服务：没有签章 PDF，也没有期初/期末余额。本页只汇总账本流水。',
  },
  calendar: {
    kicker: '收益', title: '收益日历', lede: '已入账的收益分配，按到账日期显示。', prev: '上个月', next: '下个月', monthTotal: '本月', allTime: '累计入账', credits: '笔数',
    byProduct: '按产品', list: '入账记录', listDay: '{d} 入账', wholeMonth: '整月', empty: '本月没有入账', emptyBody: '可用箭头查看其他月份。', none: '暂无收益', noneBody: '收益分配入账后会显示在这里。',
    open: '未入账', openNote: '待处理或失败的分配，不计入合计。', upcoming: '暂不提供未来派息计划', upcomingBody: '目前没有派息计划接口，因此不显示未来的派息日期。', period: '计息期', credited: '入账',
    states: { pending: '待入账', credited: '已入账', failed: '失败' },
  },
  rebalance: {
    kicker: '工具', title: '再平衡', lede: '设置目标权重，查看每个持仓的参考调整额。', total: '有报价持仓', current: '当前', target: '目标', delta: '参考调整',
    buy: '增加', sell: '减少', hold: '不变', sum: '目标合计 {v}', sumOff: '目标权重合计必须为 100%。', equal: '等权', reset: '恢复当前',
    reference: '参考调整额按最新报价计算；费用和最低额会在执行时再次校验。卖出与买入分两次确认。', unpriced: '{n} 个无报价持仓未计入。',
    execute: '无法在此执行再平衡', executeBody: '目前没有面向个人组合的再平衡服务，本页不会提交任何操作。请在各持仓页使用"追加申购"或"赎回"。',
    needTwo: '至少需要两个有报价的持仓', needTwoBody: '再平衡需要在多个持仓之间比较权重。', open: '查看持仓', targetFor: '{n} 的目标权重',
  },
  recurring: {
    kicker: '工具', title: '定投', lede: '按计划自动投资。', unavailable: '定投功能暂未开放',
    unavailableBody: '目前没有自动投资的计划服务。你仍可以手动申购任意在售产品。', nothing: '没有任何计划，也没有冻结资金。', markets: '浏览市场', assets: '我的资产',
  },
  redeem: {
    action: '赎回', kicker: '赎回申请', title: '赎回', held: '持有', inRequests: '申请中', redeemable: '可赎回', qty: '数量',
    estimate: '预估到账', price: '最新报价', consent: '我了解这是提交一笔赎回申请。到账金额按完成时的价格计算，可能与预估不同；申请处于"已申请/排队中"时可以撤销。',
    submit: '提交赎回申请', submitting: '提交中…', close: '关闭', done: '申请已记录', doneBody: '状态：{s}。申请完成后，款项计入可用现金。',
    list: '赎回申请', listNote: '本产品', empty: '暂无赎回申请', requested: '申请于 {t}', estAt: '预估价 {v}',
    cancel: '撤销', confirmCancel: '确认撤销', cancelling: '撤销中…', invalid: '请输入大于 0 的数量，最多 {n} 位小数。', over: '超过可赎回数量。',
    nothing: '没有可赎回数量：进行中的申请已覆盖全部持有。', noQuote: '暂无最新报价，无法预估。',
    states: { requested: '已申请', queued: '排队中', executing: '执行中', completed: '已完成', failed: '失败', canceled: '已撤销' },
    errors: { PRODUCT_NOT_FOUND: '该产品已不存在。', QUOTE_STALE: '该产品暂无有效报价，请稍后再试。', REDEMPTION_NOT_FOUND: '未找到该申请。', REDEMPTION_STATE_INVALID: '该申请已无法撤销。' },
  },
}

const hi: AssetToolsCopy = {
  statements: {
    kicker: 'रिकॉर्ड', title: 'विवरण', lede: 'आपकी लेजर गतिविधि का मासिक सारांश, सटीक CSV निर्यात के साथ।', month: 'महीना', noMonths: 'अभी कोई लेजर गतिविधि नहीं', noMonthsBody: 'खाते में लेजर प्रविष्टियाँ आने पर महीने यहाँ दिखेंगे।',
    inflow: 'आवक', outflow: 'जावक', net: 'शुद्ध', entries: 'प्रविष्टियाँ', byType: 'प्रकार के अनुसार', byTypeNote: 'उपलब्ध शेष में बदलाव', lines: 'प्रविष्टियाँ',
    export: 'CSV निर्यात', exportNote: 'चुने गए महीने के लिए, हर लेजर प्रविष्टि एक पंक्ति, सटीक एटॉमिक राशि।', partial: 'अधूरा महीना', partialBody: 'लेजर अधिकतम {n} प्रविष्टियाँ लौटाता है, इसलिए इस महीने की पुरानी गतिविधि छूट सकती है।',
    scope: 'आपकी नवीनतम {n} लेजर प्रविष्टियों से बना।', tz: 'महीने आपके डिवाइस के समय क्षेत्र के अनुसार हैं।',
    official: 'आधिकारिक विवरण उपलब्ध नहीं', officialBody: 'अभी कोई विवरण सेवा नहीं है: न हस्ताक्षरित PDF, न आरंभिक या अंतिम शेष। यह पृष्ठ केवल लेजर गतिविधि का सारांश है।',
  },
  calendar: {
    kicker: 'आय', title: 'आय कैलेंडर', lede: 'आपके खाते में जमा वितरण, जमा होने के दिन के अनुसार।', prev: 'पिछला महीना', next: 'अगला महीना', monthTotal: 'इस महीने', allTime: 'कुल जमा', credits: 'जमा',
    byProduct: 'उत्पाद के अनुसार', list: 'जमा', listDay: '{d} को जमा', wholeMonth: 'पूरा महीना', empty: 'इस महीने कोई जमा नहीं', emptyBody: 'अन्य महीने देखने के लिए तीरों का उपयोग करें।', none: 'अभी कोई आय नहीं', noneBody: 'वितरण खाते में जमा होने पर यहाँ दिखेंगे।',
    open: 'जमा नहीं हुआ', openNote: 'लंबित या विफल आवंटन; योग में शामिल नहीं।', upcoming: 'आगामी वितरण उपलब्ध नहीं', upcomingBody: 'अभी कोई वितरण अनुसूची सेवा नहीं है, इसलिए भविष्य की भुगतान तिथियाँ नहीं दिखाई जातीं।', period: 'अवधि', credited: 'जमा',
    states: { pending: 'लंबित', credited: 'जमा', failed: 'विफल' },
  },
  rebalance: {
    kicker: 'टूल', title: 'पुनर्संतुलन', lede: 'लक्ष्य भार तय करें और हर पोज़िशन का संदर्भ बदलाव देखें।', total: 'कोट वाली पोज़िशन', current: 'वर्तमान', target: 'लक्ष्य', delta: 'संदर्भ बदलाव',
    buy: 'बढ़ाएँ', sell: 'घटाएँ', hold: 'कोई बदलाव नहीं', sum: 'लक्ष्य कुल {v}', sumOff: 'लक्ष्यों का योग 100% होना चाहिए।', equal: 'समान भार', reset: 'वर्तमान पर लौटें',
    reference: 'संदर्भ अनुमान नवीनतम कोट पर है; शुल्क और न्यूनतम निष्पादन के समय फिर जाँचे जाते हैं। बिक्री और खरीद की अलग पुष्टि होती है।', unpriced: 'बिना कोट की {n} पोज़िशन शामिल नहीं हैं।',
    execute: 'यहाँ पुनर्संतुलन निष्पादित नहीं हो सकता', executeBody: 'व्यक्तिगत पोर्टफोलियो के लिए अभी कोई पुनर्संतुलन सेवा नहीं है, इसलिए इस पृष्ठ से कुछ भी सबमिट नहीं होता। हर पोज़िशन पर "और निवेश करें" या "रिडीम" का उपयोग करें।',
    needTwo: 'कम से कम दो कोट वाली पोज़िशन चाहिए', needTwoBody: 'पुनर्संतुलन पोज़िशनों के बीच भार की तुलना करता है।', open: 'पोज़िशन खोलें', targetFor: '{n} का लक्ष्य भार',
  },
  recurring: {
    kicker: 'टूल', title: 'आवर्ती निवेश', lede: 'अनुसूची पर स्वचालित निवेश।', unavailable: 'आवर्ती निवेश अभी उपलब्ध नहीं',
    unavailableBody: 'स्वचालित निवेश के लिए अभी कोई अनुसूची सेवा नहीं है। आप किसी भी सूचीबद्ध उत्पाद में मैन्युअल रूप से निवेश कर सकते हैं।', nothing: 'कुछ भी निर्धारित नहीं है और कोई राशि आरक्षित नहीं है।', markets: 'बाज़ार देखें', assets: 'मेरी संपत्तियाँ',
  },
  redeem: {
    action: 'रिडीम', kicker: 'रिडेम्पशन अनुरोध', title: 'रिडीम', held: 'धारित', inRequests: 'खुले अनुरोधों में', redeemable: 'रिडीम योग्य', qty: 'मात्रा',
    estimate: 'अनुमानित प्राप्ति', price: 'नवीनतम कोट', consent: 'मैं समझता/समझती हूँ कि यह एक अनुरोध दर्ज करता है। भुगतान पूरा होने के समय की कीमत पर होगा और अनुमान से अलग हो सकता है। अनुरोधित या कतार में रहते हुए मैं इसे रद्द कर सकता/सकती हूँ।',
    submit: 'अनुरोध सबमिट करें', submitting: 'सबमिट हो रहा है…', close: 'बंद करें', done: 'अनुरोध दर्ज हुआ', doneBody: 'स्थिति: {s}। अनुरोध पूरा होने पर राशि उपलब्ध नकद में जमा होगी।',
    list: 'रिडेम्पशन अनुरोध', listNote: 'इस उत्पाद के लिए', empty: 'कोई रिडेम्पशन अनुरोध नहीं', requested: '{t} को अनुरोधित', estAt: 'अनु. मूल्य {v}',
    cancel: 'रद्द करें', confirmCancel: 'रद्द करने की पुष्टि करें', cancelling: 'रद्द हो रहा है…', invalid: '0 से अधिक मात्रा दर्ज करें, अधिकतम {n} दशमलव।', over: 'रिडीम योग्य मात्रा से अधिक।',
    nothing: 'रिडीम के लिए कुछ नहीं बचा: खुले अनुरोध पूरी होल्डिंग को कवर करते हैं।', noQuote: 'कोई वर्तमान कोट नहीं, इसलिए अनुमान उपलब्ध नहीं।',
    states: { requested: 'अनुरोधित', queued: 'कतार में', executing: 'निष्पादित हो रहा', completed: 'पूर्ण', failed: 'विफल', canceled: 'रद्द' },
    errors: { PRODUCT_NOT_FOUND: 'यह उत्पाद अब मौजूद नहीं है।', QUOTE_STALE: 'इस उत्पाद का कोई वर्तमान कोट नहीं; बाद में पुनः प्रयास करें।', REDEMPTION_NOT_FOUND: 'अनुरोध नहीं मिला।', REDEMPTION_STATE_INVALID: 'यह अनुरोध अब रद्द नहीं किया जा सकता।' },
  },
}

const es: AssetToolsCopy = {
  statements: {
    kicker: 'Registros', title: 'Extractos', lede: 'Resumen mensual de la actividad de tu libro mayor, con exportación CSV exacta.', month: 'Mes', noMonths: 'Aún no hay actividad en el libro mayor', noMonthsBody: 'Los meses aparecen aquí cuando tu cuenta tiene asientos.',
    inflow: 'Entradas', outflow: 'Salidas', net: 'Neto', entries: 'Asientos', byType: 'Por tipo', byTypeNote: 'Cambio en el saldo disponible', lines: 'Asientos',
    export: 'Exportar CSV', exportNote: 'Importes atómicos exactos, una línea por asiento, del mes seleccionado.', partial: 'Mes parcial', partialBody: 'El libro mayor devuelve como máximo {n} asientos; puede faltar actividad anterior de este mes.',
    scope: 'Basado en tus últimos {n} asientos.', tz: 'Los meses siguen la zona horaria de tu dispositivo.',
    official: 'Los extractos oficiales no están disponibles', officialBody: 'Aún no hay servicio de extractos: sin PDF firmado ni saldos de apertura o cierre. Esta página solo resume la actividad del libro mayor.',
  },
  calendar: {
    kicker: 'Ingresos', title: 'Calendario de rendimientos', lede: 'Distribuciones abonadas en tu cuenta, por el día en que llegaron.', prev: 'Mes anterior', next: 'Mes siguiente', monthTotal: 'Este mes', allTime: 'Total abonado', credits: 'Abonos',
    byProduct: 'Por producto', list: 'Abonos', listDay: 'Abonos del {d}', wholeMonth: 'Todo el mes', empty: 'Sin abonos este mes', emptyBody: 'Usa las flechas para ver otros meses.', none: 'Aún no hay ingresos', noneBody: 'Las distribuciones aparecen aquí cuando se abonan en tu cuenta.',
    open: 'No abonado', openNote: 'Asignaciones pendientes o fallidas; no se suman.', upcoming: 'Las próximas distribuciones no están disponibles', upcomingBody: 'Aún no hay servicio de calendario de distribuciones, así que no se muestran fechas futuras de pago.', period: 'Periodo', credited: 'Abonado',
    states: { pending: 'Pendiente', credited: 'Abonado', failed: 'Fallido' },
  },
  rebalance: {
    kicker: 'Herramientas', title: 'Rebalanceo', lede: 'Define pesos objetivo y consulta el cambio de referencia de cada posición.', total: 'Posiciones cotizadas', current: 'Actual', target: 'Objetivo', delta: 'Cambio de referencia',
    buy: 'Aumentar', sell: 'Reducir', hold: 'Sin cambio', sum: 'Objetivos suman {v}', sumOff: 'Los objetivos deben sumar 100 %.', equal: 'Pesos iguales', reset: 'Volver al actual',
    reference: 'Estimación con las últimas cotizaciones; las comisiones y mínimos se validan al ejecutar. Ventas y compras se confirman por separado.', unpriced: 'Se excluyen {n} posición(es) sin cotización.',
    execute: 'El rebalanceo no se puede ejecutar aquí', executeBody: 'Aún no hay servicio de rebalanceo para carteras individuales, así que no se envía nada desde esta página. Usa Invertir más o Rescatar en cada posición.',
    needTwo: 'Se necesitan al menos dos posiciones cotizadas', needTwoBody: 'El rebalanceo compara pesos entre posiciones.', open: 'Abrir posición', targetFor: 'Peso objetivo de {n}',
  },
  recurring: {
    kicker: 'Herramientas', title: 'Inversión periódica', lede: 'Inversiones automáticas según un calendario.', unavailable: 'La inversión periódica aún no está disponible',
    unavailableBody: 'Aún no hay servicio de programación para inversiones automáticas. Puedes seguir invirtiendo manualmente en cualquier producto listado.', nothing: 'No hay nada programado ni fondos reservados.', markets: 'Ver mercados', assets: 'Mis activos',
  },
  redeem: {
    action: 'Rescatar', kicker: 'Solicitud de rescate', title: 'Rescatar', held: 'En cartera', inRequests: 'En solicitudes abiertas', redeemable: 'Rescatable', qty: 'Cantidad',
    estimate: 'Importe estimado', price: 'Última cotización', consent: 'Entiendo que esto registra una solicitud. El pago usa el precio al completarse y puede diferir de esta estimación. Puedo cancelarla mientras esté solicitada o en cola.',
    submit: 'Enviar solicitud', submitting: 'Enviando…', close: 'Cerrar', done: 'Solicitud registrada', doneBody: 'Estado: {s}. El importe se abona al efectivo disponible cuando se completa la solicitud.',
    list: 'Solicitudes de rescate', listNote: 'De este producto', empty: 'Sin solicitudes de rescate', requested: 'Solicitado {t}', estAt: 'Precio est. {v}',
    cancel: 'Cancelar', confirmCancel: 'Confirmar cancelación', cancelling: 'Cancelando…', invalid: 'Introduce una cantidad mayor que 0 con {n} decimales como máximo.', over: 'Supera la cantidad rescatable.',
    nothing: 'No queda nada por rescatar: las solicitudes abiertas cubren toda tu posición.', noQuote: 'Sin cotización actual; no hay estimación.',
    states: { requested: 'Solicitado', queued: 'En cola', executing: 'En ejecución', completed: 'Completado', failed: 'Fallido', canceled: 'Cancelado' },
    errors: { PRODUCT_NOT_FOUND: 'Este producto ya no existe.', QUOTE_STALE: 'No hay cotización actual para este producto; inténtalo más tarde.', REDEMPTION_NOT_FOUND: 'Solicitud no encontrada.', REDEMPTION_STATE_INVALID: 'Esta solicitud ya no se puede cancelar.' },
  },
}

const ar: AssetToolsCopy = {
  statements: {
    kicker: 'السجلات', title: 'الكشوف', lede: 'ملخص شهري لنشاط دفتر الأستاذ، مع تصدير CSV دقيق.', month: 'الشهر', noMonths: 'لا يوجد نشاط في دفتر الأستاذ بعد', noMonthsBody: 'تظهر الأشهر هنا بمجرد وجود قيود في حسابك.',
    inflow: 'وارد', outflow: 'صادر', net: 'الصافي', entries: 'القيود', byType: 'حسب النوع', byTypeNote: 'التغير في الرصيد المتاح', lines: 'القيود',
    export: 'تصدير CSV', exportNote: 'مبالغ ذرية دقيقة، سطر لكل قيد، للشهر المحدد.', partial: 'شهر غير مكتمل', partialBody: 'يعيد دفتر الأستاذ {n} قيدًا كحد أقصى، لذا قد يكون النشاط الأقدم في هذا الشهر مفقودًا.',
    scope: 'مبني على آخر {n} قيدًا في دفترك.', tz: 'تتبع الأشهر المنطقة الزمنية لجهازك.',
    official: 'الكشوف الرسمية غير متاحة', officialBody: 'لا توجد خدمة كشوف بعد: لا ملف PDF موقّع ولا أرصدة افتتاحية أو ختامية. تلخّص هذه الصفحة نشاط دفتر الأستاذ فقط.',
  },
  calendar: {
    kicker: 'الدخل', title: 'تقويم العوائد', lede: 'التوزيعات المضافة إلى حسابك، حسب يوم وصولها.', prev: 'الشهر السابق', next: 'الشهر التالي', monthTotal: 'هذا الشهر', allTime: 'إجمالي المُضاف', credits: 'الإضافات',
    byProduct: 'حسب المنتج', list: 'الإضافات', listDay: 'إضافات {d}', wholeMonth: 'الشهر كاملًا', empty: 'لا إضافات هذا الشهر', emptyBody: 'استخدم الأسهم لعرض أشهر أخرى.', none: 'لا يوجد دخل بعد', noneBody: 'تظهر التوزيعات هنا بمجرد إضافتها إلى حسابك.',
    open: 'غير مُضاف', openNote: 'تخصيصات معلقة أو فاشلة؛ غير محتسبة في الإجماليات.', upcoming: 'التوزيعات القادمة غير متاحة', upcomingBody: 'لا توجد خدمة جدول توزيعات بعد، لذا لا تُعرض تواريخ الدفع المستقبلية.', period: 'الفترة', credited: 'أُضيف',
    states: { pending: 'معلّق', credited: 'مُضاف', failed: 'فشل' },
  },
  rebalance: {
    kicker: 'الأدوات', title: 'إعادة التوازن', lede: 'حدّد الأوزان المستهدفة واطّلع على التغيير المرجعي لكل مركز.', total: 'المراكز المسعّرة', current: 'الحالي', target: 'المستهدف', delta: 'التغيير المرجعي',
    buy: 'زيادة', sell: 'تخفيض', hold: 'بلا تغيير', sum: 'مجموع الأهداف {v}', sumOff: 'يجب أن يكون مجموع الأهداف 100٪.', equal: 'أوزان متساوية', reset: 'العودة إلى الحالي',
    reference: 'تقدير مرجعي بآخر الأسعار؛ تُراجع الرسوم والحدود الدنيا عند التنفيذ. يتطلب البيع والشراء تأكيدين منفصلين.', unpriced: 'استُبعد {n} مركز بلا تسعير.',
    execute: 'لا يمكن تنفيذ إعادة التوازن هنا', executeBody: 'لا توجد خدمة إعادة توازن للمحافظ الفردية بعد، لذا لا يُرسل شيء من هذه الصفحة. استخدم «استثمر المزيد» أو «استرداد» في كل مركز.',
    needTwo: 'يلزم مركزان مسعّران على الأقل', needTwoBody: 'تقارن إعادة التوازن الأوزان بين المراكز.', open: 'فتح المركز', targetFor: 'الوزن المستهدف لـ {n}',
  },
  recurring: {
    kicker: 'الأدوات', title: 'الاستثمار الدوري', lede: 'استثمارات تلقائية وفق جدول.', unavailable: 'الاستثمار الدوري غير متاح بعد',
    unavailableBody: 'لا توجد خدمة جدولة للاستثمارات التلقائية بعد. لا يزال بإمكانك الاستثمار يدويًا في أي منتج مُدرج.', nothing: 'لا شيء مجدول ولا أموال محجوزة.', markets: 'تصفح الأسواق', assets: 'أصولي',
  },
  redeem: {
    action: 'استرداد', kicker: 'طلب استرداد', title: 'استرداد', held: 'المملوك', inRequests: 'في طلبات مفتوحة', redeemable: 'قابل للاسترداد', qty: 'الكمية',
    estimate: 'العائد التقديري', price: 'آخر سعر', consent: 'أفهم أن هذا يسجّل طلبًا. يُحتسب المبلغ بسعر الإتمام وقد يختلف عن هذا التقدير. يمكنني الإلغاء ما دام الطلب مقدّمًا أو في الانتظار.',
    submit: 'إرسال الطلب', submitting: 'جارٍ الإرسال…', close: 'إغلاق', done: 'تم تسجيل الطلب', doneBody: 'الحالة: {s}. يُضاف المبلغ إلى النقد المتاح عند اكتمال الطلب.',
    list: 'طلبات الاسترداد', listNote: 'لهذا المنتج', empty: 'لا طلبات استرداد', requested: 'قُدّم {t}', estAt: 'سعر تقديري {v}',
    cancel: 'إلغاء', confirmCancel: 'تأكيد الإلغاء', cancelling: 'جارٍ الإلغاء…', invalid: 'أدخل كمية أكبر من 0 بحد أقصى {n} منازل عشرية.', over: 'أكثر من الكمية القابلة للاسترداد.',
    nothing: 'لم يتبقَّ شيء للاسترداد: الطلبات المفتوحة تغطي كامل حيازتك.', noQuote: 'لا يوجد سعر حالي، لذا التقدير غير متاح.',
    states: { requested: 'مقدَّم', queued: 'في الانتظار', executing: 'قيد التنفيذ', completed: 'مكتمل', failed: 'فشل', canceled: 'ملغى' },
    errors: { PRODUCT_NOT_FOUND: 'هذا المنتج لم يعد موجودًا.', QUOTE_STALE: 'لا يوجد سعر حالي لهذا المنتج؛ حاول لاحقًا.', REDEMPTION_NOT_FOUND: 'الطلب غير موجود.', REDEMPTION_STATE_INVALID: 'لم يعد بالإمكان إلغاء هذا الطلب.' },
  },
}

const fr: AssetToolsCopy = {
  statements: {
    kicker: 'Registres', title: 'Relevés', lede: 'Synthèse mensuelle de l’activité de votre grand livre, avec export CSV exact.', month: 'Mois', noMonths: 'Aucune activité au grand livre', noMonthsBody: 'Les mois apparaissent ici dès que votre compte a des écritures.',
    inflow: 'Entrées', outflow: 'Sorties', net: 'Net', entries: 'Écritures', byType: 'Par type', byTypeNote: 'Variation du solde disponible', lines: 'Écritures',
    export: 'Exporter CSV', exportNote: 'Montants atomiques exacts, une ligne par écriture, pour le mois choisi.', partial: 'Mois partiel', partialBody: 'Le grand livre renvoie au plus {n} écritures ; l’activité plus ancienne de ce mois peut manquer.',
    scope: 'Établi à partir de vos {n} dernières écritures.', tz: 'Les mois suivent le fuseau horaire de votre appareil.',
    official: 'Relevés officiels indisponibles', officialBody: 'Il n’existe pas encore de service de relevés : ni PDF signé, ni soldes d’ouverture ou de clôture. Cette page résume uniquement l’activité du grand livre.',
  },
  calendar: {
    kicker: 'Revenus', title: 'Calendrier des rendements', lede: 'Distributions créditées sur votre compte, par jour de réception.', prev: 'Mois précédent', next: 'Mois suivant', monthTotal: 'Ce mois', allTime: 'Total crédité', credits: 'Crédits',
    byProduct: 'Par produit', list: 'Crédits', listDay: 'Crédits du {d}', wholeMonth: 'Tout le mois', empty: 'Aucun crédit ce mois-ci', emptyBody: 'Utilisez les flèches pour voir d’autres mois.', none: 'Aucun revenu pour l’instant', noneBody: 'Les distributions apparaissent ici une fois créditées sur votre compte.',
    open: 'Non crédité', openNote: 'Allocations en attente ou échouées ; exclues des totaux.', upcoming: 'Distributions à venir indisponibles', upcomingBody: 'Il n’existe pas encore de calendrier de distributions ; les dates de paiement futures ne sont pas affichées.', period: 'Période', credited: 'Crédité',
    states: { pending: 'En attente', credited: 'Crédité', failed: 'Échoué' },
  },
  rebalance: {
    kicker: 'Outils', title: 'Rééquilibrage', lede: 'Fixez des pondérations cibles et voyez la variation de référence de chaque position.', total: 'Positions cotées', current: 'Actuel', target: 'Cible', delta: 'Variation de référence',
    buy: 'Renforcer', sell: 'Alléger', hold: 'Inchangé', sum: 'Total des cibles {v}', sumOff: 'Les cibles doivent totaliser 100 %.', equal: 'Pondération égale', reset: 'Revenir à l’actuel',
    reference: 'Estimation selon les dernières cotations ; frais et minimums sont revérifiés à l’exécution. Ventes et achats sont confirmés séparément.', unpriced: '{n} position(s) sans cotation exclue(s).',
    execute: 'Le rééquilibrage ne peut pas être exécuté ici', executeBody: 'Il n’existe pas encore de service de rééquilibrage pour les portefeuilles individuels ; rien n’est envoyé depuis cette page. Utilisez Investir davantage ou Racheter sur chaque position.',
    needTwo: 'Au moins deux positions cotées sont nécessaires', needTwoBody: 'Le rééquilibrage compare les pondérations entre positions.', open: 'Ouvrir la position', targetFor: 'Pondération cible de {n}',
  },
  recurring: {
    kicker: 'Outils', title: 'Investissement programmé', lede: 'Investissements automatiques selon un calendrier.', unavailable: 'L’investissement programmé n’est pas encore disponible',
    unavailableBody: 'Il n’existe pas encore de service de planification pour les investissements automatiques. Vous pouvez toujours investir manuellement dans tout produit listé.', nothing: 'Rien n’est programmé et aucun fonds n’est réservé.', markets: 'Voir les marchés', assets: 'Mes actifs',
  },
  redeem: {
    action: 'Racheter', kicker: 'Demande de rachat', title: 'Racheter', held: 'Détenu', inRequests: 'En demandes ouvertes', redeemable: 'Rachetable', qty: 'Quantité',
    estimate: 'Produit estimé', price: 'Dernière cotation', consent: 'Je comprends que ceci enregistre une demande. Le paiement utilise le prix à l’exécution et peut différer de cette estimation. Je peux annuler tant qu’elle est demandée ou en file.',
    submit: 'Envoyer la demande', submitting: 'Envoi…', close: 'Fermer', done: 'Demande enregistrée', doneBody: 'État : {s}. Le produit est crédité sur la trésorerie disponible à l’exécution de la demande.',
    list: 'Demandes de rachat', listNote: 'Pour ce produit', empty: 'Aucune demande de rachat', requested: 'Demandé {t}', estAt: 'Prix est. {v}',
    cancel: 'Annuler', confirmCancel: 'Confirmer l’annulation', cancelling: 'Annulation…', invalid: 'Saisissez une quantité supérieure à 0 avec au plus {n} décimales.', over: 'Supérieur à la quantité rachetable.',
    nothing: 'Plus rien à racheter : les demandes ouvertes couvrent toute votre position.', noQuote: 'Aucune cotation actuelle ; estimation indisponible.',
    states: { requested: 'Demandé', queued: 'En file', executing: 'En cours', completed: 'Terminé', failed: 'Échoué', canceled: 'Annulé' },
    errors: { PRODUCT_NOT_FOUND: 'Ce produit n’existe plus.', QUOTE_STALE: 'Aucune cotation actuelle pour ce produit ; réessayez plus tard.', REDEMPTION_NOT_FOUND: 'Demande introuvable.', REDEMPTION_STATE_INVALID: 'Cette demande ne peut plus être annulée.' },
  },
}

const pt: AssetToolsCopy = {
  statements: {
    kicker: 'Registros', title: 'Extratos', lede: 'Resumo mensal da atividade do seu livro-razão, com exportação CSV exata.', month: 'Mês', noMonths: 'Ainda não há atividade no livro-razão', noMonthsBody: 'Os meses aparecem aqui quando sua conta tiver lançamentos.',
    inflow: 'Entradas', outflow: 'Saídas', net: 'Líquido', entries: 'Lançamentos', byType: 'Por tipo', byTypeNote: 'Variação do saldo disponível', lines: 'Lançamentos',
    export: 'Exportar CSV', exportNote: 'Valores atômicos exatos, uma linha por lançamento, do mês selecionado.', partial: 'Mês parcial', partialBody: 'O livro-razão retorna no máximo {n} lançamentos; atividades anteriores deste mês podem estar ausentes.',
    scope: 'Baseado nos seus últimos {n} lançamentos.', tz: 'Os meses seguem o fuso horário do seu dispositivo.',
    official: 'Extratos oficiais indisponíveis', officialBody: 'Ainda não há serviço de extratos: sem PDF assinado e sem saldos de abertura ou fechamento. Esta página apenas resume a atividade do livro-razão.',
  },
  calendar: {
    kicker: 'Rendimentos', title: 'Calendário de rendimentos', lede: 'Distribuições creditadas na sua conta, pelo dia em que chegaram.', prev: 'Mês anterior', next: 'Próximo mês', monthTotal: 'Este mês', allTime: 'Total creditado', credits: 'Créditos',
    byProduct: 'Por produto', list: 'Créditos', listDay: 'Créditos em {d}', wholeMonth: 'Mês inteiro', empty: 'Nenhum crédito neste mês', emptyBody: 'Use as setas para ver outros meses.', none: 'Ainda não há rendimentos', noneBody: 'As distribuições aparecem aqui quando creditadas na sua conta.',
    open: 'Não creditado', openNote: 'Alocações pendentes ou com falha; fora dos totais.', upcoming: 'Próximas distribuições indisponíveis', upcomingBody: 'Ainda não há serviço de calendário de distribuições, então datas futuras de pagamento não são exibidas.', period: 'Período', credited: 'Creditado',
    states: { pending: 'Pendente', credited: 'Creditado', failed: 'Falhou' },
  },
  rebalance: {
    kicker: 'Ferramentas', title: 'Rebalanceamento', lede: 'Defina pesos-alvo e veja a variação de referência de cada posição.', total: 'Posições cotadas', current: 'Atual', target: 'Alvo', delta: 'Variação de referência',
    buy: 'Aumentar', sell: 'Reduzir', hold: 'Sem alteração', sum: 'Alvos somam {v}', sumOff: 'Os alvos devem somar 100%.', equal: 'Pesos iguais', reset: 'Voltar ao atual',
    reference: 'Estimativa pelas últimas cotações; taxas e mínimos são revistos na execução. Vendas e compras exigem confirmações separadas.', unpriced: '{n} posição(ões) sem cotação excluída(s).',
    execute: 'O rebalanceamento não pode ser executado aqui', executeBody: 'Ainda não há serviço de rebalanceamento para carteiras individuais, então nada é enviado desta página. Use Investir mais ou Resgatar em cada posição.',
    needTwo: 'São necessárias ao menos duas posições cotadas', needTwoBody: 'O rebalanceamento compara pesos entre posições.', open: 'Abrir posição', targetFor: 'Peso-alvo de {n}',
  },
  recurring: {
    kicker: 'Ferramentas', title: 'Investimento recorrente', lede: 'Investimentos automáticos em um calendário.', unavailable: 'O investimento recorrente ainda não está disponível',
    unavailableBody: 'Ainda não há serviço de agendamento para investimentos automáticos. Você ainda pode investir manualmente em qualquer produto listado.', nothing: 'Nada está agendado e nenhum valor está reservado.', markets: 'Ver mercados', assets: 'Meus ativos',
  },
  redeem: {
    action: 'Resgatar', kicker: 'Pedido de resgate', title: 'Resgatar', held: 'Em carteira', inRequests: 'Em pedidos abertos', redeemable: 'Resgatável', qty: 'Quantidade',
    estimate: 'Valor estimado', price: 'Última cotação', consent: 'Entendo que isto registra um pedido. O pagamento usa o preço na conclusão e pode diferir desta estimativa. Posso cancelar enquanto estiver solicitado ou na fila.',
    submit: 'Enviar pedido', submitting: 'Enviando…', close: 'Fechar', done: 'Pedido registrado', doneBody: 'Estado: {s}. O valor é creditado no caixa disponível quando o pedido for concluído.',
    list: 'Pedidos de resgate', listNote: 'Deste produto', empty: 'Nenhum pedido de resgate', requested: 'Solicitado {t}', estAt: 'Preço est. {v}',
    cancel: 'Cancelar', confirmCancel: 'Confirmar cancelamento', cancelling: 'Cancelando…', invalid: 'Informe uma quantidade maior que 0 com no máximo {n} casas decimais.', over: 'Acima da quantidade resgatável.',
    nothing: 'Nada a resgatar: os pedidos abertos já cobrem toda a sua posição.', noQuote: 'Sem cotação atual; estimativa indisponível.',
    states: { requested: 'Solicitado', queued: 'Na fila', executing: 'Em execução', completed: 'Concluído', failed: 'Falhou', canceled: 'Cancelado' },
    errors: { PRODUCT_NOT_FOUND: 'Este produto não existe mais.', QUOTE_STALE: 'Sem cotação atual para este produto; tente mais tarde.', REDEMPTION_NOT_FOUND: 'Pedido não encontrado.', REDEMPTION_STATE_INVALID: 'Este pedido não pode mais ser cancelado.' },
  },
}

export const assetToolsCopy: Record<AppLocale, AssetToolsCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
