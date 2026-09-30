import type { AppLocale } from '@/lib/app-locales'

/**
 * Copy for the content area: learning center and AI goals / plans (batch F2).
 * `{x}` tokens go through fill() from maison-market-copy. Every string is factual:
 * no promised returns, no claim that an order was placed.
 */
export type LearnCopy = {
  kicker: string; title: string; lede: string; count: string
  empty: string; emptyBody: string; failed: string; retry: string
  missing: string; missingBody: string; back: string; by: string; revision: string; minutes: string
  otherLocale: string
}

export type PlanCopy = {
  titleGoals: string; titlePlan: string; kicker: string; lede: string
  sGoals: string; sGoalsNote: string; sHistory: string; sHistoryNote: string
  name: string; budget: string; horizon: string; months: string; risk: string; riskNote: string; notes: string; notesHint: string
  riskLevels: Record<'low' | 'medium' | 'high', string>
  save: string; saving: string; saved: string; generate: string; generating: string
  unsaved: string; needSave: string; conflict: string; reload: string
  errName: string; errBudget: string; errHorizon: string
  provider: string
  historyEmpty: string; state: Record<'generating' | 'ready' | 'failed', string>
  loadFailed: string; retry: string; signIn: string
  goalLine: string
  genTitle: string; genBody: string; failTitle: string; failBody: string; regenerate: string
  sExplain: string; sAlloc: string; sAllocNote: string; cash: string; unknownProduct: string
  ack: string; review: string; manage: string; notAdvice: string; model: string
  notFound: string; notFoundBody: string
}

const learn: Record<AppLocale, LearnCopy> = {
  en: { kicker: 'Knowledge', title: 'Learning center', lede: 'Published product education, risk explanations and guides.', count: '{n} articles', empty: 'No articles published yet', emptyBody: 'Articles appear here once the operations team publishes them in this language.', failed: 'Articles could not be loaded', retry: 'Retry', missing: 'This article is not available', missingBody: 'It is not published in the selected language, or it has been withdrawn.', back: 'All articles', by: 'By {v}', revision: 'Revision {v}', minutes: '{n} min read', otherLocale: 'Switching language shows only articles published in that language.' },
  'zh-CN': { kicker: '知识', title: '学习中心', lede: '已发布的产品知识、风险说明与操作指南。', count: '{n} 篇文章', empty: '暂无已发布文章', emptyBody: '运营团队以当前语言发布后，文章会显示在这里。', failed: '文章加载失败', retry: '重试', missing: '这篇文章不可用', missingBody: '当前语言尚未发布，或已下架。', back: '全部文章', by: '作者 {v}', revision: '第 {v} 版', minutes: '约 {n} 分钟', otherLocale: '切换语言后只显示该语言已发布的文章。' },
  hi: { kicker: 'ज्ञान', title: 'लर्निंग सेंटर', lede: 'प्रकाशित उत्पाद शिक्षा, जोखिम विवरण और गाइड।', count: '{n} लेख', empty: 'अभी कोई लेख प्रकाशित नहीं', emptyBody: 'ऑपरेशंस टीम इस भाषा में प्रकाशित करने के बाद लेख यहाँ दिखेंगे।', failed: 'लेख लोड नहीं हो सके', retry: 'फिर प्रयास करें', missing: 'यह लेख उपलब्ध नहीं है', missingBody: 'यह चुनी गई भाषा में प्रकाशित नहीं है या हटा दिया गया है।', back: 'सभी लेख', by: 'लेखक {v}', revision: 'संस्करण {v}', minutes: '{n} मिनट पढ़ें', otherLocale: 'भाषा बदलने पर केवल उसी भाषा में प्रकाशित लेख दिखते हैं।' },
  es: { kicker: 'Conocimiento', title: 'Centro de aprendizaje', lede: 'Formación sobre productos, riesgos y guías publicadas.', count: '{n} artículos', empty: 'Aún no hay artículos publicados', emptyBody: 'Los artículos aparecerán cuando el equipo los publique en este idioma.', failed: 'No se pudieron cargar los artículos', retry: 'Reintentar', missing: 'Este artículo no está disponible', missingBody: 'No está publicado en el idioma seleccionado o se ha retirado.', back: 'Todos los artículos', by: 'Por {v}', revision: 'Revisión {v}', minutes: '{n} min de lectura', otherLocale: 'Al cambiar de idioma solo se muestran los artículos publicados en ese idioma.' },
  ar: { kicker: 'المعرفة', title: 'مركز التعلّم', lede: 'محتوى تعليمي منشور عن المنتجات والمخاطر وأدلة الاستخدام.', count: '{n} مقالات', empty: 'لا توجد مقالات منشورة بعد', emptyBody: 'ستظهر المقالات هنا بعد أن ينشرها فريق العمليات بهذه اللغة.', failed: 'تعذر تحميل المقالات', retry: 'إعادة المحاولة', missing: 'هذه المقالة غير متاحة', missingBody: 'لم تُنشر باللغة المحددة أو تم سحبها.', back: 'كل المقالات', by: 'بقلم {v}', revision: 'المراجعة {v}', minutes: 'قراءة {n} د', otherLocale: 'عند تغيير اللغة تظهر فقط المقالات المنشورة بتلك اللغة.' },
  fr: { kicker: 'Savoir', title: 'Centre d’apprentissage', lede: 'Contenus publiés sur les produits, les risques et les guides.', count: '{n} articles', empty: 'Aucun article publié', emptyBody: 'Les articles apparaîtront une fois publiés dans cette langue par l’équipe.', failed: 'Impossible de charger les articles', retry: 'Réessayer', missing: 'Cet article n’est pas disponible', missingBody: 'Il n’est pas publié dans la langue choisie ou a été retiré.', back: 'Tous les articles', by: 'Par {v}', revision: 'Révision {v}', minutes: '{n} min de lecture', otherLocale: 'En changeant de langue, seuls les articles publiés dans cette langue s’affichent.' },
  pt: { kicker: 'Conhecimento', title: 'Central de aprendizado', lede: 'Conteúdo publicado sobre produtos, riscos e guias.', count: '{n} artigos', empty: 'Nenhum artigo publicado', emptyBody: 'Os artigos aparecerão depois que a equipe os publicar neste idioma.', failed: 'Não foi possível carregar os artigos', retry: 'Tentar novamente', missing: 'Este artigo não está disponível', missingBody: 'Não está publicado no idioma selecionado ou foi retirado.', back: 'Todos os artigos', by: 'Por {v}', revision: 'Revisão {v}', minutes: '{n} min de leitura', otherLocale: 'Ao trocar de idioma, só aparecem os artigos publicados nesse idioma.' },
}

