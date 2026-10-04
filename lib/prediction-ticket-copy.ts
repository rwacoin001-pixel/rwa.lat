import type { AppLocale } from './app-locales'

type Copy = { buy: string; bet: string; deposit: string; details: string; netPayout: string; checking: string; lowerAmount: string; unavailable: string; cash: string; settings: string; market: string }
export const predictionTicketCopy: Record<AppLocale, Copy> = {
  'zh-CN': { buy: '买入', bet: '投注', deposit: '充值', details: '明细', netPayout: '预计中奖净到账', checking: '读取余额…', lowerAmount: '调低金额', unavailable: '暂不可买', cash: '可用', settings: '订单设置', market: '盘口／市价' },
  en: { buy: 'Buy', bet: 'Bet', deposit: 'Deposit', details: 'Details', netPayout: 'Estimated net winnings', checking: 'Checking balance…', lowerAmount: 'Lower amount', unavailable: 'Unavailable', cash: 'Available', settings: 'Order settings', market: 'Market' },
  hi: { buy: 'खरीदें', bet: 'दांव लगाएँ', deposit: 'जमा करें', details: 'विवरण', netPayout: 'अनुमानित शुद्ध जीत', checking: 'शेष जाँच रहे हैं…', lowerAmount: 'राशि घटाएँ', unavailable: 'अनुपलब्ध', cash: 'उपलब्ध', settings: 'ऑर्डर सेटिंग', market: 'बाज़ार' },
  es: { buy: 'Comprar', bet: 'Apostar', deposit: 'Depositar', details: 'Detalles', netPayout: 'Ganancia neta estimada', checking: 'Consultando saldo…', lowerAmount: 'Reducir importe', unavailable: 'No disponible', cash: 'Disponible', settings: 'Ajustes de orden', market: 'Mercado' },
  ar: { buy: 'شراء', bet: 'راهن', deposit: 'إيداع', details: 'التفاصيل', netPayout: 'صافي الربح المتوقع', checking: 'جارٍ التحقق من الرصيد…', lowerAmount: 'تقليل المبلغ', unavailable: 'غير متاح', cash: 'المتاح', settings: 'إعدادات الطلب', market: 'السوق' },
  fr: { buy: 'Acheter', bet: 'Parier', deposit: 'Déposer', details: 'Détails', netPayout: 'Gains nets estimés', checking: 'Vérification du solde…', lowerAmount: 'Réduire le montant', unavailable: 'Indisponible', cash: 'Disponible', settings: 'Réglages de l’ordre', market: 'Marché' },
  pt: { buy: 'Comprar', bet: 'Apostar', deposit: 'Depositar', details: 'Detalhes', netPayout: 'Ganhos líquidos estimados', checking: 'Consultando saldo…', lowerAmount: 'Reduzir valor', unavailable: 'Indisponível', cash: 'Disponível', settings: 'Configurações da ordem', market: 'Mercado' },
}
