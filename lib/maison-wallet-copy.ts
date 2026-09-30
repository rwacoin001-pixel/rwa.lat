import type { AppLocale } from '@/lib/app-locales'

/** Cash domain copy: /assets/cash, /assets/activity, /assets/cash/deposit. `{x}` tokens go through fill(). */
export type WalletCopy = {
  cash: {
    kicker: string; title: string; available: string; locked: string; pending: string; invested: string; rewards: string; asOf: string
    deposit: string; withdraw: string; transfer: string; addressBook: string
    testMode: string; testModeBody: string
    networks: string; networksNote: string; network: string; confirmations: string; minDeposit: string; minWithdraw: string; fee: string; eta: string; etaValue: string
    funding: string; fundingNote: string; fundingEmpty: string; fundingEmptyBody: string
    kinds: { deposit: string; withdrawal: string; transfer: string }
    ledger: string; ledgerNote: string; viewAll: string; loadError: string
  }
  states: Record<string, string>
  activity: {
    kicker: string; title: string; filters: [string, string, string, string, string]
    inflow: string; outflow: string; net: string; scope: string; empty: string; emptyBody: string; lockedMove: string
    types: Record<string, string>; purposes: Record<string, string>; otherType: string
  }
  deposit: {
    kicker: string; title: string; network: string; reveal: string; revealing: string; address: string; memo: string; copy: string; copied: string
    before: string; afterNote: string; testAddress: string; backCash: string; loadError: string; qr: string
  }
}

const en: WalletCopy = {
  cash: {
    kicker: 'Cash', title: 'Cash & wallet', available: 'Available', locked: 'Locked', pending: 'Pending', invested: 'Invested (cost)', rewards: 'Rewards payable', asOf: 'Balances as of {t}',
    deposit: 'Deposit', withdraw: 'Withdraw', transfer: 'Transfer', addressBook: 'Address book',
    testMode: 'Test custody · no real funds', testModeBody: 'This environment uses a stub custodian. Addresses and balances are for testing only.',
    networks: 'Networks', networksNote: 'Server policy', network: 'Network', confirmations: 'Confirms', minDeposit: 'Min deposit', minWithdraw: 'Min withdrawal', fee: 'Withdrawal fee', eta: 'Arrival', etaValue: '{a}–{b} min',
    funding: 'Funding', fundingNote: 'Deposits, withdrawals, transfers', fundingEmpty: 'No funding yet', fundingEmptyBody: 'Deposits, withdrawals and transfers will show here with their status.',
    kinds: { deposit: 'Deposit', withdrawal: 'Withdrawal', transfer: 'Transfer' },
    ledger: 'Ledger', ledgerNote: 'Latest entries', viewAll: 'All activity', loadError: 'Could not load this section',
  },
  states: { pending: 'Pending', detected: 'Detected', confirming: 'Confirming', credited: 'Credited', requested: 'Requested', pending_review: 'In review', approved: 'Approved', broadcast: 'Broadcast', completed: 'Completed', posted: 'Posted', failed: 'Failed', rejected: 'Rejected', cancelled: 'Cancelled', held: 'Held' },
  activity: {
    kicker: 'Ledger', title: 'Activity', filters: ['All', 'Funding', 'Investing', 'Income', 'Other'],
    inflow: 'In', outflow: 'Out', net: 'Net', scope: 'Latest {n} ledger entries · available balance', empty: 'No entries here', emptyBody: 'Ledger entries in this category will appear here.', lockedMove: 'Locked {v}',
    types: { deposit: 'Deposit', withdrawal_lock: 'Withdrawal hold', withdrawal_settlement: 'Withdrawal settled', withdrawal_refund: 'Withdrawal refund', internal_transfer: 'Internal transfer', order_lock: 'Order hold', order_release: 'Order release', investment: 'Investment', redemption: 'Redemption', yield_distribution: 'Yield', adjustment: 'Adjustment', reversal: 'Reversal', basket_subscription: 'Basket subscription', basket_redemption: 'Basket redemption', basket_settlement: 'Basket settlement', basket_rebalance: 'Basket rebalance' },
    purposes: { available: 'Available', locked: 'Locked', pending: 'Pending', invested_cost: 'Invested', reward_payable: 'Rewards' }, otherType: 'Ledger entry',
  },
  deposit: {
    kicker: 'Deposit', title: 'Deposit USDT', network: 'Network', reveal: 'Show deposit address', revealing: 'Preparing address…', address: 'Deposit address', memo: 'Memo / tag', copy: 'Copy', copied: 'Copied',
    before: 'Before you send', afterNote: 'Credits appear in Activity after {n} network confirmations.', testAddress: 'Test address from a stub custodian — do not send real funds.', backCash: 'Back to cash', loadError: 'Could not prepare an address', qr: 'QR code of the deposit address',
  },
}

