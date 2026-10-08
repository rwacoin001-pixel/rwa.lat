import type { AppLocale } from '@/lib/app-locales'

/** `/assets/predictions` — the user's own prediction bets. Status words follow the server states placed / won / lost / void. */
export type MyPredictionsCopy = {
  entry: string; entryBody: string
  kicker: string; title: string; lede: string
  stats: { bets: string; inPlay: string; paidOut: string }
  partial: string
  filterLabel: string; filters: { all: string; open: string; won: string; lost: string; void: string }
  status: { placed: string; won: string; lost: string; void: string; unknown: string }
  sides: { yes: string; no: string }
  market: string; stake: string; fee: string; price: string; shares: string; placedAt: string; settledAt: string
  ifRight: string; ifRightNote: string; payout: string; payoutNote: string; noPayout: string; refund: string; refundNote: string; refundFull: string
  open: string; backed: string
  empty: { title: string; body: string; cta: string }
  filterEmpty: string
  loadError: string; loadMore: string; loadingMore: string
}

const en: MyPredictionsCopy = {
  entry: 'My predictions', entryBody: 'Bets you placed and their results',
  kicker: 'Prediction markets', title: 'My predictions', lede: 'Every bet you placed, what it is waiting on, and what it paid.',
  stats: { bets: 'Bets', inPlay: 'In play', paidOut: 'Won (net)' },
  partial: 'Totals cover the {n} most recent bets.',
  filterLabel: 'Filter by result', filters: { all: 'All', open: 'Waiting', won: 'Won', lost: 'Lost', void: 'Refunded' },
  status: { placed: 'Awaiting result', won: 'Won', lost: 'Lost', void: 'Refunded', unknown: 'Unknown' },
  sides: { yes: 'Yes', no: 'No' },
  market: 'Prediction market', stake: 'Stake', fee: 'Entry fee', price: 'Entry price', shares: 'Shares', placedAt: 'Placed', settledAt: 'Settled',
  ifRight: 'Payout if right', ifRightNote: 'Before the payout fee. Your stake is held until the market resolves.',
  payout: 'Paid to you', payoutNote: 'After a {fee} payout fee', noPayout: 'The outcome did not hit, so there is no payout.',
  refund: 'Refunded', refundNote: 'The {fee} entry fee is not refunded.', refundFull: 'The full stake was returned to your balance.',
  open: 'Open market', backed: 'Backed {outcome}',
  empty: { title: 'No predictions yet', body: 'Pick a market, choose a side and your bets will be tracked here.', cta: 'Browse prediction markets' },
  filterEmpty: 'No bets in this view.',
  loadError: 'Your predictions could not be loaded', loadMore: 'Load older bets', loadingMore: 'Loading…',
}

const zh: MyPredictionsCopy = {
  entry: '我的预测', entryBody: '查看已下的注与结果',
  kicker: '预测市场', title: '我的预测', lede: '你下过的每一注、当前在等什么、最终派了多少。',
  stats: { bets: '下注笔数', inPlay: '进行中', paidOut: '已中（净额）' },
  partial: '合计仅覆盖最近 {n} 笔。',
  filterLabel: '按结果筛选', filters: { all: '全部', open: '等待中', won: '已中', lost: '未中', void: '已退款' },
  status: { placed: '等待市场判定', won: '已中', lost: '未中', void: '已退款', unknown: '未知' },
  sides: { yes: '是', no: '否' },
  market: '预测市场', stake: '本金', fee: '下注手续费', price: '成交价', shares: '份额', placedAt: '下注时间', settledAt: '结算时间',
  ifRight: '押中可得', ifRightNote: '未扣派彩费。本金已扣，待市场结束后结算。',
  payout: '到账派彩', payoutNote: '已扣 {fee} 派彩费', noPayout: '结果未押中，无派彩。',
  refund: '已退回', refundNote: '{fee} 下注手续费不退。', refundFull: '本金已全额退回你的余额。',
  open: '查看市场', backed: '押 {outcome}',
  empty: { title: '还没有下过注', body: '挑一个市场、选一边，你的下注会记录在这里。', cta: '去预测市场看看' },
  filterEmpty: '这个分类下没有下注。',
  loadError: '预测记录加载失败', loadMore: '加载更早的下注', loadingMore: '加载中…',
}

