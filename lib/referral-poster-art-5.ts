import type { AppLocale } from './app-locales'
import { movementNames } from './referral-poster-art-4'
import { artStyleNames2 } from './referral-poster-art-2'

/* Round 5 (2026-11-04, user: more of the Shinkai-style and Memphis posters): six anime skies, six Memphis sets. */
export const ART_STYLES_5 = ['animeRainGate', 'animeSakuraGate', 'animeSnowGate', 'animeRooftopGate', 'animeSeaGate', 'animeFestivalGate', 'memphisLounge', 'memphisStair', 'memphisPool', 'memphisKiosk', 'memphisStillLife', 'memphisTerrace'] as const
type Art = typeof ART_STYLES_5[number]
type Rows = Record<AppLocale, Record<Art, string>>
const rows = (values: string[]) => Object.fromEntries(ART_STYLES_5.map((id, i) => [id, values[i]])) as Record<Art, string>

export const artStyleNames5: Rows = {
  'zh-CN': rows(['雨后晴天', '樱花坡道', '雪夜车站', '天台黄昏', '海边鸟居', '夏日祭', '孟菲斯客厅', '彩色楼梯', '泳池庭院', '街角冰淇淋', '静物', '地中海露台']),
  en: rows(['After the rain', 'Cherry blossom slope', 'Snowy station', 'Rooftop at dusk', 'Gate in the sea', 'Summer festival', 'Memphis lounge', 'Colour staircase', 'Pool courtyard', 'Corner gelato', 'Still life', 'Seaside terrace']),
  hi: rows(['बारिश के बाद', 'चेरी ब्लॉसम ढलान', 'बर्फ़ीला स्टेशन', 'सांझ की छत', 'समुद्र में द्वार', 'गर्मियों का उत्सव', 'मेम्फ़िस लाउंज', 'रंगीन सीढ़ियाँ', 'पूल आँगन', 'कोने की आइसक्रीम', 'स्थिर चित्र', 'समुद्री छत']),
  es: rows(['Tras la lluvia', 'Cuesta de cerezos', 'Estación nevada', 'Azotea al atardecer', 'Puerta en el mar', 'Festival de verano', 'Salón Memphis', 'Escalera de color', 'Patio con piscina', 'Heladería de la esquina', 'Bodegón', 'Terraza junto al mar']),
  ar: rows(['بعد المطر', 'منحدر أزهار الكرز', 'محطة ثلجية', 'سطح عند الغروب', 'بوابة في البحر', 'مهرجان الصيف', 'صالة ممفيس', 'درج ملوّن', 'فناء المسبح', 'محل البوظة', 'طبيعة صامتة', 'شرفة على البحر']),
  fr: rows(['Après la pluie', 'Pente des cerisiers', 'Gare sous la neige', 'Toit au crépuscule', 'Porte dans la mer', 'Fête d’été', 'Salon Memphis', 'Escalier coloré', 'Patio piscine', 'Glacier du coin', 'Nature morte', 'Terrasse en bord de mer']),
  pt: rows(['Depois da chuva', 'Ladeira das cerejeiras', 'Estação na neve', 'Terraço ao entardecer', 'Portal no mar', 'Festival de verão', 'Sala Memphis', 'Escada colorida', 'Pátio com piscina', 'Sorveteria da esquina', 'Natureza-morta', 'Terraço à beira-mar']),
}

