'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, ArrowUpRight, Eye, EyeOff, QrCode } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { HomeState } from '@/lib/home-lifecycle'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { fmtUsd, fromAtomic } from '@/lib/money'
import { fundsCopy } from '@/lib/maison-funds-copy'
import { EASE, useSheen } from './maison-motion'
import { HomeEmailBinding } from './HomeEmailBinding'
import styles from '@/components/screens/P04-HomeMaison.module.css'

export type HomePortfolioSnapshot = {
  totalAssetsAtomic: string | null
  totalAssetsDecimals: number
  availableAtomic: string | null
  availableDecimals: number
  holdings: number | null
  currency: 'USD' | 'USDT'
}

const cardTitles: Record<AppLocale, string> = {
  en: 'My assets', 'zh-CN': '我的资产', hi: 'मेरी संपत्तियाँ', es: 'Mis activos',
  ar: 'أصولي', fr: 'Mes actifs', pt: 'Meus ativos',
}

function amount(atomic: string | null, decimals: number, locale: AppLocale) {
  if (atomic === null || !/^\d+$/.test(atomic) || !Number.isInteger(decimals) || decimals < 0 || decimals > 78) return '—'
  try { return fmtUsd(fromAtomic(atomic, decimals), { locale }).replace(/^\$/, '') } catch { return '—' }
}

type Props = {
  state: HomeState
  account: HomePortfolioSnapshot | null
  labels: { portfolio: string; available: string; holdings: string; showBalance: string; hideBalance: string }
  status: string
  ctaLabel: string | null
  onPrimary: () => void
  onPortfolio: () => void
  onCashAction: (path: string) => void
  sampleLabel?: string
  emailBinding?: { userId: string; onVerified: () => void }
}

/** Presentation only: account state and guarded cash navigation remain owned by the app. */
export function HomePortfolioCard({ state, account, labels, status, ctaLabel, onPrimary, onPortfolio, onCashAction, sampleLabel, emailBinding }: Props) {
  const { locale, t } = useI18n()
  const reduced = useReducedMotion()
  const cardRef = useSheen<HTMLDivElement>()
  const [hideBalance, setHideBalance] = useState(false)
  const showNotice = Boolean(account && (state.degraded || state.variant))
  const total = account ? amount(account.totalAssetsAtomic, account.totalAssetsDecimals, locale) : '—'
  const available = account ? amount(account.availableAtomic, account.availableDecimals, locale) : '—'
  const cashActions = [
    { label: t('wallet.deposit'), path: '/assets/cash/deposit', Icon: ArrowDownToLine },
    { label: t('wallet.withdraw'), path: '/assets/cash/withdraw', Icon: ArrowUpFromLine },
    { label: t('wallet.transfer'), path: '/assets/cash/transfer', Icon: ArrowRightLeft },
    { label: fundsCopy[locale].receive.action, path: '/assets/cash/receive', Icon: QrCode },
  ]

  return <motion.div ref={cardRef} className={styles.card} data-lifecycle={state.lifecycle} data-account={Boolean(account)} initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .8, ease: EASE, delay: .25 }}>
    <span className={styles.cardSheen} aria-hidden="true" />
    <div className={styles.cardTop}>
      <div className={styles.cardHeading}>
        {account ? <button type="button" className={styles.cardTitle} onClick={onPortfolio}>{cardTitles[locale]}</button> : <span>{labels.portfolio}</span>}
        {account && <button type="button" className={styles.cardPrivacy} onClick={() => setHideBalance(value => !value)} aria-label={hideBalance ? labels.showBalance : labels.hideBalance} aria-pressed={hideBalance}>{hideBalance ? <EyeOff size={17} /> : <Eye size={17} />}</button>}
      </div>
      {sampleLabel ? <small className={styles.cardSample}>{sampleLabel}</small> : account && ctaLabel && !showNotice ? <button type="button" className={styles.cardExplore} onClick={onPrimary} aria-label={ctaLabel} title={ctaLabel}><ArrowUpRight size={18} /></button> : null}
    </div>
    {account ? <>
      <div className={styles.cardValue} dir="ltr">
        <strong title={hideBalance ? undefined : total}>{hideBalance ? '••••••' : total}</strong>
        <span className={styles.cardCurrency}>{account.currency}</span>
      </div>
      <div className={styles.cardFoot}>
        <span><small>{labels.available}</small><b dir="ltr">{hideBalance ? '••••' : available}</b></span>
        <span><small>{labels.holdings}</small><b>{account.holdings === null ? '—' : new Intl.NumberFormat(locale).format(account.holdings)}</b></span>
      </div>
      {showNotice && !emailBinding && <div className={styles.cardNotice} role="status"><span>{status}</span>{ctaLabel && <button type="button" onClick={onPrimary}>{ctaLabel}<ArrowUpRight size={14} /></button>}</div>}
      {emailBinding && <HomeEmailBinding key={emailBinding.userId} userId={emailBinding.userId} onVerified={emailBinding.onVerified} />}
      <div className={styles.cardActions} role="group" aria-label={cashActions.map(action => action.label).join(', ')}>
        {cashActions.map(({ label, path, Icon }) => <button key={path} type="button" onClick={() => onCashAction(path)}><Icon size={21} strokeWidth={1.65} aria-hidden="true" /><span>{label}</span></button>)}
      </div>
    </> : <>
      <strong className={styles.cardStatus} aria-live="polite">{status}</strong>
      {emailBinding && <HomeEmailBinding key={emailBinding.userId} userId={emailBinding.userId} onVerified={emailBinding.onVerified} />}
      {ctaLabel && !emailBinding && <motion.button type="button" className={styles.cardCta} onClick={onPrimary} whileTap={reduced ? undefined : { scale: .98 }}><span>{ctaLabel}</span><span className={styles.cardCtaIcon}><ArrowUpRight size={16} /></span></motion.button>}
    </>}
  </motion.div>
}