const hi: MyPredictionsCopy = {
  entry: 'मेरी भविष्यवाणियाँ', entryBody: 'आपके दांव और उनके नतीजे',
  kicker: 'प्रेडिक्शन मार्केट', title: 'मेरी भविष्यवाणियाँ', lede: 'आपका हर दांव, वह किसका इंतज़ार कर रहा है और कितना मिला।',
  stats: { bets: 'दांव', inPlay: 'जारी', paidOut: 'जीत (शुद्ध)' },
  partial: 'कुल केवल हाल के {n} दांवों का है।',
  filterLabel: 'नतीजे से फ़िल्टर करें', filters: { all: 'सभी', open: 'प्रतीक्षा', won: 'जीते', lost: 'हारे', void: 'वापस' },
  status: { placed: 'नतीजे की प्रतीक्षा', won: 'जीते', lost: 'हारे', void: 'वापस किया गया', unknown: 'अज्ञात' },
  sides: { yes: 'हाँ', no: 'नहीं' },
  market: 'प्रेडिक्शन मार्केट', stake: 'राशि', fee: 'प्रवेश शुल्क', price: 'प्रवेश मूल्य', shares: 'शेयर', placedAt: 'लगाया', settledAt: 'निपटान',
  ifRight: 'सही होने पर भुगतान', ifRightNote: 'भुगतान शुल्क से पहले। मार्केट तय होने तक राशि रुकी रहती है।',
  payout: 'आपको मिला', payoutNote: '{fee} भुगतान शुल्क के बाद', noPayout: 'नतीजा सही नहीं रहा, इसलिए कोई भुगतान नहीं।',
  refund: 'वापस', refundNote: '{fee} प्रवेश शुल्क वापस नहीं होता।', refundFull: 'पूरी राशि आपके शेष में लौटा दी गई।',
  open: 'मार्केट खोलें', backed: '{outcome} पर दांव',
  empty: { title: 'अभी कोई भविष्यवाणी नहीं', body: 'कोई मार्केट चुनें, एक पक्ष लें; आपके दांव यहाँ दिखेंगे।', cta: 'प्रेडिक्शन मार्केट देखें' },
  filterEmpty: 'इस दृश्य में कोई दांव नहीं।',
  loadError: 'आपकी भविष्यवाणियाँ लोड नहीं हो सकीं', loadMore: 'पुराने दांव लोड करें', loadingMore: 'लोड हो रहा है…',
}

const es: MyPredictionsCopy = {
  entry: 'Mis predicciones', entryBody: 'Tus apuestas y sus resultados',
  kicker: 'Mercados de predicción', title: 'Mis predicciones', lede: 'Cada apuesta que hiciste, qué espera y cuánto pagó.',
  stats: { bets: 'Apuestas', inPlay: 'En juego', paidOut: 'Ganado (neto)' },
  partial: 'Los totales cubren las {n} apuestas más recientes.',
  filterLabel: 'Filtrar por resultado', filters: { all: 'Todas', open: 'En espera', won: 'Ganadas', lost: 'Perdidas', void: 'Reembolsadas' },
  status: { placed: 'Esperando resultado', won: 'Ganada', lost: 'Perdida', void: 'Reembolsada', unknown: 'Desconocido' },
  sides: { yes: 'Sí', no: 'No' },
  market: 'Mercado de predicción', stake: 'Importe', fee: 'Comisión de entrada', price: 'Precio de entrada', shares: 'Participaciones', placedAt: 'Realizada', settledAt: 'Liquidada',
  ifRight: 'Pago si aciertas', ifRightNote: 'Antes de la comisión de pago. Tu importe queda retenido hasta que el mercado se resuelva.',
  payout: 'Pagado a ti', payoutNote: 'Tras una comisión de pago de {fee}', noPayout: 'El resultado no se cumplió, así que no hay pago.',
  refund: 'Reembolsado', refundNote: 'La comisión de entrada de {fee} no se reembolsa.', refundFull: 'El importe completo volvió a tu saldo.',
  open: 'Abrir mercado', backed: 'Apostaste a {outcome}',
  empty: { title: 'Aún no hay predicciones', body: 'Elige un mercado y un lado; tus apuestas aparecerán aquí.', cta: 'Ver mercados de predicción' },
  filterEmpty: 'No hay apuestas en esta vista.',
  loadError: 'No se pudieron cargar tus predicciones', loadMore: 'Cargar apuestas anteriores', loadingMore: 'Cargando…',
}

