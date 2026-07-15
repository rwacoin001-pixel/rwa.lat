import type { AppLocale } from './i18n'
import type { DemoProduct } from './demo-catalog'

type ProductCopy = { title: string; subtitle: string }

const products: Record<AppLocale, Record<string, ProductCopy>> = {
  en: {},
  'zh-CN': {
    'h100-inference-pool': { title: 'H100 推理算力池', subtitle: '覆盖 Tier III 数据中心的企业级推理算力' },
    'b200-training-lease': { title: 'B200 训练集群租赁', subtitle: '面向模型训练需求的预留 GPU 集群' },
    'edge-vision-grid': { title: '边缘视觉算力网络', subtitle: '面向计算机视觉负载的分布式 GPU 算力' },
    'liquid-cooling-revenue': { title: '液冷基础设施收益', subtitle: '数据中心液冷基础设施收入分成' },
    'solar-income-2027': { title: 'Solar Income 2027', subtitle: '美国在运营光伏资产的合约现金流' },
    'port-logistics-note': { title: '港口物流收益票据', subtitle: '仓储租金与码头服务现金流组合' },
    'tokenized-tbill-91d': { title: '91 天代币化美债', subtitle: '短久期美国国债参考策略' },
    'private-credit-northstar': { title: 'Northstar 私募信贷', subtitle: '带契约监测的优先担保贷款策略' },
    'multifamily-refi': { title: '多户住宅再融资', subtitle: '稳定运营住宅资产的优先留置权敞口' },
    'ai-leaders-basket': { title: 'AI 龙头股票组合', subtitle: '全球 AI 基础设施股票的代币化参考组合' },
    'semiconductor-supply-chain': { title: '半导体供应链组合', subtitle: '分散配置计算硬件与网络基础设施' },
    'global-dividend-quality': { title: '全球优质股息组合', subtitle: '经质量筛选的全球现金流型股票' },
  },
  hi: {
    'h100-inference-pool': { title: 'H100 इन्फ़रेंस पूल', subtitle: 'Tier III साइटों में एंटरप्राइज़ इन्फ़रेंस क्षमता' },
    'b200-training-lease': { title: 'B200 ट्रेनिंग लीज़', subtitle: 'मॉडल प्रशिक्षण के लिए आरक्षित GPU क्लस्टर' },
    'edge-vision-grid': { title: 'एज विज़न ग्रिड', subtitle: 'कंप्यूटर विज़न कार्यों के लिए वितरित GPU क्षमता' },
    'liquid-cooling-revenue': { title: 'लिक्विड कूलिंग आय', subtitle: 'डेटा सेंटर कूलिंग अवसंरचना की आय भागीदारी' },
    'solar-income-2027': { title: 'सोलर इनकम 2027', subtitle: 'अमेरिका की अनुबंधित परिचालन सौर परिसंपत्तियाँ' },
    'port-logistics-note': { title: 'पोर्ट लॉजिस्टिक्स नोट', subtitle: 'वेयरहाउस लीज़ और टर्मिनल सेवा नकदी-प्रवाह बास्केट' },
    'tokenized-tbill-91d': { title: 'टोकनाइज़्ड T-Bill 91D', subtitle: 'अल्पावधि अमेरिकी ट्रेज़री संदर्भ रणनीति' },
    'private-credit-northstar': { title: 'नॉर्थस्टार निजी ऋण', subtitle: 'अनुबंध निगरानी वाली वरिष्ठ सुरक्षित ऋण रणनीति' },
    'multifamily-refi': { title: 'बहु-परिवार पुनर्वित्त', subtitle: 'स्थिर आवासीय परिसंपत्तियों पर वरिष्ठ ग्रहणाधिकार' },
    'ai-leaders-basket': { title: 'AI लीडर्स बास्केट', subtitle: 'वैश्विक AI अवसंरचना शेयरों की टोकनाइज़्ड संदर्भ बास्केट' },
    'semiconductor-supply-chain': { title: 'सेमीकंडक्टर सप्लाई चेन', subtitle: 'कंप्यूट हार्डवेयर और नेटवर्किंग में विविध एक्सपोज़र' },
    'global-dividend-quality': { title: 'वैश्विक गुणवत्ता लाभांश', subtitle: 'गुणवत्ता जाँच वाले नकदी-सृजक वैश्विक शेयर' },
  },
  es: {
    'h100-inference-pool': { title: 'Pool de inferencia H100', subtitle: 'Capacidad empresarial de inferencia en centros Tier III' },
    'b200-training-lease': { title: 'Arrendamiento de entrenamiento B200', subtitle: 'Clústeres GPU reservados para entrenamiento de modelos' },
    'edge-vision-grid': { title: 'Red de visión en el borde', subtitle: 'Capacidad GPU distribuida para visión artificial' },
    'liquid-cooling-revenue': { title: 'Ingresos de refrigeración líquida', subtitle: 'Participación en ingresos de infraestructura de refrigeración' },
    'solar-income-2027': { title: 'Renta solar 2027', subtitle: 'Activos solares operativos contratados en Estados Unidos' },
    'port-logistics-note': { title: 'Nota logística portuaria', subtitle: 'Cesta de alquileres de almacenes y servicios de terminal' },
    'tokenized-tbill-91d': { title: 'T-Bill tokenizado 91D', subtitle: 'Estrategia de referencia del Tesoro estadounidense a corto plazo' },
    'private-credit-northstar': { title: 'Crédito privado Northstar', subtitle: 'Préstamos sénior garantizados con control de cláusulas' },
    'multifamily-refi': { title: 'Refinanciación multifamiliar', subtitle: 'Exposición sénior sobre activos residenciales estabilizados' },
    'ai-leaders-basket': { title: 'Cesta de líderes de IA', subtitle: 'Cesta tokenizada de acciones globales de infraestructura de IA' },
    'semiconductor-supply-chain': { title: 'Cadena de suministro de semiconductores', subtitle: 'Exposición diversificada a hardware y redes' },
    'global-dividend-quality': { title: 'Dividendos globales de calidad', subtitle: 'Acciones globales generadoras de caja con filtros de calidad' },
  },
  ar: {
    'h100-inference-pool': { title: 'مجمع استدلال H100', subtitle: 'قدرة استدلال مؤسسية عبر مراكز بيانات من الفئة الثالثة' },
    'b200-training-lease': { title: 'تأجير تدريب B200', subtitle: 'مجموعات GPU محجوزة لتدريب النماذج' },
    'edge-vision-grid': { title: 'شبكة الرؤية الطرفية', subtitle: 'قدرة GPU موزعة لأحمال الرؤية الحاسوبية' },
    'liquid-cooling-revenue': { title: 'إيرادات التبريد السائل', subtitle: 'حصة من إيرادات بنية تبريد مراكز البيانات' },
    'solar-income-2027': { title: 'دخل الطاقة الشمسية 2027', subtitle: 'أصول شمسية عاملة بعقود في الولايات المتحدة' },
    'port-logistics-note': { title: 'سند لوجستيات الموانئ', subtitle: 'سلة تدفقات إيجار المستودعات وخدمات المحطات' },
    'tokenized-tbill-91d': { title: 'سند خزانة مرمّز 91 يومًا', subtitle: 'استراتيجية مرجعية قصيرة الأجل للخزانة الأمريكية' },
    'private-credit-northstar': { title: 'ائتمان Northstar الخاص', subtitle: 'إقراض مضمون ممتاز مع مراقبة التعهدات' },
    'multifamily-refi': { title: 'إعادة تمويل سكن متعدد الوحدات', subtitle: 'حق امتياز ممتاز على أصول سكنية مستقرة' },
    'ai-leaders-basket': { title: 'سلة رواد الذكاء الاصطناعي', subtitle: 'سلة مرجعية مرمّزة لأسهم البنية التحتية العالمية' },
    'semiconductor-supply-chain': { title: 'سلسلة توريد أشباه الموصلات', subtitle: 'تعرض متنوع لأجهزة الحوسبة والشبكات' },
    'global-dividend-quality': { title: 'توزيعات عالمية عالية الجودة', subtitle: 'أسهم عالمية مولّدة للنقد وفق معايير جودة' },
  },
  fr: {
    'h100-inference-pool': { title: "Pool d’inférence H100", subtitle: "Capacité d’inférence d’entreprise sur des sites Tier III" },
    'b200-training-lease': { title: "Location d’entraînement B200", subtitle: "Clusters GPU réservés à l’entraînement de modèles" },
    'edge-vision-grid': { title: 'Réseau de vision en périphérie', subtitle: 'Capacité GPU distribuée pour la vision par ordinateur' },
    'liquid-cooling-revenue': { title: 'Revenus du refroidissement liquide', subtitle: 'Partage des revenus de l’infrastructure de refroidissement' },
    'solar-income-2027': { title: 'Revenu solaire 2027', subtitle: 'Actifs solaires opérationnels sous contrat aux États-Unis' },
    'port-logistics-note': { title: 'Note logistique portuaire', subtitle: 'Panier de loyers d’entrepôts et de services terminaux' },
    'tokenized-tbill-91d': { title: 'T-Bill tokenisé 91J', subtitle: 'Stratégie de référence du Trésor américain à court terme' },
    'private-credit-northstar': { title: 'Crédit privé Northstar', subtitle: 'Prêts senior garantis avec suivi des covenants' },
    'multifamily-refi': { title: 'Refinancement résidentiel collectif', subtitle: 'Sûreté senior sur des actifs résidentiels stabilisés' },
    'ai-leaders-basket': { title: 'Panier des leaders IA', subtitle: 'Panier tokenisé d’actions mondiales d’infrastructure IA' },
    'semiconductor-supply-chain': { title: 'Chaîne de valeur des semi-conducteurs', subtitle: 'Exposition diversifiée au matériel et aux réseaux' },
    'global-dividend-quality': { title: 'Dividendes mondiaux de qualité', subtitle: 'Actions mondiales génératrices de trésorerie filtrées sur la qualité' },
  },
  pt: {
    'h100-inference-pool': { title: 'Pool de inferência H100', subtitle: 'Capacidade empresarial de inferência em centros Tier III' },
    'b200-training-lease': { title: 'Locação de treinamento B200', subtitle: 'Clusters de GPU reservados para treinamento de modelos' },
    'edge-vision-grid': { title: 'Rede de visão na borda', subtitle: 'Capacidade GPU distribuída para visão computacional' },
    'liquid-cooling-revenue': { title: 'Receita de refrigeração líquida', subtitle: 'Participação na receita de infraestrutura de refrigeração' },
    'solar-income-2027': { title: 'Renda solar 2027', subtitle: 'Ativos solares operacionais contratados nos Estados Unidos' },
    'port-logistics-note': { title: 'Nota de logística portuária', subtitle: 'Cesta de aluguéis de armazéns e serviços de terminal' },
    'tokenized-tbill-91d': { title: 'T-Bill tokenizado 91D', subtitle: 'Estratégia de referência do Tesouro americano de curto prazo' },
    'private-credit-northstar': { title: 'Crédito privado Northstar', subtitle: 'Empréstimos seniores garantidos com monitoramento de cláusulas' },
    'multifamily-refi': { title: 'Refinanciamento multifamiliar', subtitle: 'Garantia sênior sobre ativos residenciais estabilizados' },
    'ai-leaders-basket': { title: 'Cesta de líderes de IA', subtitle: 'Cesta tokenizada de ações globais de infraestrutura de IA' },
    'semiconductor-supply-chain': { title: 'Cadeia de semicondutores', subtitle: 'Exposição diversificada a hardware e redes' },
    'global-dividend-quality': { title: 'Dividendos globais de qualidade', subtitle: 'Ações globais geradoras de caixa com filtros de qualidade' },
  },
}