const zh: WalletCopy = {
  cash: {
    kicker: '现金', title: '现金与钱包', available: '可用', locked: '锁定', pending: '处理中', invested: '已投资（成本）', rewards: '待发奖励', asOf: '余额更新于 {t}',
    deposit: '充值', withdraw: '提现', transfer: '转账', addressBook: '地址簿',
    testMode: '测试托管 · 非真实资金', testModeBody: '当前环境使用模拟托管，地址与余额仅用于测试。',
    networks: '网络', networksNote: '服务端策略', network: '网络', confirmations: '确认数', minDeposit: '最小充值', minWithdraw: '最小提现', fee: '提现手续费', eta: '到账', etaValue: '{a}–{b} 分钟',
    funding: '资金往来', fundingNote: '充值、提现、转账', fundingEmpty: '暂无资金往来', fundingEmptyBody: '充值、提现和转账会连同状态显示在这里。',
    kinds: { deposit: '充值', withdrawal: '提现', transfer: '转账' },
    ledger: '账本', ledgerNote: '最新记录', viewAll: '全部流水', loadError: '该部分加载失败',
  },
  states: { pending: '处理中', detected: '已检测', confirming: '确认中', credited: '已入账', requested: '已申请', pending_review: '审核中', approved: '已批准', broadcast: '已广播', completed: '已完成', posted: '已记账', failed: '失败', rejected: '已拒绝', cancelled: '已取消', held: '已冻结' },
  activity: {
    kicker: '账本', title: '资金流水', filters: ['全部', '资金', '投资', '收益', '其他'],
    inflow: '流入', outflow: '流出', net: '净额', scope: '最近 {n} 条账本记录 · 可用余额口径', empty: '暂无记录', emptyBody: '该类别的账本记录会显示在这里。', lockedMove: '锁定 {v}',
    types: { deposit: '充值', withdrawal_lock: '提现冻结', withdrawal_settlement: '提现结算', withdrawal_refund: '提现退回', internal_transfer: '内部转账', order_lock: '订单冻结', order_release: '订单解冻', investment: '投资扣款', redemption: '赎回', yield_distribution: '收益', adjustment: '账务调整', reversal: '冲正', basket_subscription: '组合申购', basket_redemption: '组合赎回', basket_settlement: '组合结算', basket_rebalance: '组合再平衡' },
    purposes: { available: '可用', locked: '锁定', pending: '处理中', invested_cost: '已投资', reward_payable: '奖励' }, otherType: '账本记录',
  },
  deposit: {
    kicker: '充值', title: '充值 USDT', network: '网络', reveal: '显示充值地址', revealing: '正在准备地址…', address: '充值地址', memo: '备注 / 标签', copy: '复制', copied: '已复制',
    before: '转账前请确认', afterNote: '网络确认 {n} 次后，入账记录会出现在资金流水中。', testAddress: '模拟托管生成的测试地址，请勿转入真实资金。', backCash: '返回现金', loadError: '无法准备充值地址', qr: '充值地址二维码',
  },
}

