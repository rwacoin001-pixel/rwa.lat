import type { AppLocale } from '@/lib/app-locales'

/** Assets domain copy: portfolio overview (/assets) and position detail (/assets/positions/:id). `{x}` tokens go through fill(). */
export type PortfolioCopy = {
  kicker: string; title: string; total: string; totalNote: string; valued: string
  marketValue: string; cost: string; pnl: string; yield: string; available: string; locked: string; pending: string
  tabs: [string, string, string, string]
  allocation: string; allocationNote: string; cash: string
  /** First-run guide shown instead of a wall of zeros when the account holds nothing and has no cash. */
  start: { title: string; steps: [string, string, string]; deposit: string }
  positions: string; positionsEmpty: string; positionsEmptyBody: string; browse: string; qty: string; weight: string; value: string
  history: string; historyNote: string; historyEmpty: string; historyEmptyBody: string
  income: string; incomeNote: string; incomeEmpty: string; incomeEmptyBody: string; period: string
  orders: string; ordersNote: string; ordersEmpty: string; allOrders: string
  tools: { cash: string; activity: string; calendar: string; rebalance: string; statements: string }
  product: string; loadError: string
  detail: {
    title: string; notFound: string; notFoundBody: string; unitPrice: string; quantity: string; outcome: string
    source: string; investMore: string; research: string; incomeFor: string; ordersFor: string; back: string
  }
}

const en: PortfolioCopy = {
  kicker: 'Portfolio', title: 'My assets', total: 'Total assets', totalNote: 'Positions at latest quote + cash (available and locked in open orders).', valued: 'Valued {t}',
  marketValue: 'Market value', cost: 'Cost basis', pnl: 'Unrealised P&L', yield: 'Cumulative yield', available: 'Available', locked: 'Locked', pending: 'Pending',
  tabs: ['Overview', 'Positions', 'Income', 'Orders'],
  allocation: 'Allocation', allocationNote: 'By market value', cash: 'Cash',
  start: { title: 'Make your first investment', steps: ['Add USDT', 'Pick a listed product', 'Your holdings and income appear here once you invest'], deposit: 'Add funds' },
  positions: 'Positions', positionsEmpty: 'No positions yet', positionsEmptyBody: 'Invest in a listed product and it will appear here.', browse: 'Browse markets', qty: 'Qty', weight: 'Weight', value: 'Value',
  history: 'Value history', historyNote: 'Position snapshots', historyEmpty: 'Not enough history yet', historyEmptyBody: 'The chart appears once there are two valuation snapshots.',
  income: 'Income', incomeNote: 'Credited distributions', incomeEmpty: 'No income credited yet', incomeEmptyBody: 'Distributions show here once they are credited to your account.', period: 'Period',
  orders: 'Open orders', ordersNote: 'Refreshes while pending', ordersEmpty: 'No open orders', allOrders: 'All orders',
  tools: { cash: 'Cash & wallet', activity: 'Activity', calendar: 'Yield calendar', rebalance: 'Rebalance', statements: 'Statements' },
  product: 'Product', loadError: 'Could not load this section',
  detail: {
    title: 'Position', notFound: 'Position not found', notFoundBody: 'It may have been fully redeemed, or it belongs to another account.', unitPrice: 'Unit price', quantity: 'Quantity', outcome: 'Outcome',
    source: 'Source', investMore: 'Invest more', research: 'Product page', incomeFor: 'Income from this position', ordersFor: 'Orders for this product', back: 'My assets',
  },
}

const zh: PortfolioCopy = {
  kicker: '投资组合', title: '我的资产', total: '总资产', totalNote: '持仓按最新报价估值 + 现金（可用及挂单锁定）。', valued: '估值于 {t}',
  marketValue: '持仓市值', cost: '持仓成本', pnl: '未实现盈亏', yield: '累计收益', available: '可用', locked: '锁定', pending: '处理中',
  tabs: ['总览', '持仓', '收益', '订单'],
  allocation: '资产配置', allocationNote: '按市值', cash: '现金',
  start: { title: '开始第一笔投资', steps: ['充值 USDT', '挑选在售产品', '申购后，持仓和收益会显示在这里'], deposit: '去充值' },
  positions: '持仓', positionsEmpty: '暂无持仓', positionsEmptyBody: '申购在售产品后，持仓会显示在这里。', browse: '浏览市场', qty: '数量', weight: '占比', value: '市值',
  history: '价值走势', historyNote: '持仓快照', historyEmpty: '历史数据不足', historyEmptyBody: '至少有两次估值快照后才显示走势。',
  income: '收益', incomeNote: '已入账分配', incomeEmpty: '暂无已入账收益', incomeEmptyBody: '收益分配入账后会显示在这里。', period: '计息期',
  orders: '进行中订单', ordersNote: '处理中自动刷新', ordersEmpty: '暂无进行中订单', allOrders: '全部订单',
  tools: { cash: '现金与钱包', activity: '资金流水', calendar: '收益日历', rebalance: '再平衡', statements: '对账单' },
  product: '产品', loadError: '该部分加载失败',
  detail: {
    title: '持仓详情', notFound: '未找到该持仓', notFoundBody: '该持仓可能已全部赎回，或不属于当前账户。', unitPrice: '单位价格', quantity: '持有数量', outcome: '方向',
    source: '数据来源', investMore: '追加申购', research: '产品页', incomeFor: '该持仓收益', ordersFor: '该产品订单', back: '我的资产',
  },
}

