import type { AppLocale } from '@/lib/app-locales'

// Copy for the desktop showcase (/desktop). Facts the app already states only: no yields, NAV, user counts,
// custody or reserve claims. Hengxu stays a concept (not issued, not open for subscription).
export type DesktopCard = { label: string; value: string }
export type DesktopChapter = { title: [string, string]; lede: string; cards: DesktopCard[] }
export type DesktopCopy = {
  chapters: [string, string, string, string, string, string]
  scenes: [DesktopChapter, DesktopChapter, DesktopChapter, DesktopChapter, DesktopChapter]
  nav: string
  openOnPhone: string
  language: string
  scroll: string
  scanLabel: string
  handoffTitle: [string, string]
  handoffBody: string
  sharedTitle: string
  sharedBody: string
  phoneLabel: string
  preview: string
}

const LANGS = 'EN · 中文 · हिन्दी · ES · العربية · FR · PT'

const en: DesktopCopy = {
  chapters: ['Opening', 'Real assets', 'Hengxu', 'Transparency', 'Anywhere', 'Begin'],
  scenes: [
    { title: ['Real-world assets,', 'in your pocket.'], lede: 'RWA.LAT is built for your phone. AI compute, real-world assets, global stocks and prediction markets, all from one USDT wallet.',
      cards: [{ label: 'Four markets', value: 'AI compute · RWA · Stocks · Predictions' }, { label: 'One wallet', value: 'USDT' }, { label: 'Made for mobile', value: 'Desktop is a preview only' }] },
    { title: ['Real assets,', 'with a visible source.'], lede: 'Every product states its issuer, return source, fees, maturity and exit before you invest.',
      cards: [{ label: 'Asset classes', value: 'AI compute · RWA · Global stocks' }, { label: 'Every product lists', value: 'Issuer · Return source · Fees · Maturity · Exit' }, { label: 'Priced in', value: 'USDT' }] },
    { title: ['Hengxu,', 'arranged by when you need it.'], lede: 'Ten strategy concepts, from 30-day cash to five-year holdings. A concept series: not issued and not open for subscription.',
      cards: [{ label: 'Series', value: '10 strategy concepts' }, { label: 'Horizons', value: '30 days → 5 years+' }, { label: 'Status', value: 'Concept · Not issued' }] },
    { title: ['See it clearly,', 'then decide.'], lede: 'Access rules, product structures, fees, legal documents and official channels sit together in the Trust center.',
      cards: [{ label: 'Trust center', value: 'Access · Disclosures · Legal documents' }, { label: 'Official channels', value: 'Verify the domain and social accounts' }, { label: 'Never asked', value: 'Seed phrases, private keys or codes' }] },
    { title: ['One wallet,', 'wherever you go.'], lede: 'Add RWA.LAT to your home screen and it opens full screen, like a native app, in the language you choose.',
      cards: [{ label: 'Install', value: 'Add to home screen' }, { label: 'Languages', value: LANGS }, { label: 'Alerts', value: 'Market notifications, your choice' }] },
  ],
  nav: 'Chapters',
  openOnPhone: 'Open on phone',
  language: 'Language',
  scroll: 'Scroll',
  scanLabel: 'Scan with your phone camera',
  handoffTitle: ['Made for your phone.', 'Open it there.'],
  handoffBody: 'Point your phone camera at the code to open RWA.LAT. The desktop site is a preview only.',
  sharedTitle: 'Open this page on your phone',
  sharedBody: 'This link was shared for the mobile app. Scan the code to continue on your phone.',
  phoneLabel: 'Live preview of the RWA.LAT mobile app',
  preview: 'Preview',
}