const plan: Record<AppLocale, PlanCopy> = {
  en: {
    titleGoals: 'Goals and plans', titlePlan: 'AI suggestion', kicker: 'AI planning',
    lede: 'Suggestions use published products only. Nothing is ordered and no balance is used; each investment is reviewed and confirmed separately.',
    sGoals: 'Your goals', sGoalsNote: 'Saved to your account', sHistory: 'Previous suggestions', sHistoryNote: 'Stored on the server',
    name: 'Goal name', budget: 'Planned budget', horizon: 'Horizon', months: 'months', risk: 'Risk preference', riskNote: 'Not a suitability assessment', notes: 'Additional goals', notesHint: 'Do not enter identity documents, keys or passwords.',
    riskLevels: { low: 'Low', medium: 'Medium', high: 'High' },
    save: 'Save goals', saving: 'Saving…', saved: 'Goals saved. Review them before generating a suggestion.', generate: 'Generate AI suggestion', generating: 'Generating…',
    unsaved: 'Unsaved changes', needSave: 'Save your changes before generating a suggestion.', conflict: 'Your goals were changed elsewhere. Reload to see the latest version before saving.', reload: 'Reload',
    errName: 'Enter a goal name.', errBudget: 'Enter a positive amount with up to 6 decimals.', errHorizon: 'Enter 1 to 600 months.',
    provider: 'Generating sends these goals and published product facts to the configured AI provider. Returns are not guaranteed and suggestions do not replace formal checks.',
    historyEmpty: 'No saved suggestions yet', state: { generating: 'Generating', ready: 'Ready', failed: 'Failed' },
    loadFailed: 'This could not be loaded', retry: 'Retry', signIn: 'Sign in',
    goalLine: '{title} · {budget} USDT · {months} months',
    genTitle: 'Generating the suggestion', genBody: 'This page refreshes on its own. Repeating the request does not create a second plan.', failTitle: 'This suggestion did not complete', failBody: 'No investment was submitted. You can generate a new suggestion from your goals.', regenerate: 'Back to goals',
    sExplain: 'Reasoning', sAlloc: 'Suggested allocation', sAllocNote: 'Cash included · totals 100%', cash: 'Cash reserve', unknownProduct: 'Product no longer listed',
    ack: 'I understand this is a suggestion. Product disclosures and eligibility checks still apply.', review: 'Review product', manage: 'Manage goals', notAdvice: 'Educational suggestion, not investment advice. No order was placed.', model: 'Model {v}',
    notFound: 'Suggestion not found', notFoundBody: 'It may belong to another account or no longer exist.',
  },
  'zh-CN': {
    titleGoals: '目标与计划', titlePlan: 'AI 配置建议', kicker: 'AI 规划',
    lede: '建议只使用已发布的产品。不会自动下单，也不会动用余额；每项投资都要单独查看并确认。',
    sGoals: '我的目标', sGoalsNote: '保存在账户中', sHistory: '历史建议', sHistoryNote: '保存在服务器',
    name: '目标名称', budget: '计划预算', horizon: '期限', months: '个月', risk: '风险偏好', riskNote: '不代替正式适当性评估', notes: '补充目标', notesHint: '请勿填写证件、密钥或密码。',
    riskLevels: { low: '低', medium: '中', high: '高' },
    save: '保存目标', saving: '保存中…', saved: '目标已保存。生成建议前请再确认一遍。', generate: '依据目标生成 AI 建议', generating: '生成中…',
    unsaved: '有未保存的修改', needSave: '请先保存修改，再生成建议。', conflict: '目标已在其他地方修改。请重新加载查看最新版本后再保存。', reload: '重新加载',
    errName: '请填写目标名称。', errBudget: '请输入大于 0 的金额，最多 6 位小数。', errHorizon: '请输入 1 到 600 个月。',
    provider: '生成时，上述目标和已发布产品资料会发送给已配置的 AI 服务商。收益不保证，建议不代替正式核验。',
    historyEmpty: '暂无已保存的建议', state: { generating: '生成中', ready: '已完成', failed: '失败' },
    loadFailed: '加载失败', retry: '重试', signIn: '登录',
    goalLine: '{title} · {budget} USDT · {months} 个月',
    genTitle: '建议正在生成', genBody: '页面会自动刷新；重复请求不会生成第二份。', failTitle: '本次建议未完成', failBody: '没有提交任何投资。可以回到目标页重新生成。', regenerate: '返回目标',
    sExplain: '理由说明', sAlloc: '建议配置', sAllocNote: '含现金 · 合计 100%', cash: '保留现金', unknownProduct: '产品已不在目录中',
    ack: '我理解这是建议，投资风险与资格以正式产品资料及核验为准。', review: '查看产品', manage: '管理目标', notAdvice: '仅为参考建议，不构成投资建议。未提交任何订单。', model: '模型 {v}',
    notFound: '找不到这份建议', notFoundBody: '它可能属于其他账户，或已不存在。',
  },
  hi: {
    titleGoals: 'लक्ष्य और योजनाएँ', titlePlan: 'AI सुझाव', kicker: 'AI योजना',
    lede: 'सुझाव केवल प्रकाशित उत्पादों का उपयोग करते हैं। कोई ऑर्डर नहीं होता और बैलेंस उपयोग नहीं होता; हर निवेश अलग से देखा और पुष्टि किया जाता है।',
    sGoals: 'आपके लक्ष्य', sGoalsNote: 'आपके खाते में सहेजा गया', sHistory: 'पिछले सुझाव', sHistoryNote: 'सर्वर पर सहेजे गए',
    name: 'लक्ष्य का नाम', budget: 'नियोजित बजट', horizon: 'अवधि', months: 'महीने', risk: 'जोखिम पसंद', riskNote: 'उपयुक्तता आकलन नहीं', notes: 'अतिरिक्त लक्ष्य', notesHint: 'पहचान दस्तावेज़, कुंजियाँ या पासवर्ड न डालें।',
    riskLevels: { low: 'कम', medium: 'मध्यम', high: 'उच्च' },
    save: 'लक्ष्य सहेजें', saving: 'सहेजा जा रहा है…', saved: 'लक्ष्य सहेजे गए। सुझाव बनाने से पहले उनकी समीक्षा करें।', generate: 'AI सुझाव बनाएँ', generating: 'बनाया जा रहा है…',
    unsaved: 'बिना सहेजे बदलाव', needSave: 'सुझाव बनाने से पहले बदलाव सहेजें।', conflict: 'आपके लक्ष्य कहीं और बदले गए। सहेजने से पहले नवीनतम संस्करण देखने के लिए फिर लोड करें।', reload: 'फिर लोड करें',
    errName: 'लक्ष्य का नाम दर्ज करें।', errBudget: '6 दशमलव तक धनात्मक राशि दर्ज करें।', errHorizon: '1 से 600 महीने दर्ज करें।',
    provider: 'सुझाव बनाने पर ये लक्ष्य और प्रकाशित उत्पाद तथ्य कॉन्फ़िगर किए गए AI प्रदाता को भेजे जाते हैं। रिटर्न की गारंटी नहीं है।',
    historyEmpty: 'अभी कोई सहेजा सुझाव नहीं', state: { generating: 'बन रहा है', ready: 'तैयार', failed: 'विफल' },
    loadFailed: 'लोड नहीं हो सका', retry: 'फिर प्रयास करें', signIn: 'लॉग इन करें',
    goalLine: '{title} · {budget} USDT · {months} महीने',
    genTitle: 'सुझाव बनाया जा रहा है', genBody: 'यह पेज अपने आप रीफ़्रेश होता है। अनुरोध दोहराने से दूसरी योजना नहीं बनती।', failTitle: 'यह सुझाव पूरा नहीं हुआ', failBody: 'कोई निवेश जमा नहीं हुआ। आप अपने लक्ष्यों से नया सुझाव बना सकते हैं।', regenerate: 'लक्ष्यों पर वापस',
    sExplain: 'तर्क', sAlloc: 'सुझाया आवंटन', sAllocNote: 'नकद सहित · कुल 100%', cash: 'नकद आरक्षित', unknownProduct: 'उत्पाद अब सूचीबद्ध नहीं',
    ack: 'मैं समझता/समझती हूँ कि यह सुझाव है। उत्पाद प्रकटीकरण और पात्रता जाँच लागू रहती हैं।', review: 'उत्पाद देखें', manage: 'लक्ष्य प्रबंधित करें', notAdvice: 'शैक्षिक सुझाव, निवेश सलाह नहीं। कोई ऑर्डर नहीं दिया गया।', model: 'मॉडल {v}',
    notFound: 'सुझाव नहीं मिला', notFoundBody: 'यह किसी अन्य खाते का हो सकता है या अब मौजूद नहीं है।',
  },
  es: {
    titleGoals: 'Objetivos y planes', titlePlan: 'Sugerencia de IA', kicker: 'Planificación IA',
    lede: 'Las sugerencias usan solo productos publicados. No se crea ninguna orden ni se usa saldo; cada inversión se revisa y confirma por separado.',
    sGoals: 'Tus objetivos', sGoalsNote: 'Guardados en tu cuenta', sHistory: 'Sugerencias anteriores', sHistoryNote: 'Guardadas en el servidor',
    name: 'Nombre del objetivo', budget: 'Presupuesto previsto', horizon: 'Horizonte', months: 'meses', risk: 'Preferencia de riesgo', riskNote: 'No es una evaluación de idoneidad', notes: 'Objetivos adicionales', notesHint: 'No introduzcas documentos de identidad, claves ni contraseñas.',
    riskLevels: { low: 'Bajo', medium: 'Medio', high: 'Alto' },
    save: 'Guardar objetivos', saving: 'Guardando…', saved: 'Objetivos guardados. Revísalos antes de generar una sugerencia.', generate: 'Generar sugerencia de IA', generating: 'Generando…',
    unsaved: 'Cambios sin guardar', needSave: 'Guarda los cambios antes de generar una sugerencia.', conflict: 'Tus objetivos cambiaron en otro lugar. Recarga para ver la última versión antes de guardar.', reload: 'Recargar',
    errName: 'Introduce un nombre.', errBudget: 'Introduce un importe positivo con hasta 6 decimales.', errHorizon: 'Introduce de 1 a 600 meses.',
    provider: 'Al generar, estos objetivos y los datos de productos publicados se envían al proveedor de IA configurado. La rentabilidad no está garantizada.',
    historyEmpty: 'Aún no hay sugerencias guardadas', state: { generating: 'Generando', ready: 'Lista', failed: 'Fallida' },
    loadFailed: 'No se pudo cargar', retry: 'Reintentar', signIn: 'Iniciar sesión',
    goalLine: '{title} · {budget} USDT · {months} meses',
    genTitle: 'Generando la sugerencia', genBody: 'La página se actualiza sola. Repetir la solicitud no crea otro plan.', failTitle: 'La sugerencia no se completó', failBody: 'No se envió ninguna inversión. Puedes generar una nueva desde tus objetivos.', regenerate: 'Volver a objetivos',
    sExplain: 'Razonamiento', sAlloc: 'Asignación sugerida', sAllocNote: 'Incluye efectivo · suma 100%', cash: 'Reserva de efectivo', unknownProduct: 'Producto ya no listado',
    ack: 'Entiendo que es una sugerencia. Se aplican las divulgaciones y los controles de elegibilidad.', review: 'Ver producto', manage: 'Gestionar objetivos', notAdvice: 'Sugerencia educativa, no asesoramiento. No se creó ninguna orden.', model: 'Modelo {v}',
    notFound: 'Sugerencia no encontrada', notFoundBody: 'Puede pertenecer a otra cuenta o ya no existir.',
  },
  ar: {
    titleGoals: 'الأهداف والخطط', titlePlan: 'اقتراح الذكاء الاصطناعي', kicker: 'تخطيط بالذكاء الاصطناعي',
    lede: 'تستخدم الاقتراحات المنتجات المنشورة فقط. لا يُنشأ أي أمر ولا يُستخدم الرصيد؛ تُراجع كل استثمار وتؤكده على حدة.',
    sGoals: 'أهدافك', sGoalsNote: 'محفوظة في حسابك', sHistory: 'اقتراحات سابقة', sHistoryNote: 'محفوظة على الخادم',
    name: 'اسم الهدف', budget: 'الميزانية المخططة', horizon: 'المدة', months: 'أشهر', risk: 'تفضيل المخاطر', riskNote: 'ليس تقييمًا للملاءمة', notes: 'أهداف إضافية', notesHint: 'لا تُدخل وثائق هوية أو مفاتيح أو كلمات مرور.',
    riskLevels: { low: 'منخفض', medium: 'متوسط', high: 'مرتفع' },
    save: 'حفظ الأهداف', saving: 'جارٍ الحفظ…', saved: 'تم حفظ الأهداف. راجعها قبل إنشاء اقتراح.', generate: 'إنشاء اقتراح', generating: 'جارٍ الإنشاء…',
    unsaved: 'تغييرات غير محفوظة', needSave: 'احفظ التغييرات قبل إنشاء اقتراح.', conflict: 'تغيّرت أهدافك في مكان آخر. أعد التحميل لرؤية أحدث نسخة قبل الحفظ.', reload: 'إعادة التحميل',
    errName: 'أدخل اسم الهدف.', errBudget: 'أدخل مبلغًا موجبًا بحد أقصى 6 منازل عشرية.', errHorizon: 'أدخل من 1 إلى 600 شهر.',
    provider: 'عند الإنشاء تُرسل هذه الأهداف وبيانات المنتجات المنشورة إلى مزود الذكاء الاصطناعي المُعد. العوائد غير مضمونة.',
    historyEmpty: 'لا توجد اقتراحات محفوظة بعد', state: { generating: 'قيد الإنشاء', ready: 'جاهز', failed: 'فشل' },
    loadFailed: 'تعذر التحميل', retry: 'إعادة المحاولة', signIn: 'تسجيل الدخول',
    goalLine: '{title} · {budget} USDT · {months} أشهر',
    genTitle: 'جارٍ إنشاء الاقتراح', genBody: 'تتحدث الصفحة تلقائيًا. تكرار الطلب لا ينشئ خطة ثانية.', failTitle: 'لم يكتمل هذا الاقتراح', failBody: 'لم يُرسل أي استثمار. يمكنك إنشاء اقتراح جديد من أهدافك.', regenerate: 'العودة إلى الأهداف',
    sExplain: 'التعليل', sAlloc: 'التوزيع المقترح', sAllocNote: 'يشمل النقد · المجموع 100%', cash: 'احتياطي نقدي', unknownProduct: 'المنتج لم يعد مدرجًا',
    ack: 'أفهم أن هذا اقتراح. تظل إفصاحات المنتج وفحوص الأهلية سارية.', review: 'عرض المنتج', manage: 'إدارة الأهداف', notAdvice: 'اقتراح تعليمي وليس نصيحة استثمارية. لم يُنشأ أي أمر.', model: 'النموذج {v}',
    notFound: 'الاقتراح غير موجود', notFoundBody: 'قد يكون تابعًا لحساب آخر أو لم يعد موجودًا.',
  },
  fr: {
    titleGoals: 'Objectifs et plans', titlePlan: 'Suggestion IA', kicker: 'Planification IA',
    lede: 'Les suggestions n’utilisent que des produits publiés. Aucun ordre n’est passé et aucun solde n’est utilisé ; chaque investissement est examiné et confirmé séparément.',
    sGoals: 'Vos objectifs', sGoalsNote: 'Enregistrés sur votre compte', sHistory: 'Suggestions précédentes', sHistoryNote: 'Enregistrées sur le serveur',
    name: 'Nom de l’objectif', budget: 'Budget prévu', horizon: 'Horizon', months: 'mois', risk: 'Préférence de risque', riskNote: 'Pas une évaluation d’adéquation', notes: 'Objectifs complémentaires', notesHint: 'N’indiquez ni pièce d’identité, ni clé, ni mot de passe.',
    riskLevels: { low: 'Faible', medium: 'Moyen', high: 'Élevé' },
    save: 'Enregistrer', saving: 'Enregistrement…', saved: 'Objectifs enregistrés. Relisez-les avant de générer une suggestion.', generate: 'Générer une suggestion IA', generating: 'Génération…',
    unsaved: 'Modifications non enregistrées', needSave: 'Enregistrez vos modifications avant de générer une suggestion.', conflict: 'Vos objectifs ont changé ailleurs. Rechargez pour voir la dernière version avant d’enregistrer.', reload: 'Recharger',
    errName: 'Indiquez un nom.', errBudget: 'Indiquez un montant positif, 6 décimales au plus.', errHorizon: 'Indiquez de 1 à 600 mois.',
    provider: 'La génération envoie ces objectifs et les données des produits publiés au fournisseur d’IA configuré. Les rendements ne sont pas garantis.',
    historyEmpty: 'Aucune suggestion enregistrée', state: { generating: 'En cours', ready: 'Prête', failed: 'Échec' },
    loadFailed: 'Chargement impossible', retry: 'Réessayer', signIn: 'Se connecter',
    goalLine: '{title} · {budget} USDT · {months} mois',
    genTitle: 'Génération de la suggestion', genBody: 'La page se met à jour seule. Répéter la demande ne crée pas de second plan.', failTitle: 'La suggestion n’a pas abouti', failBody: 'Aucun investissement n’a été soumis. Vous pouvez en générer une nouvelle depuis vos objectifs.', regenerate: 'Retour aux objectifs',
    sExplain: 'Justification', sAlloc: 'Répartition suggérée', sAllocNote: 'Liquidités incluses · total 100 %', cash: 'Réserve de liquidités', unknownProduct: 'Produit retiré du catalogue',
    ack: 'Je comprends qu’il s’agit d’une suggestion. Les documents produit et contrôles d’éligibilité s’appliquent.', review: 'Voir le produit', manage: 'Gérer les objectifs', notAdvice: 'Suggestion pédagogique, pas un conseil. Aucun ordre passé.', model: 'Modèle {v}',
    notFound: 'Suggestion introuvable', notFoundBody: 'Elle appartient peut-être à un autre compte ou n’existe plus.',
  },
  pt: {
    titleGoals: 'Objetivos e planos', titlePlan: 'Sugestão de IA', kicker: 'Planejamento IA',
    lede: 'As sugestões usam apenas produtos publicados. Nenhuma ordem é criada e nenhum saldo é usado; cada investimento é revisado e confirmado separadamente.',
    sGoals: 'Seus objetivos', sGoalsNote: 'Salvos na sua conta', sHistory: 'Sugestões anteriores', sHistoryNote: 'Salvas no servidor',
    name: 'Nome do objetivo', budget: 'Orçamento previsto', horizon: 'Horizonte', months: 'meses', risk: 'Preferência de risco', riskNote: 'Não é avaliação de adequação', notes: 'Objetivos adicionais', notesHint: 'Não informe documentos, chaves ou senhas.',
    riskLevels: { low: 'Baixo', medium: 'Médio', high: 'Alto' },
    save: 'Salvar objetivos', saving: 'Salvando…', saved: 'Objetivos salvos. Revise antes de gerar uma sugestão.', generate: 'Gerar sugestão de IA', generating: 'Gerando…',
    unsaved: 'Alterações não salvas', needSave: 'Salve as alterações antes de gerar uma sugestão.', conflict: 'Seus objetivos mudaram em outro lugar. Recarregue para ver a versão mais recente antes de salvar.', reload: 'Recarregar',
    errName: 'Informe um nome.', errBudget: 'Informe um valor positivo com até 6 casas decimais.', errHorizon: 'Informe de 1 a 600 meses.',
    provider: 'Ao gerar, estes objetivos e os dados dos produtos publicados são enviados ao provedor de IA configurado. Retornos não são garantidos.',
    historyEmpty: 'Nenhuma sugestão salva', state: { generating: 'Gerando', ready: 'Pronta', failed: 'Falhou' },
    loadFailed: 'Não foi possível carregar', retry: 'Tentar novamente', signIn: 'Entrar',
    goalLine: '{title} · {budget} USDT · {months} meses',
    genTitle: 'Gerando a sugestão', genBody: 'A página atualiza sozinha. Repetir o pedido não cria outro plano.', failTitle: 'A sugestão não foi concluída', failBody: 'Nenhum investimento foi enviado. Você pode gerar uma nova a partir dos objetivos.', regenerate: 'Voltar aos objetivos',
    sExplain: 'Justificativa', sAlloc: 'Alocação sugerida', sAllocNote: 'Inclui caixa · total 100%', cash: 'Reserva em caixa', unknownProduct: 'Produto não listado',
    ack: 'Entendo que é uma sugestão. Divulgações e verificações de elegibilidade continuam valendo.', review: 'Ver produto', manage: 'Gerenciar objetivos', notAdvice: 'Sugestão educativa, não recomendação. Nenhuma ordem foi criada.', model: 'Modelo {v}',
    notFound: 'Sugestão não encontrada', notFoundBody: 'Pode pertencer a outra conta ou não existir mais.',
  },
}

