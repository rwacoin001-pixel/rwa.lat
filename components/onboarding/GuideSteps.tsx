'use client'
import { motion } from 'motion/react'
import { ArrowRight, Check, Coins, FileSearch, ShieldAlert } from 'lucide-react'
import type { AppLocale } from '@/lib/i18n'
import { paletteAOnboarding } from '@/lib/palette-a-copy'
import { InviteCodeField, type InviteCodeState } from '../screens/InviteCodeField'
import { AppOffer, type OfferKind } from './AppOffer'
import { ART, EASE, FIELD, SOFT, SPRING, Satellite } from './HeroIntro'
import styles from './HeroIntro.module.css'

/**
 * Guide pages 2 and 3 (palette A), in the same card as page 1 so the whole guide reads as one product:
 * the same studio renders as the Hengxu covers, one brand-green field, the same type and springs.
 */
function Hero({ src, sats }: { src: string; sats: string[] }) {
  return <div className={styles.stage} aria-hidden="true">
    <motion.div className={styles.heroWrap} initial={{ opacity: 0, y: 30, scale: .82, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ ...SPRING, filter: { duration: .45 }, delay: .1 }}>
      <i className={styles.shadow} />
      <motion.img className={styles.hero} src={`${ART}/${src}.webp`} alt="" draggable={false} whileTap={{ scaleX: 1.08, scaleY: .9 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} />
      {sats.map((sat, i) => <Satellite key={sat} src={sat} phase={i * Math.PI} radius={104 + i * 12} speed={.36 + i * .08} />)}
    </motion.div>
  </div>
}

function Shell({ step, pager, children, hero, sats }: { step: number; pager: React.ReactNode; children: React.ReactNode; hero: string; sats: string[] }) {
  return <motion.article className={styles.card} initial={{ opacity: 0, y: 30, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...SOFT, delay: .05 }}>
    <motion.div className={styles.field} aria-hidden="true" initial={{ borderRadius: '50% 50% 50% 50% / 50% 50% 50% 50%' }}
      animate={{ borderRadius: step === 2 ? '46% 54% 58% 42% / 52% 46% 54% 48%' : '56% 44% 42% 58% / 44% 56% 44% 56%' }} transition={{ duration: 1, ease: EASE }} style={{ background: FIELD }}>
      <span /><span />
    </motion.div>
    <div className={styles.meta}>{pager}<span className={styles.step}>0{step} <i>/ 03</i></span></div>
    <Hero src={hero} sats={sats} />
    <span className={styles.grain} aria-hidden="true" />
    {children}
  </motion.article>
}

/** Page 2: what every product states before you invest. The three checks tick in turn. */
export function ClearStep({ locale, pager, onNext }: { locale: AppLocale; pager: React.ReactNode; onNext: () => void }) {
  const copy = paletteAOnboarding(locale)
  const s2 = copy.s2
  const icons = [FileSearch, Coins, ShieldAlert]
  return <section className={styles.intro}>
    <Shell step={2} pager={pager} hero="hero-clear" sats={['sat-glass']}>
      <h1 className={styles.title}><span>{copy.s0.title[0]}</span><em>{copy.s0.title[1]}</em></h1>
      <div className={styles.checks}>
        {s2.rows.map(([label, detail], i) => { const Icon = icons[i]; return <motion.div key={label} className={styles.check}
          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: .35 + i * .14 }}>
          <i><Icon size={15} strokeWidth={1.9} /></i>
          <span><b>{label}</b><small>{detail}</small></span>
          <motion.em initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 16, delay: .75 + i * .22 }}><Check size={12} strokeWidth={3} /></motion.em>
        </motion.div> })}
      </div>
      <div className={styles.product}>
        <span className={styles.productName}>{s2.name}</span>
        <span className={styles.productTitle}>{s2.title}</span>
        <span className={styles.productLine}>{s2.line}</span>
      </div>
    </Shell>
    <motion.button type="button" className={styles.cta} onClick={onNext} whileTap={{ scale: .97 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .4 }}>
      <span>{s2.next}</span><span className={styles.ctaIcon}><ArrowRight size={18} strokeWidth={2} /></span>
    </motion.button>
  </section>
}

/** Page 3: invite friends — the invitation code here is the one signup uses; the app offer sits under it. */
export function InviteStep({ locale, invite, offer, pager, onDone }: { locale: AppLocale; invite: InviteCodeState; offer: OfferKind | null; pager: React.ReactNode; onDone: () => void }) {
  // One way in. A code typed here is checked and locked now, so signup shows it read-only and never asks for a second one;
  // an empty field is fine (an existing account needs none, and signup still asks a new account for one).
  const enter = async () => { if (await invite.commit({ required: false })) onDone() }
  const copy = paletteAOnboarding(locale)
  return <section className={styles.intro} data-compact="">
    <Shell step={3} pager={pager} hero="hero-invite" sats={['sat-alu', 'sat-glass']}>
      <h1 className={styles.title}><span>{copy.s0.title[0]}</span><em>{copy.s0.title[1]}</em></h1>
      <div className={styles.product}>
        <span className={styles.productName}>{copy.s3.note}</span>
        <span className={styles.productTitle}>{copy.s3.title}</span>
        <span className={styles.productLine}>{copy.s3.body}</span>
      </div>
    </Shell>
    <motion.div className={styles.inviteBox} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .3 }}>
      <InviteCodeField invite={invite} locale={locale} />
    </motion.div>
    {offer && <div className={styles.offer}><AppOffer kind={offer} locale={locale} invite={invite} size="row" /></div>}
    <motion.div className={styles.actions} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SOFT, delay: .4 }}>
      <motion.button type="button" className={styles.cta} onClick={() => void enter()} whileTap={{ scale: .97 }}>
        <span>{copy.enter}</span><span className={styles.ctaIcon}><ArrowRight size={18} strokeWidth={2} /></span>
      </motion.button>
    </motion.div>
  </section>
}
