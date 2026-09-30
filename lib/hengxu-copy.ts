import type { AppLocale } from './i18n'
import type { HengxuFilter, HengxuHorizon, HengxuProduct, HengxuSleeve, HengxuStage, HengxuText } from './hengxu-products'

export type HengxuCopy = {
  tab: string; series: string; kicker: string; title: string; lede: string
  concept: string; conceptLong: string
  filters: Record<'all' | HengxuFilter, string>
  stage: Record<HengxuStage, string>; listed: string
  risk: [string, string, string, string]; riskPending: string; riskUnrated: string
  horizon: Record<HengxuHorizon, string>
  flagship: string; count: string; countOne: string
  fields: { risk: string; hold: string; lock: string; redeem: string; min: string; fees: string }
  tba: string; minValue: string; minNote: string
  sections: [string, string, string, string, string, string]
  fit: string; allocationNote: string; netReturn: string; sourcesNote: string
  stressNote: string
  exit: { platformFee: string; fundFee: string; window: string; how: string }
  docsTitle: string; docsBody: string; beforeLaunch: string
  learn: string; soon: string; subscribe: string; ctaNote: string
  heroCaption: string; notFound: string; notFoundBody: string; back: string
  prev: string; next: string; jump: string; sleeves: Record<HengxuSleeve, string>
  empty: string
}

const enSleeves: Record<HengxuSleeve, string> = {
  tbill: 'Short treasuries', cash: 'Settlement cash', gold: 'Gold', equity: 'Global equities', trend: 'Trend strategy',
  lending: 'Stablecoin lending', fixedTerm: 'Fixed-maturity yield', basis: 'Spot–futures hedge capital', margin: 'Settlement & margin reserve',
  tech: 'Tech equities', btc: 'BTC', eth: 'ETH', sol: 'SOL', link: 'LINK', aave: 'AAVE', ondo: 'ONDO',
  semis: 'Semiconductors', cloud: 'Cloud & networks', power: 'Power & data-centre equipment', issued: 'Platform-issued asset token', tbillCash: 'Short treasuries & cash',
}

const en: HengxuCopy = {
  tab: 'Hengxu', series: 'Hengxu series', kicker: 'Hengxu · Concept series', title: 'Ten strategies, arranged by when you need the money',
  lede: 'Research designs for short-term cash through five-year holdings. Nothing here is issued or open for subscription.',
  concept: 'Concept', conceptLong: 'Concept · Not issued · Not open for subscription',
  filters: { all: 'All', short: 'Short term', long: 'Long term', digital: 'Digital assets', research: 'In research' },
  stage: { first: 'First-wave candidate', second: 'Second-wave candidate', research: 'In research', special: 'Special research' }, listed: 'Open on RWA.LAT',
  risk: ['Conservative', 'Balanced', 'Growth', 'High risk'], riskPending: 'Graded after stress test', riskUnrated: 'Not yet graded',
  horizon: { d90: '30–90 days+', m12: '6–12 months+', y3: '3 years+', y5: '5 years+', terms: 'Per series terms' },
  flagship: 'Series flagship', count: '{n} strategies', countOne: '{n} strategy',
  fields: { risk: 'Risk tier', hold: 'Suggested holding', lock: 'Contract lock-up', redeem: 'Redemption settles', min: 'Suggested minimum', fees: 'Fees' },
  tba: 'TBA', minValue: '100 USD equiv.', minNote: 'Design target',
  sections: ['Strategy', 'Allocation', 'Return sources', 'Risks', 'Fees & exit', 'Documents'],
  fit: 'Suited to', allocationNote: 'Research weights as % of principal. Not holdings, and subject to backtesting and quotes.',
  netReturn: 'Net return after all costs', sourcesNote: 'Dividend rate, protocol APY, annualised yield and total return are reported separately, never mixed.',
  stressNote: 'Drawdowns of about 10% / 25% / 50% are discussion anchors for stress tests, not a loss limit.',
  exit: { platformFee: 'Platform fee', fundFee: 'Underlying & trading costs', window: 'Redemption window', how: 'Execution & exit' },
  docsTitle: 'Documents not yet published', docsBody: 'Terms, fee schedule, custody and audit documents will appear here once issued.', beforeLaunch: 'Must be disclosed before launch',
  learn: 'Explore strategy', soon: 'Coming soon', subscribe: 'View subscription', ctaNote: 'Concept draft. Not an offer, a return forecast or proof of assets.',
  heroCaption: 'Concept artwork. Not an asset or reserve proof.', notFound: 'Strategy not found', notFoundBody: 'This Hengxu strategy does not exist.', back: 'Back to Hengxu',
  prev: 'Previous', next: 'Next', jump: 'On this page', sleeves: enSleeves,
  empty: 'No strategies in this view.',
}

