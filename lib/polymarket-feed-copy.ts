import type { AppLocale } from '@/lib/app-locales'
import type { PolymarketCategory } from '@/lib/api/polymarket-feed'

type FeedCopy = {
  categories: Record<PolymarketCategory, string>
  more: string
  loading: string
  end: string
  retry: string
}

export const polymarketFeedCopy: Record<AppLocale, FeedCopy> = {
  en: { categories: { all: 'All', politics: 'Politics', sports: 'Sports', crypto: 'Crypto', finance: 'Finance', geopolitics: 'Geopolitics', earnings: 'Earnings', tech: 'Tech', culture: 'Culture', world: 'World' }, more: 'Show more', loading: 'Loading markets', end: 'All caught up', retry: 'Try again' },
  'zh-CN': { categories: { all: '全部', politics: '政治', sports: '体育', crypto: '加密', finance: '金融', geopolitics: '地缘政治', earnings: '财报', tech: '科技', culture: '文化', world: '世界' }, more: '查看更多', loading: '正在加载市场', end: '已显示全部', retry: '重试' },
  hi: { categories: { all: 'सभी', politics: 'राजनीति', sports: 'खेल', crypto: 'क्रिप्टो', finance: 'वित्त', geopolitics: 'भू-राजनीति', earnings: 'कमाई', tech: 'तकनीक', culture: 'संस्कृति', world: 'विश्व' }, more: 'और देखें', loading: 'बाज़ार लोड हो रहे हैं', end: 'सभी देख लिए', retry: 'फिर कोशिश करें' },
  es: { categories: { all: 'Todos', politics: 'Política', sports: 'Deportes', crypto: 'Cripto', finance: 'Finanzas', geopolitics: 'Geopolítica', earnings: 'Resultados', tech: 'Tecnología', culture: 'Cultura', world: 'Mundo' }, more: 'Ver más', loading: 'Cargando mercados', end: 'Eso es todo', retry: 'Reintentar' },
  ar: { categories: { all: 'الكل', politics: 'السياسة', sports: 'الرياضة', crypto: 'العملات الرقمية', finance: 'المال', geopolitics: 'الجغرافيا السياسية', earnings: 'الأرباح', tech: 'التقنية', culture: 'الثقافة', world: 'العالم' }, more: 'عرض المزيد', loading: 'جارٍ تحميل الأسواق', end: 'تم عرض الكل', retry: 'إعادة المحاولة' },
  fr: { categories: { all: 'Tout', politics: 'Politique', sports: 'Sports', crypto: 'Crypto', finance: 'Finance', geopolitics: 'Géopolitique', earnings: 'Résultats', tech: 'Tech', culture: 'Culture', world: 'Monde' }, more: 'Voir plus', loading: 'Chargement des marchés', end: 'Vous êtes à jour', retry: 'Réessayer' },
  pt: { categories: { all: 'Todos', politics: 'Política', sports: 'Esportes', crypto: 'Cripto', finance: 'Finanças', geopolitics: 'Geopolítica', earnings: 'Resultados', tech: 'Tecnologia', culture: 'Cultura', world: 'Mundo' }, more: 'Ver mais', loading: 'Carregando mercados', end: 'Tudo exibido', retry: 'Tentar novamente' },
}
