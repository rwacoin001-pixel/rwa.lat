import type { AppLocale } from '@/lib/app-locales'

export type TransactionPinMode = 'setup' | 'change' | 'reset'
export type TransactionPinStep = 'current' | 'next' | 'confirm'

export type TransactionPinCopy = {
  securityLabel: string; configured: string; forgot: string; refresh: string; resetNotice: string
  receiveLocked: string; depositRule: string; deposit: string
  pad: { label: string; digit: (n: string) => string; backspace: string; clear: string; filled: (n: number, total: number) => string }
  title: Record<TransactionPinMode, string>
  step: Record<TransactionPinStep, string>
  next: string; submit: string; cancel: string; back: string; working: string
  done: Record<TransactionPinMode, string>
  mismatch: string; incomplete: string
  prompt: { title: string; confirm: string }
  gate: { unavailable: string; unset: string; locked: string; cooldown: string }
  attempts: (n: number) => string
  errors: Record<string, string>
  failed: string
  eligibility: { eligible: string; ineligible: string; checking: string }
}

type BasicCopy = Omit<TransactionPinCopy, 'securityLabel' | 'configured' | 'forgot' | 'refresh' | 'resetNotice' | 'receiveLocked' | 'depositRule' | 'deposit'>
const en: BasicCopy = {
  pad: { label: 'Transaction PIN keypad', digit: (n) => `Digit ${n}`, backspace: 'Delete last digit', clear: 'Clear', filled: (n, t) => `${n} of ${t} digits entered` },
  title: { setup: 'Set transaction PIN', change: 'Change transaction PIN', reset: 'Reset transaction PIN' },
  step: { current: 'Enter current PIN', next: 'Enter new 6-digit PIN', confirm: 'Re-enter new PIN' },
  next: 'Next', submit: 'Confirm', cancel: 'Cancel', back: 'Back', working: 'Verifying…',
  done: { setup: 'Transaction PIN set', change: 'Transaction PIN changed', reset: 'Transaction PIN reset' },
  mismatch: 'PINs do not match', incomplete: 'Enter all 6 digits',
  prompt: { title: 'Confirm with transaction PIN', confirm: 'Confirm withdrawal' },
  gate: { unavailable: 'Transaction PIN is unavailable', unset: 'Set a transaction PIN first', locked: 'Too many attempts. PIN is locked for now', cooldown: 'Withdrawals paused after a PIN change' },
  attempts: (n) => `${n} attempts left`,
  errors: { TRANSACTION_PIN_INVALID: 'Incorrect PIN', TRANSACTION_PIN_LOCKED: 'PIN locked. Try again later', TRANSACTION_PIN_NOT_SET: 'Set a transaction PIN first', TRANSACTION_PIN_COOLDOWN: 'Withdrawals paused after a PIN change', TRANSACTION_PIN_WEAK: 'Choose a less predictable PIN', TRANSACTION_PIN_MISMATCH: 'PINs do not match', TRANSACTION_PIN_REUSED: 'Use a PIN different from the current one' },
  failed: 'Could not complete. Try again',
  eligibility: { eligible: 'Recipient can receive', ineligible: 'Recipient cannot receive transfers', checking: 'Checking recipient…' },
}