const zh: DesktopCopy = {
  chapters: ['开场', '真实资产', '衡序', '透明与信任', '随身', '开始'],
  scenes: [
    { title: ['真实世界的资产，', '装进你的口袋。'], lede: 'RWA.LAT 为手机而生。AI 算力、真实资产、全球股票与预测市场，都在一个 USDT 钱包里。',
      cards: [{ label: '四类市场', value: 'AI 算力 · RWA · 股票 · 预测' }, { label: '一个钱包', value: 'USDT' }, { label: '为手机设计', value: '电脑端仅作展示' }] },
    { title: ['真实资产，', '看得见来处。'], lede: '每个产品都写明发行方、收益来源、费用、期限与退出方式，投资前一目了然。',
      cards: [{ label: '资产类别', value: 'AI 算力 · RWA · 全球股票' }, { label: '每个产品都写明', value: '发行方 · 收益来源 · 费用 · 期限 · 退出' }, { label: '计价', value: 'USDT' }] },
    { title: ['衡序，', '按用钱的时间排布。'], lede: '十个策略概念，从 30 天现金管理到五年持有。目前是概念稿，尚未发行，也不开放认购。',
      cards: [{ label: '系列', value: '10 个策略概念' }, { label: '期限', value: '30 天 → 5 年以上' }, { label: '状态', value: '概念稿 · 未发行' }] },
    { title: ['先看清，', '再决定。'], lede: '访问规则、产品结构、费用、法律文件与官方渠道，集中在信任中心。',
      cards: [{ label: '信任中心', value: '访问规则 · 产品披露 · 法律文件' }, { label: '官方渠道', value: '核验域名与社交账号' }, { label: '从不索要', value: '助记词、私钥或验证码' }] },
    { title: ['一个钱包，', '随你去任何地方。'], lede: '把 RWA.LAT 添加到手机主屏幕，像原生应用一样全屏打开，用你习惯的语言。',
      cards: [{ label: '安装', value: '添加到主屏幕' }, { label: '语言', value: LANGS }, { label: '提醒', value: '市场通知，由你决定' }] },
  ],
  nav: '章节',
  openOnPhone: '用手机打开',
  language: '语言',
  scroll: '向下滚动',
  scanLabel: '用手机相机扫码',
  handoffTitle: ['为手机而生，', '在手机上打开。'],
  handoffBody: '用手机相机扫描二维码打开 RWA.LAT。电脑端仅作展示。',
  sharedTitle: '请用手机打开此页面',
  sharedBody: '这个链接是为手机应用分享的。扫码后在手机上继续查看。',
  phoneLabel: 'RWA.LAT 手机应用实时预览',
  preview: '预览',
}
const hi: DesktopCopy = {
  chapters: ['शुरुआत', 'वास्तविक एसेट', 'हेंगश्यू', 'पारदर्शिता', 'हर जगह', 'शुरू करें'],
  scenes: [
    { title: ['वास्तविक दुनिया के एसेट,', 'आपकी जेब में।'], lede: 'RWA.LAT आपके फ़ोन के लिए बना है। AI कंप्यूट, वास्तविक एसेट, वैश्विक स्टॉक और प्रेडिक्शन मार्केट, सब एक USDT वॉलेट से।',
      cards: [{ label: 'चार मार्केट', value: 'AI कंप्यूट · RWA · स्टॉक · प्रेडिक्शन' }, { label: 'एक वॉलेट', value: 'USDT' }, { label: 'मोबाइल के लिए', value: 'डेस्कटॉप केवल प्रीव्यू है' }] },
    { title: ['वास्तविक एसेट,', 'स्पष्ट स्रोत के साथ।'], lede: 'हर प्रोडक्ट निवेश से पहले जारीकर्ता, रिटर्न का स्रोत, फ़ीस, अवधि और निकास बताता है।',
      cards: [{ label: 'एसेट श्रेणियाँ', value: 'AI कंप्यूट · RWA · वैश्विक स्टॉक' }, { label: 'हर प्रोडक्ट में', value: 'जारीकर्ता · रिटर्न स्रोत · फ़ीस · अवधि · निकास' }, { label: 'मूल्य', value: 'USDT' }] },
    { title: ['हेंगश्यू,', 'ज़रूरत के समय के अनुसार।'], lede: '30 दिन के कैश से पाँच साल तक, दस रणनीति कॉन्सेप्ट। यह कॉन्सेप्ट सीरीज़ है: जारी नहीं हुई, सब्सक्रिप्शन के लिए खुली नहीं।',
      cards: [{ label: 'सीरीज़', value: '10 रणनीति कॉन्सेप्ट' }, { label: 'अवधि', value: '30 दिन → 5 साल+' }, { label: 'स्थिति', value: 'कॉन्सेप्ट · जारी नहीं' }] },
    { title: ['पहले साफ़ देखें,', 'फिर तय करें।'], lede: 'एक्सेस नियम, प्रोडक्ट संरचना, फ़ीस, कानूनी दस्तावेज़ और आधिकारिक चैनल, सब ट्रस्ट सेंटर में।',
      cards: [{ label: 'ट्रस्ट सेंटर', value: 'एक्सेस · प्रकटीकरण · कानूनी दस्तावेज़' }, { label: 'आधिकारिक चैनल', value: 'डोमेन और सोशल अकाउंट जाँचें' }, { label: 'कभी नहीं माँगते', value: 'सीड फ़्रेज़, प्राइवेट की या कोड' }] },
    { title: ['एक वॉलेट,', 'जहाँ भी आप जाएँ।'], lede: 'RWA.LAT को होम स्क्रीन पर जोड़ें, यह नेटिव ऐप की तरह फ़ुल स्क्रीन खुलता है, आपकी चुनी भाषा में।',
      cards: [{ label: 'इंस्टॉल', value: 'होम स्क्रीन पर जोड़ें' }, { label: 'भाषाएँ', value: LANGS }, { label: 'अलर्ट', value: 'मार्केट सूचनाएँ, आपकी पसंद' }] },
  ],
  nav: 'अध्याय',
  openOnPhone: 'फ़ोन पर खोलें',
  language: 'भाषा',
  scroll: 'स्क्रॉल करें',
  scanLabel: 'फ़ोन कैमरे से स्कैन करें',
  handoffTitle: ['आपके फ़ोन के लिए बना।', 'वहीं खोलें।'],
  handoffBody: 'RWA.LAT खोलने के लिए फ़ोन कैमरा कोड की ओर करें। डेस्कटॉप साइट केवल प्रीव्यू है।',
  sharedTitle: 'यह पेज अपने फ़ोन पर खोलें',
  sharedBody: 'यह लिंक मोबाइल ऐप के लिए साझा किया गया था। फ़ोन पर जारी रखने के लिए कोड स्कैन करें।',
  phoneLabel: 'RWA.LAT मोबाइल ऐप का लाइव प्रीव्यू',
  preview: 'प्रीव्यू',
}

