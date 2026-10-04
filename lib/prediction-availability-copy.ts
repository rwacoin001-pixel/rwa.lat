import type {AppLocale} from './app-locales'
const keys=['Ends in','Scheduled end reached','Closed','Hide unavailable','Checking quotes','Refresh quotes','Quotes unavailable','No sell orders','Small capacity','Price unavailable','Days','Paused','How to play'] as const
const labels:Record<AppLocale,readonly string[]>={
  en:keys,
  'zh-CN':['距结束','截止时间已到','已关闭','隐藏不可购买','正在更新报价','刷新报价','报价暂不可用','暂无卖盘','卖盘较少','价格不可用','天','已暂停','玩法介绍'],
  hi:['समाप्ति में','निर्धारित समय पूरा हुआ','बंद','अनुपलब्ध छिपाएँ','भाव जाँचे जा रहे हैं','भाव रीफ़्रेश करें','भाव उपलब्ध नहीं','बेचने के आदेश नहीं','कम क्षमता','कीमत उपलब्ध नहीं','दिन','रोका गया','कैसे खेलें'],
  es:['Termina en','Hora de cierre alcanzada','Cerrado','Ocultar no disponibles','Comprobando precios','Actualizar precios','Precios no disponibles','Sin órdenes de venta','Capacidad limitada','Precio no disponible','días','Pausado','Cómo participar'],
  ar:['ينتهي خلال','بلغ وقت الإغلاق المحدد','مغلق','إخفاء غير المتاح','جار التحقق من الأسعار','تحديث الأسعار','الأسعار غير متاحة','لا توجد أوامر بيع','سيولة محدودة','السعر غير متاح','أيام','متوقف','كيفية المشاركة'],
  fr:['Se termine dans','Échéance atteinte','Fermé','Masquer les indisponibles','Vérification des prix','Actualiser les prix','Prix indisponibles','Aucune offre de vente','Capacité limitée','Prix indisponible','jours','En pause','Comment participer'],
  pt:['Encerra em','Horário de encerramento atingido','Fechado','Ocultar indisponíveis','Verificando preços','Atualizar preços','Preços indisponíveis','Sem ofertas de venda','Capacidade limitada','Preço indisponível','dias','Pausado','Como participar'],
}
export function predictionAvailabilityText(locale:AppLocale,key:typeof keys[number]) {return labels[locale][keys.indexOf(key)]}
