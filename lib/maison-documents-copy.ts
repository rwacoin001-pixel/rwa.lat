import type { AppLocale } from '@/lib/app-locales'

/**
 * `/profile/documents` copy: order records and separately archived formal PDFs.
 * `{x}` tokens go through fill(). Rows are labelled "Order record" — never "document".
 * Actual file availability comes from the issued-document service.
 */
type Row = { title: string; body: string }
type DocKey = 'tradeConfirmation' | 'accountStatement' | 'productAgreement' | 'taxDocument'
type LinkKey = 'ledger' | 'disclosures' | 'legal'

export type DocumentsCopy = {
  common: { retry: string; errorGeneric: string }
  hero: { kicker: string; titleA: string; titleB: string; lede: string }
  vault: { card: string; records: string; ring: string; open: string; completed: string; closed: string; requested: string; note: string }
  orders: {
    section: string; sectionNote: string; status: string
    filters: Record<'all' | 'open' | 'completed' | 'failed-or-cancelled', string>
    rowLabel: string
    states: { filled: string; failed: string; cancelled: string; inProgress: string }
    emptyTitle: string; emptyBody: string; emptyCta: string
    emptyFilterTitle: string; emptyFilterBody: string
  }
  docs: {
    section: string; sectionNote: string
    unavailableTitle: string; unavailableBody: string
    notYet: string
    items: Record<DocKey, Row>
    note: string
  }
  related: { section: string; sectionNote: string; items: Record<LinkKey, Row & { caption: string }> }
  foot: string
}

const en: DocumentsCopy = {
  common: { retry: 'Try again', errorGeneric: 'Something went wrong. Please retry.' },
  hero: {
    kicker: 'Records', titleA: 'Your', titleB: 'records',
    lede: 'View your order records and issued PDFs. Trade confirmations use actual settlement records; agreements and tax documents require verified supporting records.',
  },
  vault: {
    card: 'Records vault', records: 'Order records', ring: '{c} of {n} completed',
    open: 'Open', completed: 'Completed', closed: 'Failed / cancelled', requested: 'Requested · excl. failed/cancelled',
    note: 'Order records are records of your orders inside the app — they are not formal documents.',
  },
  orders: {
    section: 'Order records', sectionNote: 'Every order you placed, newest first. Open a record for its full timeline.',
    status: 'Filter order records',
    filters: { all: 'All', open: 'Open', completed: 'Completed', 'failed-or-cancelled': 'Failed or cancelled' },
    rowLabel: 'Order record',
    states: { filled: 'Filled', failed: 'Failed', cancelled: 'Cancelled', inProgress: 'In progress' },
    emptyTitle: 'No order records yet', emptyBody: 'Once you place an order, its record appears here.', emptyCta: 'Explore markets',
    emptyFilterTitle: 'No records in this filter', emptyFilterBody: 'Try another filter to see the rest of your records.',
  },
  docs: {
    section: 'Formal documents', sectionNote: 'What an investment platform normally issues. None of it is issued through the app yet.',
    unavailableTitle: 'Not yet available',
    unavailableBody: 'Formal documents are not issued through the app yet. When they are, they will appear here — nothing is missing from your account.',
    notYet: 'Not yet available',
    items: {
      tradeConfirmation: { title: 'Trade confirmation', body: 'Per-order confirmation of what was executed — price, quantity, fees.' },
      accountStatement: { title: 'Account statement', body: 'Official periodic statement of positions, cash flows and balances.' },
      productAgreement: { title: 'Product agreement', body: 'The signed terms between you and the product for each investment.' },
      taxDocument: { title: 'Tax document', body: 'Annual tax reporting for your investments, where applicable.' },
    },
    note: 'This page never shows placeholders or downloads for documents that do not exist.',
  },
  related: {
    section: 'Related', sectionNote: 'Pages that hold real records today.',
    items: {
      ledger: { title: 'Ledger month summary', body: 'Your ledger, summarised by month.', caption: 'A summary of your ledger — not an official statement.' },
      disclosures: { title: 'Product disclosures', body: 'Public documents for each product.', caption: 'Public product documents — not your personal records.' },
      legal: { title: 'Legal centre', body: 'Platform terms, privacy and legal notices.', caption: 'Platform terms and legal text.' },
    },
  },
  foot: 'Documents are kept apart from order records. We never label an order record as a document.',
}