const zh: BasicCopy = {
  pad: { label: '交易密码键盘', digit: (n) => `数字 ${n}`, backspace: '删除一位', clear: '清空', filled: (n, t) => `已输入 ${n}/${t} 位` },
  title: { setup: '设置交易密码', change: '修改交易密码', reset: '重设交易密码' },
  step: { current: '输入当前交易密码', next: '输入新的 6 位密码', confirm: '再次输入新密码' },
  next: '下一步', submit: '确认', cancel: '取消', back: '返回', working: '验证中…',
  done: { setup: '交易密码已设置', change: '交易密码已修改', reset: '交易密码已重设' },
  mismatch: '两次输入不一致', incomplete: '请输入完整 6 位',
  prompt: { title: '输入交易密码确认', confirm: '确认提现' },
  gate: { unavailable: '交易密码暂不可用', unset: '请先设置交易密码', locked: '尝试次数过多，暂时锁定', cooldown: '修改密码后提现暂停中' },
  attempts: (n) => `剩余 ${n} 次`,
  errors: { TRANSACTION_PIN_INVALID: '交易密码错误', TRANSACTION_PIN_LOCKED: '已锁定，请稍后再试', TRANSACTION_PIN_NOT_SET: '请先设置交易密码', TRANSACTION_PIN_COOLDOWN: '修改密码后提现暂停中', TRANSACTION_PIN_WEAK: '密码过于简单', TRANSACTION_PIN_MISMATCH: '两次输入不一致', TRANSACTION_PIN_REUSED: '新密码不能与当前相同' },
  failed: '操作未完成，请重试',
  eligibility: { eligible: '对方可收款', ineligible: '对方暂不可收款', checking: '正在核验收款方…' },
}
const hi: BasicCopy = {
  pad: { label: 'लेनदेन PIN कीपैड', digit: (n) => `अंक ${n}`, backspace: 'अंतिम अंक हटाएँ', clear: 'साफ़ करें', filled: (n, t) => `${t} में से ${n} अंक` },
  title: { setup: 'लेनदेन PIN सेट करें', change: 'लेनदेन PIN बदलें', reset: 'लेनदेन PIN रीसेट करें' },
  step: { current: 'मौजूदा PIN दर्ज करें', next: 'नया 6-अंकीय PIN दर्ज करें', confirm: 'नया PIN फिर दर्ज करें' },
  next: 'आगे', submit: 'पुष्टि करें', cancel: 'रद्द करें', back: 'वापस', working: 'सत्यापन हो रहा है…',
  done: { setup: 'लेनदेन PIN सेट हुआ', change: 'लेनदेन PIN बदला गया', reset: 'लेनदेन PIN रीसेट हुआ' },
  mismatch: 'PIN मेल नहीं खाते', incomplete: 'सभी 6 अंक दर्ज करें',
  prompt: { title: 'लेनदेन PIN से पुष्टि करें', confirm: 'निकासी की पुष्टि करें' },
  gate: { unavailable: 'लेनदेन PIN उपलब्ध नहीं है', unset: 'पहले लेनदेन PIN सेट करें', locked: 'बहुत अधिक प्रयास। PIN अभी लॉक है', cooldown: 'PIN बदलने के बाद निकासी रुकी है' },
  attempts: (n) => `${n} प्रयास शेष`,
  errors: { TRANSACTION_PIN_INVALID: 'गलत PIN', TRANSACTION_PIN_LOCKED: 'PIN लॉक है। बाद में प्रयास करें', TRANSACTION_PIN_NOT_SET: 'पहले लेनदेन PIN सेट करें', TRANSACTION_PIN_COOLDOWN: 'PIN बदलने के बाद निकासी रुकी है', TRANSACTION_PIN_WEAK: 'कम अनुमानित PIN चुनें', TRANSACTION_PIN_MISMATCH: 'PIN मेल नहीं खाते', TRANSACTION_PIN_REUSED: 'मौजूदा PIN से अलग PIN चुनें' },
  failed: 'पूरा नहीं हो सका। फिर प्रयास करें',
  eligibility: { eligible: 'प्राप्तकर्ता प्राप्त कर सकता है', ineligible: 'प्राप्तकर्ता ट्रांसफ़र प्राप्त नहीं कर सकता', checking: 'प्राप्तकर्ता की जाँच…' },
}

