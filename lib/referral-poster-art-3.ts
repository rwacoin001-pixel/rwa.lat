import type { AppLocale } from './app-locales'

/* Round 3 (2026-11-04): the four round-1 styles (Eastern ink, Van Gogh, Bauhaus, Cyberpunk) remade as film one-sheets,
   added beside the originals. Their caption shows the movement (see posterMovement in referral-poster-art.ts). */
export const ART_STYLES_3 = ['filmInkGate', 'filmInkFan', 'filmInkNight', 'filmVangoghNight', 'filmVangoghField', 'filmVangoghIris', 'filmBauhausStage', 'filmBauhausBuilding', 'filmBauhausPaper', 'filmCyberRain', 'filmCyberOrbit', 'filmCyberAlley'] as const
type Art = typeof ART_STYLES_3[number]
type Rows = Record<AppLocale, Record<Art, string>>
const rows = (values: string[]) => Object.fromEntries(ART_STYLES_3.map((id, i) => [id, values[i]])) as Record<Art, string>

export const artStyleNames3: Rows = {
  'zh-CN': rows(['云海山门', '折扇流云', '月门夜舟', '星夜街巷', '麦田之门', '鸢尾月门', '光之舞台', '黄昏建筑', '纸上构成', '雨夜之门', '云上之门', '霓虹巷口']),
  en: rows(['Gate above the clouds', 'Fan of clouds', 'Moon gate by night', 'Starry street', 'Gate in the wheat', 'Iris moon gate', 'Stage of light', 'Dusk architecture', 'Paper composition', 'Gate in the rain', 'Orbit gate', 'Neon alley']),
  hi: rows(['बादलों के ऊपर द्वार', 'बादलों का पंखा', 'रात का चंद्र द्वार', 'तारों भरी गली', 'गेहूँ में द्वार', 'आइरिस द्वार', 'रोशनी का मंच', 'सांझ की वास्तुकला', 'कागज़ की रचना', 'बारिश में द्वार', 'कक्षा द्वार', 'नियॉन गली']),
  es: rows(['Puerta sobre las nubes', 'Abanico de nubes', 'Puerta lunar nocturna', 'Calle estrellada', 'Puerta en el trigal', 'Puerta de lirios', 'Escenario de luz', 'Arquitectura al atardecer', 'Composición en papel', 'Puerta bajo la lluvia', 'Puerta orbital', 'Callejón de neón']),
  ar: rows(['بوابة فوق الغيوم', 'مروحة الغيوم', 'بوابة القمر ليلاً', 'شارع النجوم', 'بوابة في القمح', 'بوابة السوسن', 'مسرح الضوء', 'عمارة الغسق', 'تكوين ورقي', 'بوابة تحت المطر', 'بوابة المدار', 'زقاق النيون']),
  fr: rows(['Porte au-dessus des nuages', 'Éventail de nuages', 'Porte de lune la nuit', 'Rue étoilée', 'Porte dans les blés', 'Porte aux iris', 'Scène de lumière', 'Architecture au crépuscule', 'Composition de papier', 'Porte sous la pluie', 'Porte orbitale', 'Ruelle néon']),
  pt: rows(['Portão sobre as nuvens', 'Leque de nuvens', 'Portal da lua à noite', 'Rua estrelada', 'Portão no trigal', 'Portal de íris', 'Palco de luz', 'Arquitetura ao entardecer', 'Composição em papel', 'Portão na chuva', 'Portão orbital', 'Beco de neon']),
}