const zh: DocumentsCopy = {
  common: { retry: '重试', errorGeneric: '出现问题，请重试。' },
  hero: {
    kicker: '记录', titleA: '你的', titleB: '记录',
    lede: '查看订单记录与已发放 PDF。成交确认书取自实际入账记录；协议与税务文件须完成相应确认和资料核实。',
  },
  vault: {
    card: '记录库', records: '订单记录', ring: '已完成 {c} / 共 {n}',
    open: '进行中', completed: '已完成', closed: '失败/取消', requested: '请求总额（不含失败/取消）',
    note: '订单记录是应用内对下单的记录，不是正式文件。',
  },
  orders: {
    section: '订单记录', sectionNote: '你下的每一笔订单，最新在前。点开记录可查看完整时间线。',
    status: '筛选订单记录',
    filters: { all: '全部', open: '进行中', completed: '已完成', 'failed-or-cancelled': '失败或取消' },
    rowLabel: '订单记录',
    states: { filled: '已成交', failed: '失败', cancelled: '已取消', inProgress: '进行中' },
    emptyTitle: '还没有订单记录', emptyBody: '下单后，订单记录会出现在这里。', emptyCta: '去逛市场',
    emptyFilterTitle: '此筛选下没有记录', emptyFilterBody: '换一个筛选条件，看看其余记录。',
  },
  docs: {
    section: '正式文件', sectionNote: '投资平台通常会出具的文件。目前应用内还不能出具。',
    unavailableTitle: '暂不可用',
    unavailableBody: '正式文件目前还不能通过应用出具。具备后会显示在这里——你的账户没有任何缺失。',
    notYet: '暂不可用',
    items: {
      tradeConfirmation: { title: '成交确认书', body: '每笔订单的成交确认——价格、数量、费用。' },
      accountStatement: { title: '对账单', body: '按周期出具的持仓、现金流与余额的正式对账单。' },
      productAgreement: { title: '产品协议', body: '每笔投资中你与产品签署的条款协议。' },
      taxDocument: { title: '税务文件', body: '按适用规定出具的年度投资税务文件。' },
    },
    note: '本页绝不会为不存在的文件显示占位内容或下载按钮。',
  },
  related: {
    section: '相关入口', sectionNote: '这些页面保存着当前真实可用的记录。',
    items: {
      ledger: { title: '账本月度汇总', body: '按月汇总你的账本流水。', caption: '账本的月度汇总——不是正式对账单。' },
      disclosures: { title: '产品披露', body: '各产品的公开披露文件。', caption: '公开的产品文件——不是你的个人记录。' },
      legal: { title: '法律中心', body: '平台条款、隐私政策与法律声明。', caption: '平台条款与法律文本。' },
    },
  },
  foot: '正式文件与订单记录分开保存。我们不会把订单记录标注成文件。',
}

