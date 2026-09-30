'use client'

/**
 * 费率与限额中心（/fees-and-limits）— 圆桌第4场 P0-A #6
 * 全站唯一费用数据源页面：所有费用/限额的解释都指向这里。
 */
import { BadgePercent, Banknote, Coins, Info, Lock, Network, Percent } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { FEE_SCHEDULE } from '@/lib/fee-schedule'
import RwaTopbar from './rwa-topbar'
import { useI18n, type AppLocale } from '@/lib/i18n'

const feesCopy: Record<AppLocale, { title: string; intro: string; trading: string; tradingNote: string; rwaCompute: string; stocks: string; prediction: string; predictionSplit: string; tbill: string; minFee: string; tradingRule: string; network: string; networkNote: string; management: string; managementNote: string; redemption: string; redemptionNote: string; limits: string; accountLevel: string; minInvestment: string; minWithdraw: string; dailyMax: string; notes: string; question: string }> = {
  en: { title: 'Fees & limits', intro: 'The single source of truth for platform fees and account limits.', trading: 'Trading fees', tradingNote: 'Charged when an order is executed', rwaCompute: 'RWA assets / AI compute', stocks: 'Stock baskets', prediction: 'Prediction markets', predictionSplit: 'place + payout', tbill: 'Tokenized T-Bills', minFee: 'Minimum fee per order', tradingRule: 'Fees are charged as a percentage of filled value; the minimum applies below the threshold.', network: 'Withdrawal network fees', networkNote: 'Network cost varies with congestion and is shown on the confirmation screen.', management: 'Management fees', managementNote: 'Annualized and accrued from product returns; not charged separately.', redemption: 'Redemption & lockups', redemptionNote: 'Early exits follow each product’s terms.', limits: 'Limits', accountLevel: 'Account level', minInvestment: 'Minimum investment', minWithdraw: 'Minimum withdrawal', dailyMax: 'Daily withdrawal cap', notes: 'Notes', question: 'Questions about fees? Contact support' },
  'zh-CN': { title: '费率与限额', intro: '全站唯一费率与账户限额数据源。', trading: '交易手续费', tradingNote: '下单成交时收取', rwaCompute: 'RWA 资产 / AI 算力', stocks: '股票组合', prediction: '预测市场', predictionSplit: '下注 + 派彩', tbill: '代币化短期国债', minFee: '单笔最低手续费', tradingRule: '手续费按成交金额比例收取，不足最低值按最低值计。', network: '提现网络费', networkNote: '网络费随链上拥堵浮动，以确认页实时展示为准。', management: '管理费', managementNote: '按年化比例从收益中计提，不单独向账户收取。', redemption: '赎回与锁定', redemptionNote: '提前退出按产品条款执行。', limits: '限额', accountLevel: '账户级', minInvestment: '最低投资额', minWithdraw: '最低提现额', dailyMax: '每日提现上限', notes: '说明', question: '对费用有疑问？联系支持' },
  hi: { title: 'शुल्क और सीमाएँ', intro: 'प्लेटफ़ॉर्म शुल्क और खाता सीमाओं का आधिकारिक स्रोत।', trading: 'ट्रेडिंग शुल्क', tradingNote: 'ऑर्डर भरने पर लिया जाता है', rwaCompute: 'RWA संपत्तियाँ / AI कंप्यूट', stocks: 'शेयर बास्केट', prediction: 'पूर्वानुमान बाज़ार', predictionSplit: 'प्लेस + पेआउट', tbill: 'टोकनाइज़्ड T-Bill', minFee: 'प्रति ऑर्डर न्यूनतम शुल्क', tradingRule: 'भरे गए मूल्य के प्रतिशत के रूप में शुल्क; सीमा से कम पर न्यूनतम लागू।', network: 'निकासी नेटवर्क शुल्क', networkNote: 'नेटवर्क लागत भीड़ के साथ बदलती है और पुष्टि पर दिखती है।', management: 'प्रबंधन शुल्क', managementNote: 'वार्षिक दर, उत्पाद रिटर्न से; अलग से नहीं लिया जाता।', redemption: 'रिडेम्पशन और लॉकअप', redemptionNote: 'शीघ्र निकास उत्पाद शर्तों के अनुसार।', limits: 'सीमाएँ', accountLevel: 'खाता स्तर', minInvestment: 'न्यूनतम निवेश', minWithdraw: 'न्यूनतम निकासी', dailyMax: 'दैनिक निकासी सीमा', notes: 'टिप्पणियाँ', question: 'शुल्क पर प्रश्न? सहायता से संपर्क करें' },
  es: { title: 'Comisiones y límites', intro: 'Fuente única para las comisiones de la plataforma y los límites de cuenta.', trading: 'Comisiones de operación', tradingNote: 'Se cobran al ejecutar una orden', rwaCompute: 'Activos RWA / cómputo IA', stocks: 'Cestas de acciones', prediction: 'Mercados de predicción', predictionSplit: 'entrada + liquidación', tbill: 'T-Bills tokenizados', minFee: 'Comisión mínima por orden', tradingRule: 'Se cobra un porcentaje del valor ejecutado; se aplica el mínimo por debajo del umbral.', network: 'Comisiones de red de retirada', networkNote: 'El coste cambia con la congestión y aparece en la confirmación.', management: 'Comisiones de gestión', managementNote: 'Anualizadas y descontadas del rendimiento; no se cobran aparte.', redemption: 'Reembolso y bloqueos', redemptionNote: 'Las salidas anticipadas siguen las condiciones del producto.', limits: 'Límites', accountLevel: 'Nivel de cuenta', minInvestment: 'Inversión mínima', minWithdraw: 'Retirada mínima', dailyMax: 'Límite diario de retirada', notes: 'Notas', question: '¿Dudas sobre comisiones? Contacta con soporte' },
  ar: { title: 'الرسوم والحدود', intro: 'المصدر الموحد لرسوم المنصة وحدود الحساب.', trading: 'رسوم التداول', tradingNote: 'تُحصّل عند تنفيذ الطلب', rwaCompute: 'أصول RWA / حوسبة الذكاء الاصطناعي', stocks: 'سلال الأسهم', prediction: 'أسواق التنبؤ', predictionSplit: 'الرهان + الدفع', tbill: 'أذون خزانة مرمّزة', minFee: 'الحد الأدنى لرسوم الطلب', tradingRule: 'تُحصّل الرسوم كنسبة من القيمة المنفذة ويُطبق الحد الأدنى تحت العتبة.', network: 'رسوم شبكة السحب', networkNote: 'تتغير التكلفة مع الازدحام وتظهر في شاشة التأكيد.', management: 'رسوم الإدارة', managementNote: 'سنوية وتُحتسب من العائد دون تحصيل منفصل.', redemption: 'الاسترداد وفترات الحجز', redemptionNote: 'تتبع المخارج المبكرة شروط المنتج.', limits: 'الحدود', accountLevel: 'مستوى الحساب', minInvestment: 'الحد الأدنى للاستثمار', minWithdraw: 'الحد الأدنى للسحب', dailyMax: 'حد السحب اليومي', notes: 'ملاحظات', question: 'أسئلة عن الرسوم؟ تواصل مع الدعم' },
  fr: { title: 'Frais et limites', intro: 'Source unique pour les frais de la plateforme et les limites de compte.', trading: 'Frais de trading', tradingNote: 'Prélevés lors de l’exécution d’un ordre', rwaCompute: 'Actifs RWA / calcul IA', stocks: 'Paniers d’actions', prediction: 'Marchés prédictifs', predictionSplit: 'mise + paiement', tbill: 'T-Bills tokenisés', minFee: 'Frais minimum par ordre', tradingRule: 'Les frais correspondent à un pourcentage de la valeur exécutée ; le minimum s’applique sous le seuil.', network: 'Frais réseau de retrait', networkNote: 'Le coût varie avec la congestion et figure dans la confirmation.', management: 'Frais de gestion', managementNote: 'Annualisés et prélevés sur le rendement, sans facturation séparée.', redemption: 'Rachat et blocages', redemptionNote: 'Les sorties anticipées suivent les conditions du produit.', limits: 'Limites', accountLevel: 'Niveau du compte', minInvestment: 'Investissement minimum', minWithdraw: 'Retrait minimum', dailyMax: 'Plafond de retrait quotidien', notes: 'Notes', question: 'Une question sur les frais ? Contacter le support' },
  pt: { title: 'Taxas e limites', intro: 'Fonte única para taxas da plataforma e limites da conta.', trading: 'Taxas de negociação', tradingNote: 'Cobradas quando uma ordem é executada', rwaCompute: 'Ativos RWA / computação de IA', stocks: 'Cestas de ações', prediction: 'Mercados de previsão', predictionSplit: 'entrada + pagamento', tbill: 'T-Bills tokenizados', minFee: 'Taxa mínima por ordem', tradingRule: 'As taxas são percentuais do valor executado; o mínimo vale abaixo do limite.', network: 'Taxas de rede para saque', networkNote: 'O custo varia com o congestionamento e aparece na confirmação.', management: 'Taxas de gestão', managementNote: 'Anualizadas e descontadas do retorno, sem cobrança separada.', redemption: 'Resgate e bloqueios', redemptionNote: 'Saídas antecipadas seguem os termos do produto.', limits: 'Limites', accountLevel: 'Nível da conta', minInvestment: 'Investimento mínimo', minWithdraw: 'Saque mínimo', dailyMax: 'Limite diário de saque', notes: 'Notas', question: 'Dúvidas sobre taxas? Fale com o suporte' },
}