export const artHeadlines5: Rows = {
  'zh-CN': rows(['雨停了，\n一起出发吧。', '春天来了，\n一起往上走。', '雪夜里，\n总有人在等你。', '城市的黄昏，\n我们的开始。', '夏天的海，\n一起去看看。', '烟花升起，\n好事发生。', '生活要有颜色，\n也要有朋友。', '一步一个颜色，\n一起往上。', '慢一点，\n享受此刻。', '好东西，\n要一起分享。', '小小的门，\n大大的可能。', '阳光正好，\n朋友正好。']),
  en: rows(['The rain has stopped.\nLet’s go.', 'Spring is here.\nLet’s climb together.', 'On a snowy night,\nsomeone is waiting.', 'The city at dusk,\nour beginning.', 'The summer sea.\nCome and see.', 'Fireworks rise.\nGood things happen.', 'Life needs colour\nand friends.', 'One colour, one step.\nUp together.', 'Slow down.\nEnjoy the moment.', 'Good things\nare better shared.', 'A small door,\nbig possibilities.', 'Perfect sun,\nperfect friends.']),
  hi: rows(['बारिश थम गई।\nचलो चलें।', 'वसंत आ गया।\nसाथ ऊपर चलें।', 'बर्फ़ीली रात में,\nकोई इंतज़ार कर रहा है।', 'शहर की सांझ,\nहमारी शुरुआत।', 'गर्मियों का समुद्र।\nआओ देखें।', 'आतिशबाज़ी उठी।\nअच्छा होता है।', 'ज़िंदगी में रंग चाहिए\nऔर दोस्त भी।', 'हर कदम एक रंग।\nसाथ ऊपर।', 'धीरे चलें।\nइस पल का आनंद लें।', 'अच्छी चीज़ें\nबाँटने से बेहतर होती हैं।', 'छोटा द्वार,\nबड़ी संभावनाएँ।', 'बढ़िया धूप,\nबढ़िया दोस्त।']),
  es: rows(['Ya paró la lluvia.\nVamos.', 'Llegó la primavera.\nSubamos juntos.', 'En una noche de nieve,\nalguien te espera.', 'La ciudad al atardecer,\nnuestro comienzo.', 'El mar de verano.\nVen a verlo.', 'Suben los fuegos artificiales.\nPasan cosas buenas.', 'La vida necesita color\ny amigos.', 'Un color, un paso.\nArriba juntos.', 'Despacio.\nDisfruta el momento.', 'Lo bueno\nse disfruta compartido.', 'Una puerta pequeña,\ngrandes posibilidades.', 'Sol perfecto,\namigos perfectos.']),
  ar: rows(['توقف المطر.\nهيا بنا.', 'جاء الربيع.\nلنصعد معاً.', 'في ليلة ثلجية،\nهناك من ينتظرك.', 'المدينة عند الغروب،\nبدايتنا.', 'بحر الصيف.\nتعال وانظر.', 'تنطلق الألعاب النارية.\nوتحدث أشياء جميلة.', 'الحياة تحتاج إلى ألوان\nوأصدقاء.', 'لون في كل خطوة.\nنصعد معاً.', 'على مهل.\nاستمتع باللحظة.', 'الأشياء الجميلة\nأجمل حين نتشاركها.', 'باب صغير،\nوإمكانات كبيرة.', 'شمس رائعة،\nوأصدقاء رائعون.']),
  fr: rows(['La pluie s’est arrêtée.\nOn y va.', 'Le printemps est là.\nMontons ensemble.', 'Par une nuit de neige,\nquelqu’un vous attend.', 'La ville au crépuscule,\nnotre début.', 'La mer d’été.\nVenez voir.', 'Les feux d’artifice montent.\nDe belles choses arrivent.', 'La vie a besoin de couleurs\net d’amis.', 'Une couleur, un pas.\nOn monte ensemble.', 'Ralentissez.\nProfitez de l’instant.', 'Les bonnes choses\nse partagent.', 'Une petite porte,\nde grandes possibilités.', 'Soleil parfait,\namis parfaits.']),
  pt: rows(['A chuva parou.\nVamos.', 'A primavera chegou.\nVamos subir juntos.', 'Numa noite de neve,\nalguém espera por você.', 'A cidade ao entardecer,\no nosso começo.', 'O mar de verão.\nVenha ver.', 'Os fogos sobem.\nCoisas boas acontecem.', 'A vida precisa de cor\ne de amigos.', 'Uma cor, um passo.\nSubindo juntos.', 'Devagar.\nAproveite o momento.', 'Coisas boas\nsão melhores compartilhadas.', 'Uma porta pequena,\ngrandes possibilidades.', 'Sol perfeito,\namigos perfeitos.']),
}

/** Line under the poster: 新海诚风 for the anime skies, 孟菲斯 for the Memphis sets. */
export function artMovement5(style: string, locale: AppLocale): string | null {
  if (style.startsWith('anime') && (ART_STYLES_5 as readonly string[]).includes(style)) return movementNames[locale].anime
  if (style.startsWith('memphis')) return artStyleNames2[locale].artMemphis
  return null
}
