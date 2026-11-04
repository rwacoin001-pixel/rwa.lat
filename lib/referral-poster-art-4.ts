import type { AppLocale } from './app-locales'

/* Round 4 (2026-11-04): quiet monumental architecture after the user's mood references (re-imagined around the A-REIT
   doorway, never copied) and three Shinkai-style anime skies. Each has its own movement line under the poster. */
export const ART_STYLES_4 = ['filmDesertGate', 'filmMirrorGate', 'filmGlassGate', 'filmSketchGate', 'filmBlueprintGate', 'filmCloudGate', 'animeSkyGate', 'animeTwilightGate', 'animeStarGate'] as const
type Art = typeof ART_STYLES_4[number]
type Rows = Record<AppLocale, Record<Art, string>>
const rows = (values: string[]) => Object.fromEntries(ART_STYLES_4.map((id, i) => [id, values[i]])) as Record<Art, string>

export const artStyleNames4: Rows = {
  'zh-CN': rows(['沙漠之门', '镜湖之门', '玻璃之门', '街角咖啡馆', '林间小屋', '云端之门', '夏日晴空', '黄昏车站', '星空站台']),
  en: rows(['Desert gate', 'Mirror lake gate', 'Glass gate', 'Corner café', 'Cabin in the trees', 'Gate in the clouds', 'Summer sky', 'Twilight crossing', 'Starlit platform']),
  hi: rows(['रेगिस्तान का द्वार', 'दर्पण झील का द्वार', 'काँच का द्वार', 'कोने का कैफ़े', 'पेड़ों के बीच कुटिया', 'बादलों में द्वार', 'गर्मियों का आसमान', 'सांझ का क्रॉसिंग', 'तारों भरा प्लेटफ़ॉर्म']),
  es: rows(['Puerta del desierto', 'Puerta del lago espejo', 'Puerta de cristal', 'Café de la esquina', 'Cabaña entre árboles', 'Puerta en las nubes', 'Cielo de verano', 'Cruce al atardecer', 'Andén estrellado']),
  ar: rows(['بوابة الصحراء', 'بوابة بحيرة المرآة', 'البوابة الزجاجية', 'مقهى الزاوية', 'كوخ بين الأشجار', 'بوابة في الغيوم', 'سماء الصيف', 'معبر الغروب', 'رصيف النجوم']),
  fr: rows(['Porte du désert', 'Porte du lac miroir', 'Porte de verre', 'Café du coin', 'Cabane dans les arbres', 'Porte dans les nuages', 'Ciel d’été', 'Passage au crépuscule', 'Quai étoilé']),
  pt: rows(['Portão do deserto', 'Portão do lago espelho', 'Portão de vidro', 'Café da esquina', 'Cabana entre árvores', 'Portão nas nuvens', 'Céu de verão', 'Travessia ao entardecer', 'Plataforma estrelada']),
}

export const artHeadlines4: Rows = {
  'zh-CN': rows(['远方不远，\n一起走过去。', '心静如水，\n门自会打开。', '一束光，\n照亮下一步。', '好地方，\n要和好朋友分享。', '慢慢来，\n好的东西会生长。', '往上走，\n就是晴天。', '那年夏天，\n我们一起出发。', '黄昏之后，\n灯会亮起来。', '今晚的星星，\n只为你停留。']),
  en: rows(['The far place\nis closer together.', 'Be still,\nand the door opens.', 'One beam of light\nfor the next step.', 'Good places\nare for good friends.', 'Take your time.\nGood things grow.', 'Keep climbing.\nIt’s clear above.', 'That summer,\nwe set out together.', 'After the twilight,\nthe lights come on.', 'Tonight’s stars\nare waiting for you.']),
  hi: rows(['दूर की मंज़िल,\nसाथ में पास है।', 'शांत रहें,\nद्वार खुल जाएगा।', 'रोशनी की एक किरण\nअगले कदम के लिए।', 'अच्छी जगहें\nअच्छे दोस्तों के लिए।', 'धीरे चलें।\nअच्छी चीज़ें बढ़ती हैं।', 'ऊपर चलते रहें।\nवहाँ आसमान साफ़ है।', 'उस गर्मी में,\nहम साथ निकले।', 'सांझ के बाद,\nरोशनी जलती है।', 'आज रात के तारे\nआपका इंतज़ार कर रहे हैं।']),
  es: rows(['Lo lejano\nestá más cerca juntos.', 'Calma,\ny la puerta se abre.', 'Un rayo de luz\npara el siguiente paso.', 'Los buenos lugares\nson para buenos amigos.', 'Sin prisa.\nLo bueno crece.', 'Sigue subiendo.\nArriba está despejado.', 'Aquel verano\nsalimos juntos.', 'Tras el atardecer,\nse encienden las luces.', 'Las estrellas de esta noche\nte esperan.']),
  ar: rows(['البعيد\nأقرب حين نكون معاً.', 'اهدأ،\nوسينفتح الباب.', 'شعاع ضوء\nللخطوة التالية.', 'الأماكن الجميلة\nللأصدقاء الطيبين.', 'على مهل.\nالأشياء الجميلة تنمو.', 'واصل الصعود.\nفالسماء صافية في الأعلى.', 'ذلك الصيف،\nانطلقنا معاً.', 'بعد الغروب،\nتضاء الأنوار.', 'نجوم الليلة\nتنتظرك.']),
  fr: rows(['Le lointain\nest plus proche à deux.', 'Restez calme,\nla porte s’ouvre.', 'Un rayon de lumière\npour le prochain pas.', 'Les beaux endroits\nsont pour les bons amis.', 'Prenez le temps.\nLe bon grandit.', 'Continuez de monter.\nLe ciel est clair là-haut.', 'Cet été-là,\nnous sommes partis ensemble.', 'Après le crépuscule,\nles lumières s’allument.', 'Les étoiles de ce soir\nvous attendent.']),
  pt: rows(['O distante\nfica mais perto juntos.', 'Calma,\ne a porta se abre.', 'Um raio de luz\npara o próximo passo.', 'Bons lugares\nsão para bons amigos.', 'Sem pressa.\nO que é bom cresce.', 'Continue subindo.\nLá em cima o céu é limpo.', 'Naquele verão,\npartimos juntos.', 'Depois do entardecer,\nas luzes se acendem.', 'As estrelas desta noite\nesperam por você.']),
}