const ar: MyPredictionsCopy = {
  entry: 'توقعاتي', entryBody: 'رهاناتك ونتائجها',
  kicker: 'أسواق التوقعات', title: 'توقعاتي', lede: 'كل رهان وضعته، وما ينتظره، وكم دفع.',
  stats: { bets: 'الرهانات', inPlay: 'قيد اللعب', paidOut: 'المكسوب (صافي)' },
  partial: 'الإجماليات تغطي أحدث {n} رهانًا.',
  filterLabel: 'التصفية حسب النتيجة', filters: { all: 'الكل', open: 'بانتظار', won: 'رابحة', lost: 'خاسرة', void: 'مستردة' },
  status: { placed: 'بانتظار النتيجة', won: 'رابح', lost: 'خاسر', void: 'مُسترد', unknown: 'غير معروف' },
  sides: { yes: 'نعم', no: 'لا' },
  market: 'سوق توقعات', stake: 'المبلغ', fee: 'رسوم الدخول', price: 'سعر الدخول', shares: 'الحصص', placedAt: 'وُضع', settledAt: 'سُوّي',
  ifRight: 'الدفع عند الصحة', ifRightNote: 'قبل رسوم الدفع. يبقى مبلغك محجوزًا حتى يُحسم السوق.',
  payout: 'المدفوع لك', payoutNote: 'بعد رسوم دفع {fee}', noPayout: 'لم تتحقق النتيجة، لذا لا يوجد دفع.',
  refund: 'مُسترد', refundNote: 'رسوم الدخول {fee} غير قابلة للاسترداد.', refundFull: 'أُعيد المبلغ كاملًا إلى رصيدك.',
  open: 'فتح السوق', backed: 'راهنت على {outcome}',
  empty: { title: 'لا توجد توقعات بعد', body: 'اختر سوقًا وجانبًا وستظهر رهاناتك هنا.', cta: 'تصفح أسواق التوقعات' },
  filterEmpty: 'لا توجد رهانات في هذا العرض.',
  loadError: 'تعذر تحميل توقعاتك', loadMore: 'تحميل الرهانات الأقدم', loadingMore: 'جارٍ التحميل…',
}

const fr: MyPredictionsCopy = {
  entry: 'Mes prédictions', entryBody: 'Vos paris et leurs résultats',
  kicker: 'Marchés de prédiction', title: 'Mes prédictions', lede: 'Chaque pari placé, ce qu’il attend et ce qu’il a rapporté.',
  stats: { bets: 'Paris', inPlay: 'En jeu', paidOut: 'Gagné (net)' },
  partial: 'Les totaux couvrent les {n} paris les plus récents.',
  filterLabel: 'Filtrer par résultat', filters: { all: 'Tous', open: 'En attente', won: 'Gagnés', lost: 'Perdus', void: 'Remboursés' },
  status: { placed: 'En attente du résultat', won: 'Gagné', lost: 'Perdu', void: 'Remboursé', unknown: 'Inconnu' },
  sides: { yes: 'Oui', no: 'Non' },
  market: 'Marché de prédiction', stake: 'Mise', fee: 'Frais d’entrée', price: 'Prix d’entrée', shares: 'Parts', placedAt: 'Placé', settledAt: 'Réglé',
  ifRight: 'Gain si vous avez raison', ifRightNote: 'Avant les frais de paiement. Votre mise est bloquée jusqu’à la résolution du marché.',
  payout: 'Versé', payoutNote: 'Après {fee} de frais de paiement', noPayout: 'Le résultat ne s’est pas réalisé : aucun gain.',
  refund: 'Remboursé', refundNote: 'Les frais d’entrée de {fee} ne sont pas remboursés.', refundFull: 'La mise complète a été rendue à votre solde.',
  open: 'Ouvrir le marché', backed: 'Pari sur {outcome}',
  empty: { title: 'Aucune prédiction pour l’instant', body: 'Choisissez un marché et un camp : vos paris apparaîtront ici.', cta: 'Voir les marchés de prédiction' },
  filterEmpty: 'Aucun pari dans cette vue.',
  loadError: 'Impossible de charger vos prédictions', loadMore: 'Charger les paris plus anciens', loadingMore: 'Chargement…',
}