const hi: PortfolioCopy = {
  kicker: 'पोर्टफोलियो', title: 'मेरी संपत्तियाँ', total: 'कुल संपत्ति', totalNote: 'नवीनतम कोट पर पोज़िशन + नकद (उपलब्ध और खुले ऑर्डर में लॉक)।', valued: '{t} पर मूल्यांकन',
  marketValue: 'बाज़ार मूल्य', cost: 'लागत आधार', pnl: 'अप्राप्त लाभ/हानि', yield: 'संचयी आय', available: 'उपलब्ध', locked: 'लॉक', pending: 'लंबित',
  tabs: ['सारांश', 'पोज़िशन', 'आय', 'ऑर्डर'],
  allocation: 'आवंटन', allocationNote: 'बाज़ार मूल्य के अनुसार', cash: 'नकद',
  start: { title: 'अपना पहला निवेश करें', steps: ['USDT जोड़ें', 'उपलब्ध प्रोडक्ट चुनें', 'निवेश के बाद आपकी पोज़िशन और आय यहाँ दिखेगी'], deposit: 'फंड जोड़ें' },
  positions: 'पोज़िशन', positionsEmpty: 'अभी कोई पोज़िशन नहीं', positionsEmptyBody: 'किसी सूचीबद्ध उत्पाद में निवेश करें, वह यहाँ दिखेगा।', browse: 'बाज़ार देखें', qty: 'मात्रा', weight: 'भार', value: 'मूल्य',
  history: 'मूल्य इतिहास', historyNote: 'पोज़िशन स्नैपशॉट', historyEmpty: 'अभी पर्याप्त इतिहास नहीं', historyEmptyBody: 'दो मूल्यांकन स्नैपशॉट के बाद चार्ट दिखेगा।',
  income: 'आय', incomeNote: 'जमा वितरण', incomeEmpty: 'अभी कोई आय जमा नहीं', incomeEmptyBody: 'वितरण खाते में जमा होने पर यहाँ दिखेंगे।', period: 'अवधि',
  orders: 'खुले ऑर्डर', ordersNote: 'लंबित रहते हुए रीफ़्रेश', ordersEmpty: 'कोई खुला ऑर्डर नहीं', allOrders: 'सभी ऑर्डर',
  tools: { cash: 'नकद और वॉलेट', activity: 'गतिविधि', calendar: 'आय कैलेंडर', rebalance: 'पुनर्संतुलन', statements: 'विवरण' },
  product: 'उत्पाद', loadError: 'यह भाग लोड नहीं हो सका',
  detail: {
    title: 'पोज़िशन', notFound: 'पोज़िशन नहीं मिली', notFoundBody: 'यह पूरी तरह रिडीम हो चुकी हो सकती है या किसी अन्य खाते की है।', unitPrice: 'इकाई मूल्य', quantity: 'मात्रा', outcome: 'दिशा',
    source: 'स्रोत', investMore: 'और निवेश करें', research: 'उत्पाद पृष्ठ', incomeFor: 'इस पोज़िशन की आय', ordersFor: 'इस उत्पाद के ऑर्डर', back: 'मेरी संपत्तियाँ',
  },
}

