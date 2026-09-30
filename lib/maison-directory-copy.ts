import type { AppLocale } from '@/lib/app-locales'

/** Batch-1b copy: issuers, compare, search. Metric labels reuse marketCopy.detail. `{x}` tokens are replaced by fill(). */
export type DirectoryCopy = {
  issuers: {
    kicker: string; title: string; lede: string; filter: string; verified: string; assets: string; marketCap: string
    sort: { cap: string; name: string }; notFound: string; notFoundBody: string; all: string; managed: string; noAssets: string
    note: string; website: string; loadError: string
  }
  compare: {
    kicker: string; title: string; lede: string; add: string; remove: string; pick: string; empty: string; emptyBody: string
    max: string; missing: string; metric: string; issuer: string; cls: string; open: string
  }
  search: {
    title: string; placeholder: string; recent: string; clear: string; top: string; investable: string; directory: string
    pairs: string; baskets: string; assetError: string; hint: string
  }
}

const en: DirectoryCopy = {
  issuers: {
    kicker: 'Directory · Issuers', title: 'Issuers', lede: '{n} institutions · {v} tracked', filter: 'Filter issuers', verified: 'Verified', assets: 'Assets · {n}', marketCap: 'Market cap',
    sort: { cap: 'Market cap', name: 'Name' }, notFound: 'Issuer not found', notFoundBody: 'This link may be out of date.', all: 'All issuers', managed: 'Tracked assets', noAssets: 'No assets are tracked for this issuer yet.',
    note: 'Issuer information comes from third-party market data and is for research only.', website: 'Website', loadError: 'Issuer data could not be loaded.',
  },
  compare: {
    kicker: 'Research · Compare', title: 'Compare', lede: 'Up to three assets side by side. Third-party market data, research only.', add: 'Add asset', remove: 'Remove {v}', pick: 'Search an asset to add',
    empty: 'Nothing to compare yet', emptyBody: 'Add up to three assets from the market directory.', max: 'Up to three assets', missing: 'Not found', metric: 'Metric', issuer: 'Issuer', cls: 'Class', open: 'Open',
  },
  search: {
    title: 'Search', placeholder: 'Search assets, pairs and baskets', recent: 'Recent', clear: 'Clear', top: 'Top assets', investable: 'Investable', directory: 'Market directory',
    pairs: 'Trading pairs', baskets: 'Baskets', assetError: 'Directory search is unavailable. Other results are still shown.', hint: 'Names, symbols and issuers',
  },
}

const zh: DirectoryCopy = {
  issuers: {
    kicker: '名录 · 发行方', title: '发行方', lede: '{n} 家机构 · 追踪市值 {v}', filter: '筛选发行方', verified: '已核验', assets: '资产 · {n}', marketCap: '市值',
    sort: { cap: '市值', name: '名称' }, notFound: '未找到发行方', notFoundBody: '该链接可能已失效。', all: '全部发行方', managed: '追踪资产', noAssets: '暂未追踪该发行方的资产。',
    note: '发行方信息来自第三方市场数据，仅供研究。', website: '官网', loadError: '发行方数据加载失败。',
  },
  compare: {
    kicker: '研究 · 比较', title: '比较', lede: '最多三个资产并排比较。第三方市场数据，仅供研究。', add: '添加资产', remove: '移除 {v}', pick: '搜索要添加的资产',
    empty: '尚未选择资产', emptyBody: '从市场名录中最多添加三个资产。', max: '最多三个资产', missing: '未找到', metric: '指标', issuer: '发行方', cls: '类别', open: '查看',
  },
  search: {
    title: '搜索', placeholder: '搜索资产、交易对与篮子', recent: '最近搜索', clear: '清除', top: '热门资产', investable: '可投资', directory: '市场名录',
    pairs: '交易对', baskets: '篮子', assetError: '名录搜索暂不可用，其他结果仍可查看。', hint: '名称、代码或发行方',
  },
}

