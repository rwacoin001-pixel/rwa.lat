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
