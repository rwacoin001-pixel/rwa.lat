import type { AppLocale } from '@/lib/app-locales'

/**
 * FormalDocumentsPanel copy: issued PDFs (trade confirmations, statements, agreements, tax).
 * "UTC" and "PDF" stay untranslated in every locale.
 */
export type FormalDocsCopy = {
  section: string
  intro: string
  actions: { syncTrades: string; readAgreement: string; refresh: string }
  requestNotice: string
  month: { label: string; aria: string; generate: string }
  busy: string
  agreement: { companyVersion: string; consent: string; confirm: string; close: string }
  states: { failed: string; generating: string; ready: string; awaitingScan: string; blocked: string }
  download: string
  retryGeneration: string
  error: { title: string; retry: string }
  empty: { title: string; body: string }
}

const en: FormalDocsCopy = {
  section: 'Official PDF documents',
  intro: 'Files belong to your account. Authorized staff issue tax documents from verified data. Read and accept the agreement before archiving it.',
  actions: { syncTrades: 'Sync actual trade confirmations', readAgreement: 'Read current agreement', refresh: 'Refresh files' },
  requestNotice: 'Request recorded. The PDF will be available after generation and scanning.',
  month: { label: 'Request a completed UTC monthly statement', aria: 'Statement month', generate: 'Generate statement PDF' },
  busy: 'Working…',
  agreement: {
    companyVersion: 'Company version',
    consent: 'I have read and agree to the full agreement and company version shown above.',
    confirm: 'Confirm and archive agreement PDF',
    close: 'Close without accepting',
  },
  states: { failed: 'Generation failed', generating: 'Generating', ready: 'Download ready', awaitingScan: 'Awaiting scan', blocked: 'File blocked' },
  download: 'Download PDF',
  retryGeneration: 'Retry generation',
  error: { title: 'Could not load official files', retry: 'Retry' },
  empty: { title: 'No issued files', body: 'Trade confirmations require actual settlements.' },
}

const zh: FormalDocsCopy = {
  section: '正式 PDF 文件',
  intro: '正式文件仅所属账户可下载。税务文件由获授权商务录入核实资料后发放；协议需阅读并确认。',
  actions: { syncTrades: '同步真实成交确认书', readAgreement: '阅读并确认当前协议', refresh: '刷新文件' },
  requestNotice: '请求已记录，PDF 生成及扫描完成后可下载。',
  month: { label: '申请已结束月份的 UTC 月结单', aria: '结单月份', generate: '生成月结单 PDF' },
  busy: '处理中…',
  agreement: {
    companyVersion: '主体版本',
    consent: '我已阅读并同意上方完整协议与所示主体版本。',
    confirm: '确认并生成协议存档 PDF',
    close: '暂不确认',
  },
  states: { failed: '生成失败', generating: '生成中', ready: '可下载', awaitingScan: '待扫描', blocked: '文件已拦截' },
  download: '下载 PDF',
  retryGeneration: '重试生成',
  error: { title: '无法载入正式文件', retry: '重试' },
  empty: { title: '尚无正式文件', body: '没有成交记录时不会生成虚构确认书。' },
}

