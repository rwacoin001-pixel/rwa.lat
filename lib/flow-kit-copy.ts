import type { AppLocale } from './app-locales'

/** Copy for the money-entry kit (components/maison/flow-kit.tsx): keypad, talking button, confirm sheet, success page. */
export type FlowKitCopy = {
  enterAmount: string; insufficient: string; belowMin: (v: string) => string; aboveMax: (v: string) => string
  addRecipient: string; chooseAddress: string; checking: string; unavailable: string
  transferN: (v: string) => string; withdrawN: (v: string) => string; buyN: (v: string) => string
  reviewTransfer: string; reviewWithdraw: string; reviewBuy: string; confirmTransfer: string; confirmWithdraw: string; confirmBuy: string
  arrival: string; instant: string; minutes: (a: number, b: number) => string; total: string
  sentTransfer: string; sentWithdraw: string; sentBuy: string; again: string; records: string; done: string
  paste: string; scan: string; book: string; recent: string; max: string; clear: string; backspace: string; digit: (n: string) => string
  available: (v: string) => string; approx: (v: string) => string
  shuffle: string; systemKeyboard: string; customKeyboard: string; pasted: string
}

const en: FlowKitCopy = {
  enterAmount: 'Enter amount', insufficient: 'Insufficient balance', belowMin: (v) => `Minimum ${v}`, aboveMax: (v) => `Maximum ${v}`,
  addRecipient: 'Add recipient', chooseAddress: 'Choose an address', checking: 'Checking…', unavailable: 'Not available',
  transferN: (v) => `Send ${v}`, withdrawN: (v) => `Withdraw ${v}`, buyN: (v) => `Subscribe ${v}`,
  reviewTransfer: 'Review transfer', reviewWithdraw: 'Review withdrawal', reviewBuy: 'Review subscription',
  confirmTransfer: 'Confirm transfer', confirmWithdraw: 'Confirm withdrawal', confirmBuy: 'Confirm subscription',
  arrival: 'Arrives', instant: 'Instantly', minutes: (a, b) => `${a}–${b} min`, total: 'Total debit',
  sentTransfer: 'Transfer sent', sentWithdraw: 'Withdrawal submitted', sentBuy: 'Subscription placed', again: 'Make another', records: 'View records', done: 'Done',
  paste: 'Paste', scan: 'Scan', book: 'Address book', recent: 'Recent', max: 'Max', clear: 'Clear', backspace: 'Delete', digit: (n) => n,
  available: (v) => `Available ${v}`, approx: (v) => `≈ $${v}`,
  shuffle: 'Shuffle keys', systemKeyboard: 'Use system keyboard', customKeyboard: 'Use keypad', pasted: 'Code pasted',
}

