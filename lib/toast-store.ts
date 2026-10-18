import { toastTone, type ToastTone } from './toast-tone'

export type ToastState = { id: number; message: string; tone: ToastTone }

// One toast at a time, shared by every screen and the top bar. A newer message replaces the older one and restarts the clock.
let current: ToastState | null = null
let nextId = 1
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

export function showToast(message: string, tone?: ToastTone) {
  const resolved = tone ?? toastTone(message)
  current = { id: nextId++, message, tone: resolved }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { current = null; timer = null; emit() }, resolved === 'error' ? 3600 : 2600)
  emit()
}

export function subscribeToast(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const getToast = () => current