const hi: DocumentsCopy = {
  common: { retry: 'फिर कोशिश करें', errorGeneric: 'कुछ गलत हो गया। फिर कोशिश करें।' },
  hero: {
    kicker: 'रिकॉर्ड', titleA: 'आपके', titleB: 'रिकॉर्ड',
    lede: 'अपने ऑर्डर रिकॉर्ड और जारी PDF देखें। ट्रेड कन्फ़र्मेशन वास्तविक निपटान से बनते हैं; समझौतों और कर दस्तावेज़ों के लिए पुष्टि और सत्यापित रिकॉर्ड आवश्यक हैं।',
  },
  vault: {
    card: 'रिकॉर्ड वॉल्ट', records: 'ऑर्डर रिकॉर्ड', ring: '{n} में से {c} पूरे',
    open: 'जारी', completed: 'पूरे', closed: 'विफल/रद्द', requested: 'कुल अनुरोधित (विफल/रद्द छोड़कर)',
    note: 'ऑर्डर रिकॉर्ड ऐप के भीतर आपके ऑर्डर का रिकॉर्ड हैं — ये औपचारिक दस्तावेज़ नहीं हैं।',
  },
  orders: {
    section: 'ऑर्डर रिकॉर्ड', sectionNote: 'आपके हर ऑर्डर का रिकॉर्ड, नया सबसे ऊपर। पूरी टाइमलाइन के लिए रिकॉर्ड खोलें।',
    status: 'ऑर्डर रिकॉर्ड फ़िल्टर करें',
    filters: { all: 'सभी', open: 'जारी', completed: 'पूरे', 'failed-or-cancelled': 'विफल या रद्द' },
    rowLabel: 'ऑर्डर रिकॉर्ड',
    states: { filled: 'भरा गया', failed: 'विफल', cancelled: 'रद्द', inProgress: 'जारी' },
    emptyTitle: 'अभी कोई ऑर्डर रिकॉर्ड नहीं', emptyBody: 'ऑर्डर करते ही उसका रिकॉर्ड यहाँ दिखेगा।', emptyCta: 'बाज़ार देखें',
    emptyFilterTitle: 'इस फ़िल्टर में कोई रिकॉर्ड नहीं', emptyFilterBody: 'बाकी रिकॉर्ड देखने के लिए कोई और फ़िल्टर आज़माएँ।',
  },
  docs: {
    section: 'औपचारिक दस्तावेज़', sectionNote: 'निवेश प्लेटफ़ॉर्म आमतौर पर ये दस्तावेज़ जारी करते हैं। अभी ऐप से जारी नहीं होते।',
    unavailableTitle: 'अभी उपलब्ध नहीं',
    unavailableBody: 'औपचारिक दस्तावेज़ अभी ऐप से जारी नहीं होते। उपलब्ध होते ही यहाँ दिखेंगे — आपके खाते से कुछ भी गायब नहीं है।',
    notYet: 'अभी उपलब्ध नहीं',
    items: {
      tradeConfirmation: { title: 'ट्रेड कन्फ़र्मेशन', body: 'हर ऑर्डर का निष्पादन पुष्टिकरण — मूल्य, मात्रा, शुल्क।' },
      accountStatement: { title: 'खाता विवरण', body: 'स्थितियों, नकदी प्रवाह और शेष का आधिकारिक आवधिक विवरण।' },
      productAgreement: { title: 'उत्पाद समझौता', body: 'हर निवेश पर आपके और उत्पाद के बीच हस्ताक्षरित शर्तें।' },
      taxDocument: { title: 'कर दस्तावेज़', body: 'जहाँ लागू हो, आपके निवेशों की वार्षिक कर रिपोर्टिंग।' },
    },
    note: 'यह पेज मौजूद न दस्तावेज़ों के लिए प्लेसहोल्डर या डाउनलोड बटन कभी नहीं दिखाता।',
  },
  related: {
    section: 'संबंधित', sectionNote: 'ये जगहें आज असली रिकॉर्ड रखती हैं।',
    items: {
      ledger: { title: 'लेजर मासिक सारांश', body: 'महीने के अनुसार आपके लेजर का सारांश।', caption: 'आपके लेजर का सारांश — आधिकारिक विवरण नहीं।' },
      disclosures: { title: 'उत्पाद खुलासे', body: 'सार्वजनिक उत्पाद दस्तावेज़।', caption: 'सार्वजनिक उत्पाद दस्तावेज़ — आपके व्यक्तिगत रिकॉर्ड नहीं।' },
      legal: { title: 'कानूनी केंद्र', body: 'प्लेटफ़ॉर्म शर्तें, गोपनीयता और कानूनी सूचनाएँ।', caption: 'प्लेटफ़ॉर्म शर्तें और कानूनी पाठ।' },
    },
  },
  foot: 'दस्तावेज़ ऑर्डर रिकॉर्ड से अलग रखे जाते हैं। हम ऑर्डर रिकॉर्ड को दस्तावेज़ नहीं कहते।',
}