const hi: DirectoryCopy = {
  issuers: {
    kicker: 'निर्देशिका · जारीकर्ता', title: 'जारीकर्ता', lede: '{n} संस्थान · {v} ट्रैक किया गया', filter: 'जारीकर्ता खोजें', verified: 'सत्यापित', assets: 'एसेट · {n}', marketCap: 'मार्केट कैप',
    sort: { cap: 'मार्केट कैप', name: 'नाम' }, notFound: 'जारीकर्ता नहीं मिला', notFoundBody: 'यह लिंक पुराना हो सकता है।', all: 'सभी जारीकर्ता', managed: 'ट्रैक किए गए एसेट', noAssets: 'इस जारीकर्ता का कोई एसेट अभी ट्रैक नहीं है।',
    note: 'जारीकर्ता की जानकारी तृतीय-पक्ष बाज़ार डेटा से है और केवल शोध के लिए है।', website: 'वेबसाइट', loadError: 'जारीकर्ता डेटा लोड नहीं हो सका।',
  },
  compare: {
    kicker: 'शोध · तुलना', title: 'तुलना', lede: 'अधिकतम तीन एसेट साथ-साथ। तृतीय-पक्ष बाज़ार डेटा, केवल शोध के लिए।', add: 'एसेट जोड़ें', remove: '{v} हटाएँ', pick: 'जोड़ने के लिए एसेट खोजें',
    empty: 'अभी तुलना के लिए कुछ नहीं', emptyBody: 'बाज़ार निर्देशिका से अधिकतम तीन एसेट जोड़ें।', max: 'अधिकतम तीन एसेट', missing: 'नहीं मिला', metric: 'मीट्रिक', issuer: 'जारीकर्ता', cls: 'वर्ग', open: 'खोलें',
  },
  search: {
    title: 'खोज', placeholder: 'एसेट, पेयर और बास्केट खोजें', recent: 'हाल की खोजें', clear: 'साफ़ करें', top: 'शीर्ष एसेट', investable: 'निवेश योग्य', directory: 'बाज़ार निर्देशिका',
    pairs: 'ट्रेडिंग पेयर', baskets: 'बास्केट', assetError: 'निर्देशिका खोज अभी उपलब्ध नहीं है। अन्य परिणाम दिखाए जा रहे हैं।', hint: 'नाम, सिंबल या जारीकर्ता',
  },
}

const es: DirectoryCopy = {
  issuers: {
    kicker: 'Directorio · Emisores', title: 'Emisores', lede: '{n} instituciones · {v} seguidos', filter: 'Filtrar emisores', verified: 'Verificado', assets: 'Activos · {n}', marketCap: 'Capitalización',
    sort: { cap: 'Capitalización', name: 'Nombre' }, notFound: 'Emisor no encontrado', notFoundBody: 'Puede que este enlace esté desactualizado.', all: 'Todos los emisores', managed: 'Activos seguidos', noAssets: 'Aún no se siguen activos de este emisor.',
    note: 'La información del emisor procede de datos de mercado de terceros y es solo para análisis.', website: 'Sitio web', loadError: 'No se pudieron cargar los datos del emisor.',
  },
  compare: {
    kicker: 'Análisis · Comparar', title: 'Comparar', lede: 'Hasta tres activos lado a lado. Datos de mercado de terceros, solo para análisis.', add: 'Añadir activo', remove: 'Quitar {v}', pick: 'Busca un activo para añadir',
    empty: 'Nada que comparar todavía', emptyBody: 'Añade hasta tres activos del directorio de mercado.', max: 'Hasta tres activos', missing: 'No encontrado', metric: 'Métrica', issuer: 'Emisor', cls: 'Clase', open: 'Abrir',
  },
  search: {
    title: 'Buscar', placeholder: 'Buscar activos, pares y cestas', recent: 'Recientes', clear: 'Borrar', top: 'Activos principales', investable: 'Invertible', directory: 'Directorio de mercado',
    pairs: 'Pares de trading', baskets: 'Cestas', assetError: 'La búsqueda en el directorio no está disponible. Se muestran los demás resultados.', hint: 'Nombres, símbolos y emisores',
  },
}

const ar: DirectoryCopy = {
  issuers: {
    kicker: 'الدليل · الجهات المُصدِرة', title: 'الجهات المُصدِرة', lede: '{n} مؤسسة · {v} متتبَّعة', filter: 'تصفية الجهات المُصدِرة', verified: 'موثَّقة', assets: 'الأصول · {n}', marketCap: 'القيمة السوقية',
    sort: { cap: 'القيمة السوقية', name: 'الاسم' }, notFound: 'الجهة المُصدِرة غير موجودة', notFoundBody: 'قد يكون هذا الرابط قديمًا.', all: 'كل الجهات المُصدِرة', managed: 'الأصول المتتبَّعة', noAssets: 'لا توجد أصول متتبَّعة لهذه الجهة بعد.',
    note: 'معلومات الجهة المُصدِرة مصدرها بيانات سوق من طرف ثالث، وهي للبحث فقط.', website: 'الموقع الإلكتروني', loadError: 'تعذّر تحميل بيانات الجهة المُصدِرة.',
  },
  compare: {
    kicker: 'بحث · مقارنة', title: 'مقارنة', lede: 'حتى ثلاثة أصول جنبًا إلى جنب. بيانات سوق من طرف ثالث، للبحث فقط.', add: 'إضافة أصل', remove: 'إزالة {v}', pick: 'ابحث عن أصل لإضافته',
    empty: 'لا شيء للمقارنة بعد', emptyBody: 'أضف حتى ثلاثة أصول من دليل السوق.', max: 'حتى ثلاثة أصول', missing: 'غير موجود', metric: 'المؤشر', issuer: 'الجهة المُصدِرة', cls: 'الفئة', open: 'فتح',
  },
  search: {
    title: 'بحث', placeholder: 'ابحث عن الأصول والأزواج والسلال', recent: 'عمليات البحث الأخيرة', clear: 'مسح', top: 'أبرز الأصول', investable: 'قابل للاستثمار', directory: 'دليل السوق',
    pairs: 'أزواج التداول', baskets: 'السلال', assetError: 'البحث في الدليل غير متاح حاليًا. تُعرض النتائج الأخرى.', hint: 'الأسماء والرموز والجهات المُصدِرة',
  },
}

