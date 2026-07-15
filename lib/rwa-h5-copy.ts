import type { AppLocale } from './i18n'

type TextRow = { title: string; description: string }

export type RwaH5Copy = {
  shell: {
    notifications: string
    openProfile: string
    primaryNavigation: string
    skipContent: string
    offlineTitle: string
    offlineBody: string
    openMasRecord: string
    disclosureOpened: string
  }
  portfolio: {
    positions: Array<{ name: string; detail: string; change: string }>
    nextIncome: string
    incomeRows: Array<{ date: string; label: string }>
    netContributions: string
    marketMovement: string
    incomeSettled: string
    months: string[]
    exportTitle: string
    exportBody: string
    exportReady: string
  }
  trust: {
    access: { eyebrow: string; title: string; body: string }
    products: { eyebrow: string; title: string; body: string }
    legal: { eyebrow: string; title: string; body: string }
    accessRows: TextRow[]
    productRows: TextRow[]
    legalRows: TextRow[]
    resultLabel: string
    resultValue: string
    notEvaluated: string
    entityMapping: string
    masStatus: string
  }
}

export const rwaH5Copy: Record<AppLocale, RwaH5Copy> = {
  en: {
    shell: { notifications: 'Notifications', openProfile: 'Open profile', primaryNavigation: 'Primary navigation', skipContent: 'Skip to main content', offlineTitle: 'You are offline', offlineBody: 'Live prices and order previews are paused. Cached Demo content remains available.', openMasRecord: 'Open MAS institution record', disclosureOpened: 'Disclosure opened in this Demo.' },
    portfolio: {
      positions: [
        { name: 'H100 inference pool', detail: 'Compute · 2 units', change: '+12.40 today' },
        { name: 'Solar Income 2027', detail: 'RWA · monthly distribution', change: '+4.82 today' },
        { name: 'AI Leaders basket', detail: 'Stocks · market hours', change: '+1.12 today' },
      ],
      nextIncome: 'Solar Income 2027 · 28 May',
      incomeRows: [
        { date: 'Today', label: 'H100 inference revenue' },
        { date: '10 May', label: 'Compute revenue settlement' },
        { date: '02 May', label: 'Solar income distribution' },
        { date: '30 Apr', label: 'Treasury reference accrual' },
      ],
      netContributions: 'Net contributions', marketMovement: 'Market movement', incomeSettled: 'Income settled',
      months: ['Jun', 'Jul', 'Aug', 'Sep'], exportTitle: 'Export performance statement', exportBody: 'Demo only. Official statements require completed settlement data.', exportReady: 'Demo performance statement prepared.',
    },
    trust: {
      access: { eyebrow: 'ACCESS & ELIGIBILITY', title: 'Availability is checked by person, product and location.', body: 'Guest browsing is public. Funding, orders and withdrawals require account verification, sanctions screening and a product-level eligibility result.' },
      products: { eyebrow: 'PRODUCT DISCLOSURES', title: 'Every return has a source, a cost and an exit rule.', body: 'The order review identifies the legal form, issuer or provider, return source, fees, term, liquidity and dispute route.' },
      legal: { eyebrow: 'LEGAL & REGULATORY', title: 'Documents are versioned and tied to your consent.', body: 'The production platform will retain the document version, language, region, timestamp and evidence for every material acceptance.' },
      accessRows: [
        { title: 'Guest browsing', description: 'Product discovery and public market information are available without an account.' },
        { title: 'Account actions', description: 'Funding, investing and withdrawals require sign-in, KYC and sanctions screening.' },
        { title: 'Country result', description: 'Demo: not yet evaluated. Production uses residence, nationality, IP and product rules.' },
        { title: 'Product override', description: 'A product may remain unavailable even when the account is otherwise eligible.' },
      ],
      productRows: [
        { title: 'AI Compute · H100 pool', description: 'Revenue participation · 0.80% subscription · 8.00% of project revenue management fee · monthly exit queue.' },
        { title: 'RWA · Solar Income 2027', description: 'Operating-asset participation · 0.80% subscription · 1.20% annual management · quarterly exit window.' },
        { title: 'Global Stocks · AI Leaders', description: 'Broker/tokenized route pending · 0.35% Demo transaction fee · exit during supported market hours.' },
        { title: 'Prediction markets', description: 'Public data discovery · fee shown before confirmation · exit depends on market liquidity and resolution.' },
        { title: 'USDT wallet', description: 'Custody/MPC provider pending · TRON, Ethereum and Arbitrum planned.' },
      ],
      legalRows: [
        { title: 'Terms of Use', description: 'Demo version 1.0 · production counsel approval pending' },
        { title: 'Privacy Notice', description: 'Demo version 1.0 · data controller details pending' },
        { title: 'Risk Disclosure', description: 'Loss, liquidity, counterparty, technology and regulatory risks' },
        { title: 'Corporate profile', description: 'Singapore operator mapping is provisional until company-secretary confirmation' },
        { title: 'Consent record', description: 'Language, version, IP/device context and timestamp will be retained' },
      ],
      resultLabel: 'Current Demo result', resultValue: 'Guest · public browsing only', notEvaluated: 'Not evaluated', entityMapping: 'Provisional Singapore entity mapping', masStatus: 'MAS status: Capital Markets Services Licensee · Venture Capital Fund Management',
    },
  },
  'zh-CN': {
    shell: { notifications: '通知', openProfile: '打开个人中心', primaryNavigation: '主导航', skipContent: '跳转到主要内容', offlineTitle: '当前处于离线状态', offlineBody: '实时价格与订单预览已暂停，仍可查看已缓存的演示内容。', openMasRecord: '打开 MAS 机构记录', disclosureOpened: '已在演示环境中打开披露内容。' },
    portfolio: {
      positions: [
        { name: 'H100 推理算力池', detail: '算力 · 2 个份额', change: '今日 +12.40' },
        { name: 'Solar Income 2027', detail: 'RWA · 每月分配', change: '今日 +4.82' },
        { name: 'AI 龙头股票组合', detail: '股票 · 交易时段', change: '今日 +1.12' },
      ],
      nextIncome: 'Solar Income 2027 · 5 月 28 日',
      incomeRows: [
        { date: '今日', label: 'H100 推理算力收益' },
        { date: '5 月 10 日', label: '算力收益结算' },
        { date: '5 月 2 日', label: '太阳能项目收益分配' },
        { date: '4 月 30 日', label: '短期国债参考收益计提' },
      ],
      netContributions: '净投入', marketMovement: '市场变动', incomeSettled: '已结算收益',
      months: ['6 月', '7 月', '8 月', '9 月'], exportTitle: '导出资产表现报告', exportBody: '仅供演示。正式报告需以已完成的结算数据为准。', exportReady: '演示版资产表现报告已生成。',
    },
    trust: {
      access: { eyebrow: '准入与适当性', title: '可用性将按用户、产品和所在地分别核验。', body: '访客可公开浏览；充值、下单和提现前需完成账户验证、制裁筛查及产品级准入判断。' },
      products: { eyebrow: '产品披露', title: '每一项收益都应说明来源、成本与退出规则。', body: '订单确认页将明确法律形态、发行方或服务商、收益来源、费用、期限、流动性及争议处理渠道。' },
      legal: { eyebrow: '法律与监管', title: '每份文件均有版本记录，并与用户同意凭证关联。', body: '正式平台将留存每次重要确认所对应的文件版本、语言、地区、时间戳及证据。' },
      accessRows: [
        { title: '访客浏览', description: '无需账户即可查看产品信息与公开市场数据。' },
        { title: '账户操作', description: '充值、投资和提现需登录并完成 KYC 与制裁筛查。' },
        { title: '国家/地区判断', description: '演示状态：尚未评估。正式环境将结合居住地、国籍、IP 与产品规则判断。' },
        { title: '产品级限制', description: '即使账户整体符合准入条件，个别产品仍可能不可用。' },
      ],
      productRows: [
        { title: 'AI 算力 · H100 算力池', description: '收益参与凭证 · 认购费 0.80% · 项目收益管理费 8.00% · 每月进入退出队列。' },
        { title: 'RWA · Solar Income 2027', description: '运营资产收益参与 · 认购费 0.80% · 年管理费 1.20% · 按季度开放退出窗口。' },
        { title: '全球股票 · AI 龙头组合', description: '券商/代币化路径待确认 · 演示交易费 0.35% · 支持交易时段内退出。' },
        { title: '预测市场', description: '公开数据浏览 · 确认前展示费用 · 退出取决于市场流动性与结果裁定。' },
        { title: 'USDT 钱包', description: '托管/MPC 服务商待确认 · 计划支持 TRON、Ethereum 与 Arbitrum。' },
      ],
      legalRows: [
        { title: '使用条款', description: '演示版 1.0 · 正式版本待法律顾问批准' },
        { title: '隐私声明', description: '演示版 1.0 · 数据控制者信息待确认' },
        { title: '风险披露', description: '涵盖损失、流动性、交易对手、技术及监管风险' },
        { title: '公司资料', description: '新加坡运营主体映射为暂定信息，待公司秘书确认' },
        { title: '同意记录', description: '将留存语言、版本、IP/设备环境与时间戳' },
      ],
      resultLabel: '当前演示结果', resultValue: '访客 · 仅限公开浏览', notEvaluated: '尚未评估', entityMapping: '暂定的新加坡运营主体映射', masStatus: 'MAS 状态：资本市场服务持牌机构 · 创业投资基金管理',
    },
  },
  hi: {
    shell: { notifications: 'सूचनाएँ', openProfile: 'प्रोफ़ाइल खोलें', primaryNavigation: 'मुख्य नेविगेशन', skipContent: 'मुख्य सामग्री पर जाएँ', offlineTitle: 'आप ऑफ़लाइन हैं', offlineBody: 'लाइव मूल्य और ऑर्डर पूर्वावलोकन रुके हैं। कैश की गई डेमो सामग्री उपलब्ध है।', openMasRecord: 'MAS संस्था रिकॉर्ड खोलें', disclosureOpened: 'डेमो में प्रकटीकरण खोल दिया गया।' },
    portfolio: {
      positions: [
        { name: 'H100 इन्फ़रेंस पूल', detail: 'कंप्यूट · 2 यूनिट', change: 'आज +12.40' },
        { name: 'Solar Income 2027', detail: 'RWA · मासिक वितरण', change: 'आज +4.82' },
        { name: 'AI Leaders बास्केट', detail: 'शेयर · बाज़ार समय', change: 'आज +1.12' },
      ],
      nextIncome: 'Solar Income 2027 · 28 मई',
      incomeRows: [{ date: 'आज', label: 'H100 इन्फ़रेंस आय' }, { date: '10 मई', label: 'कंप्यूट आय निपटान' }, { date: '02 मई', label: 'सौर आय वितरण' }, { date: '30 अप्रैल', label: 'ट्रेज़री संदर्भ आय उपार्जन' }],
      netContributions: 'शुद्ध योगदान', marketMovement: 'बाज़ार परिवर्तन', incomeSettled: 'निपटाई गई आय', months: ['जून', 'जुल॰', 'अग॰', 'सित॰'], exportTitle: 'प्रदर्शन विवरण निर्यात करें', exportBody: 'केवल डेमो। आधिकारिक विवरण के लिए पूर्ण निपटान डेटा आवश्यक है।', exportReady: 'डेमो प्रदर्शन विवरण तैयार है।',
    },
    trust: {
      access: { eyebrow: 'पहुँच और पात्रता', title: 'उपलब्धता व्यक्ति, उत्पाद और स्थान के अनुसार जाँची जाती है।', body: 'अतिथि ब्राउज़िंग सार्वजनिक है। फंडिंग, ऑर्डर और निकासी के लिए खाता सत्यापन, प्रतिबंध जाँच और उत्पाद-स्तरीय पात्रता आवश्यक है।' },
      products: { eyebrow: 'उत्पाद प्रकटीकरण', title: 'हर प्रतिफल का स्रोत, लागत और निकास नियम होता है।', body: 'ऑर्डर समीक्षा में कानूनी स्वरूप, जारीकर्ता/प्रदाता, आय स्रोत, शुल्क, अवधि, तरलता और विवाद मार्ग बताया जाता है।' },
      legal: { eyebrow: 'कानूनी और विनियामक', title: 'दस्तावेज़ संस्करणबद्ध हैं और आपकी सहमति से जुड़े हैं।', body: 'प्रोडक्शन प्लेटफ़ॉर्म हर महत्त्वपूर्ण स्वीकृति के लिए संस्करण, भाषा, क्षेत्र, समय और प्रमाण सुरक्षित रखेगा।' },
      accessRows: [{ title: 'अतिथि ब्राउज़िंग', description: 'बिना खाते के उत्पाद और सार्वजनिक बाज़ार जानकारी देखी जा सकती है।' }, { title: 'खाता कार्रवाइयाँ', description: 'फंडिंग, निवेश और निकासी के लिए साइन-इन, KYC और प्रतिबंध जाँच आवश्यक है।' }, { title: 'देश का परिणाम', description: 'डेमो: अभी मूल्यांकन नहीं हुआ। प्रोडक्शन में निवास, राष्ट्रीयता, IP और उत्पाद नियम लागू होंगे।' }, { title: 'उत्पाद अपवाद', description: 'खाता पात्र होने पर भी कोई विशिष्ट उत्पाद अनुपलब्ध रह सकता है।' }],
      productRows: [{ title: 'AI कंप्यूट · H100 पूल', description: 'आय भागीदारी · 0.80% सदस्यता शुल्क · परियोजना आय का 8.00% प्रबंधन शुल्क · मासिक निकास कतार।' }, { title: 'RWA · Solar Income 2027', description: 'परिचालन संपत्ति भागीदारी · 0.80% सदस्यता · 1.20% वार्षिक प्रबंधन · तिमाही निकास विंडो।' }, { title: 'वैश्विक शेयर · AI Leaders', description: 'ब्रोकर/टोकन मार्ग लंबित · 0.35% डेमो लेनदेन शुल्क · समर्थित बाज़ार समय में निकास।' }, { title: 'पूर्वानुमान बाज़ार', description: 'सार्वजनिक डेटा खोज · पुष्टि से पहले शुल्क · निकास तरलता और परिणाम पर निर्भर।' }, { title: 'USDT वॉलेट', description: 'कस्टडी/MPC प्रदाता लंबित · TRON, Ethereum और Arbitrum नियोजित।' }],
      legalRows: [{ title: 'उपयोग की शर्तें', description: 'डेमो संस्करण 1.0 · कानूनी स्वीकृति लंबित' }, { title: 'गोपनीयता सूचना', description: 'डेमो संस्करण 1.0 · डेटा नियंत्रक विवरण लंबित' }, { title: 'जोखिम प्रकटीकरण', description: 'हानि, तरलता, प्रतिपक्ष, तकनीक और विनियामक जोखिम' }, { title: 'कंपनी प्रोफ़ाइल', description: 'कंपनी सचिव की पुष्टि तक सिंगापुर ऑपरेटर मैपिंग अस्थायी है' }, { title: 'सहमति रिकॉर्ड', description: 'भाषा, संस्करण, IP/डिवाइस संदर्भ और समय सुरक्षित रहेगा' }],
      resultLabel: 'वर्तमान डेमो परिणाम', resultValue: 'अतिथि · केवल सार्वजनिक ब्राउज़िंग', notEvaluated: 'मूल्यांकन नहीं हुआ', entityMapping: 'अस्थायी सिंगापुर इकाई मैपिंग', masStatus: 'MAS स्थिति: कैपिटल मार्केट्स सर्विसेज़ लाइसेंसी · वेंचर कैपिटल फंड प्रबंधन',
    },
  },
  es: {
    shell: { notifications: 'Notificaciones', openProfile: 'Abrir perfil', primaryNavigation: 'Navegación principal', skipContent: 'Ir al contenido principal', offlineTitle: 'Estás sin conexión', offlineBody: 'Los precios en tiempo real y las vistas previas de órdenes están en pausa. El contenido Demo en caché sigue disponible.', openMasRecord: 'Abrir registro de la entidad en MAS', disclosureOpened: 'Información abierta en esta Demo.' },
    portfolio: {
      positions: [{ name: 'Pool de inferencia H100', detail: 'Cómputo · 2 unidades', change: '+12,40 hoy' }, { name: 'Solar Income 2027', detail: 'RWA · distribución mensual', change: '+4,82 hoy' }, { name: 'Cesta AI Leaders', detail: 'Acciones · horario de mercado', change: '+1,12 hoy' }],
      nextIncome: 'Solar Income 2027 · 28 may', incomeRows: [{ date: 'Hoy', label: 'Ingresos de inferencia H100' }, { date: '10 may', label: 'Liquidación de ingresos de cómputo' }, { date: '02 may', label: 'Distribución de ingresos solares' }, { date: '30 abr', label: 'Devengo de referencia del Tesoro' }],
      netContributions: 'Aportaciones netas', marketMovement: 'Movimiento del mercado', incomeSettled: 'Ingresos liquidados', months: ['Jun', 'Jul', 'Ago', 'Sep'], exportTitle: 'Exportar estado de rendimiento', exportBody: 'Solo Demo. Los estados oficiales requieren datos de liquidación completos.', exportReady: 'Estado de rendimiento Demo preparado.',
    },
    trust: {
      access: { eyebrow: 'ACCESO Y ELEGIBILIDAD', title: 'La disponibilidad se comprueba por persona, producto y ubicación.', body: 'La navegación como invitado es pública. Los depósitos, las órdenes y las retiradas requieren verificación, control de sanciones y elegibilidad por producto.' },
      products: { eyebrow: 'INFORMACIÓN DE PRODUCTOS', title: 'Cada rendimiento tiene un origen, un coste y una regla de salida.', body: 'La revisión de la orden identifica la forma jurídica, emisor o proveedor, origen del rendimiento, comisiones, plazo, liquidez y vía de reclamación.' },
      legal: { eyebrow: 'LEGAL Y REGULATORIO', title: 'Los documentos tienen versión y quedan vinculados a tu consentimiento.', body: 'La plataforma conservará la versión, idioma, región, hora y evidencia de cada aceptación relevante.' },
      accessRows: [{ title: 'Navegación como invitado', description: 'Los productos y datos públicos pueden consultarse sin cuenta.' }, { title: 'Operaciones de cuenta', description: 'Depositar, invertir y retirar requiere inicio de sesión, KYC y control de sanciones.' }, { title: 'Resultado por país', description: 'Demo: aún no evaluado. Producción usará residencia, nacionalidad, IP y reglas del producto.' }, { title: 'Restricción del producto', description: 'Un producto puede no estar disponible aunque la cuenta sea elegible.' }],
      productRows: [{ title: 'Cómputo IA · Pool H100', description: 'Participación en ingresos · suscripción 0,80 % · gestión 8,00 % de los ingresos · cola de salida mensual.' }, { title: 'RWA · Solar Income 2027', description: 'Participación en activos operativos · suscripción 0,80 % · gestión anual 1,20 % · salida trimestral.' }, { title: 'Acciones globales · AI Leaders', description: 'Ruta bróker/token pendiente · comisión Demo 0,35 % · salida en horario compatible.' }, { title: 'Mercados de predicción', description: 'Consulta de datos públicos · comisión antes de confirmar · salida según liquidez y resolución.' }, { title: 'Cartera USDT', description: 'Proveedor de custodia/MPC pendiente · TRON, Ethereum y Arbitrum previstos.' }],
      legalRows: [{ title: 'Condiciones de uso', description: 'Versión Demo 1.0 · aprobación legal pendiente' }, { title: 'Aviso de privacidad', description: 'Versión Demo 1.0 · datos del responsable pendientes' }, { title: 'Divulgación de riesgos', description: 'Riesgos de pérdida, liquidez, contraparte, tecnología y regulación' }, { title: 'Perfil corporativo', description: 'El operador de Singapur es provisional hasta confirmación societaria' }, { title: 'Registro de consentimiento', description: 'Se conservarán idioma, versión, contexto IP/dispositivo y hora' }],
      resultLabel: 'Resultado Demo actual', resultValue: 'Invitado · solo navegación pública', notEvaluated: 'No evaluado', entityMapping: 'Asignación provisional de entidad de Singapur', masStatus: 'Estado MAS: licencia de servicios de mercados de capitales · gestión de fondos de capital riesgo',
    },
  },
  ar: {
    shell: { notifications: 'الإشعارات', openProfile: 'فتح الملف الشخصي', primaryNavigation: 'التنقل الرئيسي', skipContent: 'انتقل إلى المحتوى الرئيسي', offlineTitle: 'أنت غير متصل', offlineBody: 'تم إيقاف الأسعار المباشرة ومعاينات الأوامر مؤقتًا. يبقى محتوى العرض المخزّن متاحًا.', openMasRecord: 'فتح سجل المؤسسة لدى MAS', disclosureOpened: 'تم فتح الإفصاح في هذا العرض.' },
    portfolio: {
      positions: [{ name: 'مجمع استدلال H100', detail: 'حوسبة · وحدتان', change: '+12.40 اليوم' }, { name: 'Solar Income 2027', detail: 'RWA · توزيع شهري', change: '+4.82 اليوم' }, { name: 'سلة AI Leaders', detail: 'أسهم · ساعات السوق', change: '+1.12 اليوم' }],
      nextIncome: 'Solar Income 2027 · 28 مايو', incomeRows: [{ date: 'اليوم', label: 'إيراد استدلال H100' }, { date: '10 مايو', label: 'تسوية إيراد الحوسبة' }, { date: '02 مايو', label: 'توزيع دخل الطاقة الشمسية' }, { date: '30 أبريل', label: 'استحقاق مرجعي للخزانة' }],
      netContributions: 'صافي المساهمات', marketMovement: 'حركة السوق', incomeSettled: 'الدخل المسوّى', months: ['يونيو', 'يوليو', 'أغسطس', 'سبتمبر'], exportTitle: 'تصدير بيان الأداء', exportBody: 'للعرض فقط. تتطلب البيانات الرسمية اكتمال بيانات التسوية.', exportReady: 'تم إعداد بيان الأداء التجريبي.',
    },
    trust: {
      access: { eyebrow: 'الوصول والأهلية', title: 'تُفحص الإتاحة حسب الشخص والمنتج والموقع.', body: 'التصفح كضيف متاح للعامة. يتطلب التمويل والأوامر والسحب توثيق الحساب وفحص العقوبات ونتيجة أهلية لكل منتج.' },
      products: { eyebrow: 'إفصاحات المنتجات', title: 'لكل عائد مصدر وتكلفة وقاعدة خروج.', body: 'توضح مراجعة الأمر الصيغة القانونية والمصدر أو المزود ومصدر العائد والرسوم والأجل والسيولة ومسار النزاع.' },
      legal: { eyebrow: 'قانوني ورقابي', title: 'الوثائق مؤرخة بالإصدار ومرتبطة بموافقتك.', body: 'ستحتفظ المنصة بإصدار الوثيقة واللغة والمنطقة والوقت ودليل كل موافقة جوهرية.' },
      accessRows: [{ title: 'تصفح الضيف', description: 'يمكن استعراض المنتجات وبيانات السوق العامة دون حساب.' }, { title: 'إجراءات الحساب', description: 'يتطلب التمويل والاستثمار والسحب تسجيل الدخول وKYC وفحص العقوبات.' }, { title: 'نتيجة الدولة', description: 'العرض: لم تُقيّم بعد. سيستخدم الإنتاج الإقامة والجنسية وIP وقواعد المنتج.' }, { title: 'تقييد المنتج', description: 'قد يظل منتج غير متاح حتى لو كان الحساب مؤهلًا.' }],
      productRows: [{ title: 'حوسبة AI · مجمع H100', description: 'مشاركة في الإيراد · اشتراك 0.80% · إدارة 8.00% من إيراد المشروع · قائمة خروج شهرية.' }, { title: 'RWA · Solar Income 2027', description: 'مشاركة في أصل تشغيلي · اشتراك 0.80% · إدارة سنوية 1.20% · نافذة خروج فصلية.' }, { title: 'أسهم عالمية · AI Leaders', description: 'مسار وسيط/رمزي قيد الاعتماد · رسم عرض 0.35% · خروج خلال ساعات السوق المدعومة.' }, { title: 'أسواق التنبؤ', description: 'استعراض بيانات عامة · عرض الرسم قبل التأكيد · الخروج حسب السيولة والنتيجة.' }, { title: 'محفظة USDT', description: 'مزود الحفظ/MPC قيد الاعتماد · TRON وEthereum وArbitrum مخطط لها.' }],
      legalRows: [{ title: 'شروط الاستخدام', description: 'إصدار عرض 1.0 · الموافقة القانونية معلقة' }, { title: 'إشعار الخصوصية', description: 'إصدار عرض 1.0 · بيانات المتحكم معلقة' }, { title: 'إفصاح المخاطر', description: 'مخاطر الخسارة والسيولة والطرف المقابل والتقنية والتنظيم' }, { title: 'ملف الشركة', description: 'تعيين مشغل سنغافورة مؤقت حتى تأكيد سكرتير الشركة' }, { title: 'سجل الموافقة', description: 'ستُحفظ اللغة والإصدار وسياق IP/الجهاز والوقت' }],
      resultLabel: 'نتيجة العرض الحالية', resultValue: 'ضيف · تصفح عام فقط', notEvaluated: 'لم تُقيّم', entityMapping: 'تعيين مؤقت لكيان سنغافورة', masStatus: 'حالة MAS: مرخص لخدمات أسواق رأس المال · إدارة صناديق رأس المال الجريء',
    },
  },
  fr: {
    shell: { notifications: 'Notifications', openProfile: 'Ouvrir le profil', primaryNavigation: 'Navigation principale', skipContent: 'Aller au contenu principal', offlineTitle: 'Vous êtes hors ligne', offlineBody: 'Les cours en direct et aperçus d’ordres sont suspendus. Le contenu démo en cache reste disponible.', openMasRecord: 'Ouvrir la fiche MAS de l’établissement', disclosureOpened: 'Information ouverte dans cette démo.' },
    portfolio: {
      positions: [{ name: 'Pool d’inférence H100', detail: 'Calcul · 2 unités', change: '+12,40 aujourd’hui' }, { name: 'Solar Income 2027', detail: 'RWA · distribution mensuelle', change: '+4,82 aujourd’hui' }, { name: 'Panier AI Leaders', detail: 'Actions · heures de marché', change: '+1,12 aujourd’hui' }],
      nextIncome: 'Solar Income 2027 · 28 mai', incomeRows: [{ date: 'Aujourd’hui', label: 'Revenu d’inférence H100' }, { date: '10 mai', label: 'Règlement du revenu de calcul' }, { date: '02 mai', label: 'Distribution du revenu solaire' }, { date: '30 avr.', label: 'Intérêt de référence du Trésor' }],
      netContributions: 'Apports nets', marketMovement: 'Variation de marché', incomeSettled: 'Revenus réglés', months: ['Juin', 'Juil.', 'Août', 'Sept.'], exportTitle: 'Exporter le relevé de performance', exportBody: 'Démo uniquement. Les relevés officiels exigent des données de règlement complètes.', exportReady: 'Relevé de performance démo préparé.',
    },
    trust: {
      access: { eyebrow: 'ACCÈS ET ÉLIGIBILITÉ', title: 'La disponibilité est vérifiée par personne, produit et lieu.', body: 'La navigation invité est publique. Financement, ordres et retraits exigent vérification, filtrage des sanctions et éligibilité par produit.' },
      products: { eyebrow: 'INFORMATIONS PRODUITS', title: 'Chaque rendement a une source, un coût et une règle de sortie.', body: 'La revue d’ordre précise forme juridique, émetteur ou prestataire, source du rendement, frais, durée, liquidité et recours.' },
      legal: { eyebrow: 'JURIDIQUE ET RÉGLEMENTAIRE', title: 'Les documents sont versionnés et liés à votre consentement.', body: 'La plateforme conservera version, langue, région, horodatage et preuve de chaque acceptation importante.' },
      accessRows: [{ title: 'Navigation invité', description: 'Les produits et données publiques sont consultables sans compte.' }, { title: 'Actions du compte', description: 'Financer, investir et retirer exige connexion, KYC et filtrage des sanctions.' }, { title: 'Résultat par pays', description: 'Démo : non évalué. La production utilisera résidence, nationalité, IP et règles produit.' }, { title: 'Restriction produit', description: 'Un produit peut rester indisponible même si le compte est éligible.' }],
      productRows: [{ title: 'Calcul IA · Pool H100', description: 'Participation aux revenus · souscription 0,80 % · gestion 8,00 % des revenus · file de sortie mensuelle.' }, { title: 'RWA · Solar Income 2027', description: 'Participation à un actif exploité · souscription 0,80 % · gestion annuelle 1,20 % · sortie trimestrielle.' }, { title: 'Actions mondiales · AI Leaders', description: 'Route courtier/token en attente · frais démo 0,35 % · sortie pendant les heures prises en charge.' }, { title: 'Marchés prédictifs', description: 'Données publiques · frais affichés avant confirmation · sortie selon liquidité et résolution.' }, { title: 'Portefeuille USDT', description: 'Prestataire de conservation/MPC en attente · TRON, Ethereum et Arbitrum prévus.' }],
      legalRows: [{ title: 'Conditions d’utilisation', description: 'Version démo 1.0 · validation juridique en attente' }, { title: 'Avis de confidentialité', description: 'Version démo 1.0 · responsable de traitement à confirmer' }, { title: 'Information sur les risques', description: 'Risques de perte, liquidité, contrepartie, technologie et réglementation' }, { title: 'Profil de l’entreprise', description: 'L’entité de Singapour reste provisoire jusqu’à confirmation du secrétariat' }, { title: 'Preuve de consentement', description: 'Langue, version, contexte IP/appareil et heure seront conservés' }],
      resultLabel: 'Résultat démo actuel', resultValue: 'Invité · navigation publique uniquement', notEvaluated: 'Non évalué', entityMapping: 'Rattachement provisoire à l’entité de Singapour', masStatus: 'Statut MAS : titulaire d’une licence de services de marchés de capitaux · gestion de fonds de capital-risque',
    },
  },
  pt: {
    shell: { notifications: 'Notificações', openProfile: 'Abrir perfil', primaryNavigation: 'Navegação principal', skipContent: 'Ir para o conteúdo principal', offlineTitle: 'Você está offline', offlineBody: 'Preços ao vivo e prévias de ordens estão pausados. O conteúdo Demo em cache continua disponível.', openMasRecord: 'Abrir registro da instituição na MAS', disclosureOpened: 'Informação aberta nesta Demo.' },
    portfolio: {
      positions: [{ name: 'Pool de inferência H100', detail: 'Computação · 2 unidades', change: '+12,40 hoje' }, { name: 'Solar Income 2027', detail: 'RWA · distribuição mensal', change: '+4,82 hoje' }, { name: 'Cesta AI Leaders', detail: 'Ações · horário de mercado', change: '+1,12 hoje' }],
      nextIncome: 'Solar Income 2027 · 28 mai', incomeRows: [{ date: 'Hoje', label: 'Receita de inferência H100' }, { date: '10 mai', label: 'Liquidação da receita de computação' }, { date: '02 mai', label: 'Distribuição de renda solar' }, { date: '30 abr', label: 'Apropriação de referência do Tesouro' }],
      netContributions: 'Contribuições líquidas', marketMovement: 'Movimento de mercado', incomeSettled: 'Renda liquidada', months: ['Jun', 'Jul', 'Ago', 'Set'], exportTitle: 'Exportar extrato de desempenho', exportBody: 'Apenas Demo. Extratos oficiais exigem dados de liquidação completos.', exportReady: 'Extrato de desempenho Demo preparado.',
    },
    trust: {
      access: { eyebrow: 'ACESSO E ELEGIBILIDADE', title: 'A disponibilidade é verificada por pessoa, produto e local.', body: 'A navegação como convidado é pública. Depósitos, ordens e saques exigem verificação, triagem de sanções e elegibilidade por produto.' },
      products: { eyebrow: 'DIVULGAÇÕES DE PRODUTOS', title: 'Todo retorno tem uma fonte, um custo e uma regra de saída.', body: 'A revisão da ordem identifica forma jurídica, emissor ou provedor, fonte do retorno, taxas, prazo, liquidez e canal de disputa.' },
      legal: { eyebrow: 'LEGAL E REGULATÓRIO', title: 'Os documentos têm versão e ficam vinculados ao seu consentimento.', body: 'A plataforma conservará versão, idioma, região, horário e evidência de cada aceitação relevante.' },
      accessRows: [{ title: 'Navegação como convidado', description: 'Produtos e dados públicos podem ser consultados sem conta.' }, { title: 'Ações da conta', description: 'Depositar, investir e sacar exige login, KYC e triagem de sanções.' }, { title: 'Resultado por país', description: 'Demo: ainda não avaliado. A produção usará residência, nacionalidade, IP e regras do produto.' }, { title: 'Restrição do produto', description: 'Um produto pode permanecer indisponível mesmo com a conta elegível.' }],
      productRows: [{ title: 'Computação de IA · Pool H100', description: 'Participação na receita · subscrição 0,80% · gestão 8,00% da receita · fila mensal de saída.' }, { title: 'RWA · Solar Income 2027', description: 'Participação em ativo operacional · subscrição 0,80% · gestão anual 1,20% · saída trimestral.' }, { title: 'Ações globais · AI Leaders', description: 'Rota corretora/token pendente · taxa Demo 0,35% · saída no horário suportado.' }, { title: 'Mercados de previsão', description: 'Dados públicos · taxa antes da confirmação · saída conforme liquidez e resolução.' }, { title: 'Carteira USDT', description: 'Provedor de custódia/MPC pendente · TRON, Ethereum e Arbitrum planejados.' }],
      legalRows: [{ title: 'Termos de Uso', description: 'Versão Demo 1.0 · aprovação jurídica pendente' }, { title: 'Aviso de Privacidade', description: 'Versão Demo 1.0 · dados do controlador pendentes' }, { title: 'Divulgação de Riscos', description: 'Riscos de perda, liquidez, contraparte, tecnologia e regulação' }, { title: 'Perfil corporativo', description: 'O operador de Singapura é provisório até confirmação societária' }, { title: 'Registro de consentimento', description: 'Idioma, versão, contexto IP/dispositivo e horário serão mantidos' }],
      resultLabel: 'Resultado Demo atual', resultValue: 'Convidado · apenas navegação pública', notEvaluated: 'Não avaliado', entityMapping: 'Vinculação provisória à entidade de Singapura', masStatus: 'Status MAS: licença de serviços de mercados de capitais · gestão de fundos de venture capital',
    },
  },
}
