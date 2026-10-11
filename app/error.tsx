'use client'

import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SystemState } from '@/components/system-state'

const RELOAD_KEY = 'a-reit.chunk-reload-at'
// After a deploy, an open page can ask for a chunk the new build no longer ships.
const STALE_BUILD = /ChunkLoadError|Loading (?:CSS )?chunk|dynamically imported module|Importing a module script failed|Unexpected token '<'/i

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const stale = STALE_BUILD.test(`${error.name} ${error.message}`)
  const [reloading, setReloading] = useState(false)

  const reload = () => {
    setReloading(true)
    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* Storage is optional. */ }
    window.location.reload()
  }

  useEffect(() => {
    console.error(error)
    if (!stale) return
    // Reload once to pick up the current build; the timestamp stops a loop if the chunk is truly gone.
    let last = 0
    try { last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) } catch { /* Storage is optional. */ }
    if (Date.now() - last > 30_000) reload()
  }, [error])

  const retry = () => {
    if (stale) return reload()
    startTransition(() => { router.refresh(); reset() })
  }

  return <SystemState kind="error" reference={error.digest} onRetry={retry} retrying={reloading} />
}
