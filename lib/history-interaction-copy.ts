import type { AppLocale } from '@/lib/app-locales'

export type HistoryRange = '7' | '30' | '90' | 'all'

type HistoryInteractionCopy = {
  ranges: Record<HistoryRange, string>
  rangeLabel: string
  latest: string
  reading: string
  read: string
  endRead: string
  readHint: string
  endHint: string
  chartLabel: string
  since: string
  points: string
}

/** Copy for the portfolio history chart's reading mode and range switch. `{d}` = date, `{n}` = point count. */
export const historyInteractionCopy: Record<AppLocale, HistoryInteractionCopy> = {
  en: {
    ranges: { '7': '7D', '30': '30D', '90': '90D', all: 'All' }, rangeLabel: 'History range',
    latest: 'Latest record', reading: 'Reading', read: 'Inspect values', endRead: 'End reading',
    readHint: 'Or press and hold the chart', endHint: 'Drag or use arrow keys · Esc to exit',
    chartLabel: 'Portfolio value history. Press and hold, or use arrow keys, to read values. Esc exits.',
    since: 'vs {d}', points: '{n} records',
  },
  'zh-CN': {
    ranges: { '7': '7天', '30': '30天', '90': '90天', all: '全部' }, rangeLabel: '历史区间',
    latest: '最新记录', reading: '历史读数', read: '查看读数', endRead: '结束读数',
    readHint: '也可长按图表', endHint: '拖动或方向键查看 · Esc 退出',
    chartLabel: '资产价值历史。长按拖动或使用方向键查看读数，Esc 退出。',
    since: '较 {d}', points: '{n} 条记录',
  },
  hi: {
    ranges: { '7': '7 दिन', '30': '30 दिन', '90': '90 दिन', all: 'सभी' }, rangeLabel: 'इतिहास अवधि',
    latest: 'नवीनतम रिकॉर्ड', reading: 'रीडिंग', read: 'मान देखें', endRead: 'रीडिंग बंद करें',
    readHint: 'या चार्ट को दबाकर रखें', endHint: 'खींचें या तीर कुंजियाँ · बाहर निकलने के लिए Esc',
    chartLabel: 'पोर्टफोलियो मूल्य इतिहास। मान पढ़ने के लिए दबाकर रखें या तीर कुंजियाँ उपयोग करें। Esc से बाहर निकलें।',
    since: '{d} की तुलना में', points: '{n} रिकॉर्ड',
  },
  es: {
    ranges: { '7': '7 d', '30': '30 d', '90': '90 d', all: 'Todo' }, rangeLabel: 'Periodo del historial',
    latest: 'Último registro', reading: 'Lectura', read: 'Ver valores', endRead: 'Terminar lectura',
    readHint: 'O mantén pulsado el gráfico', endHint: 'Arrastra o usa las flechas · Esc para salir',
    chartLabel: 'Historial del valor de la cartera. Mantén pulsado o usa las flechas para leer valores. Esc para salir.',
    since: 'vs. {d}', points: '{n} registros',
  },
  ar: {
    ranges: { '7': '7 أيام', '30': '30 يومًا', '90': '90 يومًا', all: 'الكل' }, rangeLabel: 'نطاق السجل',
    latest: 'أحدث سجل', reading: 'قراءة', read: 'عرض القيم', endRead: 'إنهاء القراءة',
    readHint: 'أو اضغط مطولًا على الرسم', endHint: 'اسحب أو استخدم مفاتيح الأسهم · Esc للخروج',
    chartLabel: 'سجل قيمة المحفظة. اضغط مطولًا أو استخدم مفاتيح الأسهم لقراءة القيم. Esc للخروج.',
    since: 'مقارنة بـ {d}', points: '{n} سجلات',
  },
  fr: {
    ranges: { '7': '7 j', '30': '30 j', '90': '90 j', all: 'Tout' }, rangeLabel: 'Période de l’historique',
    latest: 'Dernier relevé', reading: 'Lecture', read: 'Lire les valeurs', endRead: 'Terminer la lecture',
    readHint: 'Ou appuyez longuement sur le graphique', endHint: 'Glissez ou utilisez les flèches · Échap pour quitter',
    chartLabel: 'Historique de la valeur du portefeuille. Appui long ou flèches pour lire les valeurs. Échap pour quitter.',
    since: 'vs {d}', points: '{n} relevés',
  },
  pt: {
    ranges: { '7': '7 d', '30': '30 d', '90': '90 d', all: 'Tudo' }, rangeLabel: 'Período do histórico',
    latest: 'Último registro', reading: 'Leitura', read: 'Ver valores', endRead: 'Encerrar leitura',
    readHint: 'Ou mantenha o gráfico pressionado', endHint: 'Arraste ou use as setas · Esc para sair',
    chartLabel: 'Histórico do valor da carteira. Mantenha pressionado ou use as setas para ler valores. Esc para sair.',
    since: 'vs. {d}', points: '{n} registros',
  },
}
