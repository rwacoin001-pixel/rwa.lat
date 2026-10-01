export type PostLocation = { city: string; countryCode: string; source: 'device' }
export const locationCopy = {
  en: ['Enable location', 'Locating…', 'Location failed. Retry', 'Location required to post. Only city / region is public.'],
  'zh-CN': ['授权定位', '定位中…', '定位失败，重试', '发帖须授权定位，仅公开城市／地区。'],
  hi: ['स्थान सक्षम करें', 'स्थान खोज रहे हैं…', 'स्थान विफल। फिर प्रयास करें', 'पोस्ट के लिए स्थान आवश्यक है। केवल शहर / क्षेत्र सार्वजनिक है।'],
  es: ['Permitir ubicación', 'Localizando…', 'Ubicación fallida. Reintentar', 'Ubicación obligatoria. Solo la ciudad / región es pública.'],
  ar: ['السماح بالموقع', 'جارٍ تحديد الموقع…', 'تعذر تحديد الموقع. أعد المحاولة', 'الموقع مطلوب للنشر. تظهر المدينة / المنطقة فقط.'],
  fr: ['Autoriser la localisation', 'Localisation…', 'Échec. Réessayer', 'Localisation obligatoire. Seule la ville / région est publique.'],
  pt: ['Permitir localização', 'Localizando…', 'Falha. Tentar novamente', 'Localização obrigatória. Só a cidade / região é pública.'],
} as const
/** Consent comes from the browser location prompt. Coordinates never enter our post API. */
export async function getPostLocation(locale: string): Promise<PostLocation> {
  if (!navigator.geolocation || !window.isSecureContext) throw new Error('LOCATION_UNAVAILABLE')
  const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 }))
  const params = new URLSearchParams({ latitude: String(position.coords.latitude), longitude: String(position.coords.longitude), localityLanguage: locale.split('-')[0] })
  // This free endpoint permits consented, live device coordinates only, directly from the browser.
  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`, { signal: AbortSignal.timeout(10000), credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error('LOCATION_LOOKUP_FAILED')
  const data = await response.json() as { city?: string; locality?: string; principalSubdivision?: string; countryCode?: string }
  const city = (data.city || data.locality || data.principalSubdivision || '').trim().slice(0, 80)
  const countryCode = (data.countryCode || '').toUpperCase()
  if (!city || !/^[A-Z]{2}$/.test(countryCode)) throw new Error('LOCATION_LOOKUP_FAILED')
  return { city, countryCode, source: 'device' }
}
