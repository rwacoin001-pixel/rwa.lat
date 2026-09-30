import type { AppLocale } from '@/lib/app-locales'

/**
 * Account closure copy (task H2). `{x}` tokens go through fill().
 * The page is informational only: closure is not available in the app yet,
 * so every string stays factual — no request wording, no legal claims.
 */
type Row = { title: string; body: string }

export type CloseCopy = {
  common: { retry: string; unknown: string; none: string }
  page: {
    kicker: string
    titleA: string
    titleB: string
    lede: string
    statusTitle: string
    statusBody: string
    labelBalance: string
    labelPositions: string
    before: string
    beforeNote: string
    items: Record<'balance' | 'positions', Row & { action: string }>
    state: { done: string; todo: string; failed: string; loading: string }
    balanceMeta: string
    balanceEmpty: string
    balanceHeld: string
    positionsMeta: string
    positionsEmpty: string
    means: string
    meansNote: string
    meansItems: [Row, Row, Row]
    way: string
    wayNote: string
    supportCta: string
    supportHint: string
    finalNote: string
    finalCta: string
    disabledReason: string
  }
}

const en: CloseCopy = {
  common: { retry: 'Try again', unknown: 'Unavailable', none: '—' },
  page: {
    kicker: 'Account closure',
    titleA: 'Close',
    titleB: 'account',
    lede: 'Closing an account is not available in the app yet. You can ask our support team about it — and there are a few things to settle first.',
    statusTitle: 'Account closure is not available in the app yet',
    statusBody: 'Nothing on this page closes your account.',
    labelBalance: 'Available balance',
    labelPositions: 'Open positions',
    before: 'Before closing',
    beforeNote: 'Live account data. Settle both before any closure.',
    items: {
      balance: { title: 'Withdraw your available balance', body: 'Move your cash out before anything else.', action: 'Withdraw' },
      positions: { title: 'Redeem your open positions', body: 'Sell or redeem everything you still hold.', action: 'Go to assets' },
    },
    state: { done: 'Done', todo: 'To do', failed: 'Couldn’t load', loading: '…' },
    balanceMeta: '{amount} to withdraw',
    balanceEmpty: 'Nothing to withdraw',
    balanceHeld: '{amount} still locked or pending',
    positionsMeta: '{n} open positions',
    positionsEmpty: 'No open positions',
    means: 'What closing will mean',
    meansNote: 'What happens to your account after closure.',
    meansItems: [
      { title: 'Access ends', body: 'You will no longer be able to sign in or use the app.' },
      { title: 'Records may be kept', body: 'Records may be retained as required by law.' },
      { title: 'Ask before you decide', body: 'Support will confirm what closure involves — including whether it can be reversed — before anything is done.' },
    ],
    way: 'The way forward',
    wayNote: 'For now, ask our support team about closing your account.',
    supportCta: 'Contact support about closing',
    supportHint: 'Opens the support form in this app. Nothing is sent until you submit it there.',
    finalNote: 'This action is disabled — account closure is not available yet.',
    finalCta: 'Close account',
    disabledReason: 'Not available yet',
  },
}

const zh: CloseCopy = {
  common: { retry: '重试', unknown: '暂不可用', none: '—' },
  page: {
    kicker: '账户注销',
    titleA: '注销',
    titleB: '账户',
    lede: '应用内暂不支持注销账户。你可以向客服咨询注销事宜——在此之前，有几件事需要先处理好。',
    statusTitle: '应用内暂不支持注销账户',
    statusBody: '本页面不会注销你的账户。',
    labelBalance: '可用余额',
    labelPositions: '持仓数量',
    before: '注销之前',
    beforeNote: '以下为账户实时数据。请先处理完毕。',
    items: {
      balance: { title: '提走可用余额', body: '先把现金提走，再谈其他。', action: '去提现' },
      positions: { title: '赎回全部持仓', body: '把仍持有的资产全部卖出或赎回。', action: '去资产' },
    },
    state: { done: '已完成', todo: '待处理', failed: '加载失败', loading: '…' },
    balanceMeta: '{amount} 待提取',
    balanceEmpty: '没有待提取的余额',
    balanceHeld: '仍有 {amount} 处于锁定或处理中',
    positionsMeta: '{n} 笔持仓',
    positionsEmpty: '没有持仓',
    means: '注销意味着什么',
    meansNote: '注销后你的账户会发生什么。',
    meansItems: [
      { title: '访问立即终止', body: '你将无法再登录或使用本应用。' },
      { title: '记录可能被保留', body: '依法需要保留的记录可能会被保留。' },
      { title: '决定前先确认', body: '在任何操作之前，客服会向你说明注销涉及的内容，包括能否撤销。' },
    ],
    way: '现在该怎么做',
    wayNote: '目前请通过客服咨询注销事宜。',
    supportCta: '联系客服申请注销',
    supportHint: '将打开工单表单。在你于该页面提交之前，不会发送任何内容。',
    finalNote: '该操作已禁用——应用内暂不支持注销账户。',
    finalCta: '注销账户',
    disabledReason: '暂不可用',
  },
}

