/** Change string values only: keys and the independent unpublished draft are preserved. */
export function supportBrand(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/RWA\.LAT/g, 'A-REIT').replace(/rwa\.lat/g, 'a-reit.com')
  if (Array.isArray(value)) return value.map(supportBrand)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, key === 'supportEmail' ? 'support@a-reit.com' : supportBrand(item)]))
  return value
}
