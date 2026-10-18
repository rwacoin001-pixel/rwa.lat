/**
 * Number of unread notifications in whatever the API returned. A malformed or unexpected body counts as zero:
 * the bell badge is decoration and must never take the page down with it.
 */
export function countUnread(data: unknown): number {
  if (!Array.isArray(data)) return 0
  let count = 0
  for (const item of data) if (item && typeof item === 'object' && !(item as { readAt?: unknown }).readAt) count++
  return count
}