const hi: WalletCopy = {
  cash: {
    kicker: 'नकद', title: 'नकद और वॉलेट', available: 'उपलब्ध', locked: 'लॉक', pending: 'लंबित', invested: 'निवेशित (लागत)', rewards: 'देय पुरस्कार', asOf: '{t} तक का शेष',
    deposit: 'जमा', withdraw: 'निकासी', transfer: 'ट्रांसफ़र', addressBook: 'पता पुस्तिका',
    testMode: 'टेस्ट कस्टडी · असली धन नहीं', testModeBody: 'यह परिवेश स्टब कस्टोडियन का उपयोग करता है। पते और शेष केवल परीक्षण के लिए हैं।',
    networks: 'नेटवर्क', networksNote: 'सर्वर नीति', network: 'नेटवर्क', confirmations: 'पुष्टि', minDeposit: 'न्यूनतम जमा', minWithdraw: 'न्यूनतम निकासी', fee: 'निकासी शुल्क', eta: 'आगमन', etaValue: '{a}–{b} मिनट',
    funding: 'फ़ंडिंग', fundingNote: 'जमा, निकासी, ट्रांसफ़र', fundingEmpty: 'अभी कोई फ़ंडिंग नहीं', fundingEmptyBody: 'जमा, निकासी और ट्रांसफ़र अपनी स्थिति के साथ यहाँ दिखेंगे।',
    kinds: { deposit: 'जमा', withdrawal: 'निकासी', transfer: 'ट्रांसफ़र' },
    ledger: 'लेजर', ledgerNote: 'नवीनतम प्रविष्टियाँ', viewAll: 'सभी गतिविधि', loadError: 'यह भाग लोड नहीं हो सका',
  },
  states: { pending: 'लंबित', detected: 'पता चला', confirming: 'पुष्टि हो रही', credited: 'जमा हुआ', requested: 'अनुरोधित', pending_review: 'समीक्षा में', approved: 'स्वीकृत', broadcast: 'प्रसारित', completed: 'पूर्ण', posted: 'दर्ज', failed: 'विफल', rejected: 'अस्वीकृत', cancelled: 'रद्द', held: 'रोका गया' },
  activity: {
    kicker: 'लेजर', title: 'गतिविधि', filters: ['सभी', 'फ़ंडिंग', 'निवेश', 'आय', 'अन्य'],
    inflow: 'आवक', outflow: 'जावक', net: 'शुद्ध', scope: 'नवीनतम {n} लेजर प्रविष्टियाँ · उपलब्ध शेष', empty: 'यहाँ कोई प्रविष्टि नहीं', emptyBody: 'इस श्रेणी की लेजर प्रविष्टियाँ यहाँ दिखेंगी।', lockedMove: 'लॉक {v}',
    types: { deposit: 'जमा', withdrawal_lock: 'निकासी होल्ड', withdrawal_settlement: 'निकासी निपटान', withdrawal_refund: 'निकासी वापसी', internal_transfer: 'आंतरिक ट्रांसफ़र', order_lock: 'ऑर्डर होल्ड', order_release: 'ऑर्डर रिलीज़', investment: 'निवेश', redemption: 'रिडेम्पशन', yield_distribution: 'आय', adjustment: 'समायोजन', reversal: 'रिवर्सल', basket_subscription: 'बास्केट सदस्यता', basket_redemption: 'बास्केट रिडेम्पशन', basket_settlement: 'बास्केट निपटान', basket_rebalance: 'बास्केट पुनर्संतुलन' },
    purposes: { available: 'उपलब्ध', locked: 'लॉक', pending: 'लंबित', invested_cost: 'निवेशित', reward_payable: 'पुरस्कार' }, otherType: 'लेजर प्रविष्टि',
  },
  deposit: {
    kicker: 'जमा', title: 'USDT जमा करें', network: 'नेटवर्क', reveal: 'जमा पता दिखाएँ', revealing: 'पता तैयार हो रहा है…', address: 'जमा पता', memo: 'मेमो / टैग', copy: 'कॉपी', copied: 'कॉपी हुआ',
    before: 'भेजने से पहले', afterNote: '{n} नेटवर्क पुष्टियों के बाद जमा गतिविधि में दिखेगा।', testAddress: 'स्टब कस्टोडियन का टेस्ट पता — असली धन न भेजें।', backCash: 'नकद पर लौटें', loadError: 'पता तैयार नहीं हो सका', qr: 'जमा पते का QR कोड',
  },
}