const es: BasicCopy = {
  pad: { label: 'Teclado del PIN de transacción', digit: (n) => `Dígito ${n}`, backspace: 'Borrar último dígito', clear: 'Borrar', filled: (n, t) => `${n} de ${t} dígitos` },
  title: { setup: 'Crear PIN de transacción', change: 'Cambiar PIN de transacción', reset: 'Restablecer PIN de transacción' },
  step: { current: 'Introduce el PIN actual', next: 'Introduce un PIN nuevo de 6 dígitos', confirm: 'Repite el PIN nuevo' },
  next: 'Siguiente', submit: 'Confirmar', cancel: 'Cancelar', back: 'Atrás', working: 'Verificando…',
  done: { setup: 'PIN de transacción creado', change: 'PIN de transacción cambiado', reset: 'PIN de transacción restablecido' },
  mismatch: 'Los PIN no coinciden', incomplete: 'Introduce los 6 dígitos',
  prompt: { title: 'Confirma con tu PIN de transacción', confirm: 'Confirmar retiro' },
  gate: { unavailable: 'PIN de transacción no disponible', unset: 'Primero crea un PIN de transacción', locked: 'Demasiados intentos. PIN bloqueado por ahora', cooldown: 'Retiros en pausa tras cambiar el PIN' },
  attempts: (n) => `Quedan ${n} intentos`,
  errors: { TRANSACTION_PIN_INVALID: 'PIN incorrecto', TRANSACTION_PIN_LOCKED: 'PIN bloqueado. Inténtalo más tarde', TRANSACTION_PIN_NOT_SET: 'Primero crea un PIN de transacción', TRANSACTION_PIN_COOLDOWN: 'Retiros en pausa tras cambiar el PIN', TRANSACTION_PIN_WEAK: 'Elige un PIN menos predecible', TRANSACTION_PIN_MISMATCH: 'Los PIN no coinciden', TRANSACTION_PIN_REUSED: 'Usa un PIN distinto del actual' },
  failed: 'No se pudo completar. Inténtalo de nuevo',
  eligibility: { eligible: 'El destinatario puede recibir', ineligible: 'El destinatario no puede recibir transferencias', checking: 'Verificando destinatario…' },
}

const ar: BasicCopy = {
  pad: { label: 'لوحة رمز المعاملات', digit: (n) => `الرقم ${n}`, backspace: 'حذف آخر رقم', clear: 'مسح', filled: (n, t) => `${n} من ${t} أرقام` },
  title: { setup: 'تعيين رمز المعاملات', change: 'تغيير رمز المعاملات', reset: 'إعادة تعيين رمز المعاملات' },
  step: { current: 'أدخل الرمز الحالي', next: 'أدخل رمزًا جديدًا من 6 أرقام', confirm: 'أعد إدخال الرمز الجديد' },
  next: 'التالي', submit: 'تأكيد', cancel: 'إلغاء', back: 'رجوع', working: 'جارٍ التحقق…',
  done: { setup: 'تم تعيين رمز المعاملات', change: 'تم تغيير رمز المعاملات', reset: 'تمت إعادة تعيين رمز المعاملات' },
  mismatch: 'الرمزان غير متطابقين', incomplete: 'أدخل الأرقام الستة',
  prompt: { title: 'التأكيد برمز المعاملات', confirm: 'تأكيد السحب' },
  gate: { unavailable: 'رمز المعاملات غير متاح', unset: 'عيّن رمز المعاملات أولًا', locked: 'محاولات كثيرة. الرمز مقفل حاليًا', cooldown: 'السحب متوقف مؤقتًا بعد تغيير الرمز' },
  attempts: (n) => `متبقٍ ${n} محاولات`,
  errors: { TRANSACTION_PIN_INVALID: 'رمز غير صحيح', TRANSACTION_PIN_LOCKED: 'الرمز مقفل. حاول لاحقًا', TRANSACTION_PIN_NOT_SET: 'عيّن رمز المعاملات أولًا', TRANSACTION_PIN_COOLDOWN: 'السحب متوقف مؤقتًا بعد تغيير الرمز', TRANSACTION_PIN_WEAK: 'اختر رمزًا يصعب تخمينه', TRANSACTION_PIN_MISMATCH: 'الرمزان غير متطابقين', TRANSACTION_PIN_REUSED: 'استخدم رمزًا مختلفًا عن الحالي' },
  failed: 'تعذّر الإكمال. حاول مجددًا',
  eligibility: { eligible: 'يمكن للمستلم الاستلام', ineligible: 'لا يمكن للمستلم استلام التحويلات', checking: 'جارٍ التحقق من المستلم…' },
}
const fr: BasicCopy = {
  pad: { label: 'Clavier du code de transaction', digit: (n) => `Chiffre ${n}`, backspace: 'Effacer le dernier chiffre', clear: 'Effacer', filled: (n, t) => `${n} chiffres sur ${t}` },
  title: { setup: 'Définir le code de transaction', change: 'Modifier le code de transaction', reset: 'Réinitialiser le code de transaction' },
  step: { current: 'Saisissez le code actuel', next: 'Saisissez un nouveau code à 6 chiffres', confirm: 'Confirmez le nouveau code' },
  next: 'Suivant', submit: 'Confirmer', cancel: 'Annuler', back: 'Retour', working: 'Vérification…',
  done: { setup: 'Code de transaction défini', change: 'Code de transaction modifié', reset: 'Code de transaction réinitialisé' },
  mismatch: 'Les codes ne correspondent pas', incomplete: 'Saisissez les 6 chiffres',
  prompt: { title: 'Confirmer avec le code de transaction', confirm: 'Confirmer le retrait' },
  gate: { unavailable: 'Code de transaction indisponible', unset: 'Définissez d’abord un code de transaction', locked: 'Trop de tentatives. Code verrouillé pour le moment', cooldown: 'Retraits suspendus après modification du code' },
  attempts: (n) => `${n} tentatives restantes`,
  errors: { TRANSACTION_PIN_INVALID: 'Code incorrect', TRANSACTION_PIN_LOCKED: 'Code verrouillé. Réessayez plus tard', TRANSACTION_PIN_NOT_SET: 'Définissez d’abord un code de transaction', TRANSACTION_PIN_COOLDOWN: 'Retraits suspendus après modification du code', TRANSACTION_PIN_WEAK: 'Choisissez un code moins prévisible', TRANSACTION_PIN_MISMATCH: 'Les codes ne correspondent pas', TRANSACTION_PIN_REUSED: 'Choisissez un code différent de l’actuel' },
  failed: 'Échec. Réessayez',
  eligibility: { eligible: 'Le destinataire peut recevoir', ineligible: 'Le destinataire ne peut pas recevoir de transferts', checking: 'Vérification du destinataire…' },
}

