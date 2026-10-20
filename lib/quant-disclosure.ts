export type DisclosureSection = { heading: string; paragraphs: string[] }

/** Keep the complete primary disclosure; the stored bilingual source remains available separately. */
export function disclosureSections(content: string): DisclosureSection[] {
  const summary = /^\s*[—–-]+\s*English summary\s*[—–-]+\s*$/im.exec(content)
  const primary = summary && /[\u3400-\u9fff]/u.test(content.slice(0, summary.index))
    ? content.slice(0, summary.index) : content
  const sections: DisclosureSection[] = []
  let section: DisclosureSection = { heading: '', paragraphs: [] }
  let paragraph: string[] = []
  const flush = () => {
    const text = paragraph.join('\n').trim()
    // The existing translation endpoint accepts individual texts up to 4,000 characters.
    for (let rest = text; rest;) {
      let end = Math.min(rest.length, 3000)
      if (end < rest.length) {
        const boundary = Math.max(rest.lastIndexOf('。', end), rest.lastIndexOf('. ', end), rest.lastIndexOf('\n', end))
        if (boundary > 1500) end = boundary + 1
      }
      section.paragraphs.push(rest.slice(0, end))
      rest = rest.slice(end)
    }
    paragraph = []
  }
  for (const line of primary.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = /^\s*【([^】]+)】\s*(.*)$/.exec(line) ?? /^\s*#{1,6}\s+(.+?)\s*$/.exec(line)
    if (heading) {
      flush()
      if (section.heading || section.paragraphs.length) sections.push(section)
      section = { heading: heading[1].trim(), paragraphs: [] }
      if (heading[2]) paragraph.push(heading[2])
    } else if (!line.trim()) flush()
    else paragraph.push(line)
  }
  flush()
  if (section.heading || section.paragraphs.length) sections.push(section)
  return sections
}