const es: WalletCopy = {
  cash: {
    kicker: 'Efectivo', title: 'Efectivo y billetera', available: 'Disponible', locked: 'Bloqueado', pending: 'Pendiente', invested: 'Invertido (coste)', rewards: 'Recompensas por pagar', asOf: 'Saldos a {t}',
    deposit: 'Depositar', withdraw: 'Retirar', transfer: 'Transferir', addressBook: 'Libreta de direcciones',
    testMode: 'Custodia de prueba · sin fondos reales', testModeBody: 'Este entorno usa un custodio simulado. Las direcciones y saldos son solo de prueba.',
    networks: 'Redes', networksNote: 'Política del servidor', network: 'Red', confirmations: 'Confirm.', minDeposit: 'Depósito mín.', minWithdraw: 'Retiro mín.', fee: 'Comisión de retiro', eta: 'Llegada', etaValue: '{a}–{b} min',
    funding: 'Movimientos de fondos', fundingNote: 'Depósitos, retiros, transferencias', fundingEmpty: 'Aún no hay movimientos', fundingEmptyBody: 'Los depósitos, retiros y transferencias aparecerán aquí con su estado.',
    kinds: { deposit: 'Depósito', withdrawal: 'Retiro', transfer: 'Transferencia' },
    ledger: 'Libro mayor', ledgerNote: 'Últimos asientos', viewAll: 'Toda la actividad', loadError: 'No se pudo cargar esta sección',
  },
  states: { pending: 'Pendiente', detected: 'Detectado', confirming: 'Confirmando', credited: 'Abonado', requested: 'Solicitado', pending_review: 'En revisión', approved: 'Aprobado', broadcast: 'Emitido', completed: 'Completado', posted: 'Registrado', failed: 'Fallido', rejected: 'Rechazado', cancelled: 'Cancelado', held: 'Retenido' },
  activity: {
    kicker: 'Libro mayor', title: 'Actividad', filters: ['Todo', 'Fondos', 'Inversión', 'Ingresos', 'Otros'],
    inflow: 'Entrada', outflow: 'Salida', net: 'Neto', scope: 'Últimos {n} asientos · saldo disponible', empty: 'No hay asientos', emptyBody: 'Los asientos de esta categoría aparecerán aquí.', lockedMove: 'Bloqueado {v}',
    types: { deposit: 'Depósito', withdrawal_lock: 'Retención de retiro', withdrawal_settlement: 'Retiro liquidado', withdrawal_refund: 'Reembolso de retiro', internal_transfer: 'Transferencia interna', order_lock: 'Retención de orden', order_release: 'Liberación de orden', investment: 'Inversión', redemption: 'Rescate', yield_distribution: 'Rendimiento', adjustment: 'Ajuste', reversal: 'Reversión', basket_subscription: 'Suscripción a cesta', basket_redemption: 'Rescate de cesta', basket_settlement: 'Liquidación de cesta', basket_rebalance: 'Rebalanceo de cesta' },
    purposes: { available: 'Disponible', locked: 'Bloqueado', pending: 'Pendiente', invested_cost: 'Invertido', reward_payable: 'Recompensas' }, otherType: 'Asiento',
  },
  deposit: {
    kicker: 'Depósito', title: 'Depositar USDT', network: 'Red', reveal: 'Mostrar dirección de depósito', revealing: 'Preparando dirección…', address: 'Dirección de depósito', memo: 'Memo / etiqueta', copy: 'Copiar', copied: 'Copiado',
    before: 'Antes de enviar', afterNote: 'El abono aparece en Actividad tras {n} confirmaciones de red.', testAddress: 'Dirección de prueba de un custodio simulado: no envíes fondos reales.', backCash: 'Volver a efectivo', loadError: 'No se pudo preparar una dirección', qr: 'Código QR de la dirección de depósito',
  },
}