export const artHeadlines3: Rows = {
  'zh-CN': rows(['山门之内，\n别有天地。', '风起云涌，\n与你同行。', '夜色温柔，\n灯在前方。', '星光之下，\n总有一扇门为你开。', '播种今天，\n收获明天。', '繁花深处，\n另有新天。', '灯光亮起，\n轮到你登场。', '好的结构，\n经得起时间。', '简单的形状，\n清楚的方向。', '雨夜里，\n也有一扇门亮着。', '向上，\n再向上。', '走到尽头，\n是光。']),
  en: rows(['Beyond the gate,\nanother world.', 'When the clouds rise,\nwe rise together.', 'A gentle night.\nA light ahead.', 'Under the stars,\na door is open for you.', 'Sow today.\nHarvest tomorrow.', 'Past the flowers,\na new sky.', 'The lights are up.\nYour turn.', 'Good structure\nstands the test of time.', 'Simple shapes.\nClear direction.', 'Even in the rain,\na door is lit.', 'Up,\nand further up.', 'At the end of the alley,\nlight.']),
  hi: rows(['द्वार के पार,\nएक नई दुनिया।', 'बादल उठें,\nहम साथ उठें।', 'कोमल रात।\nआगे रोशनी।', 'तारों के नीचे,\nएक द्वार आपके लिए खुला है।', 'आज बोएँ।\nकल काटें।', 'फूलों के पार,\nनया आसमान।', 'रोशनी जल चुकी।\nअब आपकी बारी।', 'अच्छी बुनियाद\nसमय की कसौटी पर खरी।', 'सरल आकार।\nसाफ़ दिशा।', 'बारिश में भी,\nएक द्वार रोशन है।', 'ऊपर,\nऔर ऊपर।', 'गली के अंत में,\nरोशनी।']),
  es: rows(['Tras la puerta,\notro mundo.', 'Cuando suben las nubes,\nsubimos juntos.', 'Una noche serena.\nUna luz al frente.', 'Bajo las estrellas,\nuna puerta abierta para ti.', 'Siembra hoy.\nCosecha mañana.', 'Tras las flores,\nun cielo nuevo.', 'Se encienden las luces.\nTe toca.', 'Una buena estructura\nresiste el tiempo.', 'Formas simples.\nRumbo claro.', 'Incluso bajo la lluvia,\nuna puerta encendida.', 'Arriba,\ny más arriba.', 'Al final del callejón,\nluz.']),
  ar: rows(['خلف البوابة،\nعالم آخر.', 'حين تعلو الغيوم،\nنعلو معاً.', 'ليلة هادئة.\nوضوء في الأمام.', 'تحت النجوم،\nباب مفتوح لك.', 'ازرع اليوم.\nواحصد غداً.', 'خلف الزهور،\nسماء جديدة.', 'أُضيئت الأنوار.\nحان دورك.', 'البنية الجيدة\nتصمد أمام الزمن.', 'أشكال بسيطة.\nواتجاه واضح.', 'حتى تحت المطر،\nباب مضاء.', 'إلى الأعلى،\nثم أعلى.', 'في نهاية الزقاق،\nضوء.']),
  fr: rows(['Derrière la porte,\nun autre monde.', 'Quand les nuages s’élèvent,\nnous aussi.', 'Une nuit douce.\nUne lumière devant.', 'Sous les étoiles,\nune porte s’ouvre pour vous.', 'Semez aujourd’hui.\nRécoltez demain.', 'Au-delà des fleurs,\nun ciel neuf.', 'Les lumières s’allument.\nÀ vous.', 'Une bonne structure\nrésiste au temps.', 'Formes simples.\nCap clair.', 'Même sous la pluie,\nune porte éclairée.', 'Plus haut,\ntoujours plus haut.', 'Au bout de la ruelle,\nla lumière.']),
  pt: rows(['Além do portão,\noutro mundo.', 'Quando as nuvens sobem,\nsubimos juntos.', 'Uma noite serena.\nUma luz à frente.', 'Sob as estrelas,\num portão aberto para você.', 'Plante hoje.\nColha amanhã.', 'Além das flores,\num novo céu.', 'As luzes se acendem.\nÉ sua vez.', 'Uma boa estrutura\nresiste ao tempo.', 'Formas simples.\nRumo claro.', 'Mesmo na chuva,\num portão aceso.', 'Para cima,\ne mais além.', 'No fim do beco,\nluz.']),
}
