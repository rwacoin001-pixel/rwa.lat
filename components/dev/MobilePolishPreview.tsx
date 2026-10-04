'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRwaTheme } from '@/lib/rwa-theme'
import { ParticleStartupVisual } from '@/components/app-startup'
import { TransferScanner } from '@/components/maison/TransferScanner'
import KycCapture from '@/components/maison/KycCapture'
import { AiChatScreen } from '@/components/maison/AiChatScreen'
import { MaisonPage } from '@/components/maison/primitives'
import { transferRecipientFromCode } from '@/lib/transfer-code'

/** Local visual harness. Requests are normal: isolated browser tests intercept them.
    This route is absent from production; it never approves identity or moves funds. */
export default function MobilePolishPreview() {
  const mode = useSearchParams().get('screen') ?? 'index'
  const { theme, toggleTheme } = useRwaTheme()
  const [open, setOpen] = useState(true)
  const [recipient, setRecipient] = useState('')
  return <main className="rwa-shell"><div className="rwa-mobile" data-theme={theme} data-screen="ai">
    {open && mode === 'startup' && <ParticleStartupVisual theme={theme} />}
    {open && mode === 'scanner' && <MaisonPage page="transfer"><TransferScanner onCode={code => { const value = transferRecipientFromCode(code, window.location.origin); if (!value) return false; setRecipient(value); setOpen(false); return true }} onClose={() => setOpen(false)} /></MaisonPage>}
    {open && mode === 'kyc' && <MaisonPage page="kyc"><KycCapture onClose={() => setOpen(false)} onComplete={() => setOpen(false)} /></MaisonPage>}
    {open && mode === 'ai' && <AiChatScreen onClose={() => setOpen(false)} onPlan={() => undefined} />}
    {(!open || mode === 'index') && <div style={{ padding: 24 }}><h1>Mobile preview · isolated QA</h1>{recipient && <output data-recipient>{recipient}</output>}<button onClick={toggleTheme}>Theme: {theme}</button><nav style={{ display: 'grid', gap: 16, marginTop: 24 }}>{['startup', 'scanner', 'kyc', 'ai'].map(screen => <a key={screen} href={`?screen=${screen}`}>{screen}</a>)}</nav></div>}
  </div></main>
}