const hi: CloseCopy = {
  common: { retry: 'फिर से कोशिश करें', unknown: 'उपलब्ध नहीं', none: '—' },
  page: {
    kicker: 'खाता बंद करना',
    titleA: 'खाता',
    titleB: 'बंद करें',
    lede: 'ऐप में खाता बंद करना अभी उपलब्ध नहीं है। आप इसके बारे में हमारी सहायता टीम से पूछ सकते हैं — और पहले कुछ बातें निपटानी होंगी।',
    statusTitle: 'खाता बंद करना अभी ऐप में उपलब्ध नहीं है',
    statusBody: 'इस पेज पर कुछ भी आपका खाता बंद नहीं करता।',
    labelBalance: 'उपलब्ध शेष',
    labelPositions: 'खुली स्थितियाँ',
    before: 'बंद करने से पहले',
    beforeNote: 'ये आपके खाते के लाइव आँकड़े हैं। बंद करने से पहले इन्हें निपटाएँ।',
    items: {
      balance: { title: 'अपना उपलब्ध शेष निकालें', body: 'बाकी सब से पहले अपना नकद बाहर भेजें।', action: 'निकासी करें' },
      positions: { title: 'अपनी खुली स्थितियाँ भुनाएँ', body: 'जो अभी भी रखा है उसे बेचें या भुनाएँ।', action: 'संपत्तियों पर जाएँ' },
    },
    state: { done: 'पूरा', todo: 'बाकी', failed: 'लोड नहीं हुआ', loading: '…' },
    balanceMeta: '{amount} निकालने के लिए',
    balanceEmpty: 'निकालने के लिए कुछ नहीं',
    balanceHeld: '{amount} अभी लॉक या लंबित है',
    positionsMeta: '{n} खुली स्थितियाँ',
    positionsEmpty: 'कोई खुली स्थिति नहीं',
    means: 'बंद करने का क्या मतलब होगा',
    meansNote: 'बंद करने के बाद आपके खाते का क्या होगा।',
    meansItems: [
      { title: 'पहुँच समाप्त', body: 'आप फिर से साइन इन या ऐप का उपयोग नहीं कर पाएँगे।' },
      { title: 'रिकॉर्ड रखे जा सकते हैं', body: 'कानून के अनुसार आवश्यक रिकॉर्ड रखे जा सकते हैं।' },
      { title: 'निर्णय से पहले पूछें', body: 'कुछ भी करने से पहले सहायता टीम बताएगी कि खाता बंद करने में क्या शामिल है — और क्या इसे वापस लिया जा सकता है।' },
    ],
    way: 'आगे का रास्ता',
    wayNote: 'फ़िलहाल खाता बंद करने के बारे में हमारी सहायता टीम से पूछें।',
    supportCta: 'बंद करने के बारे में सहायता से संपर्क करें',
    supportHint: 'ऐप में सहायता फ़ॉर्म खुलता है। वहाँ भेजने तक कुछ भी नहीं भेजा जाता।',
    finalNote: 'यह क्रिया अक्षम है — खाता बंद करना अभी उपलब्ध नहीं है।',
    finalCta: 'खाता बंद करें',
    disabledReason: 'अभी उपलब्ध नहीं',
  },
}

