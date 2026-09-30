'use client'
import { useEffect } from 'react'
import { beginUiLoading } from './ui-loading'
export function useUiLoading(active: boolean) {
  useEffect(() => { if (active) return beginUiLoading() }, [active])
}
