export type SharePageResult = 'shared' | 'cancelled' | 'copied' | 'failed'
type SharePlatform = { share?: (data: ShareData) => Promise<void>; clipboard?: { writeText: (text: string) => Promise<void> } }

/** Cancellation leaves the clipboard alone; an unavailable or failed share can copy the same link. */
export async function sharePage(url: string, platform: SharePlatform): Promise<SharePageResult> {
  if (platform.share) {
    try { await platform.share({ url }); return 'shared' }
    catch (error) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'cancelled'
    }
  }
  if (platform.clipboard?.writeText) {
    try { await platform.clipboard.writeText(url); return 'copied' } catch { /* Report failure instead of pretending the link was copied. */ }
  }
  return 'failed'
}
