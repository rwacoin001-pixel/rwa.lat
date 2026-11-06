type LegalPublication = {
  version: string
  revision: number
  title: string
  effectiveDate: string
  sections: { title: string; body: string }[]
}
type LegalBrand = { id: string; name: string; origin: string }

/** Presentation repair for the first imported publication only. Never mutate its stored text or future publications. */
export function displayLegalPublication<T extends LegalPublication>(document: T, brand: LegalBrand, original = false): { document: T; adapted: boolean } {
  if (original || brand.id !== 'kimeng' || document.revision !== 1 || !/^(terms|privacy)-2026-09-18$/.test(document.version)) {
    return { document, adapted: false }
  }
  const displayText = (text: string) => text
    .replace(/support@rwa\.lat\b/gi, 'support@a-reit.com')
    .replace(/https:\/\/(?:www\.)?rwa\.lat(?=[/\s.,;:!?)]|$)/gi, brand.origin)
    .replace(/\bRWA\.LAT\b/g, brand.name)
  const sections = document.sections.map((section, index) => {
    let body = section.body
    if (index < document.sections.length - 1) body = body.replace(new RegExp(`\\s+${index + 2}\\s+\\.\\s*$`), '')
    if (index === document.sections.length - 1) body = body.replace(/\s*© 2026 RWA\.LAT — All rights reserved\. Privacy Policy Terms of Service support@rwa\.lat\s*$/, '')
    return { title: displayText(section.title), body: displayText(body) }
  })
  const title = displayText(document.title)
  const adapted = title !== document.title || sections.some((section, index) => section.title !== document.sections[index].title || section.body !== document.sections[index].body)
  return { document: adapted ? { ...document, title, sections } : document, adapted }
}

export function formatLegalEffectiveDate(value: string, locale: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date)
}
