'use client'

import { Check, FileText } from 'lucide-react'
import { useState } from 'react'
import RwaTopbar from '@/components/rwa-topbar'
import { Notice } from '@/components/ui/Notice'
import { useI18n } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { acknowledgeDisclosure, listBasketDisclosures } from '@/lib/api/markets'
import { basketRouteCopy } from '@/lib/route-copy'
import { backOr } from '@/lib/maison-nav'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'

const back = () => backOr('/markets?tab=baskets')

/** `/invest/basket/disclosures`: every published basket disclosure, each acknowledged on its own. */
export function BasketDisclosuresScreen() {
  const { locale } = useI18n()
  const copy = basketRouteCopy[locale]
  const topbar = <RwaTopbar screen="basket-disclosures" title={copy.disclosures} onBack={back} />
  const list = useQuery('basket:disclosures', listBasketDisclosures, { staleTime: 5 * 60_000 })
  const [acked, setAcked] = useState<ReadonlySet<string>>(new Set())
  const [pending, setPending] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const acknowledge = async (id: string) => {
    if (pending) return
    setPending(id)
    setFailed(false)
    const result = await acknowledgeDisclosure(id)
    setPending(null)
    if (result.ok) setAcked((current) => new Set(current).add(id))
    else setFailed(true)
  }
  const items = list.data

  return <MaisonPage page="basket-disclosures" dock topbar={topbar}>
    <header className={s.hero}>
      <p className={s.kicker}>{copy.eyebrow}</p>
      <h1 className={s.titleL}>{copy.disclosures}</h1>
      <p className={s.lede}>{copy.disclosureBody}</p>
    </header>
    {!items && !list.error && <Skeleton rows={4} />}
    {!items && list.error && <StateBlock tone="error" title={copy.unavailable} retry={list.refetch} retryLabel={copy.retry} />}
    {items && !items.length && <StateBlock title={copy.noHoldings} />}
    {items && items.length > 0 && <ul className={s.list}>{items.map((item) => {
      const done = acked.has(item.id)
      return <li key={item.id} className={s.card} style={{ marginBottom: 12 }}>
        <p className={s.kicker}><FileText size={13} aria-hidden="true" /> v{item.version}</p>
        <h2 style={{ margin: '4px 0 6px', fontSize: 15 }}>{item.title}</h2>
        <p className={s.lede} style={{ whiteSpace: 'pre-line' }}>{item.content}</p>
        <button type="button" className={s.ghost} disabled={done || pending === item.id} onClick={() => void acknowledge(item.id)}>{done ? <><Check size={14} aria-hidden="true" /> {copy.acknowledged}</> : copy.acknowledge}</button>
      </li>
    })}</ul>}
    {failed && <Notice tone="error">{copy.actionFailed}</Notice>}
  </MaisonPage>
}
