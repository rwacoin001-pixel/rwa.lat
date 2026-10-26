import { apiUrl, getSessionToken } from './_http'

/**
 * Live unread count (server-sent events over fetch, so the session header goes with it). Calls `onUnread` with the
 * count at once and whenever it changes; reconnects with a growing pause after a drop; stops when `signal` aborts.
 * Returns nothing — callers keep their polling as the fallback, this only makes changes show up sooner.
 */
export function watchUnread(onUnread: (unread: number) => void, signal: AbortSignal) {
  let pause = 2_000
  const connect = async () => {
    while (!signal.aborted) {
      const token = getSessionToken()
      if (!token) return
      try {
        const response = await fetch(apiUrl('/v1/notifications/stream'), { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' }, cache: 'no-store', signal })
        if (response.status === 401 || response.status === 403) return
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`)
        pause = 2_000
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += value
          let cut: number
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, cut)
            buffer = buffer.slice(cut + 2)
            const event = /^event: ?(.*)$/m.exec(block)?.[1]?.trim() ?? 'message'
            const data = block.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
            if (event !== 'unread' || !data) continue
            try { const parsed = JSON.parse(data) as { unread?: unknown }; if (typeof parsed.unread === 'number') onUnread(parsed.unread) } catch { /* a malformed event is skipped */ }
          }
        }
      } catch { if (signal.aborted) return }
      await new Promise((resolve) => setTimeout(resolve, pause))
      pause = Math.min(pause * 2, 60_000)
    }
  }
  void connect()
}