const ar: WalletCopy = {
  cash: {
    kicker: 'النقد', title: 'النقد والمحفظة', available: 'متاح', locked: 'محجوز', pending: 'قيد المعالجة', invested: 'مستثمر (التكلفة)', rewards: 'مكافآت مستحقة', asOf: 'الأرصدة حتى {t}',
    deposit: 'إيداع', withdraw: 'سحب', transfer: 'تحويل', addressBook: 'دفتر العناوين',
    testMode: 'حفظ تجريبي · لا أموال حقيقية', testModeBody: 'تستخدم هذه البيئة أمين حفظ تجريبيًا. العناوين والأرصدة للاختبار فقط.',
    networks: 'الشبكات', networksNote: 'سياسة الخادم', network: 'الشبكة', confirmations: 'التأكيدات', minDeposit: 'أدنى إيداع', minWithdraw: 'أدنى سحب', fee: 'رسوم السحب', eta: 'الوصول', etaValue: '{a}–{b} دقيقة',
    funding: 'التمويل', fundingNote: 'إيداعات وسحوبات وتحويلات', fundingEmpty: 'لا يوجد تمويل بعد', fundingEmptyBody: 'ستظهر الإيداعات والسحوبات والتحويلات هنا مع حالتها.',
    kinds: { deposit: 'إيداع', withdrawal: 'سحب', transfer: 'تحويل' },
    ledger: 'دفتر الأستاذ', ledgerNote: 'أحدث القيود', viewAll: 'كل النشاط', loadError: 'تعذر تحميل هذا القسم',
  },
  states: { pending: 'قيد المعالجة', detected: 'تم الرصد', confirming: 'قيد التأكيد', credited: 'أُضيف', requested: 'مطلوب', pending_review: 'قيد المراجعة', approved: 'مقبول', broadcast: 'مُرسل', completed: 'مكتمل', posted: 'مُقيد', failed: 'فشل', rejected: 'مرفوض', cancelled: 'ملغى', held: 'محتجز' },
  activity: {
    kicker: 'دفتر الأستاذ', title: 'النشاط', filters: ['الكل', 'التمويل', 'الاستثمار', 'الدخل', 'أخرى'],
    inflow: 'وارد', outflow: 'صادر', net: 'الصافي', scope: 'أحدث {n} قيدًا · الرصيد المتاح', empty: 'لا توجد قيود', emptyBody: 'ستظهر قيود هذه الفئة هنا.', lockedMove: 'محجوز {v}',
    types: { deposit: 'إيداع', withdrawal_lock: 'حجز سحب', withdrawal_settlement: 'تسوية سحب', withdrawal_refund: 'استرداد سحب', internal_transfer: 'تحويل داخلي', order_lock: 'حجز أمر', order_release: 'فك حجز أمر', investment: 'استثمار', redemption: 'استرداد', yield_distribution: 'عائد', adjustment: 'تسوية', reversal: 'عكس قيد', basket_subscription: 'اكتتاب سلة', basket_redemption: 'استرداد سلة', basket_settlement: 'تسوية سلة', basket_rebalance: 'إعادة توازن سلة' },
    purposes: { available: 'متاح', locked: 'محجوز', pending: 'قيد المعالجة', invested_cost: 'مستثمر', reward_payable: 'مكافآت' }, otherType: 'قيد',
  },
  deposit: {
    kicker: 'إيداع', title: 'إيداع USDT', network: 'الشبكة', reveal: 'عرض عنوان الإيداع', revealing: 'جارٍ تجهيز العنوان…', address: 'عنوان الإيداع', memo: 'مذكرة / وسم', copy: 'نسخ', copied: 'تم النسخ',
    before: 'قبل الإرسال', afterNote: 'يظهر الإيداع في النشاط بعد {n} تأكيدًا على الشبكة.', testAddress: 'عنوان تجريبي من أمين حفظ تجريبي — لا ترسل أموالًا حقيقية.', backCash: 'العودة إلى النقد', loadError: 'تعذر تجهيز عنوان', qr: 'رمز QR لعنوان الإيداع',
  },
}

