'use client'
import { AlertCircle } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'

const COPY: Record<AppLocale, { failed: string; retry: string }> = {
  'zh-CN': { failed: '加载失败', retry: '重试' },
  en: { failed: 'Unable to load', retry: 'Retry' },
  es: { failed: 'No se pudo cargar', retry: 'Reintentar' },
  ar: { failed: 'تعذر التحميل', retry: 'إعادة المحاولة' },
  fr: { failed: 'Chargement impossible', retry: 'Réessayer' },
  pt: { failed: 'Falha ao carregar', retry: 'Tentar novamente' },
  hi: { failed: 'लोड नहीं हुआ', retry: 'फिर प्रयास करें' },
}

export function ErrorBlock({ message, retry, retryLabel }: { message?: string; retry?: () => void; retryLabel?: string }) {
  const c = COPY[useI18n().locale]
  return <div className="rwa-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><p>{message ?? c.failed}</p>{retry && <button type="button" className="rwa-sel" data-state="rest" onClick={retry}>{retryLabel ?? c.retry}</button>}</div>
}
