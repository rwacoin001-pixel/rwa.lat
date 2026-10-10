import type { AppLocale } from './i18n'

export const authCardCaption: Record<AppLocale, string> = {
  en: 'Connect to real assets.',
  'zh-CN': '从这里，连接真实资产。',
  hi: 'वास्तविक संपत्तियों से जुड़ें।',
  es: 'Conecta con activos reales.',
  ar: 'تواصل مع الأصول الحقيقية.',
  fr: 'Accédez aux actifs réels.',
  pt: 'Conecte-se a ativos reais.',
}

/** The sign-in poster's two-line title; the second line takes the gold. */
export const authPosterTitle: Record<AppLocale, [string, string]> = {
  en: ['Real assets,', 'a freer future.'],
  'zh-CN': ['真实资产，', '自由未来。'],
  hi: ['वास्तविक संपत्तियाँ,', 'एक स्वतंत्र भविष्य।'],
  es: ['Activos reales,', 'un futuro más libre.'],
  ar: ['أصول حقيقية،', 'مستقبل أكثر حرية.'],
  fr: ['Actifs réels,', 'un avenir plus libre.'],
  pt: ['Ativos reais,', 'um futuro mais livre.'],
}

export const authPosterIntro: Record<AppLocale, string> = {
  en: 'Sign in or create your account.',
  'zh-CN': '登录或创建你的账户。',
  hi: 'साइन इन करें या अपना खाता बनाएँ।',
  es: 'Inicia sesión o crea tu cuenta.',
  ar: 'سجّل الدخول أو أنشئ حسابك.',
  fr: 'Connectez-vous ou créez votre compte.',
  pt: 'Entre ou crie sua conta.',
}

/** Extra strings for the Maison sign-in card; the base auth strings stay in auth-visual-copy. */
export type AuthSheetCopy = {
  kicker: string; modes: string; wallet: string; passkeyNote: string
  loginTitle: string; loginLede: string; registerTitle: string; registerLede: string
  codeTitle: string; sentTo: string; or: string; browse: string
  newHere: string; createAccount: string; haveAccount: string; signIn: string
  showPassword: string; hidePassword: string; passkey: string; useCode: string; usePassword: string
  setupTitle: string; setupLede: string; ruleLength: string; ruleMatch: string; help: string
  passwordRequired: string
  continue: string; checking: string; emailLede: string; account: string; newLede: string; unavailable: string
}

