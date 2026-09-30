import type { AppLocale } from '@/lib/app-locales'

/** Exchange-density labels shared by the redesigned Maison pages (table heads, ladder, stat strips). `{x}` tokens go through fill(). */
export type ProCopy = {
  spread: string; bestBid: string; bestAsk: string; high: string; low: string; volume: string; change: string
  time: string; price: string; size: string; sum: string; name: string; mcap: string; last: string
  live: string; refresh: string; tapLevel: string; depth: string; tape: string; pressure: string
  fills: string; candles: string; range: string; count: string; nav: string; weight: string; value: string
}

const en: ProCopy = {
  spread: 'Spread', bestBid: 'Best bid', bestAsk: 'Best ask', high: 'High', low: 'Low', volume: 'Volume', change: 'Change',
  time: 'Time', price: 'Price', size: 'Size', sum: 'Total', name: 'Name', mcap: 'Mkt cap', last: 'Last',
  live: 'Live', refresh: 'Refreshes every {s}s', tapLevel: 'Tap a level to use its price', depth: 'Depth', tape: 'Live quotes', pressure: 'Book pressure',
  fills: 'Fills', candles: '{n} candles', range: 'Range', count: '{n} items', nav: 'NAV', weight: 'Weight', value: 'Value',
}
const zh: ProCopy = {
  spread: '价差', bestBid: '最优买价', bestAsk: '最优卖价', high: '最高', low: '最低', volume: '成交量', change: '涨跌',
  time: '时间', price: '价格', size: '数量', sum: '累计', name: '名称', mcap: '市值', last: '最新',
  live: '实时', refresh: '每 {s} 秒刷新', tapLevel: '点按档位即可带入价格', depth: '深度', tape: '实时行情', pressure: '盘口力量',
  fills: '成交', candles: '{n} 根K线', range: '区间', count: '{n} 项', nav: '净值', weight: '权重', value: '市值',
}
const hi: ProCopy = {
  spread: 'स्प्रेड', bestBid: 'सर्वश्रेष्ठ बोली', bestAsk: 'सर्वश्रेष्ठ पूछ', high: 'उच्च', low: 'निम्न', volume: 'वॉल्यूम', change: 'बदलाव',
  time: 'समय', price: 'कीमत', size: 'मात्रा', sum: 'कुल', name: 'नाम', mcap: 'मार्केट कैप', last: 'अंतिम',
  live: 'लाइव', refresh: 'हर {s} सेकंड में ताज़ा', tapLevel: 'कीमत भरने के लिए किसी स्तर पर टैप करें', depth: 'गहराई', tape: 'लाइव भाव', pressure: 'बुक दबाव',
  fills: 'फ़िल', candles: '{n} कैंडल', range: 'दायरा', count: '{n} आइटम', nav: 'NAV', weight: 'भार', value: 'मूल्य',
}
const es: ProCopy = {
  spread: 'Diferencial', bestBid: 'Mejor compra', bestAsk: 'Mejor venta', high: 'Máximo', low: 'Mínimo', volume: 'Volumen', change: 'Cambio',
  time: 'Hora', price: 'Precio', size: 'Cantidad', sum: 'Total', name: 'Nombre', mcap: 'Cap. mercado', last: 'Último',
  live: 'En vivo', refresh: 'Se actualiza cada {s} s', tapLevel: 'Toca un nivel para usar su precio', depth: 'Profundidad', tape: 'Cotizaciones en vivo', pressure: 'Presión del libro',
  fills: 'Ejecuciones', candles: '{n} velas', range: 'Rango', count: '{n} elementos', nav: 'VL', weight: 'Peso', value: 'Valor',
}
const ar: ProCopy = {
  spread: 'الفارق', bestBid: 'أفضل عرض شراء', bestAsk: 'أفضل عرض بيع', high: 'الأعلى', low: 'الأدنى', volume: 'الحجم', change: 'التغير',
  time: 'الوقت', price: 'السعر', size: 'الكمية', sum: 'الإجمالي', name: 'الاسم', mcap: 'القيمة السوقية', last: 'الأخير',
  live: 'مباشر', refresh: 'يتحدّث كل {s} ث', tapLevel: 'اضغط على مستوى لاستخدام سعره', depth: 'العمق', tape: 'أسعار مباشرة', pressure: 'ضغط الدفتر',
  fills: 'التنفيذات', candles: '{n} شمعة', range: 'النطاق', count: '{n} عنصر', nav: 'صافي القيمة', weight: 'الوزن', value: 'القيمة',
}
const fr: ProCopy = {
  spread: 'Écart', bestBid: 'Meilleur achat', bestAsk: 'Meilleure vente', high: 'Haut', low: 'Bas', volume: 'Volume', change: 'Variation',
  time: 'Heure', price: 'Prix', size: 'Quantité', sum: 'Cumul', name: 'Nom', mcap: 'Capi.', last: 'Dernier',
  live: 'En direct', refresh: 'Actualisé toutes les {s} s', tapLevel: 'Touchez un niveau pour reprendre son prix', depth: 'Profondeur', tape: 'Cours en direct', pressure: 'Pression du carnet',
  fills: 'Exécutions', candles: '{n} bougies', range: 'Plage', count: '{n} éléments', nav: 'VL', weight: 'Poids', value: 'Valeur',
}
const pt: ProCopy = {
  spread: 'Spread', bestBid: 'Melhor compra', bestAsk: 'Melhor venda', high: 'Máxima', low: 'Mínima', volume: 'Volume', change: 'Variação',
  time: 'Hora', price: 'Preço', size: 'Quantidade', sum: 'Total', name: 'Nome', mcap: 'Valor de mercado', last: 'Último',
  live: 'Ao vivo', refresh: 'Atualiza a cada {s} s', tapLevel: 'Toque num nível para usar o preço', depth: 'Profundidade', tape: 'Cotações ao vivo', pressure: 'Pressão do livro',
  fills: 'Execuções', candles: '{n} velas', range: 'Intervalo', count: '{n} itens', nav: 'VPC', weight: 'Peso', value: 'Valor',
}

export const proCopy: Record<AppLocale, ProCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