const es: CloseCopy = {
  common: { retry: 'Reintentar', unknown: 'No disponible', none: '—' },
  page: {
    kicker: 'Cierre de cuenta',
    titleA: 'Cerrar',
    titleB: 'cuenta',
    lede: 'Cerrar una cuenta todavía no está disponible en la app. Puedes consultarlo con nuestro equipo de soporte, y antes hay que dejar unas cuantas cosas en orden.',
    statusTitle: 'El cierre de cuenta todavía no está disponible en la app',
    statusBody: 'Nada en esta página cierra tu cuenta.',
    labelBalance: 'Saldo disponible',
    labelPositions: 'Posiciones abiertas',
    before: 'Antes de cerrar',
    beforeNote: 'Datos reales de tu cuenta. Déjalos en orden antes de cualquier cierre.',
    items: {
      balance: { title: 'Retira tu saldo disponible', body: 'Saca tu dinero antes que nada.', action: 'Retirar' },
      positions: { title: 'Canjea tus posiciones abiertas', body: 'Vende o canjea todo lo que aún tengas.', action: 'Ir a activos' },
    },
    state: { done: 'Hecho', todo: 'Pendiente', failed: 'No se pudo cargar', loading: '…' },
    balanceMeta: '{amount} por retirar',
    balanceEmpty: 'Nada por retirar',
    balanceHeld: '{amount} aún bloqueado o pendiente',
    positionsMeta: '{n} posiciones abiertas',
    positionsEmpty: 'Sin posiciones abiertas',
    means: 'Qué significará el cierre',
    meansNote: 'Qué ocurre con tu cuenta después del cierre.',
    meansItems: [
      { title: 'Se termina el acceso', body: 'Ya no podrás iniciar sesión ni usar la app.' },
      { title: 'Los registros pueden conservarse', body: 'Los registros pueden conservarse según exija la ley.' },
      { title: 'Pregunta antes de decidir', body: 'Soporte te confirmará qué implica el cierre, incluido si se puede revertir, antes de hacer nada.' },
    ],
    way: 'El camino a seguir',
    wayNote: 'Por ahora, consulta el cierre de tu cuenta con nuestro equipo de soporte.',
    supportCta: 'Contactar con soporte sobre el cierre',
    supportHint: 'Abre el formulario de soporte en la app. No se envía nada hasta que lo envíes allí.',
    finalNote: 'Esta acción está desactivada: el cierre de cuenta aún no está disponible.',
    finalCta: 'Cerrar cuenta',
    disabledReason: 'Aún no disponible',
  },
}

const ar: CloseCopy = {
  common: { retry: 'إعادة المحاولة', unknown: 'غير متاح', none: '—' },
  page: {
    kicker: 'إغلاق الحساب',
    titleA: 'إغلاق',
    titleB: 'الحساب',
    lede: 'إغلاق الحساب غير متاح في التطبيق حتى الآن. يمكنك الاستفسار عنه لدى فريق الدعم — وهناك أمور يجب تسويتها أولاً.',
    statusTitle: 'إغلاق الحساب غير متاح في التطبيق حتى الآن',
    statusBody: 'لا شيء في هذه الصفحة يغلق حسابك.',
    labelBalance: 'الرصيد المتاح',
    labelPositions: 'المراكز المفتوحة',
    before: 'قبل الإغلاق',
    beforeNote: 'بيانات حسابك المباشرة. سوِّ هذه الأمور قبل أي إغلاق.',
    items: {
      balance: { title: 'اسحب رصيدك المتاح', body: 'انقل أموالك إلى الخارج قبل أي شيء آخر.', action: 'سحب' },
      positions: { title: 'صرف مراكزك المفتوحة', body: 'بِع أو صرف كل ما لا تزال تمتلكه.', action: 'الذهاب إلى الأصول' },
    },
    state: { done: 'تم', todo: 'مطلوب', failed: 'تعذّر التحميل', loading: '…' },
    balanceMeta: '{amount} متاحة للسحب',
    balanceEmpty: 'لا يوجد شيء للسحب',
    balanceHeld: 'لا يزال {amount} مقفلاً أو قيد المعالجة',
    positionsMeta: '{n} مراكز مفتوحة',
    positionsEmpty: 'لا توجد مراكز مفتوحة',
    means: 'ماذا سيُعني الإغلاق',
    meansNote: 'ماذا يحدث لحسابك بعد الإغلاق.',
    meansItems: [
      { title: 'ينتهي الوصول', body: 'لن تتمكن بعد ذلك من تسجيل الدخول أو استخدام التطبيق.' },
      { title: 'قد يُحتفظ بالسجلات', body: 'قد يُحتفظ بالسجلات وفق ما يقتضيه القانون.' },
      { title: 'اسأل قبل أن تقرر', body: 'سيؤكد لك فريق الدعم ما يترتب على الإغلاق — بما في ذلك إمكانية التراجع عنه — قبل اتخاذ أي إجراء.' },
    ],
    way: 'الطريق إلى الأمام',
    wayNote: 'في الوقت الحالي، استفسر لدى فريق الدعم عن إغلاق حسابك.',
    supportCta: 'تواصل مع الدعم بشأن الإغلاق',
    supportHint: 'يفتح نموذج الدعم في التطبيق. لا يُرسل شيء حتى تُرسله هناك.',
    finalNote: 'هذا الإجراء معطّل — إغلاق الحساب غير متاح حتى الآن.',
    finalCta: 'إغلاق الحساب',
    disabledReason: 'غير متاح بعد',
  },
}