const es: DocumentsCopy = {
  common: { retry: 'Reintentar', errorGeneric: 'Algo salió mal. Reintenta.' },
  hero: {
    kicker: 'Registros', titleA: 'Tus', titleB: 'registros',
    lede: 'Consulta tus órdenes y PDF emitidos. Las confirmaciones usan liquidaciones reales; los acuerdos y documentos fiscales requieren confirmación y registros verificados.',
  },
  vault: {
    card: 'Cámara de registros', records: 'Registros de órdenes', ring: '{c} de {n} completadas',
    open: 'Abiertas', completed: 'Completadas', closed: 'Fallidas/anuladas', requested: 'Total solicitado (sin fallidas/anuladas)',
    note: 'Los registros de órdenes son registros de tus órdenes dentro de la app — no son documentos formales.',
  },
  orders: {
    section: 'Registros de órdenes', sectionNote: 'Cada orden que hiciste, la más reciente primero. Abre un registro para ver su línea de tiempo completa.',
    status: 'Filtrar registros de órdenes',
    filters: { all: 'Todas', open: 'Abiertas', completed: 'Completadas', 'failed-or-cancelled': 'Fallidas o anuladas' },
    rowLabel: 'Registro de orden',
    states: { filled: 'Ejecutada', failed: 'Fallida', cancelled: 'Anulada', inProgress: 'En curso' },
    emptyTitle: 'Aún no hay registros de órdenes', emptyBody: 'Cuando hagas una orden, su registro aparecerá aquí.', emptyCta: 'Explorar mercados',
    emptyFilterTitle: 'Sin registros en este filtro', emptyFilterBody: 'Prueba otro filtro para ver el resto de tus registros.',
  },
  docs: {
    section: 'Documentos formales', sectionNote: 'Lo que una plataforma de inversión suele emitir. Todavía no se emite desde la app.',
    unavailableTitle: 'Aún no disponible',
    unavailableBody: 'Los documentos formales aún no se emiten desde la app. Cuando lo estén, aparecerán aquí — no falta nada en tu cuenta.',
    notYet: 'Aún no disponible',
    items: {
      tradeConfirmation: { title: 'Confirmación de operación', body: 'Confirmación por orden de lo ejecutado: precio, cantidad, comisiones.' },
      accountStatement: { title: 'Extracto de cuenta', body: 'Extracto oficial periódico de posiciones, flujos de efectivo y saldos.' },
      productAgreement: { title: 'Acuerdo del producto', body: 'Los términos firmados entre tú y el producto para cada inversión.' },
      taxDocument: { title: 'Documento fiscal', body: 'El informe fiscal anual de tus inversiones, cuando corresponda.' },
    },
    note: 'Esta página nunca muestra marcadores ni descargas para documentos que no existen.',
  },
  related: {
    section: 'Relacionado', sectionNote: 'Páginas que hoy contienen registros reales.',
    items: {
      ledger: { title: 'Resumen mensual del libro', body: 'Tu libro mayor, resumido por mes.', caption: 'Un resumen de tu libro mayor — no un extracto oficial.' },
      disclosures: { title: 'Divulgaciones de productos', body: 'Documentos públicos de cada producto.', caption: 'Documentos públicos del producto — no tus registros personales.' },
      legal: { title: 'Centro legal', body: 'Condiciones de la plataforma, privacidad y avisos legales.', caption: 'Condiciones y textos legales de la plataforma.' },
    },
  },
  foot: 'Los documentos se guardan aparte de los registros de órdenes. Nunca etiquetamos un registro de orden como documento.',
}

const ar: DocumentsCopy = {
  common: { retry: 'إعادة المحاولة', errorGeneric: 'حدث خطأ. أعد المحاولة.' },
  hero: {
    kicker: 'السجلات', titleA: 'سجلاتك', titleB: 'الخاصة',
    lede: 'اطّلع على سجلات طلباتك وملفات PDF الصادرة. تستند تأكيدات التداول إلى التسوية الفعلية؛ وتتطلب الاتفاقيات والوثائق الضريبية تأكيدًا وسجلات موثّقة.',
  },
  vault: {
    card: 'خزنة السجلات', records: 'سجلات الطلبات', ring: '{c} من {n} مكتملة',
    open: 'مفتوحة', completed: 'مكتملة', closed: 'فاشلة/ملغاة', requested: 'إجمالي المطلوب (دون الفاشلة/الملغاة)',
    note: 'سجلات الطلبات هي سجلات لطلباتك داخل التطبيق — وليست وثائق رسمية.',
  },
  orders: {
    section: 'سجلات الطلبات', sectionNote: 'كل طلب قمت به، الأحدث أولاً. افتح السجل لعرض الخط الزمني الكامل.',
    status: 'تصفية سجلات الطلبات',
    filters: { all: 'الكل', open: 'مفتوحة', completed: 'مكتملة', 'failed-or-cancelled': 'فاشلة أو ملغاة' },
    rowLabel: 'سجل طلب',
    states: { filled: 'مُنفَّذ', failed: 'فاشل', cancelled: 'ملغى', inProgress: 'قيد التنفيذ' },
    emptyTitle: 'لا توجد سجلات طلبات بعد', emptyBody: 'بمجرد إنشاء طلب، سيظهر سجله هنا.', emptyCta: 'استكشف الأسواق',
    emptyFilterTitle: 'لا سجلات في هذا التصفية', emptyFilterBody: 'جرّب تصفية أخرى لرؤية بقية سجلاتك.',
  },
  docs: {
    section: 'الوثائق الرسمية', sectionNote: 'ما تصدره منصات الاستثمار عادةً. لا يُصدر عبر التطبيق بعد.',
    unavailableTitle: 'غير متاحة بعد',
    unavailableBody: 'الوثائق الرسمية لا تُصدر عبر التطبيق بعد. ستظهر هنا متى توافرت — لا يوجد شيء ناقص في حسابك.',
    notYet: 'غير متاحة بعد',
    items: {
      tradeConfirmation: { title: 'تأكيد التداول', body: 'تأكيد لكل طلب بما تم تنفيذه — السعر والكمية والرسوم.' },
      accountStatement: { title: 'كشف الحساب', body: 'كشف رسمي دوري للمراكز والتدفقات النقدية والأرصدة.' },
      productAgreement: { title: 'اتفاقية المنتج', body: 'الشروط الموقعة بينك وبين المنتج لكل استثمار.' },
      taxDocument: { title: 'وثيقة ضريبية', body: 'التقارير الضريبية السنوية لاستثماراتك، حيثما ينطبق.' },
    },
    note: 'لا تعرض هذه الصفحة أبدًا عناصر وهمية أو أزرار تنزيل لوثائق غير موجودة.',
  },
  related: {
    section: 'ذو صلة', sectionNote: 'صفحات تحتوي على سجلات حقيقية اليوم.',
    items: {
      ledger: { title: 'ملخص الدفتر الشهري', body: 'دفترك ملخّصًا حسب الشهر.', caption: 'ملخص لدفترك — وليس كشفًا رسميًا.' },
      disclosures: { title: 'إفصاحات المنتجات', body: 'وثائق المنتجات العامة.', caption: 'وثائق منتجات عامة — وليست سجلاتك الشخصية.' },
      legal: { title: 'المركز القانوني', body: 'شروط المنصة والخصوصية والإشعارات القانونية.', caption: 'شروط المنصة والنصوص القانونية.' },
    },
  },
  foot: 'تُحفظ الوثائق منفصلة عن سجلات الطلبات. لا نسمّي سجل طلب أبدًا وثيقة.',
}