const pt: BasicCopy = {
  pad: { label: 'Teclado do PIN de transação', digit: (n) => `Dígito ${n}`, backspace: 'Apagar último dígito', clear: 'Limpar', filled: (n, t) => `${n} de ${t} dígitos` },
  title: { setup: 'Definir PIN de transação', change: 'Alterar PIN de transação', reset: 'Redefinir PIN de transação' },
  step: { current: 'Digite o PIN atual', next: 'Digite um novo PIN de 6 dígitos', confirm: 'Digite o novo PIN novamente' },
  next: 'Avançar', submit: 'Confirmar', cancel: 'Cancelar', back: 'Voltar', working: 'Verificando…',
  done: { setup: 'PIN de transação definido', change: 'PIN de transação alterado', reset: 'PIN de transação redefinido' },
  mismatch: 'Os PINs não coincidem', incomplete: 'Digite os 6 dígitos',
  prompt: { title: 'Confirme com o PIN de transação', confirm: 'Confirmar saque' },
  gate: { unavailable: 'PIN de transação indisponível', unset: 'Defina um PIN de transação primeiro', locked: 'Muitas tentativas. PIN bloqueado por enquanto', cooldown: 'Saques pausados após alterar o PIN' },
  attempts: (n) => `${n} tentativas restantes`,
  errors: { TRANSACTION_PIN_INVALID: 'PIN incorreto', TRANSACTION_PIN_LOCKED: 'PIN bloqueado. Tente mais tarde', TRANSACTION_PIN_NOT_SET: 'Defina um PIN de transação primeiro', TRANSACTION_PIN_COOLDOWN: 'Saques pausados após alterar o PIN', TRANSACTION_PIN_WEAK: 'Escolha um PIN menos previsível', TRANSACTION_PIN_MISMATCH: 'Os PINs não coincidem', TRANSACTION_PIN_REUSED: 'Use um PIN diferente do atual' },
  failed: 'Não foi possível concluir. Tente novamente',
  eligibility: { eligible: 'O destinatário pode receber', ineligible: 'O destinatário não pode receber transferências', checking: 'Verificando destinatário…' },
}

