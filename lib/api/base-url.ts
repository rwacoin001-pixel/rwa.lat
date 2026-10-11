/** Empty configuration intentionally uses the current site's /v1 proxy. */
export function getApiBaseUrl(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  return (configuredBaseUrl ?? (process.env.NODE_ENV === 'production' ? 'https://api.a-reit.com' : ''))
    .trim()
    .replace(/\/+$/, '')
}