const pct = (value: number) => `${(value * 100).toFixed(2)}%`

export function FeesScreen({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const copy = feesCopy[locale]
  const localizedNotes = locale === 'zh-CN' ? FEE_SCHEDULE.notes : [copy.tradingRule, copy.networkNote, copy.managementNote, copy.redemptionNote]
  return (
    <section className="screen fees-screen">
      <RwaTopbar screen="fees" title={copy.title} onBack={() => go('profile')} />

      <header className="fees-header">
        <h1>{copy.title}</h1>
        <small>{copy.intro} · v{FEE_SCHEDULE.version} · {FEE_SCHEDULE.updatedAt}</small>
      </header>

      <section className="fees-block glass">
        <div className="fees-block-head"><BadgePercent size={17} /><b>{copy.trading}</b><small>{copy.tradingNote}</small></div>
        <div className="fees-rows">
          <span><small>{copy.rwaCompute}</small><b className="money-sm">{pct(FEE_SCHEDULE.order.default)}</b></span>
          <span><small>{copy.stocks}</small><b className="money-sm">{pct(FEE_SCHEDULE.order.stocks)}</b></span>
          <span><small>{copy.prediction} · {copy.predictionSplit}</small><b className="money-sm">{pct(FEE_SCHEDULE.order.prediction)} + {pct(FEE_SCHEDULE.order.predictionPayout)}</b></span>
          <span><small>{copy.tbill}</small><b className="money-sm">{pct(FEE_SCHEDULE.order.tbill)}</b></span>
          <span><small>{copy.minFee}</small><b className="money-sm">{FEE_SCHEDULE.order.minFeeUsdt.toFixed(2)} USDT</b></span>
        </div>
        <p className="fees-note"><Percent size={13} /> {copy.tradingRule}</p>
      </section>

      <section className="fees-block glass">
        <div className="fees-block-head"><Network size={17} /><b>{copy.network}</b><small>{copy.networkNote}</small></div>
        <div className="fees-rows">
          {Object.entries(FEE_SCHEDULE.network).map(([chain, fee]) => (
            <span key={chain}><small>{chain}</small><b className="money-sm">{fee.toFixed(2)} USDT</b></span>
          ))}
        </div>
        <p className="fees-note"><Coins size={13} /> {copy.networkNote}</p>
      </section>

      <section className="fees-block glass">
        <div className="fees-block-head"><Banknote size={17} /><b>{copy.management}</b><small>{copy.managementNote}</small></div>
        <div className="fees-rows">
          <span><small>{copy.rwaCompute}</small><b className="money-sm">{pct(FEE_SCHEDULE.management.rwa)} / yr</b></span>
          <span><small>{copy.management}</small><b className="money-sm">{pct(FEE_SCHEDULE.management.compute)} / yr</b></span>
          <span><small>{copy.stocks}</small><b className="money-sm">{pct(FEE_SCHEDULE.management.stocks)}</b></span>
          <span><small>{copy.prediction}</small><b className="money-sm">{pct(FEE_SCHEDULE.management.prediction)}</b></span>
        </div>
        <p className="fees-note"><Info size={13} /> {copy.managementNote}</p>
      </section>

      <section className="fees-block glass">
        <div className="fees-block-head"><Lock size={17} /><b>{copy.redemption}</b><small>{copy.redemptionNote}</small></div>
        <div className="fees-rows">
          <span><small>{copy.redemption}</small><b className="money-sm">{pct(FEE_SCHEDULE.redemption.feeRate)}</b></span>
        </div>
        <p className="fees-note"><Info size={13} /> {locale === 'zh-CN' ? FEE_SCHEDULE.redemption.earlyExitNote : copy.redemptionNote}</p>
      </section>

      <section className="fees-block glass">
        <div className="fees-block-head"><Coins size={17} /><b>{copy.limits}</b><small>{copy.accountLevel}</small></div>
        <div className="fees-rows">
          <span><small>{copy.minInvestment}</small><b className="money-sm">{FEE_SCHEDULE.limits.minInvestmentUsdt} USDT</b></span>
          <span><small>{copy.minWithdraw}</small><b className="money-sm">{FEE_SCHEDULE.limits.minWithdrawUsdt} USDT</b></span>
          <span><small>{copy.dailyMax}</small><b className="money-sm">{FEE_SCHEDULE.limits.maxDailyWithdrawUsdt.toLocaleString()} USDT</b></span>
        </div>
      </section>

      <section className="fees-notes glass">
        <b>{copy.notes}</b>
        {localizedNotes.map((note) => (
          <p key={note}><Info size={13} /> {note}</p>
        ))}
      </section>

      <button className="quiet-action" type="button" onClick={() => go('support')}>{copy.question}</button>
    </section>
  )
}