const fr: DocumentsCopy = {
  common: { retry: 'Réessayer', errorGeneric: 'Une erreur est survenue. Réessayez.' },
  hero: {
    kicker: 'Registres', titleA: 'Vos', titleB: 'registres',
    lede: 'Consultez vos ordres et PDF émis. Les confirmations reposent sur les règlements réels ; les accords et documents fiscaux nécessitent une confirmation et des données vérifiées.',
  },
  vault: {
    card: 'Coffre de registres', records: 'Registres d’ordres', ring: '{c} sur {n} terminés',
    open: 'En cours', completed: 'Terminés', closed: 'Échoués/annulés', requested: 'Total demandé (hors échoués/annulés)',
    note: 'Les registres d’ordres sont les enregistrements de vos ordres dans l’app — pas des documents formels.',
  },
  orders: {
    section: 'Registres d’ordres', sectionNote: 'Chaque ordre passé, le plus récent en premier. Ouvrez un registre pour sa chronologie complète.',
    status: 'Filtrer les registres d’ordres',
    filters: { all: 'Tous', open: 'En cours', completed: 'Terminés', 'failed-or-cancelled': 'Échoués ou annulés' },
    rowLabel: 'Registre d’ordre',
    states: { filled: 'Exécuté', failed: 'Échoué', cancelled: 'Annulé', inProgress: 'En cours' },
    emptyTitle: 'Aucun registre d’ordre', emptyBody: 'Dès que vous passerez un ordre, son registre apparaîtra ici.', emptyCta: 'Explorer les marchés',
    emptyFilterTitle: 'Aucun registre dans ce filtre', emptyFilterBody: 'Essayez un autre filtre pour voir le reste de vos registres.',
  },
  docs: {
    section: 'Documents formels', sectionNote: 'Ce qu’une plateforme d’investissement émet habituellement. Rien n’est encore émis depuis l’app.',
    unavailableTitle: 'Pas encore disponible',
    unavailableBody: 'Les documents formels ne sont pas encore émis depuis l’app. Ils apparaîtront ici quand ce sera le cas — il ne manque rien dans votre compte.',
    notYet: 'Pas encore disponible',
    items: {
      tradeConfirmation: { title: 'Confirmation de transaction', body: 'Confirmation par ordre de l’exécution : prix, quantité, frais.' },
      accountStatement: { title: 'Relevé de compte', body: 'Relevé officiel périodique des positions, flux de trésorerie et soldes.' },
      productAgreement: { title: 'Contrat du produit', body: 'Les conditions signées entre vous et le produit pour chaque investissement.' },
      taxDocument: { title: 'Document fiscal', body: 'La déclaration fiscale annuelle de vos investissements, le cas échéant.' },
    },
    note: 'Cette page n’affiche jamais de remplissage ni de téléchargement pour des documents inexistants.',
  },
  related: {
    section: 'À proximité', sectionNote: 'Des pages qui contiennent de vrais registres aujourd’hui.',
    items: {
      ledger: { title: 'Synthèse mensuelle du grand livre', body: 'Votre grand livre résumé par mois.', caption: 'Une synthèse de votre grand livre — pas un relevé officiel.' },
      disclosures: { title: 'Divulgations produits', body: 'Documents publics de chaque produit.', caption: 'Documents publics du produit — pas vos registres personnels.' },
      legal: { title: 'Centre juridique', body: 'Conditions de la plateforme, confidentialité et mentions légales.', caption: 'Conditions et textes juridiques de la plateforme.' },
    },
  },
  foot: 'Les documents sont conservés à part des registres d’ordres. Nous ne qualifions jamais un registre d’ordre de document.',
}

