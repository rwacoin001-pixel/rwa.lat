'use client'

import { Languages } from 'lucide-react'
import { request } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { useI18n } from '@/lib/i18n'
import { contentErrors, learnCopy } from '@/lib/maison-content-copy'
import { fill } from '@/lib/maison-market-copy'
import { backOr, openPath } from '@/lib/maison-nav'
import RwaTopbar from '../rwa-topbar'
import { fmtDate } from './format'
import { MaisonPage, Skeleton, StateBlock, maison as s } from './primitives'
import c from './content.module.css'

type Article = { id: string; slug: string; locale: string; title: string; summary: string; author: string; body?: string; publishedAt: string; revision: number }

// Rough reading time: CJK by characters, other scripts by words.
function minutes(body: string) {
  const cjk = (body.match(/[぀-ヿ㐀-鿿]/g) ?? []).length
  const words = body.replace(/[぀-ヿ㐀-鿿]/g, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(cjk / 400 + words / 200))
}

export function LearnScreen({ slug }: { slug?: string }) {
  const { locale } = useI18n()
  const t = learnCopy[locale], e = contentErrors[locale]
  // The API only returns snapshots published in this locale; unpublished, archived and
  // other-language articles all answer 404 ARTICLE_NOT_FOUND.
  const url = `/v1/content/articles${slug ? `/${encodeURIComponent(slug)}` : ''}?locale=${encodeURIComponent(locale)}`
  const query = useQuery(`content:${locale}:${slug ?? 'list'}`, () => request<Article | Article[]>(url))
  const rows = Array.isArray(query.data) ? query.data : null
  const article = query.data && !Array.isArray(query.data) ? query.data : null
  const back = <button type="button" className={s.ghost} onClick={() => openPath('/learn')}>{t.back}</button>
  const failed = query.error && <StateBlock tone="error" title={query.error.status === 0 ? e.network : t.failed} retry={query.refetch} retryLabel={t.retry} />

  return <MaisonPage page="learn" topbar={<RwaTopbar screen={slug ? 'learn-article' : 'learn'} title={t.title} onBack={() => backOr(slug ? '/learn' : '/home')} />}>
    {slug ? <>
      {query.error ? query.error.status === 404
        ? <StateBlock tone="unavailable" title={t.missing} body={t.missingBody} action={back} />
        : failed
        : !article ? <Skeleton rows={6} />
          : <article lang={article.locale} aria-labelledby="learn-title">
            <p className={s.kicker}>{t.kicker}</p>
            <h1 id="learn-title" className={c.readTitle} dir="auto">{article.title}</h1>
            {article.summary && <p className={c.readSummary} dir="auto">{article.summary}</p>}
            <p className={c.meta}>
              {article.author && <span dir="auto">{fill(t.by, { v: article.author })}</span>}
              <span>{fmtDate(article.publishedAt, locale)}</span>
              {article.body && <span>{fill(t.minutes, { n: minutes(article.body) })}</span>}
              <span>{fill(t.revision, { v: article.revision })}</span>
            </p>
            <div className={c.readBody} dir="auto">{article.body}</div>
          </article>}
    </> : <>
      <header className={s.hero}>
        <p className={s.kicker}>{t.kicker}</p>
        <h1 className={s.display}>{t.title}</h1>
        <p className={s.lede}>{t.lede}</p>
      </header>
      {query.error ? failed
        : !rows ? <Skeleton rows={4} />
          : !rows.length ? <StateBlock title={t.empty} body={t.emptyBody} />
            : <>
              <p className={c.meta} aria-live="polite">{fill(t.count, { n: rows.length })}</p>
              <ul className={c.articles}>{rows.map(row => <li key={row.id}>
                <button type="button" className={c.article} onClick={() => openPath(`/learn/${encodeURIComponent(row.slug)}`)}>
                  <h3 dir="auto">{row.title}</h3>
                  {row.summary && <p dir="auto">{row.summary}</p>}
                  <span className={c.meta}>{row.author && <span dir="auto">{row.author}</span>}<span>{fmtDate(row.publishedAt, locale)}</span></span>
                </button>
              </li>)}</ul>
            </>}
      <p className={s.notice}><Languages size={15} aria-hidden="true" /><span>{t.otherLocale}</span></p>
    </>}
  </MaisonPage>
}
