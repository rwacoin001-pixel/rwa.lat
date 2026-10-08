const REGIONAL_HOST = 'polymarket-upload.s3.us-east-2.amazonaws.com'
const STANDARD_HOST = 'polymarket-upload.s3.amazonaws.com'

/** Ordered image candidates. Regional Polymarket bucket URLs prefer the standard bucket host, then the original. */
export function predictionImageSources(src?: string | null): string[] {
  const raw = src?.trim()
  if (!raw) return []
  let url: URL
  try { url = new URL(raw) } catch { return [raw] }
  const signed = [...url.searchParams.keys()].some(key => key.toLowerCase().startsWith('x-amz-'))
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hostname !== REGIONAL_HOST || signed) return [raw]
  // Swap only the host text so path, plus signs, encoding and query stay byte-identical.
  const prefix = `https://${REGIONAL_HOST}`
  if (!raw.toLowerCase().startsWith(prefix)) return [raw]
  return [`https://${STANDARD_HOST}${raw.slice(prefix.length)}`, raw]
}