const zh: HengxuCopy = {
  tab: '衡序', series: '衡序系列', kicker: '衡序 · 概念系列', title: '十款策略，按用钱的时间排好',
  lede: '从 30 天的短期资金到五年以上的长期持有。均为研究设计，尚未发行，暂不开放认购。',
  concept: '概念', conceptLong: '概念稿 · 未发行 · 暂不开放认购',
  filters: { all: '全部', short: '短期', long: '长期', digital: '数字资产', research: '研究中' },
  stage: { first: '首发候选', second: '第二批候选', research: '研究中', special: '专项研究' }, listed: '已在 RWA.LAT 上线',
  risk: ['稳健研究', '均衡研究', '进取研究', '高风险研究'], riskPending: '待压力测试定级', riskUnrated: '未定级',
  horizon: { d90: '30–90 天起', m12: '6–12 个月起', y3: '3 年起', y5: '5 年起', terms: '以期次条款为准' },
  flagship: '系列主打', count: '{n} 款', countOne: '{n} 款',
  fields: { risk: '风险档', hold: '建议持有期', lock: '合同锁定期', redeem: '赎回到账期', min: '建议起投', fees: '费用' },
  tba: '待公布', minValue: '100 美元等值', minNote: '设计目标',
  sections: ['策略', '资产配置', '收益来源', '风险', '费用与退出', '文件'],
  fit: '适合', allocationNote: '研究配比，按投资本金计。不是现有持仓，需经回测与报价确认。',
  netReturn: '扣除全部成本后的净收益', sourcesNote: '分红率、协议 APY、年化收益率与总回报分开列示，不混用。',
  stressNote: '约 10% / 25% / 50% 的回撤仅是压力测试的讨论锚点，不是损失上限。',
  exit: { platformFee: '平台费用', fundFee: '底层与交易成本', window: '赎回申请窗口', how: '执行与退出' },
  docsTitle: '文件尚未发布', docsBody: '产品条款、费用表、托管与审计文件发布后将在此列出。', beforeLaunch: '上线前须披露',
  learn: '了解策略', soon: '即将推出', subscribe: '查看认购', ctaNote: '概念稿，不构成要约、收益预测或资产证明。',
  heroCaption: '概念主视觉，不代表资产或储备证明。', notFound: '未找到该策略', notFoundBody: '衡序系列中没有这款策略。', back: '返回衡序',
  prev: '上一款', next: '下一款', jump: '本页目录',
  sleeves: {
    tbill: '超短期国债', cash: '结算现金', gold: '黄金工具', equity: '全球股票', trend: '趋势策略',
    lending: '稳定币借贷', fixedTerm: '到期型收益头寸', basis: '期现对冲策略资本', margin: '结算及保证金准备金',
    tech: '科技股票', btc: 'BTC', eth: 'ETH', sol: 'SOL', link: 'LINK', aave: 'AAVE', ondo: 'ONDO',
    semis: '半导体', cloud: '云与网络', power: '电力和数据中心设备', issued: '平台自发行资产代币', tbillCash: '超短债及现金',
  },
  empty: '当前筛选下没有策略。',
}