const copy: Record<AppLocale, FlowKitCopy> = {
  en,
  'zh-CN': {
    enterAmount: '输入金额', insufficient: '余额不足', belowMin: (v) => `最低 ${v}`, aboveMax: (v) => `最高 ${v}`,
    addRecipient: '填写收款人', chooseAddress: '选择收款地址', checking: '正在核对…', unavailable: '暂不可用',
    transferN: (v) => `转账 ${v}`, withdrawN: (v) => `提现 ${v}`, buyN: (v) => `申购 ${v}`,
    reviewTransfer: '确认转账', reviewWithdraw: '确认提现', reviewBuy: '确认申购',
    confirmTransfer: '确认转账', confirmWithdraw: '确认提现', confirmBuy: '确认申购',
    arrival: '到账时间', instant: '即时到账', minutes: (a, b) => `约 ${a}–${b} 分钟`, total: '合计扣款',
    sentTransfer: '转账已发出', sentWithdraw: '提现已提交', sentBuy: '申购已提交', again: '再来一笔', records: '查看记录', done: '完成',
    paste: '粘贴', scan: '扫码', book: '地址簿', recent: '最近', max: '最大', clear: '清空', backspace: '删除', digit: (n) => n,
    available: (v) => `可用 ${v}`, approx: (v) => `≈ $${v}`,
    shuffle: '随机键盘', systemKeyboard: '用系统键盘', customKeyboard: '用数字键盘', pasted: '已粘贴验证码',
  },
  hi: {
    ...en, enterAmount: 'राशि दर्ज करें', insufficient: 'अपर्याप्त शेष', belowMin: (v) => `न्यूनतम ${v}`, aboveMax: (v) => `अधिकतम ${v}`,
    addRecipient: 'प्राप्तकर्ता जोड़ें', chooseAddress: 'पता चुनें', transferN: (v) => `${v} भेजें`, withdrawN: (v) => `${v} निकालें`, buyN: (v) => `${v} सब्सक्राइब करें`,
    reviewTransfer: 'ट्रांसफ़र जाँचें', reviewWithdraw: 'निकासी जाँचें', reviewBuy: 'सब्सक्रिप्शन जाँचें', confirmTransfer: 'ट्रांसफ़र पुष्टि करें', confirmWithdraw: 'निकासी पुष्टि करें', confirmBuy: 'सब्सक्रिप्शन पुष्टि करें',
    arrival: 'पहुँचेगा', instant: 'तुरंत', again: 'एक और', records: 'रिकॉर्ड देखें', done: 'हो गया', paste: 'पेस्ट', scan: 'स्कैन', book: 'पता पुस्तिका', recent: 'हाल के', max: 'अधिकतम',
    available: (v) => `उपलब्ध ${v}`, shuffle: 'कुंजियाँ मिलाएँ', systemKeyboard: 'सिस्टम कीबोर्ड', customKeyboard: 'कीपैड',
  },
  es: {
    ...en, enterAmount: 'Introduce un importe', insufficient: 'Saldo insuficiente', belowMin: (v) => `Mínimo ${v}`, aboveMax: (v) => `Máximo ${v}`,
    addRecipient: 'Añadir destinatario', chooseAddress: 'Elige una dirección', transferN: (v) => `Enviar ${v}`, withdrawN: (v) => `Retirar ${v}`, buyN: (v) => `Suscribir ${v}`,
    reviewTransfer: 'Revisar envío', reviewWithdraw: 'Revisar retiro', reviewBuy: 'Revisar suscripción', confirmTransfer: 'Confirmar envío', confirmWithdraw: 'Confirmar retiro', confirmBuy: 'Confirmar suscripción',
    arrival: 'Llega', instant: 'Al instante', total: 'Cargo total', sentTransfer: 'Envío realizado', sentWithdraw: 'Retiro enviado', sentBuy: 'Suscripción enviada',
    again: 'Otra operación', records: 'Ver registros', done: 'Listo', paste: 'Pegar', scan: 'Escanear', book: 'Agenda', recent: 'Recientes', max: 'Máx',
    available: (v) => `Disponible ${v}`, shuffle: 'Mezclar teclas', systemKeyboard: 'Teclado del sistema', customKeyboard: 'Teclado numérico',
  },
  ar: {
    ...en, enterAmount: 'أدخل المبلغ', insufficient: 'الرصيد غير كافٍ', belowMin: (v) => `الحد الأدنى ${v}`, aboveMax: (v) => `الحد الأقصى ${v}`,
    addRecipient: 'أضف المستلم', chooseAddress: 'اختر عنوانًا', transferN: (v) => `إرسال ${v}`, withdrawN: (v) => `سحب ${v}`, buyN: (v) => `اشتراك ${v}`,
    reviewTransfer: 'مراجعة التحويل', reviewWithdraw: 'مراجعة السحب', reviewBuy: 'مراجعة الاشتراك', confirmTransfer: 'تأكيد التحويل', confirmWithdraw: 'تأكيد السحب', confirmBuy: 'تأكيد الاشتراك',
    arrival: 'الوصول', instant: 'فورًا', total: 'إجمالي الخصم', sentTransfer: 'تم الإرسال', sentWithdraw: 'تم تقديم السحب', sentBuy: 'تم تقديم الاشتراك',
    again: 'عملية أخرى', records: 'عرض السجلات', done: 'تم', paste: 'لصق', scan: 'مسح', book: 'دفتر العناوين', recent: 'الأخيرة', max: 'الأقصى',
    available: (v) => `المتاح ${v}`, shuffle: 'خلط الأزرار', systemKeyboard: 'لوحة مفاتيح النظام', customKeyboard: 'لوحة الأرقام',
  },
  fr: {
    ...en, enterAmount: 'Saisir un montant', insufficient: 'Solde insuffisant', belowMin: (v) => `Minimum ${v}`, aboveMax: (v) => `Maximum ${v}`,
    addRecipient: 'Ajouter un destinataire', chooseAddress: 'Choisir une adresse', transferN: (v) => `Envoyer ${v}`, withdrawN: (v) => `Retirer ${v}`, buyN: (v) => `Souscrire ${v}`,
    reviewTransfer: 'Vérifier le virement', reviewWithdraw: 'Vérifier le retrait', reviewBuy: 'Vérifier la souscription', confirmTransfer: 'Confirmer le virement', confirmWithdraw: 'Confirmer le retrait', confirmBuy: 'Confirmer la souscription',
    arrival: 'Arrivée', instant: 'Immédiat', total: 'Débit total', sentTransfer: 'Virement envoyé', sentWithdraw: 'Retrait soumis', sentBuy: 'Souscription envoyée',
    again: 'Une autre', records: 'Voir l’historique', done: 'Terminé', paste: 'Coller', scan: 'Scanner', book: 'Carnet', recent: 'Récents', max: 'Max',
    available: (v) => `Disponible ${v}`, shuffle: 'Mélanger les touches', systemKeyboard: 'Clavier système', customKeyboard: 'Pavé numérique',
  },
  pt: {
    ...en, enterAmount: 'Digite o valor', insufficient: 'Saldo insuficiente', belowMin: (v) => `Mínimo ${v}`, aboveMax: (v) => `Máximo ${v}`,
    addRecipient: 'Adicionar destinatário', chooseAddress: 'Escolha um endereço', transferN: (v) => `Enviar ${v}`, withdrawN: (v) => `Sacar ${v}`, buyN: (v) => `Subscrever ${v}`,
    reviewTransfer: 'Revisar envio', reviewWithdraw: 'Revisar saque', reviewBuy: 'Revisar subscrição', confirmTransfer: 'Confirmar envio', confirmWithdraw: 'Confirmar saque', confirmBuy: 'Confirmar subscrição',
    arrival: 'Chegada', instant: 'Na hora', total: 'Débito total', sentTransfer: 'Envio feito', sentWithdraw: 'Saque enviado', sentBuy: 'Subscrição enviada',
    again: 'Fazer outra', records: 'Ver registros', done: 'Concluir', paste: 'Colar', scan: 'Escanear', book: 'Agenda', recent: 'Recentes', max: 'Máx',
    available: (v) => `Disponível ${v}`, shuffle: 'Embaralhar teclas', systemKeyboard: 'Teclado do sistema', customKeyboard: 'Teclado numérico',
  },
}

export const flowKitCopy = (locale: AppLocale): FlowKitCopy => copy[locale] ?? en