const pt: MyPredictionsCopy = {
  entry: 'Minhas previsões', entryBody: 'Suas apostas e resultados',
  kicker: 'Mercados de previsão', title: 'Minhas previsões', lede: 'Cada aposta que você fez, o que ela aguarda e quanto pagou.',
  stats: { bets: 'Apostas', inPlay: 'Em jogo', paidOut: 'Ganho (líquido)' },
  partial: 'Os totais cobrem as {n} apostas mais recentes.',
  filterLabel: 'Filtrar por resultado', filters: { all: 'Todas', open: 'Aguardando', won: 'Ganhas', lost: 'Perdidas', void: 'Reembolsadas' },
  status: { placed: 'Aguardando resultado', won: 'Ganha', lost: 'Perdida', void: 'Reembolsada', unknown: 'Desconhecido' },
  sides: { yes: 'Sim', no: 'Não' },
  market: 'Mercado de previsão', stake: 'Valor', fee: 'Taxa de entrada', price: 'Preço de entrada', shares: 'Cotas', placedAt: 'Feita', settledAt: 'Liquidada',
  ifRight: 'Pagamento se acertar', ifRightNote: 'Antes da taxa de pagamento. Seu valor fica retido até o mercado ser resolvido.',
  payout: 'Pago a você', payoutNote: 'Após taxa de pagamento de {fee}', noPayout: 'O resultado não se concretizou, então não há pagamento.',
  refund: 'Reembolsado', refundNote: 'A taxa de entrada de {fee} não é reembolsada.', refundFull: 'O valor total voltou ao seu saldo.',
  open: 'Abrir mercado', backed: 'Apostou em {outcome}',
  empty: { title: 'Ainda não há previsões', body: 'Escolha um mercado e um lado; suas apostas aparecerão aqui.', cta: 'Ver mercados de previsão' },
  filterEmpty: 'Nenhuma aposta nesta visão.',
  loadError: 'Não foi possível carregar suas previsões', loadMore: 'Carregar apostas anteriores', loadingMore: 'Carregando…',
}

export const myPredictionsCopy: Record<AppLocale, MyPredictionsCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }

/** Labels used only by the `/assets/predictions` screen; the shared copy above also feeds the `/assets` entry card. */
export type MyPredictionsScreenCopy = {
  summaryLabel: string; stakeLabel: string; inPlayStake: string; paidPayout: string
  scope: string; scopeInfo: string; scopeNote: string
  statusShort: { placed: string; won: string; lost: string; void: string; unknown: string }
  payoutBeforeFee: string; payoutPaid: string; payoutLost: string; payoutRefund: string; payoutUnknown: string
  details: string; marketTitle: string; payoutFee: string; pending: string
  moreInfo: string; wonNote: string; unknownNote: string
}

const enScreen: MyPredictionsScreenCopy = {
  summaryLabel: 'Prediction summary', stakeLabel: 'Amount placed', inPlayStake: 'Amount in play', paidPayout: 'Paid out',
  scope: 'Loaded {m} of {n} bets', scopeInfo: 'About these totals',
  scopeNote: 'Bets counts every bet on your account. Amount in play, paid out and the filter counts add up only the {m} loaded bets; load older bets to include more. Amount in play is the full amount placed, including entry fees. Paid out is the net amount credited after payout fees, not profit.',
  statusShort: { placed: 'Waiting', won: 'Won', lost: 'Lost', void: 'Refunded', unknown: 'Unknown' },
  payoutBeforeFee: 'Payout if right · before fee', payoutPaid: 'Paid out', payoutLost: 'Payout', payoutRefund: 'Refunded', payoutUnknown: 'Payout',
  details: 'Details', marketTitle: 'Market', payoutFee: 'Payout fee', pending: 'Awaiting settlement',
  moreInfo: 'About these amounts', wonNote: 'Paid out is the net amount credited to you after the payout fee, not profit. Profit is paid out minus the amount placed, which already includes the entry fee.',
  unknownNote: 'This bet has a status we do not recognise yet, so no payout is shown.',
}

const zhScreen: MyPredictionsScreenCopy = {
  summaryLabel: '预测摘要', stakeLabel: '投注金额', inPlayStake: '进行中金额', paidPayout: '到账派彩',
  scope: '已载入 {m} / 共 {n} 笔', scopeInfo: '统计说明',
  scopeNote: '下注笔数为本账户全部下注。进行中金额、到账派彩与筛选数量仅统计已载入的 {m} 笔；加载更早的下注后会一并计入。进行中金额为下注时扣除的全部金额，已含下注手续费；到账派彩为扣除派彩费后实际到账的金额，不等于利润。',
  statusShort: { placed: '等待中', won: '已中', lost: '未中', void: '已退款', unknown: '未知' },
  payoutBeforeFee: '押中可得（未扣费）', payoutPaid: '到账派彩', payoutLost: '派彩', payoutRefund: '已退回', payoutUnknown: '派彩',
  details: '明细', marketTitle: '市场', payoutFee: '派彩费', pending: '待市场结算',
  moreInfo: '金额说明', wonNote: '到账派彩是扣除派彩费后实际到账的金额，并不等于利润。盈亏为到账派彩减去投注金额；投注金额已含下注手续费，无需再减。',
  unknownNote: '该笔状态暂无法识别，因此不显示派彩。',
}