const fr: WalletCopy = {
  cash: {
    kicker: 'Liquidités', title: 'Liquidités et portefeuille', available: 'Disponible', locked: 'Bloqué', pending: 'En attente', invested: 'Investi (coût)', rewards: 'Récompenses dues', asOf: 'Soldes au {t}',
    deposit: 'Déposer', withdraw: 'Retirer', transfer: 'Transférer', addressBook: 'Carnet d’adresses',
    testMode: 'Garde de test · pas de fonds réels', testModeBody: 'Cet environnement utilise un dépositaire simulé. Adresses et soldes servent uniquement aux tests.',
    networks: 'Réseaux', networksNote: 'Politique serveur', network: 'Réseau', confirmations: 'Confirm.', minDeposit: 'Dépôt min.', minWithdraw: 'Retrait min.', fee: 'Frais de retrait', eta: 'Arrivée', etaValue: '{a}–{b} min',
    funding: 'Mouvements de fonds', fundingNote: 'Dépôts, retraits, transferts', fundingEmpty: 'Aucun mouvement', fundingEmptyBody: 'Dépôts, retraits et transferts apparaîtront ici avec leur statut.',
    kinds: { deposit: 'Dépôt', withdrawal: 'Retrait', transfer: 'Transfert' },
    ledger: 'Grand livre', ledgerNote: 'Dernières écritures', viewAll: 'Toute l’activité', loadError: 'Impossible de charger cette section',
  },
  states: { pending: 'En attente', detected: 'Détecté', confirming: 'Confirmation', credited: 'Crédité', requested: 'Demandé', pending_review: 'En revue', approved: 'Approuvé', broadcast: 'Diffusé', completed: 'Terminé', posted: 'Comptabilisé', failed: 'Échec', rejected: 'Refusé', cancelled: 'Annulé', held: 'Retenu' },
  activity: {
    kicker: 'Grand livre', title: 'Activité', filters: ['Tout', 'Fonds', 'Investissement', 'Revenus', 'Autres'],
    inflow: 'Entrées', outflow: 'Sorties', net: 'Net', scope: '{n} dernières écritures · solde disponible', empty: 'Aucune écriture', emptyBody: 'Les écritures de cette catégorie apparaîtront ici.', lockedMove: 'Bloqué {v}',
    types: { deposit: 'Dépôt', withdrawal_lock: 'Blocage de retrait', withdrawal_settlement: 'Retrait réglé', withdrawal_refund: 'Remboursement de retrait', internal_transfer: 'Transfert interne', order_lock: 'Blocage d’ordre', order_release: 'Libération d’ordre', investment: 'Investissement', redemption: 'Rachat', yield_distribution: 'Rendement', adjustment: 'Ajustement', reversal: 'Contre-passation', basket_subscription: 'Souscription panier', basket_redemption: 'Rachat panier', basket_settlement: 'Règlement panier', basket_rebalance: 'Rééquilibrage panier' },
    purposes: { available: 'Disponible', locked: 'Bloqué', pending: 'En attente', invested_cost: 'Investi', reward_payable: 'Récompenses' }, otherType: 'Écriture',
  },
  deposit: {
    kicker: 'Dépôt', title: 'Déposer des USDT', network: 'Réseau', reveal: 'Afficher l’adresse de dépôt', revealing: 'Préparation de l’adresse…', address: 'Adresse de dépôt', memo: 'Mémo / tag', copy: 'Copier', copied: 'Copié',
    before: 'Avant d’envoyer', afterNote: 'Le crédit apparaît dans Activité après {n} confirmations réseau.', testAddress: 'Adresse de test d’un dépositaire simulé — n’envoyez pas de fonds réels.', backCash: 'Retour aux liquidités', loadError: 'Impossible de préparer une adresse', qr: 'QR code de l’adresse de dépôt',
  },
}