const hi: HengxuCopy = {
  ...en,
  tab: 'हेंगशू', series: 'हेंगशू श्रृंखला', kicker: 'हेंगशू · अवधारणा श्रृंखला', title: 'दस रणनीतियाँ, पैसे की ज़रूरत के समय के अनुसार',
  lede: 'अल्पकालिक नकदी से पाँच साल की होल्डिंग तक के शोध डिज़ाइन। कुछ भी जारी नहीं हुआ है और सदस्यता खुली नहीं है।',
  concept: 'अवधारणा', conceptLong: 'अवधारणा · जारी नहीं · सदस्यता बंद',
  filters: { all: 'सभी', short: 'अल्पकालिक', long: 'दीर्घकालिक', digital: 'डिजिटल संपत्ति', research: 'शोध में' },
  stage: { first: 'पहली लहर उम्मीदवार', second: 'दूसरी लहर उम्मीदवार', research: 'शोध में', special: 'विशेष शोध' }, listed: 'RWA.LAT पर उपलब्ध',
  risk: ['संरक्षित', 'संतुलित', 'विकास', 'उच्च जोखिम'], riskPending: 'तनाव परीक्षण के बाद श्रेणी', riskUnrated: 'अभी श्रेणी नहीं',
  horizon: { d90: '30–90 दिन+', m12: '6–12 महीने+', y3: '3 वर्ष+', y5: '5 वर्ष+', terms: 'श्रृंखला शर्तों के अनुसार' },
  flagship: 'श्रृंखला प्रमुख', count: '{n} रणनीतियाँ', countOne: '{n} रणनीति', sourcesNote: 'लाभांश दर, प्रोटोकॉल APY, वार्षिक प्रतिफल और कुल रिटर्न अलग-अलग दिखाए जाते हैं, कभी मिलाए नहीं जाते।', stressNote: 'लगभग 10% / 25% / 50% की गिरावट तनाव परीक्षण के चर्चा बिंदु हैं, हानि सीमा नहीं।',
  fields: { risk: 'जोखिम श्रेणी', hold: 'सुझाई अवधि', lock: 'अनुबंध लॉक-अप', redeem: 'रिडेम्प्शन निपटान', min: 'सुझाया न्यूनतम', fees: 'शुल्क' },
  tba: 'घोषित होना बाकी', minValue: '100 USD समतुल्य', minNote: 'डिज़ाइन लक्ष्य',
  sections: ['रणनीति', 'आवंटन', 'रिटर्न स्रोत', 'जोखिम', 'शुल्क और निकास', 'दस्तावेज़'],
  fit: 'उपयुक्त', allocationNote: 'मूलधन के % में शोध भार। होल्डिंग नहीं; बैकटेस्ट और कोट के अधीन।',
  netReturn: 'सभी लागतों के बाद शुद्ध रिटर्न', docsTitle: 'दस्तावेज़ अभी प्रकाशित नहीं', docsBody: 'शर्तें, शुल्क, कस्टडी और ऑडिट दस्तावेज़ जारी होने पर यहाँ दिखेंगे।', beforeLaunch: 'लॉन्च से पहले प्रकटीकरण',
  exit: { platformFee: 'प्लेटफ़ॉर्म शुल्क', fundFee: 'अंतर्निहित और ट्रेडिंग लागत', window: 'रिडेम्प्शन विंडो', how: 'निष्पादन और निकास' },
  learn: 'रणनीति देखें', soon: 'जल्द आ रहा है', subscribe: 'सदस्यता देखें', ctaNote: 'अवधारणा मसौदा। प्रस्ताव, रिटर्न पूर्वानुमान या संपत्ति प्रमाण नहीं।',
  heroCaption: 'अवधारणा चित्र। संपत्ति या रिज़र्व प्रमाण नहीं।', notFound: 'रणनीति नहीं मिली', notFoundBody: 'यह हेंगशू रणनीति मौजूद नहीं है।', back: 'हेंगशू पर लौटें',
  prev: 'पिछली', next: 'अगली', jump: 'इस पृष्ठ पर', empty: 'इस दृश्य में कोई रणनीति नहीं।',
}

