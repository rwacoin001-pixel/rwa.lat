/**
 * Quote freshness must not depend on the visitor's device clock.
 *
 * Order books carry `fetchedAt` from the server's clock. The ticket and the market rows compare it with
 * `Date.now()` and treat a book more than 5 s "in the future" or more than 120 s old as expired, so a phone
 * whose clock runs a few seconds slow saw every quote as "expired" the moment it arrived (measured
 * 2026-10-14: a desktop 3–5 s behind Cloudflare sat right at the limit) and refreshing could not help.
 *
 * On receipt, re-express each book's age on the device clock: the server says how old the book was when it
 * answered (`serverNow - fetchedAt`), and the device knows when the answer arrived.
 */
export function onDeviceClock<T extends { fetchedAt: string }>(book: T | null | undefined, serverNow: string | null | undefined, receivedAt = Date.now()): T | null {
  if (!book) return null
  const server = Date.parse(serverNow ?? '')
  const fetched = Date.parse(book.fetchedAt)
  if (!Number.isFinite(server) || !Number.isFinite(fetched)) return book
  const age = Math.max(0, server - fetched)
  return { ...book, fetchedAt: new Date(receivedAt - age).toISOString() }
}
