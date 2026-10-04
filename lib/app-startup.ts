export const APP_STARTUP_KEY = 'rwa:startup:logo:v2'

export function shouldShowAppStartup({ pathname, installed, seen, reducedMotion }: {
  pathname: string; installed: boolean; seen: boolean; reducedMotion: boolean
}) {
  if (!installed || seen || reducedMotion) return false
  return !/^\/(?:desktop|auth|dev|design-preview|privacy|terms)(?:\/|$)/.test(pathname)
}