const es: PortfolioCopy = {
  kicker: 'Cartera', title: 'Mis activos', total: 'Activos totales', totalNote: 'Posiciones a la última cotización + efectivo (disponible y bloqueado en órdenes abiertas).', valued: 'Valorado {t}',
  marketValue: 'Valor de mercado', cost: 'Coste base', pnl: 'P&G no realizado', yield: 'Rendimiento acumulado', available: 'Disponible', locked: 'Bloqueado', pending: 'Pendiente',
  tabs: ['Resumen', 'Posiciones', 'Ingresos', 'Órdenes'],
  allocation: 'Distribución', allocationNote: 'Por valor de mercado', cash: 'Efectivo',
  start: { title: 'Haz tu primera inversión', steps: ['Añade USDT', 'Elige un producto disponible', 'Tus posiciones e ingresos aparecerán aquí al invertir'], deposit: 'Añadir fondos' },
  positions: 'Posiciones', positionsEmpty: 'Aún no hay posiciones', positionsEmptyBody: 'Invierte en un producto listado y aparecerá aquí.', browse: 'Ver mercados', qty: 'Cant.', weight: 'Peso', value: 'Valor',
  history: 'Histórico de valor', historyNote: 'Instantáneas de posición', historyEmpty: 'Aún no hay suficiente histórico', historyEmptyBody: 'El gráfico aparece cuando hay dos instantáneas de valoración.',
  income: 'Ingresos', incomeNote: 'Distribuciones abonadas', incomeEmpty: 'Aún no hay ingresos abonados', incomeEmptyBody: 'Las distribuciones aparecen aquí cuando se abonan en tu cuenta.', period: 'Periodo',
  orders: 'Órdenes abiertas', ordersNote: 'Se actualiza mientras está pendiente', ordersEmpty: 'No hay órdenes abiertas', allOrders: 'Todas las órdenes',
  tools: { cash: 'Efectivo y billetera', activity: 'Actividad', calendar: 'Calendario de rendimientos', rebalance: 'Rebalancear', statements: 'Extractos' },
  product: 'Producto', loadError: 'No se pudo cargar esta sección',
  detail: {
    title: 'Posición', notFound: 'Posición no encontrada', notFoundBody: 'Puede haberse rescatado por completo o pertenecer a otra cuenta.', unitPrice: 'Precio unitario', quantity: 'Cantidad', outcome: 'Dirección',
    source: 'Fuente', investMore: 'Invertir más', research: 'Página del producto', incomeFor: 'Ingresos de esta posición', ordersFor: 'Órdenes de este producto', back: 'Mis activos',
  },
}

const ar: PortfolioCopy = {
  kicker: 'المحفظة', title: 'أصولي', total: 'إجمالي الأصول', totalNote: 'المراكز بآخر تسعير + النقد (المتاح والمحجوز في الأوامر المفتوحة).', valued: 'قُيّم في {t}',
  marketValue: 'القيمة السوقية', cost: 'أساس التكلفة', pnl: 'ربح/خسارة غير محققة', yield: 'العائد التراكمي', available: 'متاح', locked: 'محجوز', pending: 'قيد المعالجة',
  tabs: ['نظرة عامة', 'المراكز', 'الدخل', 'الأوامر'],
  allocation: 'التوزيع', allocationNote: 'حسب القيمة السوقية', cash: 'نقد',
  start: { title: 'ابدأ استثمارك الأول', steps: ['أضف USDT', 'اختر منتجًا متاحًا', 'ستظهر مراكزك وعوائدك هنا بعد الاستثمار'], deposit: 'إضافة أموال' },
  positions: 'المراكز', positionsEmpty: 'لا توجد مراكز بعد', positionsEmptyBody: 'استثمر في منتج مدرج وسيظهر هنا.', browse: 'تصفح الأسواق', qty: 'الكمية', weight: 'الوزن', value: 'القيمة',
  history: 'سجل القيمة', historyNote: 'لقطات المراكز', historyEmpty: 'لا يوجد سجل كافٍ بعد', historyEmptyBody: 'يظهر الرسم بعد لقطتي تقييم على الأقل.',
  income: 'الدخل', incomeNote: 'التوزيعات المضافة', incomeEmpty: 'لم يُضف أي دخل بعد', incomeEmptyBody: 'تظهر التوزيعات هنا عند إضافتها إلى حسابك.', period: 'الفترة',
  orders: 'الأوامر المفتوحة', ordersNote: 'تُحدَّث أثناء المعالجة', ordersEmpty: 'لا توجد أوامر مفتوحة', allOrders: 'كل الأوامر',
  tools: { cash: 'النقد والمحفظة', activity: 'النشاط', calendar: 'تقويم العائد', rebalance: 'إعادة التوازن', statements: 'الكشوفات' },
  product: 'المنتج', loadError: 'تعذر تحميل هذا القسم',
  detail: {
    title: 'المركز', notFound: 'المركز غير موجود', notFoundBody: 'ربما تم استرداده بالكامل أو يخص حسابًا آخر.', unitPrice: 'سعر الوحدة', quantity: 'الكمية', outcome: 'الاتجاه',
    source: 'المصدر', investMore: 'استثمر المزيد', research: 'صفحة المنتج', incomeFor: 'دخل هذا المركز', ordersFor: 'أوامر هذا المنتج', back: 'أصولي',
  },
}

