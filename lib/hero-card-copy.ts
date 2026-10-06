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
}

export const heroCardCopy: Record<AppLocale, HeroCardCopy> = {
  en: { ended: 'Ended · awaiting settlement', units: ['d', 'h', 'm', 's'], implied: 'Implied probability', leading: 'Leading', options: 'Options', note: 'Implied by market prices, not a guaranteed return', historyEmpty: 'No price history yet', hideAmounts: 'Hide amounts', showAmounts: 'Show amounts', buy: 'Buy {o}', buyNow: 'Buy', noteShort: 'Priced by the market, not guaranteed', perShare: 'Shares pay $1 at expiry', allOptions: 'All options', fee: 'Bet fee', settles: 'Settles', trend: '{o} price trend', flat: 'Unchanged in this window', cashDetail: 'Cash details' },
  'zh-CN': { ended: '已结束 · 待结算', units: ['天', '时', '分', '秒'], implied: '隐含概率', leading: '领先项', options: '选项', note: '概率由市场价格推出，不代表保证收益', historyEmpty: '暂无走势数据', hideAmounts: '隐藏金额', showAmounts: '显示金额', buy: '买 {o}', buyNow: '买入', noteShort: '由市场价推算，非保证收益', perShare: '份额到期兑 $1', allOptions: '全部选项', fee: '下注费', settles: '结算', trend: '「{o}」价格走势', flat: '该区间内无变化', cashDetail: '现金明细' },
  hi: { ended: 'समाप्त · निपटान प्रतीक्षित', units: ['दि', 'घं', 'मि', 'से'], implied: 'निहित संभावना', leading: 'अग्रणी', options: 'विकल्प', note: 'बाज़ार भाव से निकली संभावना, गारंटीशुदा रिटर्न नहीं', historyEmpty: 'अभी मूल्य इतिहास नहीं है', hideAmounts: 'राशि छिपाएँ', showAmounts: 'राशि दिखाएँ', buy: '{o} खरीदें', buyNow: 'खरीदें', noteShort: 'बाज़ार भाव से, गारंटी नहीं', perShare: 'समाप्ति पर हर शेयर $1', allOptions: 'सभी विकल्प', fee: 'दांव शुल्क', settles: 'निपटान', trend: '“{o}” मूल्य रुझान', flat: 'इस अवधि में कोई बदलाव नहीं', cashDetail: 'नकद विवरण' },
  es: { ended: 'Finalizado · pendiente de liquidación', units: ['d', 'h', 'min', 's'], implied: 'Probabilidad implícita', leading: 'Líder', options: 'Opciones', note: 'Implícita en los precios de mercado, no es un rendimiento garantizado', historyEmpty: 'Aún no hay historial de precios', hideAmounts: 'Ocultar importes', showAmounts: 'Mostrar importes', buy: 'Comprar {o}', buyNow: 'Comprar', noteShort: 'Según el mercado, sin garantía', perShare: 'Cada acción paga $1 al vencer', allOptions: 'Todas las opciones', fee: 'Comisión', settles: 'Liquidación', trend: 'Precio de «{o}»', flat: 'Sin cambios en este periodo', cashDetail: 'Detalle de efectivo' },
  ar: { ended: 'انتهى · بانتظار التسوية', units: ['ي', 'س', 'د', 'ث'], implied: 'الاحتمال الضمني', leading: 'الأعلى', options: 'الخيارات', note: 'مستخلص من أسعار السوق وليس عائدًا مضمونًا', historyEmpty: 'لا يوجد سجل أسعار بعد', hideAmounts: 'إخفاء المبالغ', showAmounts: 'إظهار المبالغ', buy: 'شراء {o}', buyNow: 'شراء', noteShort: 'من أسعار السوق، غير مضمون', perShare: 'كل حصة تدفع 1$ عند الانتهاء', allOptions: 'كل الخيارات', fee: 'رسوم الرهان', settles: 'التسوية', trend: 'سعر «{o}»', flat: 'لا تغيير في هذه الفترة', cashDetail: 'تفاصيل النقد' },
  fr: { ended: 'Terminé · en attente de règlement', units: ['j', 'h', 'min', 's'], implied: 'Probabilité implicite', leading: 'En tête', options: 'Options', note: 'Déduite des prix du marché, rendement non garanti', historyEmpty: 'Pas encore d’historique de prix', hideAmounts: 'Masquer les montants', showAmounts: 'Afficher les montants', buy: 'Acheter {o}', buyNow: 'Acheter', noteShort: 'Selon le marché, sans garantie', perShare: 'Chaque part vaut 1 $ à l’échéance', allOptions: 'Toutes les options', fee: 'Frais de pari', settles: 'Règlement', trend: 'Prix de « {o} »', flat: 'Aucun changement sur cette période', cashDetail: 'Détail des liquidités' },
  pt: { ended: 'Encerrado · aguardando liquidação', units: ['d', 'h', 'min', 's'], implied: 'Probabilidade implícita', leading: 'Líder', options: 'Opções', note: 'Implícita nos preços de mercado, não é retorno garantido', historyEmpty: 'Ainda não há histórico de preços', hideAmounts: 'Ocultar valores', showAmounts: 'Mostrar valores', buy: 'Comprar {o}', buyNow: 'Comprar', noteShort: 'Pelo mercado, sem garantia', perShare: 'Cada cota paga $1 no vencimento', allOptions: 'Todas as opções', fee: 'Taxa da aposta', settles: 'Liquidação', trend: 'Preço de “{o}”', flat: 'Sem alteração neste período', cashDetail: 'Detalhes do saldo' },
}