const meta: Record<AppLocale, {
  risk: Record<string, string>; returns: Record<string, string>; liquidity: Record<string, string>; availability: Record<string, string>; note: string
}> = {
  en: { risk: {}, returns: {}, liquidity: {}, availability: {}, note: 'Demo product for presentation' },
  'zh-CN': {
    risk: { 'Low Risk': '低风险', 'Medium Risk': '中风险', 'High Risk': '高风险' },
    returns: { 'projected APY': '预计年化收益率', 'projected yield': '预计收益率', 'indicative yield': '指示性收益率', 'AI score': 'AI 评分' },
    liquidity: { 'Monthly window': '每月退出窗口', '90-day term': '90 天期限', 'Weekly queue': '每周赎回队列', 'Quarterly window': '季度退出窗口', '12-month term': '12 个月期限', 'T+2 redemption': 'T+2 赎回', '18-month term': '18 个月期限', 'Market hours': '交易时段' },
    availability: { '72% capacity': '剩余容量 72%', '41% capacity': '剩余容量 41%', '88% capacity': '剩余容量 88%', '65% capacity': '剩余容量 65%', Open: '开放认购', '58% subscribed': '已认购 58%', 'Daily dealing': '每日申赎', '34% subscribed': '已认购 34%', 'Market open': '市场开放' }, note: '演示产品资料',
  },
  hi: {
    risk: { 'Low Risk': 'कम जोखिम', 'Medium Risk': 'मध्यम जोखिम', 'High Risk': 'उच्च जोखिम' }, returns: { 'projected APY': 'अनुमानित APY', 'projected yield': 'अनुमानित प्रतिफल', 'indicative yield': 'संकेतक प्रतिफल', 'AI score': 'AI स्कोर' }, liquidity: { 'Monthly window': 'मासिक विंडो', '90-day term': '90-दिन अवधि', 'Weekly queue': 'साप्ताहिक कतार', 'Quarterly window': 'त्रैमासिक विंडो', '12-month term': '12-माह अवधि', 'T+2 redemption': 'T+2 मोचन', '18-month term': '18-माह अवधि', 'Market hours': 'बाज़ार समय' }, availability: { '72% capacity': '72% क्षमता', '41% capacity': '41% क्षमता', '88% capacity': '88% क्षमता', '65% capacity': '65% क्षमता', Open: 'खुला', '58% subscribed': '58% सदस्यता', 'Daily dealing': 'दैनिक लेनदेन', '34% subscribed': '34% सदस्यता', 'Market open': 'बाज़ार खुला' }, note: 'प्रस्तुति हेतु डेमो उत्पाद',
  },
  es: {
    risk: { 'Low Risk': 'Riesgo bajo', 'Medium Risk': 'Riesgo medio', 'High Risk': 'Riesgo alto' }, returns: { 'projected APY': 'APY proyectado', 'projected yield': 'rendimiento proyectado', 'indicative yield': 'rendimiento indicativo', 'AI score': 'puntuación IA' }, liquidity: { 'Monthly window': 'Ventana mensual', '90-day term': 'Plazo de 90 días', 'Weekly queue': 'Cola semanal', 'Quarterly window': 'Ventana trimestral', '12-month term': 'Plazo de 12 meses', 'T+2 redemption': 'Reembolso T+2', '18-month term': 'Plazo de 18 meses', 'Market hours': 'Horario de mercado' }, availability: { '72% capacity': '72% de capacidad', '41% capacity': '41% de capacidad', '88% capacity': '88% de capacidad', '65% capacity': '65% de capacidad', Open: 'Abierto', '58% subscribed': '58% suscrito', 'Daily dealing': 'Operativa diaria', '34% subscribed': '34% suscrito', 'Market open': 'Mercado abierto' }, note: 'Producto demo para presentación',
  },
  ar: {
    risk: { 'Low Risk': 'مخاطر منخفضة', 'Medium Risk': 'مخاطر متوسطة', 'High Risk': 'مخاطر مرتفعة' }, returns: { 'projected APY': 'عائد سنوي متوقع', 'projected yield': 'عائد متوقع', 'indicative yield': 'عائد استرشادي', 'AI score': 'تقييم الذكاء الاصطناعي' }, liquidity: { 'Monthly window': 'نافذة شهرية', '90-day term': 'مدة 90 يومًا', 'Weekly queue': 'طابور أسبوعي', 'Quarterly window': 'نافذة ربع سنوية', '12-month term': 'مدة 12 شهرًا', 'T+2 redemption': 'استرداد T+2', '18-month term': 'مدة 18 شهرًا', 'Market hours': 'ساعات السوق' }, availability: { '72% capacity': 'سعة 72%', '41% capacity': 'سعة 41%', '88% capacity': 'سعة 88%', '65% capacity': 'سعة 65%', Open: 'متاح', '58% subscribed': 'اكتتاب 58%', 'Daily dealing': 'تعامل يومي', '34% subscribed': 'اكتتاب 34%', 'Market open': 'السوق مفتوح' }, note: 'منتج تجريبي للعرض',
  },
  fr: {
    risk: { 'Low Risk': 'Risque faible', 'Medium Risk': 'Risque modéré', 'High Risk': 'Risque élevé' }, returns: { 'projected APY': 'APY projeté', 'projected yield': 'rendement projeté', 'indicative yield': 'rendement indicatif', 'AI score': 'score IA' }, liquidity: { 'Monthly window': 'Fenêtre mensuelle', '90-day term': 'Durée de 90 jours', 'Weekly queue': 'File hebdomadaire', 'Quarterly window': 'Fenêtre trimestrielle', '12-month term': 'Durée de 12 mois', 'T+2 redemption': 'Rachat T+2', '18-month term': 'Durée de 18 mois', 'Market hours': 'Heures de marché' }, availability: { '72% capacity': '72 % de capacité', '41% capacity': '41 % de capacité', '88% capacity': '88 % de capacité', '65% capacity': '65 % de capacité', Open: 'Ouvert', '58% subscribed': '58 % souscrit', 'Daily dealing': 'Transactions quotidiennes', '34% subscribed': '34 % souscrit', 'Market open': 'Marché ouvert' }, note: 'Produit démo de présentation',
  },
  pt: {
    risk: { 'Low Risk': 'Risco baixo', 'Medium Risk': 'Risco médio', 'High Risk': 'Risco alto' }, returns: { 'projected APY': 'APY projetado', 'projected yield': 'retorno projetado', 'indicative yield': 'retorno indicativo', 'AI score': 'pontuação de IA' }, liquidity: { 'Monthly window': 'Janela mensal', '90-day term': 'Prazo de 90 dias', 'Weekly queue': 'Fila semanal', 'Quarterly window': 'Janela trimestral', '12-month term': 'Prazo de 12 meses', 'T+2 redemption': 'Resgate T+2', '18-month term': 'Prazo de 18 meses', 'Market hours': 'Horário de mercado' }, availability: { '72% capacity': '72% de capacidade', '41% capacity': '41% de capacidade', '88% capacity': '88% de capacidade', '65% capacity': '65% de capacidade', Open: 'Aberto', '58% subscribed': '58% subscrito', 'Daily dealing': 'Negociação diária', '34% subscribed': '34% subscrito', 'Market open': 'Mercado aberto' }, note: 'Produto demo para apresentação',
  },
}