export const learnCopy = learn
export const planCopy = plan

/** Status-mapped errors so server English / base-layer Chinese never leaks into other locales. */
export type ContentErrors = { network: string; aiOff: string; noProducts: string; generic: string; busyAi: string }
export const contentErrors: Record<AppLocale, ContentErrors> = {
  en: { network: 'Network unavailable. Check your connection and try again.', aiOff: 'The AI service is not available right now. Your goals are saved.', noProducts: 'No published products are available for a suggestion yet.', generic: 'The request could not be completed. Try again.', busyAi: 'The AI service is busy. Try again in a moment.' },
  'zh-CN': { network: '网络不可用，请检查连接后重试。', aiOff: 'AI 服务暂不可用，目标已保存。', noProducts: '目前没有可用于建议的已发布产品。', generic: '请求未完成，请重试。', busyAi: 'AI 服务繁忙，请稍后重试。' },
  hi: { network: 'नेटवर्क उपलब्ध नहीं। कनेक्शन जाँचकर फिर प्रयास करें।', aiOff: 'AI सेवा अभी उपलब्ध नहीं है। आपके लक्ष्य सहेजे गए हैं।', noProducts: 'सुझाव के लिए अभी कोई प्रकाशित उत्पाद उपलब्ध नहीं है।', generic: 'अनुरोध पूरा नहीं हो सका। फिर प्रयास करें।', busyAi: 'AI सेवा व्यस्त है। थोड़ी देर बाद प्रयास करें।' },
  es: { network: 'Sin conexión. Comprueba la red e inténtalo de nuevo.', aiOff: 'El servicio de IA no está disponible. Tus objetivos están guardados.', noProducts: 'Aún no hay productos publicados para una sugerencia.', generic: 'No se pudo completar la solicitud. Inténtalo de nuevo.', busyAi: 'El servicio de IA está ocupado. Inténtalo en un momento.' },
  ar: { network: 'الشبكة غير متاحة. تحقق من الاتصال وحاول مجددًا.', aiOff: 'خدمة الذكاء الاصطناعي غير متاحة الآن. أهدافك محفوظة.', noProducts: 'لا توجد منتجات منشورة متاحة للاقتراح بعد.', generic: 'تعذر إكمال الطلب. حاول مجددًا.', busyAi: 'خدمة الذكاء الاصطناعي مشغولة. حاول بعد قليل.' },
  fr: { network: 'Réseau indisponible. Vérifiez la connexion et réessayez.', aiOff: 'Le service d’IA est indisponible. Vos objectifs sont enregistrés.', noProducts: 'Aucun produit publié n’est disponible pour une suggestion.', generic: 'La demande n’a pas abouti. Réessayez.', busyAi: 'Le service d’IA est occupé. Réessayez dans un instant.' },
  pt: { network: 'Rede indisponível. Verifique a conexão e tente novamente.', aiOff: 'O serviço de IA está indisponível. Seus objetivos estão salvos.', noProducts: 'Ainda não há produtos publicados para uma sugestão.', generic: 'Não foi possível concluir o pedido. Tente novamente.', busyAi: 'O serviço de IA está ocupado. Tente novamente em instantes.' },
}

