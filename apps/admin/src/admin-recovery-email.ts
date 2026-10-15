const LOCALES = ['zh-CN', 'en', 'hi', 'es', 'ar', 'fr', 'pt'] as const
type Locale = typeof LOCALES[number]
type Copy = { subject: string; title: string; intro: string; account: string; expiry: string; consequence: string; warning: string; notice: string }
const copy: Record<Locale, Copy> = {
  'zh-CN': {
    subject: 'A-REIT 管理员验证器恢复', title: '恢复管理员验证器',
    intro: '请在发起恢复的页面输入此验证码，然后绑定新的验证器。', account: '管理员账号',
    expiry: '此验证码在 10 分钟内有效。',
    consequence: '完成绑定后，原验证器和旧登录会话将失效。仅验证邮箱不会替换原验证器。',
    warning: '切勿向任何人提供此验证码。如果不是你发起的请求，请忽略此邮件；不要继续恢复或分享验证码。',
    notice: '管理员安全通知',
  },
  en: {
    subject: 'A-REIT administrator authenticator recovery', title: 'Recover your administrator authenticator',
    intro: 'Enter this code on the page where you requested recovery, then bind a new authenticator.', account: 'Administrator account',
    expiry: 'This code expires in 10 minutes.',
    consequence: 'Completing the binding will invalidate your previous authenticator and existing sign-in sessions. Email verification alone does not replace your authenticator.',
    warning: 'Never share this code with anyone. If you did not request this, ignore this email; do not continue recovery or share the code.',
    notice: 'Administrator security notice',
  },
  hi: {
    subject: 'A-REIT व्यवस्थापक ऑथेंटिकेटर रिकवरी', title: 'अपना व्यवस्थापक ऑथेंटिकेटर रिकवर करें',
    intro: 'जिस पेज पर आपने रिकवरी का अनुरोध किया था, वहाँ यह कोड दर्ज करें। फिर नया ऑथेंटिकेटर जोड़ें।', account: 'व्यवस्थापक खाता',
    expiry: 'यह कोड 10 मिनट में समाप्त हो जाएगा।',
    consequence: 'नया ऑथेंटिकेटर जोड़ने की प्रक्रिया पूरी होने पर पुराना ऑथेंटिकेटर और मौजूदा लॉगिन सत्र अमान्य हो जाएँगे। केवल ईमेल सत्यापन से ऑथेंटिकेटर नहीं बदलता।',
    warning: 'यह कोड किसी के साथ साझा न करें। यदि आपने यह अनुरोध नहीं किया है, तो इस ईमेल को अनदेखा करें; रिकवरी जारी न रखें और कोड साझा न करें।',
    notice: 'व्यवस्थापक सुरक्षा सूचना',
  },
  es: {
    subject: 'A-REIT: recuperación del autenticador de administrador', title: 'Recupera tu autenticador de administrador',
    intro: 'Introduce este código en la página donde solicitaste la recuperación y después vincula un nuevo autenticador.', account: 'Cuenta de administrador',
    expiry: 'Este código caduca en 10 minutos.',
    consequence: 'Al completar la vinculación, el autenticador anterior y las sesiones de acceso existentes dejarán de ser válidos. Verificar el correo por sí solo no sustituye el autenticador.',
    warning: 'Nunca compartas este código. Si no solicitaste la recuperación, ignora este correo; no continúes el proceso ni compartas el código.',
    notice: 'Aviso de seguridad para administradores',
  },
  ar: {
    subject: 'A-REIT: استعادة تطبيق المصادقة للمسؤول', title: 'استعادة تطبيق المصادقة للمسؤول',
    intro: 'أدخل هذا الرمز في الصفحة التي طلبت منها الاستعادة، ثم اربط تطبيق مصادقة جديدًا.', account: 'حساب المسؤول',
    expiry: 'تنتهي صلاحية هذا الرمز خلال 10 دقائق.',
    consequence: 'عند إكمال الربط، سيصبح تطبيق المصادقة السابق وجلسات تسجيل الدخول الحالية غير صالحة. التحقق من البريد الإلكتروني وحده لا يستبدل تطبيق المصادقة.',
    warning: 'لا تشارك هذا الرمز مع أي شخص. إذا لم تطلب الاستعادة، فتجاهل هذه الرسالة؛ لا تتابع الاستعادة ولا تشارك الرمز.',
    notice: 'إشعار أمان للمسؤول',
  },
  fr: {
    subject: 'A-REIT : récupération de l’authentificateur administrateur', title: 'Récupérez votre authentificateur administrateur',
    intro: 'Saisissez ce code sur la page où vous avez demandé la récupération, puis associez un nouvel authentificateur.', account: 'Compte administrateur',
    expiry: 'Ce code expire dans 10 minutes.',
    consequence: 'Une fois l’association terminée, l’ancien authentificateur et les sessions de connexion existantes seront invalidés. La seule vérification de l’adresse e-mail ne remplace pas l’authentificateur.',
    warning: 'Ne partagez jamais ce code. Si vous n’avez pas fait cette demande, ignorez cet e-mail ; ne poursuivez pas la récupération et ne partagez pas le code.',
    notice: 'Avis de sécurité administrateur',
  },
  pt: {
    subject: 'A-REIT: recuperação do autenticador de administrador', title: 'Recupere o seu autenticador de administrador',
    intro: 'Introduza este código na página onde solicitou a recuperação e, em seguida, associe um novo autenticador.', account: 'Conta de administrador',
    expiry: 'Este código expira em 10 minutos.',
    consequence: 'Ao concluir a associação, o autenticador anterior e as sessões de acesso existentes serão invalidados. A verificação do e-mail, por si só, não substitui o autenticador.',
    warning: 'Nunca partilhe este código. Se não fez este pedido, ignore este e-mail; não continue a recuperação nem partilhe o código.',
    notice: 'Aviso de segurança do administrador',
  },
}

