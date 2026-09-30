'use client'
import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { RwaScreen } from '@/lib/rwa-routes'
import { getSessionToken } from '@/lib/api/_http'
import { getSummary } from '@/lib/api/summary'
import { useI18n, type AppLocale } from '@/lib/i18n'
import AppLoading from '@/components/app-loading'

const bootCopy: Record<AppLocale, { loading: string; network: string; failed: string; retry: string }> = {
  'zh-CN': { loading: '正在载入账户', network: '网络不可用，请检查连接后重试。', failed: '账户暂时无法载入，请重试。', retry: '重试' },
  en: { loading: 'Loading your account', network: 'Network unavailable. Check your connection and retry.', failed: 'Your account could not be loaded. Please retry.', retry: 'Retry' },
  es: { loading: 'Cargando tu cuenta', network: 'Sin conexión. Revisa la red y reintenta.', failed: 'No se pudo cargar tu cuenta. Reintenta.', retry: 'Reintentar' },
  ar: { loading: 'جارٍ تحميل حسابك', network: 'الشبكة غير متاحة. تحقق من الاتصال وأعد المحاولة.', failed: 'تعذر تحميل حسابك. حاول مجددًا.', retry: 'إعادة المحاولة' },
  fr: { loading: 'Chargement de votre compte', network: 'Réseau indisponible. Vérifiez la connexion et réessayez.', failed: 'Impossible de charger votre compte. Réessayez.', retry: 'Réessayer' },
  pt: { loading: 'Carregando sua conta', network: 'Sem rede. Verifique a conexão e tente de novo.', failed: 'Não foi possível carregar sua conta. Tente de novo.', retry: 'Tentar novamente' },
  hi: { loading: 'आपका खाता लोड हो रहा है', network: 'नेटवर्क उपलब्ध नहीं। कनेक्शन जाँचें और फिर प्रयास करें।', failed: 'आपका खाता लोड नहीं हुआ। फिर प्रयास करें।', retry: 'फिर प्रयास करें' },
}

export function BootScreen({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const c = bootCopy[locale]
  const goRef = useRef(go)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<'network' | 'failed' | null>(null)
  goRef.current = go
  useEffect(() => {
    let active = true
    const boot = async () => {
      setError(null)
      // Child effects run before the shell's mount effect, which resets the screen to the
      // initial route; navigating synchronously here would be overwritten and strand the loader.
      await new Promise(resolve => setTimeout(resolve, 0))
      if (!active) return
      if (!getSessionToken()) { goRef.current('login'); return }
      const result = await getSummary()
      if (!active) return
      if (result.ok) goRef.current('home')
      else if (result.error.status === 401) goRef.current('login')
      else setError(result.error.status === 0 ? 'network' : 'failed')
    }
    void boot()
    return () => { active = false }
  }, [attempt])
  if (!error) return <AppLoading />
  return <section className="screen s2-boot" aria-label={c.loading} aria-busy={!error}>{error
    ? <div className="rwa-error" role="alert"><AlertCircle size={20} aria-hidden="true" /><p>{c[error]}</p><button type="button" className="rwa-sel" data-state="rest" onClick={() => setAttempt(value => value + 1)}>{c.retry}</button></div>
    : <span className="rwa-skeleton" />}</section>
}