const hiScreen: MyPredictionsScreenCopy = {
  summaryLabel: 'भविष्यवाणी सारांश', stakeLabel: 'लगाई गई राशि', inPlayStake: 'जारी राशि', paidPayout: 'मिला भुगतान',
  scope: '{n} में से {m} दांव लोड हुए', scopeInfo: 'इन कुल के बारे में',
  scopeNote: 'दांव की संख्या आपके खाते के सभी दांव गिनती है। जारी राशि, मिला भुगतान और फ़िल्टर गिनती केवल लोड हुए {m} दांवों को जोड़ते हैं; पुराने दांव लोड करने पर वे भी जुड़ेंगे। जारी राशि लगाई गई पूरी राशि है, जिसमें प्रवेश शुल्क शामिल है। मिला भुगतान, भुगतान शुल्क के बाद जमा हुई शुद्ध राशि है, लाभ नहीं।',
  statusShort: { placed: 'प्रतीक्षा', won: 'जीते', lost: 'हारे', void: 'वापस', unknown: 'अज्ञात' },
  payoutBeforeFee: 'सही होने पर · शुल्क से पहले', payoutPaid: 'मिला भुगतान', payoutLost: 'भुगतान', payoutRefund: 'वापस', payoutUnknown: 'भुगतान',
  details: 'विवरण', marketTitle: 'मार्केट', payoutFee: 'भुगतान शुल्क', pending: 'निपटान की प्रतीक्षा',
  moreInfo: 'राशि के बारे में', wonNote: 'मिला भुगतान, भुगतान शुल्क के बाद आपके खाते में जमा शुद्ध राशि है, लाभ नहीं। लाभ = मिला भुगतान − लगाई गई राशि; इस राशि में प्रवेश शुल्क पहले से शामिल है।',
  unknownNote: 'इस दांव की स्थिति अभी पहचानी नहीं गई, इसलिए कोई भुगतान नहीं दिखाया गया।',
}

const esScreen: MyPredictionsScreenCopy = {
  summaryLabel: 'Resumen de predicciones', stakeLabel: 'Importe apostado', inPlayStake: 'Importe en juego', paidPayout: 'Pagado',
  scope: 'Cargadas {m} de {n} apuestas', scopeInfo: 'Sobre estos totales',
  scopeNote: 'Apuestas cuenta todas las de tu cuenta. Importe en juego, pagado y los contadores de filtros suman solo las {m} apuestas cargadas; carga apuestas anteriores para incluir más. El importe en juego es el total apostado, incluidas las comisiones de entrada. Pagado es el importe neto abonado tras la comisión de pago, no la ganancia.',
  statusShort: { placed: 'En espera', won: 'Ganada', lost: 'Perdida', void: 'Reembolsada', unknown: 'Desconocido' },
  payoutBeforeFee: 'Pago si aciertas · antes de comisión', payoutPaid: 'Pagado', payoutLost: 'Pago', payoutRefund: 'Reembolsado', payoutUnknown: 'Pago',
  details: 'Detalles', marketTitle: 'Mercado', payoutFee: 'Comisión de pago', pending: 'Pendiente de liquidación',
  moreInfo: 'Sobre estos importes', wonNote: 'Pagado es el importe neto abonado tras la comisión de pago, no la ganancia. La ganancia es lo pagado menos el importe apostado, que ya incluye la comisión de entrada.',
  unknownNote: 'El estado de esta apuesta aún no se reconoce, así que no se muestra pago.',
}

