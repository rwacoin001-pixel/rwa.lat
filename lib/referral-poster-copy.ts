import type { AppLocale } from './app-locales'

export type PosterCopy = {
  create: string; title: string; platform: string; templates: string; language: string
  save: string; share: string; preparing: string; retry: string; failed: string; saved: string
  saveHint: string; shareHint: string; unavailable: string; close: string; preview: string
  brand: string; purchase: string; fee: string; guide: string
  headline: string; purchaseText: string; feeText: string; brandText: string
  disclaimer: string; scan: string; code: string; level: string; steps: string[]
}
export const posterCopy: Record<AppLocale, PosterCopy> = {
  'zh-CN': {
    create: '生成推荐海报', title: '专属推荐海报', platform: '选择平台', templates: '选择模板', language: '海报语言',
    save: '保存图片', share: '分享图片', preparing: '正在生成', retry: '重新生成', failed: '生成失败，请重试', saved: '图片已准备好',
    saveHint: '无法直接保存时，可长按海报保存。', shareHint: '此浏览器暂不支持图片分享，请保存后发送。', unavailable: '此奖励暂不可用，请选择其他模板。', close: '关闭', preview: '海报预览',
    brand: '好友邀请', purchase: '买入推荐奖励', fee: '手续费推荐奖励', guide: '三步参与',
    headline: '邀请好友，\n分享更多可能。', brandText: '从一次邀请，开启更多可能。',
    purchaseText: '直邀好友完成合格买入，可获其成交金额 {rate} 的推荐奖励。',
    feeText: '直邀好友产生合格平台手续费，可获该手续费 {rate} 的推荐奖励。',
    disclaimer: '推荐奖励比例，非投资收益率。适用交易与奖励条件以活动规则为准。',
    scan: '扫码注册', code: '专属邀请码', level: '级', steps: ['分享你的邀请链接', '好友注册并完成合格交易', '在推荐页查看并领取奖励'],
  },
  en: {
    create: 'Create referral poster', title: 'Your referral poster', platform: 'Platform', templates: 'Choose a template', language: 'Poster language',
    save: 'Save image', share: 'Share image', preparing: 'Creating', retry: 'Try again', failed: 'Unable to create. Please retry.', saved: 'Your image is ready',
    saveHint: 'If saving is unavailable, press and hold the image below to save it.', shareHint: 'Image sharing is unavailable here. Save the image and send it.', unavailable: 'This reward is unavailable. Choose another template.', close: 'Close', preview: 'Poster preview',
    brand: 'Invite friends', purchase: 'Purchase referral reward', fee: 'Fee referral reward', guide: 'Three steps',
    headline: 'Good connections.\nShared possibilities.', brandText: 'Start with an invitation. Share more possibilities.',
    purchaseText: 'Earn {rate} of eligible completed purchases made by friends you invite directly.',
    feeText: 'Earn {rate} of eligible platform fees paid by friends you invite directly.',
    disclaimer: 'Referral reward rates, not investment returns. Eligible transactions and program rules apply.',
    scan: 'Scan to register', code: 'Your invitation code', level: 'Level', steps: ['Share your invitation link', 'Friends register and complete eligible trades', 'View and claim rewards in Referrals'],
  },
  hi: {
    create: 'रेफ़रल पोस्टर बनाएँ', title: 'आपका रेफ़रल पोस्टर', platform: 'प्लेटफ़ॉर्म चुनें', templates: 'टेम्पलेट चुनें', language: 'पोस्टर की भाषा',
    save: 'चित्र सहेजें', share: 'चित्र साझा करें', preparing: 'बन रहा है', retry: 'फिर बनाएँ', failed: 'पोस्टर नहीं बन सका। फिर प्रयास करें।', saved: 'आपका चित्र तैयार है',
    saveHint: 'सीधे सहेजना संभव न हो तो नीचे दिए चित्र को दबाकर रखें।', shareHint: 'यहाँ चित्र साझा करना उपलब्ध नहीं है। चित्र सहेजकर भेजें।', unavailable: 'यह रिवॉर्ड उपलब्ध नहीं है। दूसरा टेम्पलेट चुनें।', close: 'बंद करें', preview: 'पोस्टर पूर्वावलोकन',
    brand: 'दोस्तों को आमंत्रित करें', purchase: 'खरीद पर रेफ़रल रिवॉर्ड', fee: 'शुल्क पर रेफ़रल रिवॉर्ड', guide: 'तीन चरण',
    headline: 'दोस्तों को आमंत्रित करें।\nनई संभावनाएँ साझा करें।', brandText: 'एक निमंत्रण से नई संभावनाएँ साझा करें।',
    purchaseText: 'आपके सीधे आमंत्रित दोस्तों की पात्र और पूरी हो चुकी खरीद के मूल्य पर {rate} रेफ़रल रिवॉर्ड पाएँ।',
    feeText: 'आपके सीधे आमंत्रित दोस्तों द्वारा चुकाए गए पात्र प्लेटफ़ॉर्म शुल्क के {rate} के बराबर रेफ़रल रिवॉर्ड पाएँ।',
    disclaimer: 'ये रेफ़रल रिवॉर्ड की दरें हैं, निवेश रिटर्न नहीं। पात्र लेनदेन और रिवॉर्ड की शर्तें कार्यक्रम के नियमों के अधीन हैं।',
    scan: 'पंजीकरण के लिए स्कैन करें', code: 'आपका निमंत्रण कोड', level: 'स्तर', steps: ['अपना निमंत्रण लिंक साझा करें', 'दोस्त पंजीकरण कर पात्र लेनदेन पूरा करें', 'रेफ़रल पृष्ठ पर रिवॉर्ड देखें और क्लेम करें'],
  },
  es: {
    create: 'Crear imagen de invitación', title: 'Tu imagen de invitación', platform: 'Plataforma', templates: 'Elige una plantilla', language: 'Idioma de la imagen',
    save: 'Guardar imagen', share: 'Compartir imagen', preparing: 'Creando', retry: 'Reintentar', failed: 'No se pudo crear. Inténtalo de nuevo.', saved: 'Tu imagen está lista',
    saveHint: 'Si no puedes guardarla, mantén pulsada la imagen de abajo.', shareHint: 'Aquí no se pueden compartir imágenes. Guárdala y envíala.', unavailable: 'Esta recompensa no está disponible. Elige otra plantilla.', close: 'Cerrar', preview: 'Vista previa',
    brand: 'Invita a tus amigos', purchase: 'Recompensa por compras', fee: 'Recompensa por comisiones', guide: 'Tres pasos',
    headline: 'Invita a tus amigos.\nComparte posibilidades.', brandText: 'Una invitación para compartir nuevas posibilidades.',
    purchaseText: 'Recibe el {rate} del importe de las compras elegibles completadas por tus invitados directos.',
    feeText: 'Recibe el {rate} de las comisiones elegibles de la plataforma pagadas por tus invitados directos.',
    disclaimer: 'Son recompensas por recomendación, no rentabilidad de inversión. Se aplican las operaciones elegibles y las reglas del programa.',
    scan: 'Escanea para registrarte', code: 'Tu código de invitación', level: 'Nivel', steps: ['Comparte tu enlace de invitación', 'Tus amigos se registran y completan operaciones elegibles', 'Consulta y solicita tus recompensas en Referidos'],
  },
  ar: {
    create: 'إنشاء ملصق دعوة', title: 'ملصق الدعوة الخاص بك', platform: 'اختر المنصة', templates: 'اختر القالب', language: 'لغة الملصق',
    save: 'حفظ الصورة', share: 'مشاركة الصورة', preparing: 'جارٍ الإنشاء', retry: 'حاول مجدداً', failed: 'تعذّر الإنشاء. حاول مجدداً.', saved: 'الصورة جاهزة',
    saveHint: 'إذا تعذّر الحفظ المباشر، اضغط مطولاً على الصورة أدناه لحفظها.', shareHint: 'مشاركة الصور غير متاحة هنا. احفظ الصورة ثم أرسلها.', unavailable: 'هذه المكافأة غير متاحة. اختر قالباً آخر.', close: 'إغلاق', preview: 'معاينة الملصق',
    brand: 'ادعُ أصدقاءك', purchase: 'مكافأة إحالة المشتريات', fee: 'مكافأة إحالة الرسوم', guide: 'ثلاث خطوات',
    headline: 'ادعُ أصدقاءك.\nوشاركهم مزيداً من الإمكانات.', brandText: 'تبدأ إمكانات جديدة بدعوة واحدة.',
    purchaseText: 'احصل على مكافأة إحالة بنسبة {rate} من قيمة المشتريات المؤهلة المكتملة للأصدقاء الذين تدعوهم مباشرة.',
    feeText: 'احصل على مكافأة إحالة تعادل {rate} من رسوم المنصة المؤهلة التي يدفعها الأصدقاء الذين تدعوهم مباشرة.',
    disclaimer: 'هذه نسب مكافآت إحالة وليست عوائد استثمارية. تخضع المعاملات المؤهلة وشروط المكافآت لقواعد البرنامج.',
    scan: 'امسح للتسجيل', code: 'رمز دعوتك الخاص', level: 'المستوى', steps: ['شارك رابط دعوتك', 'يسجّل الأصدقاء ويكملون معاملات مؤهلة', 'اعرض المكافآت وطالب بها في صفحة الإحالات'],
  },
  fr: {
    create: 'Créer une affiche de parrainage', title: 'Votre affiche de parrainage', platform: 'Plateforme', templates: 'Choisir un modèle', language: 'Langue de l’affiche',
    save: 'Enregistrer', share: 'Partager l’image', preparing: 'Création', retry: 'Réessayer', failed: 'Création impossible. Réessayez.', saved: 'Votre image est prête',
    saveHint: 'Si l’enregistrement est indisponible, appuyez longuement sur l’image ci-dessous.', shareHint: 'Le partage d’images est indisponible ici. Enregistrez puis envoyez l’image.', unavailable: 'Cette récompense est indisponible. Choisissez un autre modèle.', close: 'Fermer', preview: 'Aperçu de l’affiche',
    brand: 'Invitez vos proches', purchase: 'Récompense sur les achats', fee: 'Récompense sur les frais', guide: 'Trois étapes',
    headline: 'Invitez vos proches.\nPartagez les possibilités.', brandText: 'De nouvelles possibilités commencent par une invitation.',
    purchaseText: 'Recevez {rate} du montant des achats éligibles finalisés par vos filleuls directs.',
    feeText: 'Recevez {rate} des frais éligibles de la plateforme payés par vos filleuls directs.',
    disclaimer: 'Taux de récompense de parrainage, et non rendements d’investissement. Les transactions éligibles et les règles du programme s’appliquent.',
    scan: 'Scannez pour vous inscrire', code: 'Votre code d’invitation', level: 'Niveau', steps: ['Partagez votre lien d’invitation', 'Vos proches s’inscrivent et réalisent des opérations éligibles', 'Consultez et réclamez les récompenses dans Parrainage'],
  },
  pt: {
    create: 'Criar imagem de indicação', title: 'Sua imagem de indicação', platform: 'Plataforma', templates: 'Escolha um modelo', language: 'Idioma da imagem',
    save: 'Salvar imagem', share: 'Compartilhar', preparing: 'Criando', retry: 'Tentar novamente', failed: 'Não foi possível criar. Tente novamente.', saved: 'Sua imagem está pronta',
    saveHint: 'Se não for possível salvar, mantenha pressionada a imagem abaixo.', shareHint: 'O compartilhamento de imagens não está disponível aqui. Salve e envie a imagem.', unavailable: 'Esta recompensa não está disponível. Escolha outro modelo.', close: 'Fechar', preview: 'Prévia da imagem',
    brand: 'Convide amigos', purchase: 'Recompensa por compras', fee: 'Recompensa por taxas', guide: 'Três etapas',
    headline: 'Convide amigos.\nCompartilhe possibilidades.', brandText: 'Novas possibilidades começam com um convite.',
    purchaseText: 'Receba {rate} do valor das compras elegíveis concluídas pelos amigos que você convidar diretamente.',
    feeText: 'Receba {rate} das taxas elegíveis da plataforma pagas pelos amigos que você convidar diretamente.',
    disclaimer: 'Percentuais de recompensas por indicação, não rentabilidade de investimentos. Aplicam-se as transações elegíveis e as regras do programa.',
    scan: 'Escaneie para se cadastrar', code: 'Seu código de convite', level: 'Nível', steps: ['Compartilhe seu link de convite', 'Amigos se cadastram e concluem transações elegíveis', 'Veja e solicite recompensas na página de indicações'],
  },
}
