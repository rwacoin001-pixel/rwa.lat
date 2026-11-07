import type { AppLocale } from './i18n'
import type { AssetSummary } from './api/portfolio-summary'

const COPY: Record<AppLocale, { total: string; partial: string; missing: string; cost: string; error: string; cash: string; rewards: string }> = {
  'zh-CN': { total: '总资产', partial: '已估值资产', missing: '部分持仓估值暂不可用，当前为已估值合计。', cost: '预测持仓按扣除下注费后的投入成本计入。', error: '资产数据暂不可用，请刷新重试。', cash: '现金余额（含冻结及待处理）', rewards: '待领取奖励' },
  en: { total: 'Total assets', partial: 'Valued assets', missing: 'Some holdings cannot be valued. This is the valued subtotal.', cost: 'Open predictions are included at cost after placement fees.', error: 'Asset data is unavailable. Refresh to retry.', cash: 'Cash (including locked and pending)', rewards: 'Unclaimed rewards' },
  es: { total: 'Activos totales', partial: 'Activos valorados', missing: 'Faltan valoraciones. Se muestra el subtotal valorado.', cost: 'Las predicciones abiertas se incluyen al coste tras comisiones de entrada.', error: 'Datos de activos no disponibles. Actualiza para reintentar.', cash: 'Efectivo (incluido bloqueado y pendiente)', rewards: 'Recompensas por reclamar' },
  fr: { total: 'Total des actifs', partial: 'Actifs valorisés', missing: 'Certaines valorisations manquent. Le sous-total valorisé est affiché.', cost: 'Les prédictions ouvertes sont comptées au coût après frais de mise.', error: 'Données des actifs indisponibles. Actualisez pour réessayer.', cash: 'Liquidités (bloquées et en attente incluses)', rewards: 'Récompenses à réclamer' },
  pt: { total: 'Ativos totais', partial: 'Ativos avaliados', missing: 'Faltam algumas avaliações. Este é o subtotal avaliado.', cost: 'Previsões abertas são incluídas pelo custo após taxas de entrada.', error: 'Dados dos ativos indisponíveis. Atualize para tentar novamente.', cash: 'Saldo (inclui bloqueado e pendente)', rewards: 'Recompensas a resgatar' },
  hi: { total: 'कुल संपत्ति', partial: 'मूल्यांकित संपत्ति', missing: 'कुछ होल्डिंग का मूल्यांकन उपलब्ध नहीं है। यह उपलब्ध मूल्यों का उप-योग है।', cost: 'खुली भविष्यवाणियाँ प्रवेश शुल्क घटाने के बाद लागत पर शामिल हैं।', error: 'संपत्ति डेटा उपलब्ध नहीं है। रीफ़्रेश करके पुनः प्रयास करें।', cash: 'नकद (लॉक और लंबित सहित)', rewards: 'लंबित पुरस्कार' },
  ar: { total: 'إجمالي الأصول', partial: 'الأصول المقيّمة', missing: 'بعض التقييمات غير متاحة. المعروض هو مجموع الأصول المقيّمة.', cost: 'تُحتسب التوقعات المفتوحة بالتكلفة بعد خصم رسوم الرهان.', error: 'بيانات الأصول غير متاحة. حدّث الصفحة للمحاولة مجددًا.', cash: 'النقد (يشمل المحجوز والمعلق)', rewards: 'مكافآت غير مستلمة' },
}

export function assetValuationCopy(locale: AppLocale, summary: AssetSummary | undefined, failed = false) {
  const copy = COPY[locale]
  return {
    ...copy,
    label: summary && !summary.valuationComplete ? copy.partial : copy.total,
    note: failed ? copy.error : [summary && !summary.valuationComplete ? copy.missing : '', summary && summary.predictions.openCount > 0 ? copy.cost : ''].filter(Boolean).join(' '),
  }
}
