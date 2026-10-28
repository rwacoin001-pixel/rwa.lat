#!/usr/bin/env node
// Moves a stylesheet's sizes onto the Paper & Glass scale (docs/design-system.md §3.1), following the spec's own
// conversion table. Only the properties the audit checks are touched (font-size, font, border-radius, gap, padding,
// margin), only px literals, and never inside calc()/clamp()/min()/max() that mix in fluid units.
//
//   node scripts/design-migrate.mjs path/a.css [path/b.css ...]     rewrite in place, print what changed
//   node scripts/design-migrate.mjs --dry path/a.css                 print only
//   --keep-display   leave fonts of 25px and up alone (signed-out promo headlines and dial art, §3.1 exception)
//
// Font: ≤10.5 → 11 · 11.5 → 12 · 12.5–13.5 → 13 · 14–16 → 15 · 16.5–19 → 17 · 20–24 → 22 · 25–35 → 28 · 36+ → 40.
// Space: the nearest scale step (ties go up); above 48 is left alone (page-level clearances) and reported.
// Radius: ≤4 kept (hairlines, bars) · nearest of 8 / 12 / 22 / 28 · 50+ → 999 (pills).
import { readFileSync, writeFileSync } from 'node:fs'
import { SCALE } from './design-audit.mjs'

const PROPS = /^(font-size|font|border(?:-[a-z]+)*-radius|gap|row-gap|column-gap|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*)$/
const kindOf = (prop) => prop === 'font-size' || prop === 'font' ? 'font' : prop.includes('radius') ? 'radius' : 'space'
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))

const nearest = (n, steps) => steps.reduce((best, s) => Math.abs(s - n) < Math.abs(best - n) || (Math.abs(s - n) === Math.abs(best - n) && s > best) ? s : best, steps[0])
export function mapValue(kind, n) {
  if (kind === 'font') {
    if (SCALE.font.includes(n)) return n
    if (n <= 10.5) return 11
    if (n < 12.25) return 12
    if (n < 14) return 13
    if (n <= 16) return 15
    if (n < 20) return 17
    if (n <= 24) return 22
    if (n < 36) return 28
    return 40
  }
  if (kind === 'radius') {
    if (n <= 4 || SCALE.radius.includes(n)) return n
    if (n >= 50) return 999
    return nearest(n, [8, 12, 22, 28])
  }
  if (n === 1 || SCALE.space.includes(n) || n > 48) return n
  return nearest(n, SCALE.space)
}

const fmt = (n) => String(Math.round(n * 100) / 100)

export function migrate(css, { keepDisplay = false } = {}) {
  const text = strip(css)
  const edits = []
  const changes = []
  for (const m of text.matchAll(/([a-z-]+)(\s*:\s*)([^;{}]+)/g)) {
    const prop = m[1]
    if (!PROPS.test(prop)) continue
    const kind = kindOf(prop)
    const start = m.index + m[1].length + m[2].length
    const raw = m[3]
    if (/\b(calc|clamp|min|max)\(/.test(raw) && /env\(|v[hw]\b|[sdl]v[hw]|%|cq[iw]/.test(raw)) continue
    const line = text.slice(0, m.index).split('\n').length
    if (prop === 'font') {
      // Only the size: the first length followed by "/" or a space (before the family).
      const size = /(^|\s)(\d*\.?\d+)px(?=\s*\/|\s|$)/.exec(raw)
      if (!size) continue
      const n = Number(size[2]), to = keepDisplay && n >= 25 ? n : mapValue('font', n)
      if (to !== n) { edits.push([start + size.index + size[1].length, size[2].length, fmt(to)]); changes.push(`${line}: font ${n} → ${to}`) }
      continue
    }
    // px literals outside var(...) fallbacks are left alone inside var(); everything else maps.
    const masked = raw.replace(/var\([^)]*\)/g, (v) => ' '.repeat(v.length))
    for (const lm of masked.matchAll(/(-?)(\d*\.?\d+)px\b/g)) {
      const n = Number(lm[2]), to = keepDisplay && kind === 'font' && n >= 25 ? n : mapValue(kind, n)
      if (to === n) continue
      edits.push([start + lm.index + lm[1].length, lm[2].length, fmt(to)])
      changes.push(`${line}: ${kind} ${n} → ${to}`)
    }
  }
  let out = css
  for (const [at, len, value] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + value + out.slice(at + len)
  return { out, changes }
}

/** Inline styles in TSX: fontSize: 11.5, borderRadius: 10, padding: '10px 14px'. */
export function migrateTsx(source, { keepDisplay = false } = {}) {
  const edits = [], changes = []
  for (const m of source.matchAll(/(fontSize|borderRadius|padding|margin|gap|rowGap|columnGap|padding[A-Z]\w*|margin[A-Z]\w*)(\s*:\s*)(\d*\.?\d+|'[^']*'|"[^"]*")/g)) {
    const prop = m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    const kind = kindOf(prop)
    const at = m.index + m[1].length + m[2].length
    const line = source.slice(0, m.index).split('\n').length
    const keep = (n) => keepDisplay && kind === 'font' && n >= 25
    if (/^\d/.test(m[3])) {
      const n = Number(m[3]), to = keep(n) ? n : mapValue(kind, n)
      if (to !== n) { edits.push([at, m[3].length, fmt(to)]); changes.push(`${line}: ${kind} ${n} → ${to}`) }
      continue
    }
    if (/calc|clamp|min\(|max\(|var\(/.test(m[3])) continue
    for (const lm of m[3].matchAll(/(-?)(\d*\.?\d+)px/g)) {
      const n = Number(lm[2]), to = keep(n) ? n : mapValue(kind, n)
      if (to === n) continue
      edits.push([at + lm.index + lm[1].length, lm[2].length, fmt(to)]); changes.push(`${line}: ${kind} ${n} → ${to}`)
    }
  }
  let out = source
  for (const [i, len, value] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, i) + value + out.slice(i + len)
  return { out, changes }
}

const args = process.argv.slice(2)
const dry = args.includes('--dry')
for (const file of args.filter((a) => !a.startsWith('--'))) {
  const css = readFileSync(file, 'utf8')
  const opts = { keepDisplay: args.includes('--keep-display') }
  const { out, changes } = file.endsWith('.tsx') ? migrateTsx(css, opts) : migrate(css, opts)
  if (!dry && out !== css) writeFileSync(file, out)
  console.log(`${file}: ${changes.length} value(s) ${dry ? 'would change' : 'changed'}`)
  if (process.env.VERBOSE) changes.forEach((c) => console.log('  ' + c))
}