const arScreen: MyPredictionsScreenCopy = {
  summaryLabel: 'ملخص التوقعات', stakeLabel: 'المبلغ المُراهَن', inPlayStake: 'المبلغ قيد اللعب', paidPayout: 'المدفوع',
  scope: 'تم تحميل {m} من {n} رهانًا', scopeInfo: 'حول هذه الإجماليات',
  scopeNote: 'عدد الرهانات يشمل كل رهانات حسابك. المبلغ قيد اللعب والمدفوع وأعداد التصفية تجمع فقط الرهانات المحمّلة ({m})؛ حمّل الرهانات الأقدم لإضافتها. المبلغ قيد اللعب هو كامل المبلغ المُراهَن، بما في ذلك رسوم الدخول. المدفوع هو صافي ما أُضيف إلى رصيدك بعد رسوم الدفع، وليس ربحًا.',
  statusShort: { placed: 'بانتظار', won: 'رابح', lost: 'خاسر', void: 'مُسترد', unknown: 'غير معروف' },
  payoutBeforeFee: 'الدفع عند الصحة · قبل الرسوم', payoutPaid: 'المدفوع', payoutLost: 'الدفع', payoutRefund: 'مُسترد', payoutUnknown: 'الدفع',
  details: 'التفاصيل', marketTitle: 'السوق', payoutFee: 'رسوم الدفع', pending: 'بانتظار التسوية',
  moreInfo: 'حول هذه المبالغ', wonNote: 'المدفوع هو صافي المبلغ المُضاف إلى رصيدك بعد رسوم الدفع، وليس ربحًا. الربح هو المدفوع ناقص المبلغ المُراهَن، وهذا المبلغ يشمل رسوم الدخول مسبقًا.',
  unknownNote: 'حالة هذا الرهان غير معروفة بعد، لذا لا يُعرض أي دفع.',
}

const frScreen: MyPredictionsScreenCopy = {
  summaryLabel: 'Résumé des prédictions', stakeLabel: 'Montant misé', inPlayStake: 'Montant en jeu', paidPayout: 'Versé',
  scope: '{m} paris chargés sur {n}', scopeInfo: 'À propos de ces totaux',
  scopeNote: 'Paris compte tous les paris de votre compte. Montant en jeu, versé et les compteurs de filtres ne totalisent que les {m} paris chargés ; chargez les paris plus anciens pour les inclure. Le montant en jeu est le total misé, frais d’entrée compris. Versé est le montant net crédité après frais de paiement, pas un bénéfice.',
  statusShort: { placed: 'En attente', won: 'Gagné', lost: 'Perdu', void: 'Remboursé', unknown: 'Inconnu' },
  payoutBeforeFee: 'Gain si juste · avant frais', payoutPaid: 'Versé', payoutLost: 'Gain', payoutRefund: 'Remboursé', payoutUnknown: 'Gain',
  details: 'Détails', marketTitle: 'Marché', payoutFee: 'Frais de paiement', pending: 'En attente de règlement',
  moreInfo: 'À propos de ces montants', wonNote: 'Versé est le montant net crédité après frais de paiement, pas un bénéfice. Le bénéfice correspond au versé moins le montant misé, qui inclut déjà les frais d’entrée.',
  unknownNote: 'Le statut de ce pari n’est pas encore reconnu : aucun gain n’est affiché.',
}

const ptScreen: MyPredictionsScreenCopy = {
  summaryLabel: 'Resumo das previsões', stakeLabel: 'Valor apostado', inPlayStake: 'Valor em jogo', paidPayout: 'Pago',
  scope: '{m} de {n} apostas carregadas', scopeInfo: 'Sobre estes totais',
  scopeNote: 'Apostas conta todas as apostas da sua conta. Valor em jogo, pago e as contagens dos filtros somam só as {m} apostas carregadas; carregue apostas anteriores para incluí-las. O valor em jogo é o total apostado, já incluindo as taxas de entrada. Pago é o valor líquido creditado após a taxa de pagamento, não lucro.',
  statusShort: { placed: 'Aguardando', won: 'Ganha', lost: 'Perdida', void: 'Reembolsada', unknown: 'Desconhecido' },
  payoutBeforeFee: 'Pagamento se acertar · antes da taxa', payoutPaid: 'Pago', payoutLost: 'Pagamento', payoutRefund: 'Reembolsado', payoutUnknown: 'Pagamento',
  details: 'Detalhes', marketTitle: 'Mercado', payoutFee: 'Taxa de pagamento', pending: 'Aguardando liquidação',
  moreInfo: 'Sobre estes valores', wonNote: 'Pago é o valor líquido creditado a você após a taxa de pagamento, não lucro. O lucro é o pago menos o valor apostado, que já inclui a taxa de entrada.',
  unknownNote: 'O status desta aposta ainda não é reconhecido, então nenhum pagamento é exibido.',
}

export const myPredictionsScreenCopy: Record<AppLocale, MyPredictionsScreenCopy> = { en: enScreen, 'zh-CN': zhScreen, hi: hiScreen, es: esScreen, ar: arScreen, fr: frScreen, pt: ptScreen }
