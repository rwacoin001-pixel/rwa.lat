const pending = new Set<symbol>()
const listeners = new Set<() => void>()
const publish = () => listeners.forEach(listener => listener())
export const subscribeUiLoading = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const uiLoadingCount = () => pending.size
export function beginUiLoading() {
  if (typeof window === 'undefined') return () => {}
  const key = Symbol('loading')
  pending.add(key); publish()
  return () => { if (pending.delete(key)) publish() }
}
