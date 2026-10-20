'use client'

import { useMemo, useState } from 'react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import { useQuery } from '@/lib/api/_query'
import { getQuantDisclosure, type QuantDisclosure } from '@/lib/api/quant'
import { useContentTranslation } from '@/lib/use-content-translation'
import { disclosureSections } from '@/lib/quant-disclosure'
import { communityExperienceCopy } from '@/lib/community-experience-copy'
import { marketCopy } from '@/lib/maison-market-copy'
import { Sheet } from './Sheet'
import { Skeleton, StateBlock, maison as s } from './primitives'
import { useHideDock } from './QuantParts'
import styles from './quant-disclosure.module.css'

type Copy = { title: string; effective: string; version: string; translated: string; empty: string }
const copy: Record<AppLocale, Copy> = {
  'zh-CN': { title: '风险披露', effective: '生效日期', version: '版本', translated: '查看译文', empty: '暂无风险披露文件' },
  en: { title: 'Risk disclosure', effective: 'Effective date', version: 'Version', translated: 'Show translation', empty: 'No disclosure available' },
  hi: { title: 'जोखिम प्रकटीकरण', effective: 'प्रभावी तिथि', version: 'संस्करण', translated: 'अनुवाद दिखाएँ', empty: 'कोई प्रकटीकरण उपलब्ध नहीं है' },
  es: { title: 'Información de riesgos', effective: 'Fecha de vigencia', version: 'Versión', translated: 'Ver traducción', empty: 'No hay información de riesgos disponible' },
  ar: { title: 'الإفصاح عن المخاطر', effective: 'تاريخ السريان', version: 'الإصدار', translated: 'عرض الترجمة', empty: 'لا يتوفر إفصاح عن المخاطر' },
  fr: { title: 'Information sur les risques', effective: 'Date d’effet', version: 'Version', translated: 'Voir la traduction', empty: 'Aucune information sur les risques disponible' },
  pt: { title: 'Divulgação de riscos', effective: 'Data de vigência', version: 'Versão', translated: 'Ver tradução', empty: 'Nenhuma divulgação de riscos disponível' },
}

export function QuantDisclosureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useI18n()
  const c = copy[locale]
  const disclosure = useQuery(open ? 'quant:disclosure' : null, getQuantDisclosure, { staleTime: 5 * 60_000 })
  useHideDock(open)
  return <Sheet open={open} onClose={onClose} title={c.title} className={styles.sheet} data-quant-disclosure="">
    {open && (disclosure.data
      ? <DisclosureContent key={`${disclosure.data.id}:${locale}`} disclosure={disclosure.data} onClose={onClose} />
      : disclosure.error
        ? <div className={styles.state}><StateBlock tone="error" title={marketCopy[locale].markets.loadError} retry={() => void disclosure.refetch()} retryLabel={marketCopy[locale].common.retry} /></div>
        : disclosure.loading || disclosure.data === undefined
          ? <div className={styles.state}><Skeleton rows={5} /></div>
          : <div className={styles.state}><StateBlock title={c.empty} /></div>)}
  </Sheet>
}

function DisclosureContent({ disclosure, onClose }: { disclosure: QuantDisclosure; onClose: () => void }) {
  const { locale } = useI18n()
  const c = copy[locale]
  const common = communityExperienceCopy[locale]
  const [original, setOriginal] = useState(false)
  const sections = useMemo(() => disclosureSections(disclosure.content), [disclosure.content])
  const texts = useMemo(() => [disclosure.title, ...sections.flatMap(section => [section.heading, ...section.paragraphs])].filter(Boolean), [disclosure.title, sections])
  const translate = useContentTranslation(locale === 'zh-CN' ? [] : texts, true)
  const ready = locale === 'zh-CN' || texts.every(translate.hasTranslation)
  const loading = !original && !ready && !translate.error
  const source = original || !ready
  const sourceLang = /[\u3400-\u9fff]/u.test(disclosure.content) ? 'zh-CN' : undefined
  const renderText = (text: string) => source ? text : translate(text)
  const effective = new Date(disclosure.effectiveFrom)
  const date = Number.isFinite(effective.getTime()) ? new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Singapore' }).format(effective) : null

  return <div className={styles.content} lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <div className={styles.toolbar}>
      <dl className={styles.meta}>
        <div><dt>{c.version}</dt><dd><bdi>{disclosure.version}</bdi></dd></div>
        {date && <div><dt>{c.effective}</dt><dd><time dateTime={disclosure.effectiveFrom}>{date}</time></dd></div>}
      </dl>
      <button type="button" className={styles.toggle} aria-pressed={original} onClick={() => setOriginal(value => !value)}>{original ? c.translated : common.original}</button>
    </div>
    {loading && <p className={styles.status} role="status">{common.translating}</p>}
    {!original && translate.error && !ready && <button type="button" className={styles.retry} onClick={() => translate.retry()}>{common.retry}</button>}
    <div className={styles.reader} role="region" aria-label={c.title} tabIndex={0} aria-busy={loading || undefined}>
      {loading ? <Skeleton rows={5} /> : <article lang={source ? sourceLang : locale} dir={source ? 'auto' : locale === 'ar' ? 'rtl' : 'ltr'}>
        <h3 className={styles.documentTitle}>{renderText(disclosure.title)}</h3>
        {original ? <p className={styles.original} dir="auto">{disclosure.content}</p> : sections.map((section, index) => <section className={styles.section} key={index}>
          {section.heading && <h4>{renderText(section.heading)}</h4>}
          {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{renderText(paragraph)}</p>)}
        </section>)}
      </article>}
    </div>
    <footer className={styles.footer}><button type="button" className={s.ghost} onClick={onClose}>{marketCopy[locale].common.close}</button></footer>
  </div>
}
