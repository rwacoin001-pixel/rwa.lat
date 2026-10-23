'use client'
import { useSyncExternalStore } from 'react'

/** True on devices that opted in to the palette A preview (html[data-palette='a'], set before paint by the bootstrap). */
const subscribe = () => () => {}
export const usePaletteA = () => useSyncExternalStore(
  subscribe,
  () => document.documentElement.dataset.palette === 'a',
  () => false,
)