type Movement = 'surreal' | 'surrealMin' | 'minimalArch' | 'sketch' | 'board' | 'dreamy' | 'anime'
const MOVEMENT_OF: Record<Art, Movement> = { filmDesertGate: 'surreal', filmMirrorGate: 'surrealMin', filmGlassGate: 'minimalArch', filmSketchGate: 'sketch', filmBlueprintGate: 'board', filmCloudGate: 'dreamy', animeSkyGate: 'anime', animeTwilightGate: 'anime', animeStarGate: 'anime' }
const movementNames: Record<AppLocale, Record<Movement, string>> = {
  'zh-CN': { surreal: '超现实主义', surrealMin: '超现实极简', minimalArch: '极简建筑', sketch: '建筑速写', board: '建筑图解', dreamy: '梦幻超现实', anime: '新海诚风' },
  en: { surreal: 'Surrealism', surrealMin: 'Surreal minimalism', minimalArch: 'Minimal architecture', sketch: 'Architectural sketch', board: 'Architectural board', dreamy: 'Dream surrealism', anime: 'Shinkai-style anime' },
  hi: { surreal: 'अतियथार्थवाद', surrealMin: 'अतियथार्थ न्यूनतमवाद', minimalArch: 'न्यूनतम वास्तुकला', sketch: 'वास्तु रेखाचित्र', board: 'वास्तु प्रस्तुति', dreamy: 'स्वप्निल अतियथार्थ', anime: 'शिंकाई-शैली एनीमे' },
  es: { surreal: 'Surrealismo', surrealMin: 'Minimalismo surrealista', minimalArch: 'Arquitectura minimalista', sketch: 'Boceto arquitectónico', board: 'Lámina de arquitectura', dreamy: 'Surrealismo onírico', anime: 'Anime estilo Shinkai' },
  ar: { surreal: 'السريالية', surrealMin: 'تبسيط سريالي', minimalArch: 'عمارة تبسيطية', sketch: 'رسم معماري', board: 'لوحة معمارية', dreamy: 'سريالية حالمة', anime: 'أنمي بأسلوب شينكاي' },
  fr: { surreal: 'Surréalisme', surrealMin: 'Minimalisme surréaliste', minimalArch: 'Architecture minimaliste', sketch: 'Croquis d’architecte', board: 'Planche d’architecture', dreamy: 'Surréalisme onirique', anime: 'Anime façon Shinkai' },
  pt: { surreal: 'Surrealismo', surrealMin: 'Minimalismo surrealista', minimalArch: 'Arquitetura minimalista', sketch: 'Esboço arquitetônico', board: 'Prancha de arquitetura', dreamy: 'Surrealismo onírico', anime: 'Anime estilo Shinkai' },
}
export function artMovement4(style: string, locale: AppLocale): string | null {
  const movement = MOVEMENT_OF[style as Art]
  return movement ? movementNames[locale][movement] : null
}