const pt: WalletCopy = {
  cash: {
    kicker: 'Caixa', title: 'Caixa e carteira', available: 'Disponível', locked: 'Bloqueado', pending: 'Pendente', invested: 'Investido (custo)', rewards: 'Recompensas a pagar', asOf: 'Saldos em {t}',
    deposit: 'Depositar', withdraw: 'Sacar', transfer: 'Transferir', addressBook: 'Catálogo de endereços',
    testMode: 'Custódia de teste · sem fundos reais', testModeBody: 'Este ambiente usa um custodiante simulado. Endereços e saldos são apenas para teste.',
    networks: 'Redes', networksNote: 'Política do servidor', network: 'Rede', confirmations: 'Confirm.', minDeposit: 'Depósito mín.', minWithdraw: 'Saque mín.', fee: 'Taxa de saque', eta: 'Chegada', etaValue: '{a}–{b} min',
    funding: 'Movimentações', fundingNote: 'Depósitos, saques, transferências', fundingEmpty: 'Nenhuma movimentação', fundingEmptyBody: 'Depósitos, saques e transferências aparecerão aqui com o status.',
    kinds: { deposit: 'Depósito', withdrawal: 'Saque', transfer: 'Transferência' },
    ledger: 'Razão', ledgerNote: 'Lançamentos recentes', viewAll: 'Toda a atividade', loadError: 'Não foi possível carregar esta seção',
  },
  states: { pending: 'Pendente', detected: 'Detectado', confirming: 'Confirmando', credited: 'Creditado', requested: 'Solicitado', pending_review: 'Em análise', approved: 'Aprovado', broadcast: 'Transmitido', completed: 'Concluído', posted: 'Lançado', failed: 'Falhou', rejected: 'Recusado', cancelled: 'Cancelado', held: 'Retido' },
  activity: {
    kicker: 'Razão', title: 'Atividade', filters: ['Tudo', 'Fundos', 'Investimentos', 'Rendimentos', 'Outros'],
    inflow: 'Entradas', outflow: 'Saídas', net: 'Líquido', scope: 'Últimos {n} lançamentos · saldo disponível', empty: 'Nenhum lançamento', emptyBody: 'Os lançamentos desta categoria aparecerão aqui.', lockedMove: 'Bloqueado {v}',
    types: { deposit: 'Depósito', withdrawal_lock: 'Bloqueio de saque', withdrawal_settlement: 'Saque liquidado', withdrawal_refund: 'Estorno de saque', internal_transfer: 'Transferência interna', order_lock: 'Bloqueio de ordem', order_release: 'Liberação de ordem', investment: 'Investimento', redemption: 'Resgate', yield_distribution: 'Rendimento', adjustment: 'Ajuste', reversal: 'Estorno', basket_subscription: 'Subscrição de cesta', basket_redemption: 'Resgate de cesta', basket_settlement: 'Liquidação de cesta', basket_rebalance: 'Rebalanceamento de cesta' },
    purposes: { available: 'Disponível', locked: 'Bloqueado', pending: 'Pendente', invested_cost: 'Investido', reward_payable: 'Recompensas' }, otherType: 'Lançamento',
  },
  deposit: {
    kicker: 'Depósito', title: 'Depositar USDT', network: 'Rede', reveal: 'Mostrar endereço de depósito', revealing: 'Preparando endereço…', address: 'Endereço de depósito', memo: 'Memo / tag', copy: 'Copiar', copied: 'Copiado',
    before: 'Antes de enviar', afterNote: 'O crédito aparece em Atividade após {n} confirmações de rede.', testAddress: 'Endereço de teste de um custodiante simulado — não envie fundos reais.', backCash: 'Voltar ao caixa', loadError: 'Não foi possível preparar um endereço', qr: 'QR code do endereço de depósito',
  },
}

export const walletCopy: Record<AppLocale, WalletCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
