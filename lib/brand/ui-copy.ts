import { brandText } from './build-brand'

/** Only for authored UI dictionaries. Do not apply to server responses or historical records. */
export function mapBrandCopy<T>(input: T, locale?: string): T {
  if (typeof input === 'string') return brandText(input, locale) as T
  if (Array.isArray(input)) return input.map(value => mapBrandCopy(value, locale)) as T
  if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, value]) =>
    [key, mapBrandCopy(value, key === 'zh-CN' ? key : locale)])) as T
  return input
}