function localeFor(value?: string): Locale {
  if (typeof value !== 'string' || !/^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(value)) return 'en'
  const language = value.toLowerCase().split(/[-_]/)[0]
  return language === 'zh' ? 'zh-CN' : LOCALES.find(locale => locale === language) ?? 'en'
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Pure rendering: callers retain ownership of recovery state, code generation and delivery. */
export function renderAdminRecoveryEmail(code: string, email: string, locale?: string) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid administrator recovery code')
  const language = localeFor(locale)
  const direction = language === 'ar' ? 'rtl' : 'ltr'
  const align = direction === 'rtl' ? 'right' : 'left'
  const content = copy[language]
  const h = Object.fromEntries(Object.entries(content).map(([key, value]) => [key, escapeHtml(value)])) as Copy
  const html = '<!doctype html>\n<html lang="' + language + '" dir="' + direction + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>' + h.title + '</title>' +
    '<style>body,table,td{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}img{border:0;outline:none}.mail-bg{background:#f3f4f4}.surface{background:#ffffff}.ink{color:#161a1d}.muted{color:#747779}@media(max-width:620px){.outer-pad{padding:16px 10px!important}.body-pad{padding:30px 24px!important}.brand-pad{padding:23px 24px!important}.mail-title{font-size:27px!important}}@media(prefers-color-scheme:dark){.mail-bg{background:#0e1115!important}.surface{background:#191e24!important}.ink{color:#f4f4f2!important}.muted{color:#a6aaae!important}.rule,.shell{border-color:#343b42!important}.code-panel{background:#20262d!important;border-color:#5e503a!important}}[data-ogsc] .mail-bg{background:#0e1115!important}[data-ogsc] .surface{background:#191e24!important}[data-ogsc] .ink{color:#f4f4f2!important}[data-ogsc] .muted{color:#a6aaae!important}[data-ogsc] .code-panel{background:#20262d!important;border-color:#5e503a!important}</style>' +
    '<!--[if mso]><style>body,table,td{font-family:Arial,sans-serif!important}</style><![endif]--></head>' +
    '<body class="mail-bg" bgcolor="#f3f4f4" style="margin:0;padding:0;width:100%;font-family:Arial,sans-serif;font-size:15px;line-height:1.7"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">' + h.intro + '</div>' +
    '<table role="presentation" class="mail-bg" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f4"><tr><td align="center" class="outer-pad" style="padding:38px 16px"><!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->' +
    '<table role="presentation" class="surface shell" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #e4e5e5"><tr><td class="brand-pad" bgcolor="#11151b" align="' + align + '" style="padding:25px 36px;border-bottom:2px solid #e3bb7a"><img alt="A-REIT" src="https://api.a-reit.com/v1/media/email-v2/logo-lockup.png" width="122" height="25" style="display:block;width:122px;height:25px;color:#ffffff"></td></tr>' +
    '<tr><td class="body-pad" align="' + align + '" style="padding:34px 36px 32px"><div class="muted" style="font-size:11px;color:#747779;margin-bottom:14px">' + h.notice + '</div><h1 class="mail-title ink" style="margin:0 0 15px;color:#161a1d;font-size:30px;line-height:1.3;font-weight:600">' + h.title + '</h1><p class="muted" style="margin:0 0 20px;color:#747779">' + h.intro + '</p>' +
    '<p class="muted" style="margin:0 0 24px;color:#747779;font-size:13px">' + h.account + ': <span dir="ltr" style="unicode-bidi:isolate;overflow-wrap:anywhere">' + escapeHtml(email) + '</span></p>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="code-panel" bgcolor="#f5f3ef" style="padding:26px 12px;border:1px solid #e5ddce;text-align:center"><div dir="ltr" class="ink" style="color:#161a1d;font-family:Consolas,monospace;font-size:38px;line-height:1.25;letter-spacing:8px;font-weight:600;white-space:nowrap;user-select:all">' + code + '</div><div class="muted" style="padding-top:12px;color:#747779;font-size:12px">' + h.expiry + '</div></td></tr></table>' +
    '<p class="muted" style="margin:24px 0;color:#747779;font-size:13px">' + h.consequence + '</p><p class="muted rule" style="margin:0;padding-top:21px;border-top:1px solid #e9e9e7;color:#747779;font-size:12px">' + h.warning + '</p></td></tr>' +
    '<tr><td class="muted rule" style="padding:20px 24px;border-top:1px solid #e9e9e7;text-align:center;font-size:11px;color:#747779">© ' + new Date().getUTCFullYear() + ' A-REIT</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>'
  return { subject: content.subject, html, text: [content.title, '', content.intro, content.account + ': ' + email, '', code, content.expiry, '', content.consequence, '', content.warning, '', 'A-REIT'].join('\n') }
}
