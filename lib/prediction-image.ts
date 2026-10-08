const REGIONAL_HOST = 'polymarket-upload.s3.us-east-2.amazonaws.com'
const STANDARD_HOST = 'polymarket-upload.s3.amazonaws.com'
const MEDIA_PATH = '/media/prediction'

function isSignedQueryName(name: string) {
  const lower = name.toLowerCase()
  return lower.startsWith('x-amz-') || lower === 'awsaccesskeyid' || lower === 'signature' || lower === 'expires'
}

/** Ordered image candidates. Public Polymarket bucket URLs prefer same-origin media, then standard S3, then the original. */
export function predictionImageSources(src?: string | null): string[] {
  const raw = src?.trim()
  if (!raw) return []
  let url: URL
  try { url = new URL(raw) } catch { return [raw] }
  const signed = [...url.searchParams.keys()].some(isSignedQueryName)
  const host = url.hostname
  if (url.protocol !== 'https:' || url.username || url.password || url.port || (host !== REGIONAL_HOST && host !== STANDARD_HOST) || signed) return [raw]
  const prefix = `https://${host}`
  if (!raw.toLowerCase().startsWith(prefix) || raw[prefix.length] !== '/') return [raw]
  // Slice the raw string so path encoding, plus signs and query stay byte-identical.
  const rest = raw.slice(prefix.length).split('#')[0]
  const queryAt = rest.indexOf('?')
  const key = queryAt < 0 ? rest : rest.slice(0, queryAt)
  const query = queryAt < 0 ? '' : rest.slice(queryAt + 1)
  const params = new URLSearchParams({key})
  if (query) params.set('q', query)
  const sources = [`${MEDIA_PATH}?${params}`, `https://${STANDARD_HOST}${raw.slice(prefix.length)}`, raw]
  return [...new Set(sources)]
}