const hi: FormalDocsCopy = {
  section: 'आधिकारिक PDF दस्तावेज़',
  intro: 'फ़ाइलें आपके खाते से संबंधित हैं। अधिकृत कर्मचारी सत्यापित डेटा के आधार पर कर दस्तावेज़ जारी करते हैं। समझौते को संग्रहित करने से पहले उसे पढ़ें और स्वीकार करें।',
  actions: { syncTrades: 'वास्तविक ट्रेड पुष्टिकरण सिंक करें', readAgreement: 'वर्तमान समझौता पढ़ें', refresh: 'फ़ाइलें रीफ़्रेश करें' },
  requestNotice: 'अनुरोध दर्ज कर लिया गया है। PDF बनने और स्कैन होने के बाद उपलब्ध होगा।',
  month: { label: 'किसी पूर्ण UTC माह का मासिक विवरण अनुरोध करें', aria: 'विवरण का माह', generate: 'विवरण PDF बनाएँ' },
  busy: 'प्रक्रिया जारी है…',
  agreement: {
    companyVersion: 'कंपनी संस्करण',
    consent: 'मैंने ऊपर दिखाया गया पूरा समझौता और कंपनी संस्करण पढ़ लिया है और मैं इससे सहमत हूँ।',
    confirm: 'पुष्टि करें और समझौता PDF संग्रहित करें',
    close: 'स्वीकार किए बिना बंद करें',
  },
  states: { failed: 'निर्माण विफल', generating: 'बनाया जा रहा है', ready: 'डाउनलोड के लिए तैयार', awaitingScan: 'स्कैन की प्रतीक्षा', blocked: 'फ़ाइल अवरुद्ध' },
  download: 'PDF डाउनलोड करें',
  retryGeneration: 'फिर से बनाएँ',
  error: { title: 'आधिकारिक फ़ाइलें लोड नहीं हो सकीं', retry: 'पुनः प्रयास करें' },
  empty: { title: 'कोई जारी फ़ाइल नहीं', body: 'ट्रेड पुष्टिकरण के लिए वास्तविक निपटान आवश्यक हैं।' },
}

const es: FormalDocsCopy = {
  section: 'Documentos PDF oficiales',
  intro: 'Los archivos pertenecen a su cuenta. El personal autorizado emite los documentos fiscales a partir de datos verificados. Lea y acepte el contrato antes de archivarlo.',
  actions: { syncTrades: 'Sincronizar confirmaciones de operaciones reales', readAgreement: 'Leer el contrato vigente', refresh: 'Actualizar archivos' },
  requestNotice: 'Solicitud registrada. El PDF estará disponible tras su generación y análisis.',
  month: { label: 'Solicitar un extracto mensual UTC de un mes cerrado', aria: 'Mes del extracto', generate: 'Generar extracto en PDF' },
  busy: 'Procesando…',
  agreement: {
    companyVersion: 'Versión de la entidad',
    consent: 'He leído y acepto el contrato completo y la versión de la entidad indicados arriba.',
    confirm: 'Confirmar y archivar el contrato en PDF',
    close: 'Cerrar sin aceptar',
  },
  states: { failed: 'Error de generación', generating: 'Generando', ready: 'Listo para descargar', awaitingScan: 'Pendiente de análisis', blocked: 'Archivo bloqueado' },
  download: 'Descargar PDF',
  retryGeneration: 'Reintentar generación',
  error: { title: 'No se pudieron cargar los archivos oficiales', retry: 'Reintentar' },
  empty: { title: 'No hay archivos emitidos', body: 'Las confirmaciones de operaciones requieren liquidaciones reales.' },
}

const ar: FormalDocsCopy = {
  section: 'مستندات PDF الرسمية',
  intro: 'تعود الملفات إلى حسابك. يُصدر الموظفون المخوَّلون المستندات الضريبية استنادًا إلى بيانات موثَّقة. اقرأ الاتفاقية ووافق عليها قبل أرشفتها.',
  actions: { syncTrades: 'مزامنة تأكيدات الصفقات الفعلية', readAgreement: 'قراءة الاتفاقية الحالية', refresh: 'تحديث الملفات' },
  requestNotice: 'تم تسجيل الطلب. سيتوفر ملف PDF بعد إنشائه وفحصه.',
  month: { label: 'طلب كشف حساب شهري UTC لشهر مكتمل', aria: 'شهر الكشف', generate: 'إنشاء كشف PDF' },
  busy: 'جارٍ المعالجة…',
  agreement: {
    companyVersion: 'إصدار الجهة',
    consent: 'لقد قرأت الاتفاقية كاملةً وإصدار الجهة الموضَّح أعلاه وأوافق عليهما.',
    confirm: 'تأكيد وأرشفة الاتفاقية بصيغة PDF',
    close: 'إغلاق دون موافقة',
  },
  states: { failed: 'فشل الإنشاء', generating: 'جارٍ الإنشاء', ready: 'جاهز للتنزيل', awaitingScan: 'بانتظار الفحص', blocked: 'الملف محظور' },
  download: 'تنزيل PDF',
  retryGeneration: 'إعادة محاولة الإنشاء',
  error: { title: 'تعذّر تحميل الملفات الرسمية', retry: 'إعادة المحاولة' },
  empty: { title: 'لا توجد ملفات صادرة', body: 'تتطلب تأكيدات الصفقات تسويات فعلية.' },
}

