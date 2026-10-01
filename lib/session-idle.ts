export const IDLE_MS = 24 * 60 * 60 * 1000

export function needsIdleVerification(lastActive: unknown, now = Date.now()): boolean {
  return typeof lastActive !== 'number' || !Number.isFinite(lastActive) || lastActive <= 0 || lastActive > now || now - lastActive >= IDLE_MS
}