/** Community composer, like/follow and screen-level failure copy (F2). */
export type CommunityCopy = {
  post: string; reply: string; placeholder: string; public: string; login: string; busy: string
  like: string; unlike: string; follow: string; unfollow: string; retry: string
  published: string; replied: string; liked: string; unliked: string; followed: string; unfollowed: string
  stateFailed: string; tooLong: string; rateLimited: string; network: string; failed: string; notAllowed: string
  feedFailed: string; moreFailed: string; postFailed: string; profileFailed: string; sending: string
}
export const communityCopy: Record<AppLocale, CommunityCopy> = {
  'zh-CN': { post: '发布帖子', reply: '公开回复', placeholder: '写下你的内容…', public: '提交后直接公开，后台事后处理。', login: '登录后参与', busy: '提交中…', like: '赞', unlike: '取消赞', follow: '关注', unfollow: '取消关注', retry: '重试', published: '帖子已发布。', replied: '回复已发布。', liked: '已点赞', unliked: '已取消赞', followed: '已关注', unfollowed: '已取消关注', stateFailed: '互动状态读取失败', tooLong: '内容过长，请删减后再提交。', rateLimited: '提交太频繁，请稍后再试。', network: '网络不可用，内容已保留，请重试。', failed: '提交未完成，内容已保留，请重试。', notAllowed: '当前账户暂不能参与社区互动。', feedFailed: '社区内容加载失败', moreFailed: '加载更多失败，请重试。', postFailed: '帖子加载失败或已下架', profileFailed: '成员资料加载失败或不可见', sending: '提交中…' },
  en: { post: 'Publish post', reply: 'Post reply', placeholder: 'Write your message…', public: 'Published immediately. Moderation follows publication.', login: 'Sign in to participate', busy: 'Submitting…', like: 'Like', unlike: 'Unlike', follow: 'Follow', unfollow: 'Unfollow', retry: 'Retry', published: 'Post published.', replied: 'Reply published.', liked: 'Liked', unliked: 'Like removed', followed: 'Following', unfollowed: 'Unfollowed', stateFailed: 'Could not load your interaction state', tooLong: 'The text is too long. Shorten it and try again.', rateLimited: 'Too many submissions. Try again shortly.', network: 'Network unavailable. Your text is kept; try again.', failed: 'Not submitted. Your text is kept; try again.', notAllowed: 'This account cannot take part in the community right now.', feedFailed: 'Unable to load community content', moreFailed: 'Unable to load more. Please retry.', postFailed: 'The post could not be loaded or is no longer published', profileFailed: 'This profile could not be loaded or is not public', sending: 'Sending…' },
  es: { post: 'Publicar', reply: 'Responder', placeholder: 'Escribe tu mensaje…', public: 'Publicación inmediata, revisión posterior.', login: 'Inicia sesión para participar', busy: 'Enviando…', like: 'Me gusta', unlike: 'Quitar Me gusta', follow: 'Seguir', unfollow: 'Dejar de seguir', retry: 'Reintentar', published: 'Publicación creada.', replied: 'Respuesta publicada.', liked: 'Te gusta', unliked: 'Me gusta retirado', followed: 'Siguiendo', unfollowed: 'Ya no sigues', stateFailed: 'No se pudo cargar tu estado', tooLong: 'El texto es demasiado largo.', rateLimited: 'Demasiados envíos. Inténtalo en breve.', network: 'Sin conexión. Tu texto se conserva; reintenta.', failed: 'No enviado. Tu texto se conserva; reintenta.', notAllowed: 'Esta cuenta no puede participar ahora.', feedFailed: 'No se pudo cargar la comunidad', moreFailed: 'No se pudo cargar más. Reintenta.', postFailed: 'La publicación no se pudo cargar o ya no está publicada', profileFailed: 'El perfil no se pudo cargar o no es público', sending: 'Enviando…' },
  ar: { post: 'نشر', reply: 'نشر الرد', placeholder: 'اكتب رسالتك…', public: 'نشر فوري ومراجعة لاحقة.', login: 'سجّل الدخول للمشاركة', busy: 'جارٍ الإرسال…', like: 'إعجاب', unlike: 'إلغاء الإعجاب', follow: 'متابعة', unfollow: 'إلغاء المتابعة', retry: 'إعادة المحاولة', published: 'تم نشر المنشور.', replied: 'تم نشر الرد.', liked: 'أُعجبت', unliked: 'أُلغي الإعجاب', followed: 'تتابع', unfollowed: 'أُلغيت المتابعة', stateFailed: 'تعذر تحميل حالة التفاعل', tooLong: 'النص طويل جدًا. اختصره وحاول مجددًا.', rateLimited: 'محاولات كثيرة. حاول بعد قليل.', network: 'الشبكة غير متاحة. نصك محفوظ؛ حاول مجددًا.', failed: 'لم يُرسل. نصك محفوظ؛ حاول مجددًا.', notAllowed: 'لا يمكن لهذا الحساب المشاركة حاليًا.', feedFailed: 'تعذر تحميل محتوى المجتمع', moreFailed: 'تعذر تحميل المزيد. حاول مجددًا.', postFailed: 'تعذر تحميل المنشور أو لم يعد منشورًا', profileFailed: 'تعذر تحميل الملف أو أنه غير عام', sending: 'جارٍ الإرسال…' },
  fr: { post: 'Publier', reply: 'Répondre', placeholder: 'Écrivez votre message…', public: 'Publication immédiate, modération ultérieure.', login: 'Se connecter pour participer', busy: 'Envoi…', like: 'Aimer', unlike: 'Ne plus aimer', follow: 'Suivre', unfollow: 'Ne plus suivre', retry: 'Réessayer', published: 'Publication en ligne.', replied: 'Réponse publiée.', liked: 'Aimé', unliked: 'Mention retirée', followed: 'Abonné', unfollowed: 'Désabonné', stateFailed: 'Impossible de charger votre état', tooLong: 'Le texte est trop long.', rateLimited: 'Trop d’envois. Réessayez bientôt.', network: 'Réseau indisponible. Texte conservé ; réessayez.', failed: 'Non envoyé. Texte conservé ; réessayez.', notAllowed: 'Ce compte ne peut pas participer pour le moment.', feedFailed: 'Impossible de charger la communauté', moreFailed: 'Impossible de charger la suite. Réessayez.', postFailed: 'La publication est introuvable ou retirée', profileFailed: 'Ce profil est introuvable ou non public', sending: 'Envoi…' },
  pt: { post: 'Publicar', reply: 'Responder', placeholder: 'Escreva sua mensagem…', public: 'Publicação imediata, moderação posterior.', login: 'Entre para participar', busy: 'Enviando…', like: 'Curtir', unlike: 'Descurtir', follow: 'Seguir', unfollow: 'Deixar de seguir', retry: 'Tentar novamente', published: 'Publicação feita.', replied: 'Resposta publicada.', liked: 'Curtido', unliked: 'Curtida removida', followed: 'Seguindo', unfollowed: 'Deixou de seguir', stateFailed: 'Não foi possível carregar seu estado', tooLong: 'O texto é longo demais.', rateLimited: 'Envios demais. Tente em instantes.', network: 'Sem rede. Seu texto foi mantido; tente de novo.', failed: 'Não enviado. Seu texto foi mantido; tente de novo.', notAllowed: 'Esta conta não pode participar agora.', feedFailed: 'Não foi possível carregar a comunidade', moreFailed: 'Não foi possível carregar mais. Tente de novo.', postFailed: 'A publicação não pôde ser carregada ou foi retirada', profileFailed: 'O perfil não pôde ser carregado ou não é público', sending: 'Enviando…' },
  hi: { post: 'पोस्ट प्रकाशित करें', reply: 'जवाब दें', placeholder: 'अपना संदेश लिखें…', public: 'तुरंत सार्वजनिक होगा; बाद में समीक्षा होगी।', login: 'भाग लेने के लिए लॉग इन करें', busy: 'भेजा जा रहा है…', like: 'पसंद करें', unlike: 'पसंद हटाएँ', follow: 'फ़ॉलो करें', unfollow: 'फ़ॉलो हटाएँ', retry: 'फिर प्रयास करें', published: 'पोस्ट प्रकाशित हुई।', replied: 'जवाब प्रकाशित हुआ।', liked: 'पसंद किया', unliked: 'पसंद हटाई', followed: 'फ़ॉलो कर रहे हैं', unfollowed: 'फ़ॉलो हटाया', stateFailed: 'इंटरैक्शन स्थिति लोड नहीं हुई', tooLong: 'पाठ बहुत लंबा है।', rateLimited: 'बहुत अधिक प्रयास। थोड़ी देर बाद करें।', network: 'नेटवर्क उपलब्ध नहीं। पाठ सुरक्षित है; फिर प्रयास करें।', failed: 'नहीं भेजा गया। पाठ सुरक्षित है; फिर प्रयास करें।', notAllowed: 'यह खाता अभी भाग नहीं ले सकता।', feedFailed: 'समुदाय सामग्री लोड नहीं हुई', moreFailed: 'और लोड नहीं हुआ। फिर प्रयास करें।', postFailed: 'पोस्ट लोड नहीं हुई या अब प्रकाशित नहीं है', profileFailed: 'प्रोफ़ाइल लोड नहीं हुई या सार्वजनिक नहीं है', sending: 'भेजा जा रहा है…' },
}