const fr: DirectoryCopy = {
  issuers: {
    kicker: 'Annuaire · Émetteurs', title: 'Émetteurs', lede: '{n} institutions · {v} suivis', filter: 'Filtrer les émetteurs', verified: 'Vérifié', assets: 'Actifs · {n}', marketCap: 'Capitalisation',
    sort: { cap: 'Capitalisation', name: 'Nom' }, notFound: 'Émetteur introuvable', notFoundBody: 'Ce lien est peut-être obsolète.', all: 'Tous les émetteurs', managed: 'Actifs suivis', noAssets: 'Aucun actif n’est encore suivi pour cet émetteur.',
    note: 'Les informations sur l’émetteur proviennent de données de marché tierces, à titre d’analyse uniquement.', website: 'Site web', loadError: 'Impossible de charger les données de l’émetteur.',
  },
  compare: {
    kicker: 'Analyse · Comparer', title: 'Comparer', lede: 'Jusqu’à trois actifs côte à côte. Données de marché tierces, à titre d’analyse uniquement.', add: 'Ajouter un actif', remove: 'Retirer {v}', pick: 'Rechercher un actif à ajouter',
    empty: 'Rien à comparer pour l’instant', emptyBody: 'Ajoutez jusqu’à trois actifs depuis l’annuaire du marché.', max: 'Jusqu’à trois actifs', missing: 'Introuvable', metric: 'Indicateur', issuer: 'Émetteur', cls: 'Classe', open: 'Ouvrir',
  },
  search: {
    title: 'Recherche', placeholder: 'Rechercher actifs, paires et paniers', recent: 'Récentes', clear: 'Effacer', top: 'Principaux actifs', investable: 'Investissable', directory: 'Annuaire du marché',
    pairs: 'Paires de trading', baskets: 'Paniers', assetError: 'La recherche dans l’annuaire est indisponible. Les autres résultats restent affichés.', hint: 'Noms, symboles et émetteurs',
  },
}

const pt: DirectoryCopy = {
  issuers: {
    kicker: 'Diretório · Emissores', title: 'Emissores', lede: '{n} instituições · {v} acompanhados', filter: 'Filtrar emissores', verified: 'Verificado', assets: 'Ativos · {n}', marketCap: 'Valor de mercado',
    sort: { cap: 'Valor de mercado', name: 'Nome' }, notFound: 'Emissor não encontrado', notFoundBody: 'Este link pode estar desatualizado.', all: 'Todos os emissores', managed: 'Ativos acompanhados', noAssets: 'Ainda não há ativos acompanhados deste emissor.',
    note: 'As informações do emissor vêm de dados de mercado de terceiros e servem apenas para pesquisa.', website: 'Site', loadError: 'Não foi possível carregar os dados do emissor.',
  },
  compare: {
    kicker: 'Pesquisa · Comparar', title: 'Comparar', lede: 'Até três ativos lado a lado. Dados de mercado de terceiros, apenas para pesquisa.', add: 'Adicionar ativo', remove: 'Remover {v}', pick: 'Pesquise um ativo para adicionar',
    empty: 'Nada para comparar ainda', emptyBody: 'Adicione até três ativos do diretório de mercado.', max: 'Até três ativos', missing: 'Não encontrado', metric: 'Métrica', issuer: 'Emissor', cls: 'Classe', open: 'Abrir',
  },
  search: {
    title: 'Buscar', placeholder: 'Buscar ativos, pares e cestas', recent: 'Recentes', clear: 'Limpar', top: 'Principais ativos', investable: 'Investível', directory: 'Diretório de mercado',
    pairs: 'Pares de negociação', baskets: 'Cestas', assetError: 'A busca no diretório está indisponível. Os demais resultados continuam visíveis.', hint: 'Nomes, símbolos e emissores',
  },
}

export const directoryCopy: Record<AppLocale, DirectoryCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