const fr: PortfolioCopy = {
  kicker: 'Portefeuille', title: 'Mes actifs', total: 'Actifs totaux', totalNote: 'Positions au dernier cours + liquidités (disponibles et bloquées dans les ordres ouverts).', valued: 'Valorisé {t}',
  marketValue: 'Valeur de marché', cost: 'Prix de revient', pnl: 'P&L latent', yield: 'Rendement cumulé', available: 'Disponible', locked: 'Bloqué', pending: 'En attente',
  tabs: ['Aperçu', 'Positions', 'Revenus', 'Ordres'],
  allocation: 'Répartition', allocationNote: 'Par valeur de marché', cash: 'Liquidités',
  start: { title: 'Faites votre premier investissement', steps: ['Ajoutez des USDT', 'Choisissez un produit disponible', 'Vos positions et revenus apparaîtront ici après votre investissement'], deposit: 'Ajouter des fonds' },
  positions: 'Positions', positionsEmpty: 'Aucune position', positionsEmptyBody: 'Investissez dans un produit listé pour le voir ici.', browse: 'Voir les marchés', qty: 'Qté', weight: 'Poids', value: 'Valeur',
  history: 'Historique de valeur', historyNote: 'Instantanés de position', historyEmpty: 'Historique insuffisant', historyEmptyBody: 'Le graphique apparaît après deux instantanés de valorisation.',
  income: 'Revenus', incomeNote: 'Distributions créditées', incomeEmpty: 'Aucun revenu crédité', incomeEmptyBody: 'Les distributions apparaissent ici une fois créditées sur votre compte.', period: 'Période',
  orders: 'Ordres ouverts', ordersNote: 'Actualisé tant qu’en attente', ordersEmpty: 'Aucun ordre ouvert', allOrders: 'Tous les ordres',
  tools: { cash: 'Liquidités et portefeuille', activity: 'Activité', calendar: 'Calendrier des rendements', rebalance: 'Rééquilibrer', statements: 'Relevés' },
  product: 'Produit', loadError: 'Impossible de charger cette section',
  detail: {
    title: 'Position', notFound: 'Position introuvable', notFoundBody: 'Elle a peut-être été entièrement rachetée ou appartient à un autre compte.', unitPrice: 'Prix unitaire', quantity: 'Quantité', outcome: 'Sens',
    source: 'Source', investMore: 'Investir davantage', research: 'Page produit', incomeFor: 'Revenus de cette position', ordersFor: 'Ordres sur ce produit', back: 'Mes actifs',
  },
}

const pt: PortfolioCopy = {
  kicker: 'Carteira', title: 'Meus ativos', total: 'Ativos totais', totalNote: 'Posições na última cotação + caixa (disponível e bloqueado em ordens abertas).', valued: 'Avaliado {t}',
  marketValue: 'Valor de mercado', cost: 'Custo base', pnl: 'L/P não realizado', yield: 'Rendimento acumulado', available: 'Disponível', locked: 'Bloqueado', pending: 'Pendente',
  tabs: ['Visão geral', 'Posições', 'Rendimentos', 'Ordens'],
  allocation: 'Alocação', allocationNote: 'Por valor de mercado', cash: 'Caixa',
  start: { title: 'Faça seu primeiro investimento', steps: ['Adicione USDT', 'Escolha um produto disponível', 'Suas posições e rendimentos aparecem aqui depois de investir'], deposit: 'Adicionar fundos' },
  positions: 'Posições', positionsEmpty: 'Ainda sem posições', positionsEmptyBody: 'Invista em um produto listado e ele aparecerá aqui.', browse: 'Ver mercados', qty: 'Qtd.', weight: 'Peso', value: 'Valor',
  history: 'Histórico de valor', historyNote: 'Snapshots de posição', historyEmpty: 'Histórico insuficiente', historyEmptyBody: 'O gráfico aparece após dois snapshots de avaliação.',
  income: 'Rendimentos', incomeNote: 'Distribuições creditadas', incomeEmpty: 'Nenhum rendimento creditado', incomeEmptyBody: 'As distribuições aparecem aqui quando creditadas na sua conta.', period: 'Período',
  orders: 'Ordens abertas', ordersNote: 'Atualiza enquanto pendente', ordersEmpty: 'Nenhuma ordem aberta', allOrders: 'Todas as ordens',
  tools: { cash: 'Caixa e carteira', activity: 'Atividade', calendar: 'Calendário de rendimentos', rebalance: 'Rebalancear', statements: 'Extratos' },
  product: 'Produto', loadError: 'Não foi possível carregar esta seção',
  detail: {
    title: 'Posição', notFound: 'Posição não encontrada', notFoundBody: 'Pode ter sido totalmente resgatada ou pertencer a outra conta.', unitPrice: 'Preço unitário', quantity: 'Quantidade', outcome: 'Direção',
    source: 'Fonte', investMore: 'Investir mais', research: 'Página do produto', incomeFor: 'Rendimentos desta posição', ordersFor: 'Ordens deste produto', back: 'Meus ativos',
  },
}

export const portfolioCopy: Record<AppLocale, PortfolioCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