const es: DesktopCopy = {
  chapters: ['Apertura', 'Activos reales', 'Hengxu', 'Transparencia', 'En todas partes', 'Empezar'],
  scenes: [
    { title: ['Activos del mundo real,', 'en tu bolsillo.'], lede: 'RWA.LAT está hecho para tu móvil. Cómputo de IA, activos reales, acciones globales y mercados de predicción, desde una sola billetera USDT.',
      cards: [{ label: 'Cuatro mercados', value: 'Cómputo IA · RWA · Acciones · Predicciones' }, { label: 'Una billetera', value: 'USDT' }, { label: 'Hecho para móvil', value: 'El escritorio es solo una vista previa' }] },
    { title: ['Activos reales,', 'con origen visible.'], lede: 'Cada producto indica emisor, origen del rendimiento, comisiones, plazo y salida antes de invertir.',
      cards: [{ label: 'Clases de activos', value: 'Cómputo IA · RWA · Acciones globales' }, { label: 'Cada producto indica', value: 'Emisor · Origen · Comisiones · Plazo · Salida' }, { label: 'Precio en', value: 'USDT' }] },
    { title: ['Hengxu,', 'según cuándo lo necesites.'], lede: 'Diez conceptos de estrategia, de efectivo a 30 días a cinco años. Serie conceptual: no emitida ni abierta a suscripción.',
      cards: [{ label: 'Serie', value: '10 conceptos de estrategia' }, { label: 'Plazos', value: '30 días → 5 años+' }, { label: 'Estado', value: 'Concepto · No emitido' }] },
    { title: ['Míralo con claridad,', 'luego decide.'], lede: 'Reglas de acceso, estructura de productos, comisiones, documentos legales y canales oficiales, juntos en el Centro de confianza.',
      cards: [{ label: 'Centro de confianza', value: 'Acceso · Divulgaciones · Documentos legales' }, { label: 'Canales oficiales', value: 'Verifica el dominio y las cuentas sociales' }, { label: 'Nunca pedimos', value: 'Frases semilla, claves privadas ni códigos' }] },
    { title: ['Una billetera,', 'vayas donde vayas.'], lede: 'Añade RWA.LAT a tu pantalla de inicio y se abre a pantalla completa, como una app nativa, en tu idioma.',
      cards: [{ label: 'Instalar', value: 'Añadir a pantalla de inicio' }, { label: 'Idiomas', value: LANGS }, { label: 'Alertas', value: 'Avisos de mercado, a tu elección' }] },
  ],
  nav: 'Capítulos',
  openOnPhone: 'Abrir en el móvil',
  language: 'Idioma',
  scroll: 'Desplázate',
  scanLabel: 'Escanea con la cámara del móvil',
  handoffTitle: ['Hecho para tu móvil.', 'Ábrelo allí.'],
  handoffBody: 'Apunta la cámara del móvil al código para abrir RWA.LAT. La web de escritorio es solo una vista previa.',
  sharedTitle: 'Abre esta página en tu móvil',
  sharedBody: 'Este enlace se compartió para la app móvil. Escanea el código para continuar en tu móvil.',
  phoneLabel: 'Vista previa en vivo de la app móvil de RWA.LAT',
  preview: 'Vista previa',
}