const es: HengxuCopy = {
  ...en,
  series: 'Serie Hengxu', kicker: 'Hengxu · Serie conceptual', title: 'Diez estrategias, ordenadas por cuándo necesitas el dinero',
  lede: 'Diseños de investigación desde liquidez a corto plazo hasta cinco años. Nada está emitido ni abierto a suscripción.',
  concept: 'Concepto', conceptLong: 'Concepto · No emitido · Sin suscripción',
  filters: { all: 'Todas', short: 'Corto plazo', long: 'Largo plazo', digital: 'Activos digitales', research: 'En estudio' },
  stage: { first: 'Candidata de primera fase', second: 'Candidata de segunda fase', research: 'En estudio', special: 'Estudio especial' }, listed: 'Disponible en RWA.LAT',
  risk: ['Conservador', 'Equilibrado', 'Crecimiento', 'Alto riesgo'], riskPending: 'Se califica tras prueba de estrés', riskUnrated: 'Sin calificar',
  horizon: { d90: '30–90 días+', m12: '6–12 meses+', y3: '3 años+', y5: '5 años+', terms: 'Según la serie' },
  flagship: 'Insignia de la serie', count: '{n} estrategias', countOne: '{n} estrategia', sourcesNote: 'Tasa de dividendo, APY del protocolo, rendimiento anualizado y rendimiento total se muestran por separado, nunca mezclados.', stressNote: 'Caídas de aprox. 10% / 25% / 50% son referencias para pruebas de estrés, no un límite de pérdida.',
  fields: { risk: 'Nivel de riesgo', hold: 'Plazo sugerido', lock: 'Bloqueo contractual', redeem: 'Liquidación del rescate', min: 'Mínimo sugerido', fees: 'Comisiones' },
  tba: 'Por anunciar', minValue: '100 USD equiv.', minNote: 'Objetivo de diseño',
  sections: ['Estrategia', 'Asignación', 'Fuentes de rendimiento', 'Riesgos', 'Comisiones y salida', 'Documentos'],
  fit: 'Para', allocationNote: 'Pesos de investigación en % del capital. No son posiciones; sujetos a backtest y cotizaciones.',
  netReturn: 'Rendimiento neto tras todos los costes', docsTitle: 'Documentos aún no publicados', docsBody: 'Condiciones, comisiones, custodia y auditoría aparecerán aquí al emitirse.', beforeLaunch: 'Debe divulgarse antes del lanzamiento',
  exit: { platformFee: 'Comisión de plataforma', fundFee: 'Costes subyacentes y de negociación', window: 'Ventana de rescate', how: 'Ejecución y salida' },
  learn: 'Ver estrategia', soon: 'Próximamente', subscribe: 'Ver suscripción', ctaNote: 'Borrador conceptual. No es una oferta, previsión de rendimiento ni prueba de activos.',
  heroCaption: 'Imagen conceptual. No prueba activos ni reservas.', notFound: 'Estrategia no encontrada', notFoundBody: 'Esta estrategia Hengxu no existe.', back: 'Volver a Hengxu',
  prev: 'Anterior', next: 'Siguiente', jump: 'En esta página', empty: 'No hay estrategias en esta vista.',
}