/** /ai assistant chat: waiting, cancel, retry and failure copy (F2). */
export type AiChatCopy = {
  unavailable: string; intro: string; thinking: string; cancel: string; cancelled: string; retry: string; send: string
  secret: string; badFormat: string; network: string; busy: string; off: string; failed: string; sessionLost: string; tooLong: string
}
export const aiChatCopy: Record<AppLocale, AiChatCopy> = {
  'zh-CN': { unavailable: 'AI 服务暂不可用', intro: '未登录会话刷新后不会保留；回答仅供参考，不构成投资建议。', thinking: '正在生成回答…', cancel: '停止等待', cancelled: '已停止等待。服务端可能仍会完成这条回答；登录后可在历史会话中查看。', retry: '重新发送', send: '发送消息', secret: '请勿发送私钥或助记词。', badFormat: '回答格式暂不可用，请重试。', network: '网络不可用，消息已保留，请重试。', busy: 'AI 服务繁忙，请稍后重试。', off: 'AI 服务暂不可用，请稍后再试。', failed: '回答未完成，消息已保留，请重试。', sessionLost: '原会话已失效，重新发送将开始新会话。', tooLong: '消息过长，请精简后再发送。' },
  en: { unavailable: 'AI is unavailable', intro: 'Signed-out sessions are not kept after refresh. Answers are for reference only and are not investment advice.', thinking: 'Writing a reply…', cancel: 'Stop waiting', cancelled: 'Stopped waiting. The server may still finish this reply; signed-in users can find it in their history.', retry: 'Send again', send: 'Send message', secret: 'Do not send private keys or recovery phrases.', badFormat: 'The reply could not be read. Try again.', network: 'Network unavailable. Your message is kept; try again.', busy: 'The AI service is busy. Try again shortly.', off: 'The AI service is not available right now.', failed: 'No reply. Your message is kept; try again.', sessionLost: 'That conversation expired. Sending again starts a new one.', tooLong: 'The message is too long. Shorten it and try again.' },
  es: { unavailable: 'La IA no está disponible', intro: 'Las sesiones sin cuenta no se guardan al recargar. Las respuestas son orientativas y no son asesoramiento de inversión.', thinking: 'Redactando respuesta…', cancel: 'Dejar de esperar', cancelled: 'Espera detenida. El servidor podría terminar la respuesta; con sesión iniciada aparecerá en tu historial.', retry: 'Enviar de nuevo', send: 'Enviar mensaje', secret: 'No envíes claves privadas ni frases de recuperación.', badFormat: 'No se pudo leer la respuesta. Reintenta.', network: 'Sin conexión. Tu mensaje se conserva; reintenta.', busy: 'El servicio de IA está ocupado. Inténtalo en breve.', off: 'El servicio de IA no está disponible ahora.', failed: 'Sin respuesta. Tu mensaje se conserva; reintenta.', sessionLost: 'La conversación caducó. Al reenviar se inicia una nueva.', tooLong: 'El mensaje es demasiado largo.' },
  ar: { unavailable: 'الذكاء الاصطناعي غير متاح', intro: 'لا تُحفظ الجلسات دون تسجيل دخول بعد التحديث. الإجابات للاسترشاد فقط وليست نصيحة استثمارية.', thinking: 'جارٍ كتابة الرد…', cancel: 'إيقاف الانتظار', cancelled: 'تم إيقاف الانتظار. قد يُكمل الخادم الرد؛ يظهر في السجل عند تسجيل الدخول.', retry: 'إعادة الإرسال', send: 'إرسال الرسالة', secret: 'لا ترسل المفاتيح الخاصة أو عبارات الاسترداد.', badFormat: 'تعذرت قراءة الرد. حاول مجددًا.', network: 'الشبكة غير متاحة. رسالتك محفوظة؛ حاول مجددًا.', busy: 'خدمة الذكاء الاصطناعي مشغولة. حاول بعد قليل.', off: 'خدمة الذكاء الاصطناعي غير متاحة حاليًا.', failed: 'لا يوجد رد. رسالتك محفوظة؛ حاول مجددًا.', sessionLost: 'انتهت المحادثة. إعادة الإرسال تبدأ محادثة جديدة.', tooLong: 'الرسالة طويلة جدًا.' },
  fr: { unavailable: 'L’IA est indisponible', intro: 'Les sessions non connectées ne sont pas conservées. Les réponses sont indicatives et ne constituent pas un conseil en investissement.', thinking: 'Rédaction de la réponse…', cancel: 'Arrêter d’attendre', cancelled: 'Attente arrêtée. Le serveur peut encore terminer ; connecté, la réponse figurera dans l’historique.', retry: 'Renvoyer', send: 'Envoyer le message', secret: 'N’envoyez ni clé privée ni phrase de récupération.', badFormat: 'Réponse illisible. Réessayez.', network: 'Réseau indisponible. Message conservé ; réessayez.', busy: 'Le service IA est occupé. Réessayez bientôt.', off: 'Le service IA est indisponible pour le moment.', failed: 'Pas de réponse. Message conservé ; réessayez.', sessionLost: 'Conversation expirée. Un nouvel envoi en ouvre une nouvelle.', tooLong: 'Le message est trop long.' },
  pt: { unavailable: 'A IA está indisponível', intro: 'Sessões sem login não são mantidas ao recarregar. As respostas são apenas referência e não são recomendação de investimento.', thinking: 'Escrevendo resposta…', cancel: 'Parar de esperar', cancelled: 'Espera interrompida. O servidor pode concluir a resposta; com login ela aparece no histórico.', retry: 'Enviar novamente', send: 'Enviar mensagem', secret: 'Não envie chaves privadas nem frases de recuperação.', badFormat: 'Não foi possível ler a resposta. Tente de novo.', network: 'Sem rede. Sua mensagem foi mantida; tente de novo.', busy: 'O serviço de IA está ocupado. Tente em instantes.', off: 'O serviço de IA não está disponível agora.', failed: 'Sem resposta. Sua mensagem foi mantida; tente de novo.', sessionLost: 'A conversa expirou. Reenviar inicia uma nova.', tooLong: 'A mensagem é longa demais.' },
  hi: { unavailable: 'AI उपलब्ध नहीं है', intro: 'बिना लॉग इन वाले सत्र रीफ़्रेश के बाद नहीं रहते। उत्तर केवल संदर्भ हैं, निवेश सलाह नहीं।', thinking: 'उत्तर लिखा जा रहा है…', cancel: 'प्रतीक्षा रोकें', cancelled: 'प्रतीक्षा रोकी गई। सर्वर उत्तर पूरा कर सकता है; लॉग इन होने पर यह इतिहास में दिखेगा।', retry: 'फिर भेजें', send: 'संदेश भेजें', secret: 'निजी कुंजी या रिकवरी वाक्यांश न भेजें।', badFormat: 'उत्तर पढ़ा नहीं जा सका। फिर प्रयास करें।', network: 'नेटवर्क उपलब्ध नहीं। संदेश सुरक्षित है; फिर प्रयास करें।', busy: 'AI सेवा व्यस्त है। थोड़ी देर बाद प्रयास करें।', off: 'AI सेवा अभी उपलब्ध नहीं है।', failed: 'उत्तर नहीं मिला। संदेश सुरक्षित है; फिर प्रयास करें।', sessionLost: 'बातचीत समाप्त हो गई। फिर भेजने पर नई शुरू होगी।', tooLong: 'संदेश बहुत लंबा है।' },
}