const ar: DesktopCopy = {
  chapters: ['البداية', 'أصول حقيقية', 'هينغشو', 'الشفافية', 'في كل مكان', 'ابدأ'],
  scenes: [
    { title: ['أصول العالم الحقيقي،', 'في جيبك.'], lede: 'صُمّم RWA.LAT لهاتفك. حوسبة الذكاء الاصطناعي والأصول الحقيقية والأسهم العالمية وأسواق التوقعات، من محفظة USDT واحدة.',
      cards: [{ label: 'أربعة أسواق', value: 'حوسبة AI · RWA · أسهم · توقعات' }, { label: 'محفظة واحدة', value: 'USDT' }, { label: 'مصمم للهاتف', value: 'نسخة سطح المكتب للعرض فقط' }] },
    { title: ['أصول حقيقية،', 'بمصدر واضح.'], lede: 'كل منتج يوضح الجهة المصدرة ومصدر العائد والرسوم والمدة وطريقة الخروج قبل الاستثمار.',
      cards: [{ label: 'فئات الأصول', value: 'حوسبة AI · RWA · أسهم عالمية' }, { label: 'كل منتج يوضح', value: 'المُصدر · مصدر العائد · الرسوم · المدة · الخروج' }, { label: 'التسعير', value: 'USDT' }] },
    { title: ['هينغشو،', 'مرتّب حسب وقت حاجتك.'], lede: 'عشرة مفاهيم استراتيجية، من نقد لـ30 يومًا إلى خمس سنوات. سلسلة مفاهيمية: غير مُصدرة وغير متاحة للاكتتاب.',
      cards: [{ label: 'السلسلة', value: '10 مفاهيم استراتيجية' }, { label: 'المدد', value: '30 يومًا ← 5 سنوات+' }, { label: 'الحالة', value: 'مفهوم · غير مُصدر' }] },
    { title: ['انظر بوضوح،', 'ثم قرّر.'], lede: 'قواعد الوصول وهيكل المنتجات والرسوم والوثائق القانونية والقنوات الرسمية، مجتمعة في مركز الثقة.',
      cards: [{ label: 'مركز الثقة', value: 'الوصول · الإفصاحات · الوثائق القانونية' }, { label: 'القنوات الرسمية', value: 'تحقق من النطاق والحسابات الاجتماعية' }, { label: 'لا نطلب أبدًا', value: 'عبارات الاسترداد أو المفاتيح الخاصة أو الرموز' }] },
    { title: ['محفظة واحدة،', 'أينما ذهبت.'], lede: 'أضف RWA.LAT إلى شاشتك الرئيسية ليفتح بملء الشاشة كتطبيق أصلي، باللغة التي تختارها.',
      cards: [{ label: 'التثبيت', value: 'أضف إلى الشاشة الرئيسية' }, { label: 'اللغات', value: LANGS }, { label: 'التنبيهات', value: 'إشعارات السوق، حسب اختيارك' }] },
  ],
  nav: 'الفصول',
  openOnPhone: 'افتح على الهاتف',
  language: 'اللغة',
  scroll: 'مرّر',
  scanLabel: 'امسح بكاميرا الهاتف',
  handoffTitle: ['صُمّم لهاتفك.', 'افتحه هناك.'],
  handoffBody: 'وجّه كاميرا هاتفك إلى الرمز لفتح RWA.LAT. موقع سطح المكتب للعرض فقط.',
  sharedTitle: 'افتح هذه الصفحة على هاتفك',
  sharedBody: 'تمت مشاركة هذا الرابط لتطبيق الهاتف. امسح الرمز للمتابعة على هاتفك.',
  phoneLabel: 'معاينة مباشرة لتطبيق RWA.LAT',
  preview: 'معاينة',
}

