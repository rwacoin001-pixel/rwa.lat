'use client'
import { Toaster, toast } from 'sonner'
import { useRwaTheme } from '@/lib/rwa-theme'
export function Toast() { const { theme } = useRwaTheme(); return <Toaster theme={theme} toastOptions={{ className: 'rwa-toast' }} /> }
export { toast }