const fr: CloseCopy = {
  common: { retry: 'Réessayer', unknown: 'Indisponible', none: '—' },
  page: {
    kicker: 'Clôture de compte',
    titleA: 'Clôturer',
    titleB: 'le compte',
    lede: 'La clôture d’un compte n’est pas encore disponible dans l’application. Vous pouvez vous renseigner auprès de notre équipe d’assistance — et quelques points doivent d’abord être réglés.',
    statusTitle: 'La clôture de compte n’est pas encore disponible dans l’application',
    statusBody: 'Rien sur cette page ne clôture votre compte.',
    labelBalance: 'Solde disponible',
    labelPositions: 'Positions ouvertes',
    before: 'Avant de clôturer',
    beforeNote: 'Données réelles de votre compte. Réglez ces points avant toute clôture.',
    items: {
      balance: { title: 'Retirez votre solde disponible', body: 'Sortez votre argent avant tout le reste.', action: 'Retirer' },
      positions: { title: 'Rachetez vos positions ouvertes', body: 'Vendez ou rachetez tout ce que vous détenez encore.', action: 'Voir les actifs' },
    },
    state: { done: 'Fait', todo: 'À faire', failed: 'Chargement impossible', loading: '…' },
    balanceMeta: '{amount} à retirer',
    balanceEmpty: 'Rien à retirer',
    balanceHeld: '{amount} encore bloqué ou en attente',
    positionsMeta: '{n} positions ouvertes',
    positionsEmpty: 'Aucune position ouverte',
    means: 'Ce que la clôture impliquera',
    meansNote: 'Ce qu’il advient de votre compte après la clôture.',
    meansItems: [
      { title: 'L’accès prend fin', body: 'Vous ne pourrez plus vous connecter ni utiliser l’application.' },
      { title: 'Les enregistrements peuvent être conservés', body: 'Les enregistrements peuvent être conservés conformément à la loi.' },
      { title: 'Demandez avant de décider', body: 'L’assistance vous confirmera ce qu’implique la clôture — y compris si elle est réversible — avant toute action.' },
    ],
    way: 'La marche à suivre',
    wayNote: 'Pour l’instant, renseignez-vous auprès de notre équipe d’assistance sur la clôture de votre compte.',
    supportCta: 'Contacter l’assistance au sujet de la clôture',
    supportHint: 'Ouvre le formulaire d’assistance dans l’app. Rien n’est envoyé tant que vous ne le soumettez pas là-bas.',
    finalNote: 'Cette action est désactivée — la clôture de compte n’est pas encore disponible.',
    finalCta: 'Clôturer le compte',
    disabledReason: 'Pas encore disponible',
  },
}

const pt: CloseCopy = {
  common: { retry: 'Tentar novamente', unknown: 'Indisponível', none: '—' },
  page: {
    kicker: 'Encerramento de conta',
    titleA: 'Encerrar',
    titleB: 'conta',
    lede: 'Encerrar uma conta ainda não está disponível no app. Você pode consultar nossa equipe de suporte — e há algumas coisas a resolver antes.',
    statusTitle: 'O encerramento de conta ainda não está disponível no app',
    statusBody: 'Nada nesta página encerra sua conta.',
    labelBalance: 'Saldo disponível',
    labelPositions: 'Posições abertas',
    before: 'Antes de encerrar',
    beforeNote: 'Dados reais da sua conta. Resolva isto antes de qualquer encerramento.',
    items: {
      balance: { title: 'Retire seu saldo disponível', body: 'Tire seu dinheiro para fora antes de tudo.', action: 'Sacar' },
      positions: { title: 'Resgate suas posições abertas', body: 'Venda ou resgate tudo o que você ainda mantém.', action: 'Ir para ativos' },
    },
    state: { done: 'Feito', todo: 'A fazer', failed: 'Não foi possível carregar', loading: '…' },
    balanceMeta: '{amount} a sacar',
    balanceEmpty: 'Nada a sacar',
    balanceHeld: '{amount} ainda bloqueado ou pendente',
    positionsMeta: '{n} posições abertas',
    positionsEmpty: 'Nenhuma posição aberta',
    means: 'O que o encerramento significa',
    meansNote: 'O que acontece com sua conta após o encerramento.',
    meansItems: [
      { title: 'O acesso termina', body: 'Você não poderá mais entrar nem usar o app.' },
      { title: 'Registros podem ser mantidos', body: 'Registros podem ser mantidos conforme exigido por lei.' },
      { title: 'Pergunte antes de decidir', body: 'O suporte vai confirmar o que o encerramento envolve — inclusive se pode ser revertido — antes de qualquer ação.' },
    ],
    way: 'O caminho a seguir',
    wayNote: 'Por enquanto, consulte nossa equipe de suporte sobre o encerramento da sua conta.',
    supportCta: 'Falar com o suporte sobre o encerramento',
    supportHint: 'Abre o formulário de suporte no app. Nada é enviado até você enviar por lá.',
    finalNote: 'Esta ação está desativada — o encerramento de conta ainda não está disponível.',
    finalCta: 'Encerrar conta',
    disabledReason: 'Ainda não disponível',
  },
}

export const closeCopy: Record<AppLocale, CloseCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