const base: Record<AppLocale, BasicCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
type ExtraCopy = Pick<TransactionPinCopy, 'securityLabel' | 'configured' | 'forgot' | 'refresh' | 'resetNotice' | 'receiveLocked' | 'depositRule' | 'deposit'>
const extra: Record<AppLocale, ExtraCopy> = {
  en: { securityLabel: 'Transaction PIN', configured: 'Set', forgot: 'Forgot PIN', refresh: 'Refresh status', resetNotice: 'Resetting your PIN pauses withdrawals for 24 hours.', receiveLocked: 'Receiving transfers is not available yet', depositRule: 'One credited external USDT deposit must exceed 300 USDT. Internal transfers and bonuses do not count.', deposit: 'Deposit' },
  'zh-CN': { securityLabel: '交易密码', configured: '已设置', forgot: '忘记密码', refresh: '刷新状态', resetNotice: '忘记密码重设后，暂停提现 24 小时。', receiveLocked: '暂未开通站内收款', depositRule: '需有单笔已到账外部充值超过 300 USDT；站内转账和赠送不计入。', deposit: '充值' },
  hi: { securityLabel: 'लेनदेन PIN', configured: 'सेट है', forgot: 'PIN भूल गए', refresh: 'स्थिति अपडेट करें', resetNotice: 'PIN रीसेट करने के बाद निकासी 24 घंटे के लिए रुकेगी।', receiveLocked: 'ट्रांसफ़र प्राप्त करना अभी उपलब्ध नहीं है', depositRule: 'एक जमा हो चुकी बाहरी USDT जमा 300 USDT से अधिक होनी चाहिए। आंतरिक ट्रांसफ़र और बोनस शामिल नहीं हैं।', deposit: 'जमा करें' },
  es: { securityLabel: 'PIN de transacción', configured: 'Configurado', forgot: 'Olvidé el PIN', refresh: 'Actualizar estado', resetNotice: 'Restablecer el PIN suspende los retiros durante 24 horas.', receiveLocked: 'Aún no puedes recibir transferencias', depositRule: 'Un depósito externo de USDT acreditado debe superar los 300 USDT. Las transferencias internas y los bonos no cuentan.', deposit: 'Depositar' },
  ar: { securityLabel: 'رمز المعاملات', configured: 'تم التعيين', forgot: 'نسيت الرمز', refresh: 'تحديث الحالة', resetNotice: 'إعادة تعيين الرمز توقف السحب لمدة 24 ساعة.', receiveLocked: 'استلام التحويلات غير متاح بعد', depositRule: 'يجب أن تتجاوز إيداعًا خارجيًا واحدًا مقيدًا 300 USDT. التحويلات الداخلية والمكافآت لا تُحتسب.', deposit: 'إيداع' },
  fr: { securityLabel: 'Code de transaction', configured: 'Défini', forgot: 'Code oublié', refresh: 'Actualiser le statut', resetNotice: 'La réinitialisation du code suspend les retraits pendant 24 heures.', receiveLocked: 'La réception de transferts n’est pas encore disponible', depositRule: 'Un seul dépôt externe USDT crédité doit dépasser 300 USDT. Les transferts internes et bonus ne comptent pas.', deposit: 'Déposer' },
  pt: { securityLabel: 'PIN de transação', configured: 'Definido', forgot: 'Esqueci o PIN', refresh: 'Atualizar status', resetNotice: 'Redefinir o PIN pausa os saques por 24 horas.', receiveLocked: 'Receber transferências ainda não está disponível', depositRule: 'Um único depósito externo USDT creditado deve superar 300 USDT. Transferências internas e bônus não contam.', deposit: 'Depositar' },
}
function withDetails(key: AppLocale): TransactionPinCopy {
  const value = base[key]
  const details = extra[key]
  const { TRANSACTION_PIN_INVALID, TRANSACTION_PIN_LOCKED } = value.errors
  return { ...value, ...details, gate: { ...value.gate, cooldown: details.resetNotice }, errors: {
    TRANSACTION_PIN_INVALID, TRANSACTION_PIN_LOCKED,
    TRANSACTION_PIN_REQUIRED: value.gate.unset,
    TRANSACTION_PIN_UNAVAILABLE: value.gate.unavailable,
    TRANSACTION_PIN_COOLDOWN: details.resetNotice,
    TRANSACTION_PIN_CONFLICT: value.failed,
    TRANSACTION_PIN_POLICY: value.incomplete,
    WALLET_TRANSFER_DEPOSIT_REQUIRED: details.depositRule,
  } }
}
export const transactionPinCopy: Record<AppLocale, TransactionPinCopy> = {
  en: withDetails('en'), 'zh-CN': withDetails('zh-CN'), hi: withDetails('hi'), es: withDetails('es'), ar: withDetails('ar'), fr: withDetails('fr'), pt: withDetails('pt'),
}
