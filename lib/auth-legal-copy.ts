import type { AppLocale } from './i18n'

export type AuthLegalKind = 'terms' | 'privacy' | 'licence'

export type AuthLegalCopy = {
  licence: string
  close: string
  readFull: string
  verify: string
  opensIn: string
  termsTitle: string
  privacyTitle: string
  updated: string
  updatedDate: string
  terms: { lede: string; points: [string, string, string] }
  privacy: { lede: string; points: [string, string, string] }
  licenceSheet: { lede: string; entity: string; regulator: string; type: string; number: string }
}

// Summaries only point at what the full documents cover; the published pages stay the binding text.
export const authLegalCopy: Record<AppLocale, AuthLegalCopy> = {
  en: {
    licence: 'Licensing', close: 'Close', readFull: 'Read the full text', verify: 'Verify on the regulator’s site', opensIn: 'Opens in a new tab', termsTitle: 'Terms of Service', privacyTitle: 'Privacy Policy', updated: 'Updated', updatedDate: 'September 18, 2026',
    terms: { lede: 'The conditions for using A-REIT.', points: ['Eligibility: 18 or older, and not in a sanctioned or prohibited jurisdiction.', 'You keep your account secure; accounts cannot be sold, transferred or shared.', 'Digital assets carry risk, and nothing here is investment, legal or tax advice.'] },
    privacy: { lede: 'How A-REIT handles your information.', points: ['What we collect, and how we use, share and retain it.', 'How cookies and local storage are used.', 'The rights you can exercise, and how to reach us.'] },
    licenceSheet: { lede: 'These details can be checked on the regulator’s official site.', entity: 'Operator', regulator: 'Regulator', type: 'Licence type', number: 'Licence no.' },
  },
  'zh-CN': {
    licence: '持牌信息', close: '关闭', readFull: '阅读全文', verify: '在监管机构官网核验', opensIn: '将在新标签页打开', termsTitle: '服务条款', privacyTitle: '隐私政策', updated: '更新于', updatedDate: '2026年9月18日',
    terms: { lede: '使用 A-REIT 平台的条件。', points: ['使用资格：年满 18 岁，且不在受制裁或被禁止的地区。', '账户安全由你负责，账户不可出售、转让或共享。', '数字资产存在风险，平台内容不构成投资、法律或税务建议。'] },
    privacy: { lede: 'A-REIT 如何处理你的信息。', points: ['我们收集哪些信息，以及如何使用、共享与保存。', 'Cookie 与本地存储的用途。', '你可以行使的权利，以及联系我们的方式。'] },
    licenceSheet: { lede: '以下信息可在监管机构官网核验。', entity: '运营主体', regulator: '监管机构', type: '牌照类型', number: '牌照编号' },
  },
  hi: {
    licence: 'लाइसेंस जानकारी', close: 'बंद करें', readFull: 'पूरा पाठ पढ़ें', verify: 'नियामक की साइट पर सत्यापित करें', opensIn: 'नए टैब में खुलेगा', termsTitle: 'सेवा की शर्तें', privacyTitle: 'गोपनीयता नीति', updated: 'अपडेट किया गया', updatedDate: '18 सितंबर 2026',
    terms: { lede: 'A-REIT के उपयोग की शर्तें।', points: ['पात्रता: 18 वर्ष या अधिक, और प्रतिबंधित क्षेत्र में न हों।', 'खाते की सुरक्षा आपकी ज़िम्मेदारी है; खाता बेचा, हस्तांतरित या साझा नहीं किया जा सकता।', 'डिजिटल परिसंपत्तियों में जोखिम है; यहाँ कुछ भी निवेश, कानूनी या कर सलाह नहीं है।'] },
    privacy: { lede: 'A-REIT आपकी जानकारी कैसे संभालता है।', points: ['हम क्या एकत्र करते हैं, और उसका उपयोग, साझा व संग्रह कैसे करते हैं।', 'कुकीज़ और लोकल स्टोरेज का उपयोग।', 'आपके अधिकार, और हमसे संपर्क कैसे करें।'] },
    licenceSheet: { lede: 'ये विवरण नियामक की आधिकारिक साइट पर जाँचे जा सकते हैं।', entity: 'संचालक', regulator: 'नियामक', type: 'लाइसेंस प्रकार', number: 'लाइसेंस सं.' },
  },
  es: {
    licence: 'Licencias', close: 'Cerrar', readFull: 'Leer el texto completo', verify: 'Verificar en el sitio del regulador', opensIn: 'Se abre en una pestaña nueva', termsTitle: 'Términos del servicio', privacyTitle: 'Política de privacidad', updated: 'Actualizado', updatedDate: '18 de septiembre de 2026',
    terms: { lede: 'Las condiciones para usar A-REIT.', points: ['Requisitos: mayor de 18 años y fuera de jurisdicciones sancionadas o prohibidas.', 'Tú proteges tu cuenta; no se puede vender, transferir ni compartir.', 'Los activos digitales conllevan riesgo y nada aquí es asesoramiento de inversión, legal o fiscal.'] },
    privacy: { lede: 'Cómo trata A-REIT tu información.', points: ['Qué recopilamos y cómo lo usamos, compartimos y conservamos.', 'Cómo se usan las cookies y el almacenamiento local.', 'Los derechos que puedes ejercer y cómo contactarnos.'] },
    licenceSheet: { lede: 'Estos datos pueden comprobarse en el sitio oficial del regulador.', entity: 'Operador', regulator: 'Regulador', type: 'Tipo de licencia', number: 'N.º de licencia' },
  },
  ar: {
    licence: 'معلومات الترخيص', close: 'إغلاق', readFull: 'قراءة النص الكامل', verify: 'التحقق على موقع الجهة التنظيمية', opensIn: 'يُفتح في علامة تبويب جديدة', termsTitle: 'شروط الخدمة', privacyTitle: 'سياسة الخصوصية', updated: 'آخر تحديث', updatedDate: '18 سبتمبر 2026',
    terms: { lede: 'شروط استخدام A-REIT.', points: ['الأهلية: 18 عامًا فأكثر، وألا تكون في منطقة خاضعة للعقوبات أو محظورة.', 'أنت مسؤول عن أمان حسابك؛ لا يجوز بيعه أو نقله أو مشاركته.', 'تنطوي الأصول الرقمية على مخاطر، ولا يُعد أي محتوى هنا نصيحة استثمارية أو قانونية أو ضريبية.'] },
    privacy: { lede: 'كيف تتعامل A-REIT مع معلوماتك.', points: ['ما نجمعه، وكيف نستخدمه ونشاركه ونحتفظ به.', 'كيفية استخدام ملفات تعريف الارتباط والتخزين المحلي.', 'الحقوق التي يمكنك ممارستها، وكيفية التواصل معنا.'] },
    licenceSheet: { lede: 'يمكن التحقق من هذه البيانات على الموقع الرسمي للجهة التنظيمية.', entity: 'الجهة المشغّلة', regulator: 'الجهة التنظيمية', type: 'نوع الترخيص', number: 'رقم الترخيص' },
  },
  fr: {
    licence: 'Agréments', close: 'Fermer', readFull: 'Lire le texte intégral', verify: 'Vérifier sur le site du régulateur', opensIn: 'S’ouvre dans un nouvel onglet', termsTitle: 'Conditions d’utilisation', privacyTitle: 'Politique de confidentialité', updated: 'Mis à jour le', updatedDate: '18 septembre 2026',
    terms: { lede: 'Les conditions d’utilisation d’A-REIT.', points: ['Éligibilité : 18 ans ou plus, hors juridiction sanctionnée ou interdite.', 'Vous protégez votre compte ; il ne peut être vendu, cédé ni partagé.', 'Les actifs numériques comportent des risques ; rien ici n’est un conseil en investissement, juridique ou fiscal.'] },
    privacy: { lede: 'Comment A-REIT traite vos informations.', points: ['Ce que nous collectons, et comment nous l’utilisons, le partageons et le conservons.', 'L’usage des cookies et du stockage local.', 'Les droits que vous pouvez exercer, et comment nous contacter.'] },
    licenceSheet: { lede: 'Ces informations sont vérifiables sur le site officiel du régulateur.', entity: 'Opérateur', regulator: 'Régulateur', type: 'Type d’agrément', number: 'N° d’agrément' },
  },
  pt: {
    licence: 'Licenciamento', close: 'Fechar', readFull: 'Ler o texto completo', verify: 'Verificar no site do regulador', opensIn: 'Abre numa nova aba', termsTitle: 'Termos de serviço', privacyTitle: 'Política de privacidade', updated: 'Atualizado em', updatedDate: '18 de setembro de 2026',
    terms: { lede: 'As condições para usar a A-REIT.', points: ['Elegibilidade: 18 anos ou mais e fora de jurisdições sancionadas ou proibidas.', 'Você protege sua conta; ela não pode ser vendida, transferida ou compartilhada.', 'Ativos digitais envolvem risco e nada aqui é aconselhamento de investimento, jurídico ou fiscal.'] },
    privacy: { lede: 'Como a A-REIT trata suas informações.', points: ['O que coletamos e como usamos, compartilhamos e guardamos.', 'Como cookies e armazenamento local são usados.', 'Os direitos que você pode exercer e como falar conosco.'] },
    licenceSheet: { lede: 'Estes dados podem ser verificados no site oficial do regulador.', entity: 'Operador', regulator: 'Regulador', type: 'Tipo de licença', number: 'N.º da licença' },
  },
}