export const authSheetCopy: Record<AppLocale, AuthSheetCopy> = {
  en: {
    kicker: 'Real-world assets, held on-chain', modes: 'Sign in or register', wallet: 'Wallet', passkeyNote: 'Saved a passkey? Tap the email field to use it.',
    loginTitle: 'Welcome back', loginLede: 'Sign in with your email and password.', registerTitle: 'Create your account', registerLede: 'Verify your email, then set a password.',
    codeTitle: 'Check your email', sentTo: 'We sent a 6-digit code to', or: 'or continue with', browse: 'Look around first',
    newHere: 'New to A-REIT?', createAccount: 'Create account', haveAccount: 'Already have an account?', signIn: 'Sign in',
    showPassword: 'Show password', hidePassword: 'Hide password', passkey: 'Passkey', useCode: 'Use an email code', usePassword: 'Use password',
    setupTitle: 'Set a password', setupLede: 'You will use it with your email to sign in.', ruleLength: '12 to 128 characters', ruleMatch: 'Both entries match', help: 'Help', passwordRequired: 'Enter your password.',
    continue: 'Continue', checking: 'Checking…', emailLede: 'Enter your email. We’ll sign you in or help you create an account.', account: 'Signing in as', newLede: 'No account uses this email yet. Verify it, then set a password to finish.', unavailable: 'This account can’t sign in right now. Contact support for help.',
  },
  'zh-CN': {
    kicker: '真实资产 · 链上持有', modes: '登录或注册', wallet: '钱包', passkeyNote: '已保存通行密钥？点一下邮箱框即可使用。',
    loginTitle: '欢迎回来', loginLede: '使用邮箱和密码登录', registerTitle: '创建账户', registerLede: '先验证邮箱，再设置登录密码',
    codeTitle: '查收验证码', sentTo: '6 位验证码已发送至', or: '或使用以下方式', browse: '暂不注册，先看看',
    newHere: '还没有账户？', createAccount: '创建账户', haveAccount: '已有账户？', signIn: '登录',
    showPassword: '显示密码', hidePassword: '隐藏密码', passkey: '通行密钥', useCode: '改用邮箱验证码', usePassword: '改用密码登录',
    setupTitle: '设置登录密码', setupLede: '之后可用邮箱和此密码登录', ruleLength: '12–128 位字符', ruleMatch: '两次输入一致', help: '帮助', passwordRequired: '请输入密码',
    continue: '继续', checking: '正在确认…', emailLede: '输入邮箱，已有账户直接登录，新邮箱将引导注册', account: '登录账户', newLede: '这个邮箱还没有账户。验证邮箱后设置密码即可完成注册', unavailable: '该账户暂时无法登录，请联系客服处理',
  },
  hi: {
    kicker: 'वास्तविक संपत्तियाँ, ऑन-चेन', modes: 'साइन इन करें या खाता बनाएँ', wallet: 'वॉलेट', passkeyNote: 'पासकी सहेजी है? उपयोग के लिए ईमेल फ़ील्ड पर टैप करें।',
    loginTitle: 'फिर से स्वागत है', loginLede: 'ईमेल और पासवर्ड से साइन इन करें।', registerTitle: 'अपना खाता बनाएँ', registerLede: 'ईमेल सत्यापित करें, फिर पासवर्ड बनाएँ।',
    codeTitle: 'अपना ईमेल देखें', sentTo: '6 अंकों का कोड भेजा गया:', or: 'या इनसे जारी रखें', browse: 'पहले देखें',
    newHere: 'A-REIT पर नए हैं?', createAccount: 'खाता बनाएँ', haveAccount: 'पहले से खाता है?', signIn: 'साइन इन करें',
    showPassword: 'पासवर्ड दिखाएँ', hidePassword: 'पासवर्ड छिपाएँ', passkey: 'पासकी', useCode: 'ईमेल कोड से', usePassword: 'पासवर्ड से',
    setupTitle: 'पासवर्ड बनाएँ', setupLede: 'इसे ईमेल के साथ साइन इन के लिए उपयोग करें।', ruleLength: '12 से 128 अक्षर', ruleMatch: 'दोनों प्रविष्टियाँ मेल खाती हैं', help: 'मदद', passwordRequired: 'अपना पासवर्ड दर्ज करें।',
    continue: 'जारी रखें', checking: 'जाँच हो रही है…', emailLede: 'अपना ईमेल दर्ज करें। हम साइन इन कराएँगे या खाता बनाने में मदद करेंगे।', account: 'इस खाते से साइन इन', newLede: 'इस ईमेल से अभी कोई खाता नहीं है। ईमेल सत्यापित करें, फिर पासवर्ड बनाएँ।', unavailable: 'यह खाता अभी साइन इन नहीं कर सकता। मदद के लिए सहायता से संपर्क करें।',
  },
  es: {
    kicker: 'Activos reales, en cadena', modes: 'Inicia sesión o crea una cuenta', wallet: 'Cartera', passkeyNote: '¿Guardaste una llave de acceso? Toca el campo de correo.',
    loginTitle: 'Hola de nuevo', loginLede: 'Accede con tu correo y contraseña.', registerTitle: 'Crea tu cuenta', registerLede: 'Verifica tu correo y luego crea una contraseña.',
    codeTitle: 'Revisa tu correo', sentTo: 'Enviamos un código de 6 dígitos a', or: 'o continúa con', browse: 'Explorar primero',
    newHere: '¿Nuevo en A-REIT?', createAccount: 'Crear cuenta', haveAccount: '¿Ya tienes cuenta?', signIn: 'Acceder',
    showPassword: 'Mostrar contraseña', hidePassword: 'Ocultar contraseña', passkey: 'Llave de acceso', useCode: 'Usar código por correo', usePassword: 'Usar contraseña',
    setupTitle: 'Crea una contraseña', setupLede: 'La usarás con tu correo para acceder.', ruleLength: 'De 12 a 128 caracteres', ruleMatch: 'Ambas coinciden', help: 'Ayuda', passwordRequired: 'Introduce tu contraseña.',
    continue: 'Continuar', checking: 'Comprobando…', emailLede: 'Introduce tu correo. Te damos acceso o te ayudamos a crear una cuenta.', account: 'Accediendo como', newLede: 'Aún no hay una cuenta con este correo. Verifícalo y crea una contraseña para terminar.', unavailable: 'Esta cuenta no puede acceder ahora. Contacta con soporte.',
  },
  ar: {
    kicker: 'أصول حقيقية على السلسلة', modes: 'سجّل الدخول أو أنشئ حسابًا', wallet: 'المحفظة', passkeyNote: 'حفظت مفتاح مرور؟ المس حقل البريد لاستخدامه.',
    loginTitle: 'مرحبًا بعودتك', loginLede: 'سجّل الدخول ببريدك وكلمة المرور.', registerTitle: 'أنشئ حسابك', registerLede: 'تحقق من بريدك ثم عيّن كلمة مرور.',
    codeTitle: 'تحقق من بريدك', sentTo: 'أرسلنا رمزًا من 6 أرقام إلى', or: 'أو تابع عبر', browse: 'تصفّح أولاً',
    newHere: 'جديد في A-REIT؟', createAccount: 'أنشئ حسابًا', haveAccount: 'لديك حساب؟', signIn: 'سجّل الدخول',
    showPassword: 'إظهار كلمة المرور', hidePassword: 'إخفاء كلمة المرور', passkey: 'مفتاح المرور', useCode: 'استخدم رمز البريد', usePassword: 'استخدم كلمة المرور',
    setupTitle: 'عيّن كلمة مرور', setupLede: 'ستستخدمها مع بريدك لتسجيل الدخول.', ruleLength: 'من 12 إلى 128 حرفًا', ruleMatch: 'الإدخالان متطابقان', help: 'مساعدة', passwordRequired: 'أدخل كلمة المرور.',
    continue: 'متابعة', checking: 'جارٍ التحقق…', emailLede: 'أدخل بريدك. سنسجّل دخولك أو نساعدك في إنشاء حساب.', account: 'تسجيل الدخول باسم', newLede: 'لا يوجد حساب بهذا البريد بعد. تحقّق منه ثم عيّن كلمة مرور لإكمال التسجيل.', unavailable: 'لا يمكن لهذا الحساب تسجيل الدخول الآن. تواصل مع الدعم.',
  },
  fr: {
    kicker: 'Actifs réels, détenus on-chain', modes: 'Connexion ou création de compte', wallet: 'Portefeuille', passkeyNote: 'Clé d’accès enregistrée ? Touchez le champ e-mail.',
    loginTitle: 'Bon retour', loginLede: 'Connectez-vous avec votre e-mail et votre mot de passe.', registerTitle: 'Créez votre compte', registerLede: 'Vérifiez votre e-mail, puis définissez un mot de passe.',
    codeTitle: 'Consultez vos e-mails', sentTo: 'Code à 6 chiffres envoyé à', or: 'ou continuer avec', browse: 'Découvrir d’abord',
    newHere: 'Nouveau sur A-REIT ?', createAccount: 'Créer un compte', haveAccount: 'Déjà un compte ?', signIn: 'Connexion',
    showPassword: 'Afficher le mot de passe', hidePassword: 'Masquer le mot de passe', passkey: 'Clé d’accès', useCode: 'Code par e-mail', usePassword: 'Mot de passe',
    setupTitle: 'Définir un mot de passe', setupLede: 'Il servira avec votre e-mail pour vous connecter.', ruleLength: '12 à 128 caractères', ruleMatch: 'Les deux saisies correspondent', help: 'Aide', passwordRequired: 'Saisissez votre mot de passe.',
    continue: 'Continuer', checking: 'Vérification…', emailLede: 'Saisissez votre e-mail. Nous vous connectons ou vous aidons à créer un compte.', account: 'Connexion en tant que', newLede: 'Aucun compte n’utilise cet e-mail. Vérifiez-le, puis définissez un mot de passe.', unavailable: 'Ce compte ne peut pas se connecter pour le moment. Contactez le support.',
  },
  pt: {
    kicker: 'Ativos reais, on-chain', modes: 'Entre ou crie uma conta', wallet: 'Carteira', passkeyNote: 'Salvou uma chave de acesso? Toque no campo de e-mail.',
    loginTitle: 'Bem-vindo de volta', loginLede: 'Entre com seu e-mail e senha.', registerTitle: 'Crie sua conta', registerLede: 'Verifique seu e-mail e depois defina uma senha.',
    codeTitle: 'Confira seu e-mail', sentTo: 'Enviamos um código de 6 dígitos para', or: 'ou continue com', browse: 'Explorar primeiro',
    newHere: 'Novo na A-REIT?', createAccount: 'Criar conta', haveAccount: 'Já tem conta?', signIn: 'Entrar',
    showPassword: 'Mostrar senha', hidePassword: 'Ocultar senha', passkey: 'Chave de acesso', useCode: 'Usar código por e-mail', usePassword: 'Usar senha',
    setupTitle: 'Defina uma senha', setupLede: 'Você a usará com seu e-mail para entrar.', ruleLength: '12 a 128 caracteres', ruleMatch: 'As duas entradas coincidem', help: 'Ajuda', passwordRequired: 'Digite sua senha.',
    continue: 'Continuar', checking: 'Verificando…', emailLede: 'Digite seu e-mail. Fazemos seu login ou ajudamos a criar uma conta.', account: 'Entrando como', newLede: 'Ainda não há conta com este e-mail. Verifique-o e defina uma senha para concluir.', unavailable: 'Esta conta não pode entrar agora. Fale com o suporte.',
  },
}