const fr: FormalDocsCopy = {
  section: 'Documents PDF officiels',
  intro: 'Les fichiers sont rattachés à votre compte. Le personnel habilité émet les documents fiscaux à partir de données vérifiées. Lisez et acceptez la convention avant de l’archiver.',
  actions: { syncTrades: 'Synchroniser les confirmations d’opérations réelles', readAgreement: 'Lire la convention en vigueur', refresh: 'Actualiser les fichiers' },
  requestNotice: 'Demande enregistrée. Le PDF sera disponible après sa génération et son analyse.',
  month: { label: 'Demander un relevé mensuel UTC d’un mois clôturé', aria: 'Mois du relevé', generate: 'Générer le relevé PDF' },
  busy: 'Traitement…',
  agreement: {
    companyVersion: 'Version de l’entité',
    consent: 'J’ai lu et j’accepte l’intégralité de la convention et la version de l’entité indiquées ci-dessus.',
    confirm: 'Confirmer et archiver la convention en PDF',
    close: 'Fermer sans accepter',
  },
  states: { failed: 'Échec de la génération', generating: 'Génération en cours', ready: 'Prêt au téléchargement', awaitingScan: 'Analyse en attente', blocked: 'Fichier bloqué' },
  download: 'Télécharger le PDF',
  retryGeneration: 'Relancer la génération',
  error: { title: 'Impossible de charger les fichiers officiels', retry: 'Réessayer' },
  empty: { title: 'Aucun fichier émis', body: 'Les confirmations d’opérations nécessitent des règlements effectifs.' },
}

const pt: FormalDocsCopy = {
  section: 'Documentos PDF oficiais',
  intro: 'Os arquivos pertencem à sua conta. A equipe autorizada emite os documentos fiscais com base em dados verificados. Leia e aceite o contrato antes de arquivá-lo.',
  actions: { syncTrades: 'Sincronizar confirmações de operações reais', readAgreement: 'Ler o contrato vigente', refresh: 'Atualizar arquivos' },
  requestNotice: 'Solicitação registrada. O PDF ficará disponível após a geração e a verificação.',
  month: { label: 'Solicitar um extrato mensal UTC de um mês encerrado', aria: 'Mês do extrato', generate: 'Gerar extrato em PDF' },
  busy: 'Processando…',
  agreement: {
    companyVersion: 'Versão da entidade',
    consent: 'Li e concordo com o contrato completo e a versão da entidade exibidos acima.',
    confirm: 'Confirmar e arquivar o contrato em PDF',
    close: 'Fechar sem aceitar',
  },
  states: { failed: 'Falha na geração', generating: 'Gerando', ready: 'Pronto para download', awaitingScan: 'Aguardando verificação', blocked: 'Arquivo bloqueado' },
  download: 'Baixar PDF',
  retryGeneration: 'Tentar gerar novamente',
  error: { title: 'Não foi possível carregar os arquivos oficiais', retry: 'Tentar novamente' },
  empty: { title: 'Nenhum arquivo emitido', body: 'As confirmações de operações exigem liquidações efetivas.' },
}

export const formalDocsCopy: Record<AppLocale, FormalDocsCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