const pt: DocumentsCopy = {
  common: { retry: 'Tentar novamente', errorGeneric: 'Algo deu errado. Tente novamente.' },
  hero: {
    kicker: 'Registros', titleA: 'Os seus', titleB: 'registros',
    lede: 'Consulte suas ordens e PDFs emitidos. As confirmações usam liquidações reais; acordos e documentos fiscais exigem confirmação e registros verificados.',
  },
  vault: {
    card: 'Cofre de registros', records: 'Registros de ordens', ring: '{c} de {n} concluídas',
    open: 'Em curso', completed: 'Concluídas', closed: 'Falhadas/canceladas', requested: 'Total solicitado (sem falhadas/canceladas)',
    note: 'Os registros de ordens são registos das suas ordens dentro da app — não são documentos formais.',
  },
  orders: {
    section: 'Registros de ordens', sectionNote: 'Cada ordem que fez, a mais recente primeiro. Abra um registro para ver a linha do tempo completa.',
    status: 'Filtrar registros de ordens',
    filters: { all: 'Todas', open: 'Em curso', completed: 'Concluídas', 'failed-or-cancelled': 'Falhadas ou canceladas' },
    rowLabel: 'Registro de ordem',
    states: { filled: 'Executada', failed: 'Falhada', cancelled: 'Cancelada', inProgress: 'Em curso' },
    emptyTitle: 'Ainda não há registros de ordens', emptyBody: 'Assim que fizer uma ordem, o registro aparece aqui.', emptyCta: 'Explorar mercados',
    emptyFilterTitle: 'Sem registros neste filtro', emptyFilterBody: 'Experimente outro filtro para ver o resto dos seus registros.',
  },
  docs: {
    section: 'Documentos formais', sectionNote: 'O que uma plataforma de investimento costuma emitir. Ainda não é emitido pela app.',
    unavailableTitle: 'Ainda não disponível',
    unavailableBody: 'Os documentos formais ainda não são emitidos pela app. Quando forem, aparecem aqui — não falta nada na sua conta.',
    notYet: 'Ainda não disponível',
    items: {
      tradeConfirmation: { title: 'Confirmação de negociação', body: 'Confirmação por ordem do que foi executado: preço, quantidade, taxas.' },
      accountStatement: { title: 'Extrato de conta', body: 'Extrato oficial periódico de posições, fluxos de caixa e saldos.' },
      productAgreement: { title: 'Acordo do produto', body: 'Os termos assinados entre si e o produto para cada investimento.' },
      taxDocument: { title: 'Documento fiscal', body: 'A declaração fiscal anual dos seus investimentos, quando aplicável.' },
    },
    note: 'Esta página nunca mostra marcadores ou downloads para documentos que não existem.',
  },
  related: {
    section: 'Relacionado', sectionNote: 'Páginas que hoje contêm registos reais.',
    items: {
      ledger: { title: 'Resumo mensal do livro-razão', body: 'O seu livro-razão resumido por mês.', caption: 'Um resumo do seu livro-razão — não um extrato oficial.' },
      disclosures: { title: 'Divulgações de produtos', body: 'Documentos públicos de cada produto.', caption: 'Documentos públicos do produto — não os seus registos pessoais.' },
      legal: { title: 'Centro jurídico', body: 'Termos da plataforma, privacidade e avisos legais.', caption: 'Termos e textos jurídicos da plataforma.' },
    },
  },
  foot: 'Os documentos são guardados à parte dos registros de ordens. Nunca chamamos um registro de ordem de documento.',
}

export const documentsCopy: Record<AppLocale, DocumentsCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
