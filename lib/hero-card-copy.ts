import type { AppLocale } from '@/lib/i18n'

export type HeroCardCopy = {
  ended: string
  units: [string, string, string, string]
  implied: string
  leading: string
  options: string
  note: string
  historyEmpty: string
  hideAmounts: string
  showAmounts: string
  buy: string
  buyNow: string
  noteShort: string
  perShare: string
  allOptions: string
  fee: string
  settles: string
  trend: string
  flat: string
  cashDetail: string
  basketNote: string
  tradeNote: string
  assetsNote: string
  almanacTitle: string
  lastPrice: string
  sell: string
  bids: string
  asks: string
  depth: string
  candles: string
  high24: string
  low24: string
  spread: string
  /** A listed pair with no resting orders and no candles: say so instead of drawing empty instruments. */
  quietBadge: string
  quietNote: string
  almanacSum: string
  almanacLead: string
  almanacWeighted: string
  asOf: string
}

export const heroCardCopy: Record<AppLocale, HeroCardCopy> = {
  en: { quietBadge: 'No open orders', quietNote: 'No open orders and no trading history yet. You can place the first limit order.', ended: 'Ended · awaiting settlement', units: ['d', 'h', 'm', 's'], implied: 'Implied probability', leading: 'Leading', options: 'Options', note: 'Implied by market prices, not a guaranteed return', historyEmpty: 'No price history yet', hideAmounts: 'Hide amounts', showAmounts: 'Show amounts', buy: 'Buy {o}', buyNow: 'Buy', noteShort: 'Priced by the market, not guaranteed', perShare: 'Shares pay $1 at expiry', allOptions: 'All options', fee: 'Bet fee', settles: 'Settles', trend: '{o} price trend', flat: 'Unchanged in this window', cashDetail: 'Cash details', basketNote: 'NAV moves with holdings; returns not guaranteed', tradeNote: 'Prices move in real time; trading carries risk', assetsNote: 'Market caps from third-party data, for reference only', almanacTitle: 'Real assets by market cap · top {n}', lastPrice: 'Last price', sell: 'Sell', bids: 'Bids {p}', asks: 'Asks {p}', depth: 'Top {n} levels', candles: '24h · hourly candles', high24: '24h high', low24: '24h low', spread: 'Spread', almanacSum: 'Combined market cap · top {n}', almanacLead: 'Leader’s share', almanacWeighted: 'Weighted 24h', asOf: 'As of' },
  'zh-CN': { quietBadge: '暂无挂单', quietNote: '目前没有挂单，也还没有成交走势。可以挂出第一笔限价单。', ended: '已结束 · 待结算', units: ['天', '时', '分', '秒'], implied: '隐含概率', leading: '领先项', options: '选项', note: '概率由市场价格推出，不代表保证收益', historyEmpty: '暂无走势数据', hideAmounts: '隐藏金额', showAmounts: '显示金额', buy: '买 {o}', buyNow: '买入', noteShort: '由市场价推算，非保证收益', perShare: '份额到期兑 $1', allOptions: '全部选项', fee: '下注费', settles: '结算', trend: '「{o}」价格走势', flat: '该区间内无变化', cashDetail: '现金明细', basketNote: '净值随持仓波动，不保证收益', tradeNote: '价格实时变动，交易有风险', assetsNote: '市值来自第三方数据，仅供参考', almanacTitle: '真实资产市值榜 · 前 {n}', lastPrice: '最新成交价', sell: '卖出', bids: '买盘 {p}', asks: '卖盘 {p}', depth: '前 {n} 档挂单', candles: '24h · 1 小时 K 线', high24: '24h 最高', low24: '24h 最低', spread: '买卖价差', almanacSum: '前 {n} 合计市值', almanacLead: '榜首占比', almanacWeighted: '加权 24h', asOf: '数据时间' },
  hi: { quietBadge: 'कोई खुला ऑर्डर नहीं', quietNote: 'अभी कोई खुला ऑर्डर या ट्रेड इतिहास नहीं है। आप पहला लिमिट ऑर्डर लगा सकते हैं।', ended: 'समाप्त · निपटान प्रतीक्षित', units: ['दि', 'घं', 'मि', 'से'], implied: 'निहित संभावना', leading: 'अग्रणी', options: 'विकल्प', note: 'बाज़ार भाव से निकली संभावना, गारंटीशुदा रिटर्न नहीं', historyEmpty: 'अभी मूल्य इतिहास नहीं है', hideAmounts: 'राशि छिपाएँ', showAmounts: 'राशि दिखाएँ', buy: '{o} खरीदें', buyNow: 'खरीदें', noteShort: 'बाज़ार भाव से, गारंटी नहीं', perShare: 'समाप्ति पर हर शेयर $1', allOptions: 'सभी विकल्प', fee: 'दांव शुल्क', settles: 'निपटान', trend: '“{o}” मूल्य रुझान', flat: 'इस अवधि में कोई बदलाव नहीं', cashDetail: 'नकद विवरण', basketNote: 'NAV होल्डिंग के साथ बदलता है; रिटर्न की गारंटी नहीं', tradeNote: 'कीमतें लगातार बदलती हैं; ट्रेडिंग में जोखिम है', assetsNote: 'मार्केट कैप तृतीय-पक्ष डेटा से, केवल संदर्भ हेतु', almanacTitle: 'बाज़ार मूल्य से वास्तविक संपत्ति · शीर्ष {n}', lastPrice: 'अंतिम सौदा मूल्य', sell: 'बेचें', bids: 'खरीद {p}', asks: 'बिक्री {p}', depth: 'शीर्ष {n} स्तर', candles: '24h · घंटेवार कैंडल', high24: '24h उच्च', low24: '24h निम्न', spread: 'स्प्रेड', almanacSum: 'शीर्ष {n} का कुल मार्केट कैप', almanacLead: 'पहले की हिस्सेदारी', almanacWeighted: 'भारित 24h', asOf: 'डेटा समय' },
  es: { quietBadge: 'Sin órdenes', quietNote: 'Aún no hay órdenes abiertas ni historial de operaciones. Puedes colocar la primera orden limitada.', ended: 'Finalizado · pendiente de liquidación', units: ['d', 'h', 'min', 's'], implied: 'Probabilidad implícita', leading: 'Líder', options: 'Opciones', note: 'Implícita en los precios de mercado, no es un rendimiento garantizado', historyEmpty: 'Aún no hay historial de precios', hideAmounts: 'Ocultar importes', showAmounts: 'Mostrar importes', buy: 'Comprar {o}', buyNow: 'Comprar', noteShort: 'Según el mercado, sin garantía', perShare: 'Cada acción paga $1 al vencer', allOptions: 'Todas las opciones', fee: 'Comisión', settles: 'Liquidación', trend: 'Precio de «{o}»', flat: 'Sin cambios en este periodo', cashDetail: 'Detalle de efectivo', basketNote: 'El valor liquidativo varía con la cartera; sin rentabilidad garantizada', tradeNote: 'Los precios cambian en tiempo real; operar conlleva riesgo', assetsNote: 'Capitalización de fuentes externas, solo como referencia', almanacTitle: 'Activos reales por capitalización · top {n}', lastPrice: 'Último precio', sell: 'Vender', bids: 'Compra {p}', asks: 'Venta {p}', depth: 'Primeros {n} niveles', candles: '24h · velas de 1 h', high24: 'Máx. 24h', low24: 'Mín. 24h', spread: 'Diferencial', almanacSum: 'Capitalización conjunta · top {n}', almanacLead: 'Peso del primero', almanacWeighted: 'Ponderado 24h', asOf: 'Datos a' },
  ar: { quietBadge: 'لا أوامر مفتوحة', quietNote: 'لا توجد أوامر مفتوحة ولا سجل تداول بعد. يمكنك وضع أول أمر محدد.', ended: 'انتهى · بانتظار التسوية', units: ['ي', 'س', 'د', 'ث'], implied: 'الاحتمال الضمني', leading: 'الأعلى', options: 'الخيارات', note: 'مستخلص من أسعار السوق وليس عائدًا مضمونًا', historyEmpty: 'لا يوجد سجل أسعار بعد', hideAmounts: 'إخفاء المبالغ', showAmounts: 'إظهار المبالغ', buy: 'شراء {o}', buyNow: 'شراء', noteShort: 'من أسعار السوق، غير مضمون', perShare: 'كل حصة تدفع 1$ عند الانتهاء', allOptions: 'كل الخيارات', fee: 'رسوم الرهان', settles: 'التسوية', trend: 'سعر «{o}»', flat: 'لا تغيير في هذه الفترة', cashDetail: 'تفاصيل النقد', basketNote: 'صافي القيمة يتغير مع المحفظة؛ العائد غير مضمون', tradeNote: 'الأسعار تتغير لحظيًا؛ التداول ينطوي على مخاطر', assetsNote: 'القيمة السوقية من بيانات طرف ثالث، للاطلاع فقط', almanacTitle: 'الأصول الحقيقية حسب القيمة السوقية · أعلى {n}', lastPrice: 'آخر سعر تنفيذ', sell: 'بيع', bids: 'الشراء {p}', asks: 'البيع {p}', depth: 'أعلى {n} مستويات', candles: '24س · شموع كل ساعة', high24: 'أعلى 24س', low24: 'أدنى 24س', spread: 'الفارق', almanacSum: 'القيمة السوقية المجمّعة · أعلى {n}', almanacLead: 'حصة الأول', almanacWeighted: 'مرجّح 24س', asOf: 'وقت البيانات' },
  fr: { quietBadge: 'Aucun ordre', quietNote: 'Aucun ordre ouvert ni historique pour l’instant. Vous pouvez placer le premier ordre à cours limité.', ended: 'Terminé · en attente de règlement', units: ['j', 'h', 'min', 's'], implied: 'Probabilité implicite', leading: 'En tête', options: 'Options', note: 'Déduite des prix du marché, rendement non garanti', historyEmpty: 'Pas encore d’historique de prix', hideAmounts: 'Masquer les montants', showAmounts: 'Afficher les montants', buy: 'Acheter {o}', buyNow: 'Acheter', noteShort: 'Selon le marché, sans garantie', perShare: 'Chaque part vaut 1 $ à l’échéance', allOptions: 'Toutes les options', fee: 'Frais de pari', settles: 'Règlement', trend: 'Prix de « {o} »', flat: 'Aucun changement sur cette période', cashDetail: 'Détail des liquidités', basketNote: 'La VL varie avec le portefeuille ; rendement non garanti', tradeNote: 'Les prix varient en temps réel ; trader comporte des risques', assetsNote: 'Capitalisations issues de données tierces, à titre indicatif', almanacTitle: 'Actifs réels par capitalisation · top {n}', lastPrice: 'Dernier prix', sell: 'Vendre', bids: 'Achats {p}', asks: 'Ventes {p}', depth: '{n} premiers niveaux', candles: '24 h · bougies 1 h', high24: 'Haut 24 h', low24: 'Bas 24 h', spread: 'Écart', almanacSum: 'Capitalisation cumulée · top {n}', almanacLead: 'Part du premier', almanacWeighted: 'Pondéré 24 h', asOf: 'Données au' },
  pt: { quietBadge: 'Sem ordens', quietNote: 'Ainda não há ordens abertas nem histórico. Você pode enviar a primeira ordem limitada.', ended: 'Encerrado · aguardando liquidação', units: ['d', 'h', 'min', 's'], implied: 'Probabilidade implícita', leading: 'Líder', options: 'Opções', note: 'Implícita nos preços de mercado, não é retorno garantido', historyEmpty: 'Ainda não há histórico de preços', hideAmounts: 'Ocultar valores', showAmounts: 'Mostrar valores', buy: 'Comprar {o}', buyNow: 'Comprar', noteShort: 'Pelo mercado, sem garantia', perShare: 'Cada cota paga $1 no vencimento', allOptions: 'Todas as opções', fee: 'Taxa da aposta', settles: 'Liquidação', trend: 'Preço de “{o}”', flat: 'Sem alteração neste período', cashDetail: 'Detalhes do saldo', basketNote: 'O valor da cota varia com a carteira; retorno não garantido', tradeNote: 'Os preços mudam em tempo real; negociar envolve risco', assetsNote: 'Capitalização de dados de terceiros, apenas referência', almanacTitle: 'Ativos reais por capitalização · top {n}', lastPrice: 'Último preço', sell: 'Vender', bids: 'Compra {p}', asks: 'Venda {p}', depth: 'Primeiros {n} níveis', candles: '24h · velas de 1 h', high24: 'Máx. 24h', low24: 'Mín. 24h', spread: 'Spread', almanacSum: 'Capitalização somada · top {n}', almanacLead: 'Fatia do líder', almanacWeighted: 'Ponderado 24h', asOf: 'Dados de' },
}