const ar: HengxuCopy = {
  ...en,
  tab: 'هنغشو', series: 'سلسلة هنغشو', kicker: 'هنغشو · سلسلة مفاهيمية', title: 'عشر استراتيجيات مرتبة حسب موعد حاجتك إلى المال',
  lede: 'تصاميم بحثية من السيولة قصيرة الأجل حتى الاحتفاظ لخمس سنوات. لا شيء صادر أو متاح للاكتتاب.',
  concept: 'مفهوم', conceptLong: 'مفهوم · غير صادر · الاكتتاب غير متاح',
  filters: { all: 'الكل', short: 'قصير الأجل', long: 'طويل الأجل', digital: 'أصول رقمية', research: 'قيد البحث' },
  stage: { first: 'مرشح للدفعة الأولى', second: 'مرشح للدفعة الثانية', research: 'قيد البحث', special: 'بحث خاص' }, listed: 'متاح على RWA.LAT',
  risk: ['متحفظ', 'متوازن', 'نمو', 'مخاطر عالية'], riskPending: 'يُصنَّف بعد اختبار الضغط', riskUnrated: 'غير مصنف بعد',
  horizon: { d90: '30–90 يومًا فأكثر', m12: '6–12 شهرًا فأكثر', y3: '3 سنوات فأكثر', y5: '5 سنوات فأكثر', terms: 'وفق شروط الإصدار' },
  flagship: 'الأبرز في السلسلة', count: '{n} استراتيجيات', countOne: '{n} استراتيجية', sourcesNote: 'تُعرض نسبة التوزيعات وعائد البروتوكول السنوي والعائد السنوي والعائد الإجمالي كلٌّ على حدة، ولا تُخلط.', stressNote: 'تراجعات بنحو 10% / 25% / 50% هي مراجع لنقاش اختبارات الضغط، وليست حدًا أقصى للخسارة.',
  fields: { risk: 'فئة المخاطر', hold: 'مدة الاحتفاظ المقترحة', lock: 'فترة القفل التعاقدية', redeem: 'تسوية الاسترداد', min: 'الحد الأدنى المقترح', fees: 'الرسوم' },
  tba: 'يُعلن لاحقًا', minValue: 'ما يعادل 100 دولار', minNote: 'هدف تصميمي',
  sections: ['الاستراتيجية', 'التوزيع', 'مصادر العائد', 'المخاطر', 'الرسوم والخروج', 'المستندات'],
  fit: 'مناسبة لـ', allocationNote: 'أوزان بحثية كنسبة من رأس المال. ليست حيازات، وتخضع للاختبار الرجعي والتسعير.',
  netReturn: 'صافي العائد بعد جميع التكاليف', docsTitle: 'لم تُنشر المستندات بعد', docsBody: 'ستظهر الشروط وجدول الرسوم ومستندات الحفظ والتدقيق هنا عند إصدارها.', beforeLaunch: 'يجب الإفصاح عنه قبل الإطلاق',
  exit: { platformFee: 'رسوم المنصة', fundFee: 'التكاليف الأساسية وتكاليف التداول', window: 'نافذة الاسترداد', how: 'التنفيذ والخروج' },
  learn: 'استكشف الاستراتيجية', soon: 'قريبًا', subscribe: 'عرض الاكتتاب', ctaNote: 'مسودة مفاهيمية. ليست عرضًا ولا توقعًا للعائد ولا إثباتًا للأصول.',
  heroCaption: 'صورة مفاهيمية، لا تثبت أصولًا أو احتياطيات.', notFound: 'الاستراتيجية غير موجودة', notFoundBody: 'لا توجد هذه الاستراتيجية في سلسلة هنغشو.', back: 'العودة إلى هنغشو',
  prev: 'السابقة', next: 'التالية', jump: 'في هذه الصفحة', empty: 'لا توجد استراتيجيات في هذا العرض.',
}

const fr: HengxuCopy = {
  ...en,
  series: 'Série Hengxu', kicker: 'Hengxu · Série conceptuelle', title: 'Dix stratégies, classées selon le moment où vous aurez besoin de l’argent',
  lede: 'Des conceptions de recherche, de la trésorerie à court terme aux placements sur cinq ans. Rien n’est émis ni ouvert à la souscription.',
  concept: 'Concept', conceptLong: 'Concept · Non émis · Souscription fermée',
  filters: { all: 'Toutes', short: 'Court terme', long: 'Long terme', digital: 'Actifs numériques', research: 'En recherche' },
  stage: { first: 'Candidate 1re vague', second: 'Candidate 2e vague', research: 'En recherche', special: 'Recherche spéciale' }, listed: 'Disponible sur RWA.LAT',
  risk: ['Prudent', 'Équilibré', 'Croissance', 'Risque élevé'], riskPending: 'Classé après test de résistance', riskUnrated: 'Non classé',
  horizon: { d90: '30–90 jours et +', m12: '6–12 mois et +', y3: '3 ans et +', y5: '5 ans et +', terms: 'Selon la série' },
  flagship: 'Phare de la série', count: '{n} stratégies', countOne: '{n} stratégie', sourcesNote: 'Taux de distribution, APY du protocole, rendement annualisé et rendement total sont présentés séparément, jamais mélangés.', stressNote: 'Des baisses d’environ 10 % / 25 % / 50 % servent de repères aux tests de résistance, pas de plafond de perte.',
  fields: { risk: 'Niveau de risque', hold: 'Durée conseillée', lock: 'Blocage contractuel', redeem: 'Règlement du rachat', min: 'Minimum conseillé', fees: 'Frais' },
  tba: 'À annoncer', minValue: '100 USD équiv.', minNote: 'Objectif de conception',
  sections: ['Stratégie', 'Allocation', 'Sources de rendement', 'Risques', 'Frais et sortie', 'Documents'],
  fit: 'Pour', allocationNote: 'Pondérations de recherche en % du capital. Pas des positions ; soumises à backtest et cotations.',
  netReturn: 'Rendement net après tous les coûts', docsTitle: 'Documents pas encore publiés', docsBody: 'Conditions, barème, conservation et audit apparaîtront ici après émission.', beforeLaunch: 'À publier avant le lancement',
  exit: { platformFee: 'Frais de plateforme', fundFee: 'Coûts sous-jacents et de transaction', window: 'Fenêtre de rachat', how: 'Exécution et sortie' },
  learn: 'Découvrir la stratégie', soon: 'Bientôt', subscribe: 'Voir la souscription', ctaNote: 'Brouillon conceptuel. Ni offre, ni prévision de rendement, ni preuve d’actifs.',
  heroCaption: 'Visuel conceptuel. Pas une preuve d’actifs ou de réserves.', notFound: 'Stratégie introuvable', notFoundBody: 'Cette stratégie Hengxu n’existe pas.', back: 'Retour à Hengxu',
  prev: 'Précédente', next: 'Suivante', jump: 'Sur cette page', empty: 'Aucune stratégie dans cette vue.',
}