const fr: DesktopCopy = {
  chapters: ['Ouverture', 'Actifs réels', 'Hengxu', 'Transparence', 'Partout', 'Commencer'],
  scenes: [
    { title: ['Les actifs du monde réel,', 'dans votre poche.'], lede: 'RWA.LAT est conçu pour votre téléphone. Calcul IA, actifs réels, actions mondiales et marchés de prédiction, depuis un seul portefeuille USDT.',
      cards: [{ label: 'Quatre marchés', value: 'Calcul IA · RWA · Actions · Prédictions' }, { label: 'Un portefeuille', value: 'USDT' }, { label: 'Conçu pour mobile', value: 'Le bureau n’est qu’un aperçu' }] },
    { title: ['Des actifs réels,', 'à la source visible.'], lede: 'Chaque produit indique émetteur, source du rendement, frais, échéance et sortie avant d’investir.',
      cards: [{ label: 'Classes d’actifs', value: 'Calcul IA · RWA · Actions mondiales' }, { label: 'Chaque produit indique', value: 'Émetteur · Source · Frais · Échéance · Sortie' }, { label: 'Prix en', value: 'USDT' }] },
    { title: ['Hengxu,', 'selon le moment où vous en avez besoin.'], lede: 'Dix concepts de stratégie, de la trésorerie à 30 jours aux placements à cinq ans. Série conceptuelle : non émise, non ouverte à la souscription.',
      cards: [{ label: 'Série', value: '10 concepts de stratégie' }, { label: 'Horizons', value: '30 jours → 5 ans+' }, { label: 'Statut', value: 'Concept · Non émis' }] },
    { title: ['Voir clairement,', 'puis décider.'], lede: 'Règles d’accès, structure des produits, frais, documents juridiques et canaux officiels, réunis dans le Centre de confiance.',
      cards: [{ label: 'Centre de confiance', value: 'Accès · Informations · Documents juridiques' }, { label: 'Canaux officiels', value: 'Vérifiez le domaine et les comptes sociaux' }, { label: 'Jamais demandé', value: 'Phrases de récupération, clés privées ou codes' }] },
    { title: ['Un portefeuille,', 'où que vous alliez.'], lede: 'Ajoutez RWA.LAT à l’écran d’accueil : il s’ouvre en plein écran, comme une app native, dans votre langue.',
      cards: [{ label: 'Installer', value: 'Ajouter à l’écran d’accueil' }, { label: 'Langues', value: LANGS }, { label: 'Alertes', value: 'Notifications de marché, à votre choix' }] },
  ],
  nav: 'Chapitres',
  openOnPhone: 'Ouvrir sur mobile',
  language: 'Langue',
  scroll: 'Défiler',
  scanLabel: 'Scannez avec l’appareil photo',
  handoffTitle: ['Conçu pour votre téléphone.', 'Ouvrez-le là-bas.'],
  handoffBody: 'Pointez l’appareil photo de votre téléphone vers le code pour ouvrir RWA.LAT. Le site bureau n’est qu’un aperçu.',
  sharedTitle: 'Ouvrez cette page sur votre téléphone',
  sharedBody: 'Ce lien a été partagé pour l’app mobile. Scannez le code pour continuer sur votre téléphone.',
  phoneLabel: 'Aperçu en direct de l’app mobile RWA.LAT',
  preview: 'Aperçu',
}