export function localizeProduct(product: DemoProduct, locale: AppLocale): DemoProduct {
  if (locale === 'en') return product
  const copy = products[locale][product.id]
  const translated = meta[locale]
  return {
    ...product,
    title: copy?.title ?? product.title,
    subtitle: copy?.subtitle ?? product.subtitle,
    risk: (translated.risk[product.risk] ?? product.risk) as DemoProduct['risk'],
    returnLabel: translated.returns[product.returnLabel] ?? product.returnLabel,
    liquidity: translated.liquidity[product.liquidity] ?? product.liquidity,
    availability: translated.availability[product.availability] ?? product.availability,
    note: translated.note,
  }
}

export function categoryLabel(category: DemoProduct['category'], locale: AppLocale) {
  const labels: Record<AppLocale, Record<DemoProduct['category'], string>> = {
    en: { Compute: 'Compute', RWA: 'RWA', Stocks: 'Stocks', Prediction: 'Prediction' },
    'zh-CN': { Compute: '算力', RWA: 'RWA', Stocks: '美股', Prediction: '预测市场' },
    hi: { Compute: 'कंप्यूट', RWA: 'RWA', Stocks: 'शेयर', Prediction: 'पूर्वानुमान' },
    es: { Compute: 'Cómputo', RWA: 'RWA', Stocks: 'Acciones', Prediction: 'Predicción' },
    ar: { Compute: 'الحوسبة', RWA: 'RWA', Stocks: 'الأسهم', Prediction: 'التوقعات' },
    fr: { Compute: 'Calcul', RWA: 'RWA', Stocks: 'Actions', Prediction: 'Prédiction' },
    pt: { Compute: 'Computação', RWA: 'RWA', Stocks: 'Ações', Prediction: 'Previsão' },
  }
  return labels[locale][category]
}