const pt: HengxuCopy = {
  ...en,
  series: 'Série Hengxu', kicker: 'Hengxu · Série conceitual', title: 'Dez estratégias, ordenadas por quando você vai precisar do dinheiro',
  lede: 'Projetos de pesquisa, do caixa de curto prazo a cinco anos. Nada foi emitido nem está aberto à subscrição.',
  concept: 'Conceito', conceptLong: 'Conceito · Não emitido · Sem subscrição',
  filters: { all: 'Todas', short: 'Curto prazo', long: 'Longo prazo', digital: 'Ativos digitais', research: 'Em pesquisa' },
  stage: { first: 'Candidata da 1ª fase', second: 'Candidata da 2ª fase', research: 'Em pesquisa', special: 'Pesquisa especial' }, listed: 'Disponível na RWA.LAT',
  risk: ['Conservador', 'Equilibrado', 'Crescimento', 'Alto risco'], riskPending: 'Classificado após teste de estresse', riskUnrated: 'Sem classificação',
  horizon: { d90: '30–90 dias+', m12: '6–12 meses+', y3: '3 anos+', y5: '5 anos+', terms: 'Conforme a série' },
  flagship: 'Destaque da série', count: '{n} estratégias', countOne: '{n} estratégia', sourcesNote: 'Taxa de dividendos, APY do protocolo, rendimento anualizado e retorno total são mostrados separadamente, nunca misturados.', stressNote: 'Quedas de cerca de 10% / 25% / 50% são referências para testes de estresse, não um limite de perda.',
  fields: { risk: 'Nível de risco', hold: 'Prazo sugerido', lock: 'Carência contratual', redeem: 'Liquidação do resgate', min: 'Mínimo sugerido', fees: 'Taxas' },
  tba: 'A anunciar', minValue: '100 USD equiv.', minNote: 'Meta de design',
  sections: ['Estratégia', 'Alocação', 'Fontes de retorno', 'Riscos', 'Taxas e saída', 'Documentos'],
  fit: 'Para', allocationNote: 'Pesos de pesquisa em % do principal. Não são posições; sujeitos a backtest e cotações.',
  netReturn: 'Retorno líquido após todos os custos', docsTitle: 'Documentos ainda não publicados', docsBody: 'Termos, tabela de taxas, custódia e auditoria aparecerão aqui após a emissão.', beforeLaunch: 'Deve ser divulgado antes do lançamento',
  exit: { platformFee: 'Taxa da plataforma', fundFee: 'Custos subjacentes e de negociação', window: 'Janela de resgate', how: 'Execução e saída' },
  learn: 'Conhecer a estratégia', soon: 'Em breve', subscribe: 'Ver subscrição', ctaNote: 'Rascunho conceitual. Não é oferta, previsão de retorno nem prova de ativos.',
  heroCaption: 'Imagem conceitual. Não prova ativos nem reservas.', notFound: 'Estratégia não encontrada', notFoundBody: 'Esta estratégia Hengxu não existe.', back: 'Voltar ao Hengxu',
  prev: 'Anterior', next: 'Próxima', jump: 'Nesta página', empty: 'Nenhuma estratégia nesta visualização.',
}

export const hengxuCopy: Record<AppLocale, HengxuCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }

/** Product body text is written in Chinese and English; other locales read the English version. */
export const hengxuText = (product: HengxuProduct, locale: AppLocale): HengxuText => locale === 'zh-CN' ? product.zh : product.en