const pt: DesktopCopy = {
  chapters: ['Abertura', 'Ativos reais', 'Hengxu', 'Transparência', 'Em qualquer lugar', 'Começar'],
  scenes: [
    { title: ['Ativos do mundo real,', 'no seu bolso.'], lede: 'O RWA.LAT foi feito para o seu celular. Computação de IA, ativos reais, ações globais e mercados de previsão, numa única carteira USDT.',
      cards: [{ label: 'Quatro mercados', value: 'Computação IA · RWA · Ações · Previsões' }, { label: 'Uma carteira', value: 'USDT' }, { label: 'Feito para celular', value: 'O desktop é só uma prévia' }] },
    { title: ['Ativos reais,', 'com origem visível.'], lede: 'Cada produto informa emissor, origem do retorno, taxas, prazo e saída antes de você investir.',
      cards: [{ label: 'Classes de ativos', value: 'Computação IA · RWA · Ações globais' }, { label: 'Cada produto informa', value: 'Emissor · Origem · Taxas · Prazo · Saída' }, { label: 'Preço em', value: 'USDT' }] },
    { title: ['Hengxu,', 'conforme quando você precisa.'], lede: 'Dez conceitos de estratégia, de caixa em 30 dias a cinco anos. Série conceitual: não emitida e não aberta para subscrição.',
      cards: [{ label: 'Série', value: '10 conceitos de estratégia' }, { label: 'Prazos', value: '30 dias → 5 anos+' }, { label: 'Status', value: 'Conceito · Não emitido' }] },
    { title: ['Veja com clareza,', 'depois decida.'], lede: 'Regras de acesso, estrutura dos produtos, taxas, documentos legais e canais oficiais, reunidos na Central de confiança.',
      cards: [{ label: 'Central de confiança', value: 'Acesso · Divulgações · Documentos legais' }, { label: 'Canais oficiais', value: 'Verifique o domínio e as contas sociais' }, { label: 'Nunca pedimos', value: 'Frases-semente, chaves privadas ou códigos' }] },
    { title: ['Uma carteira,', 'aonde você for.'], lede: 'Adicione o RWA.LAT à tela inicial e ele abre em tela cheia, como um app nativo, no seu idioma.',
      cards: [{ label: 'Instalar', value: 'Adicionar à tela inicial' }, { label: 'Idiomas', value: LANGS }, { label: 'Alertas', value: 'Notificações de mercado, você escolhe' }] },
  ],
  nav: 'Capítulos',
  openOnPhone: 'Abrir no celular',
  language: 'Idioma',
  scroll: 'Role',
  scanLabel: 'Escaneie com a câmera do celular',
  handoffTitle: ['Feito para o seu celular.', 'Abra lá.'],
  handoffBody: 'Aponte a câmera do celular para o código para abrir o RWA.LAT. O site para desktop é só uma prévia.',
  sharedTitle: 'Abra esta página no celular',
  sharedBody: 'Este link foi compartilhado para o app móvel. Escaneie o código para continuar no celular.',
  phoneLabel: 'Prévia ao vivo do app móvel RWA.LAT',
  preview: 'Prévia',
}

const copy: Record<AppLocale, DesktopCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }

export function desktopCopy(locale: AppLocale): DesktopCopy {
  return copy[locale] ?? en
}
