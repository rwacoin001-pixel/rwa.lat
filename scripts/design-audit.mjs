#!/usr/bin/env node
// Design scale audit (docs/design-system.md §3.1). Finds font sizes, corner radii and spacing in CSS that are off the
// Paper & Glass scale. It ratchets: values already in the code are recorded in scripts/design-audit-baseline.json, and
// only NEW off-scale values fail. Files listed in STRICT must be fully on the scale (pages already migrated).
//
//   node scripts/design-audit.mjs                 report + fail on new off-scale values
//   node scripts/design-audit.mjs --summary       counts only
//   node scripts/design-audit.mjs --update        rewrite the baseline (after a migration removed values)
//   node scripts/design-audit.mjs path/a.css ...  only these files
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export const SCALE = {
  font: [11, 12, 13, 15, 17, 22, 28, 40],
  radius: [8, 12, 22, 28, 999],
  space: [0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 48],
}
// Pages that have been moved onto the scale: no exceptions, no baseline.
export const STRICT = ['components/h5/dock-v2.module.css', 'components/home/HomeGetApp.module.css', 'components/home/HomeForYou.module.css', 'components/home/Tilt3D.module.css', 'components/maison/portfolio-a.module.css', 'components/maison/receive.module.css', 'components/maison/quant-v2.module.css', 'components/maison/invite-landing.module.css', 'components/maison/share-win.module.css', 'components/community-proof.module.css', 'components/maison/invite-centre.module.css', 'components/home/home-v2.module.css', 'components/home/HomeAssetCard.tsx', 'components/home/HomeReferral.tsx', 'components/home/RollingText.tsx']
const ROOTS = ['components', 'app', 'styles']
const BASELINE = 'scripts/design-audit-baseline.json'

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const px = (value) => [...value.matchAll(/(-?\d*\.?\d+)px/g)].map((m) => Math.abs(Number(m[1])))

const PROPS = /^(font-size|font|border(?:-[a-z]+)*-radius|gap|row-gap|column-gap|padding(?:-[a-z]+)*|margin(?:-[a-z]+)*)$/
const kindOf = (prop) => prop === 'font-size' || prop === 'font' ? 'font' : prop.includes('radius') ? 'radius' : 'space'

function check(kind, values, line, out) {
  for (const value of values) {
    // Hairlines and tiny bars (carets, progress tracks) may round by 1–4px; circles use 50%.
    if (kind === 'radius' && value <= 4) continue
    if (kind === 'space' && value === 1) continue
    if (!SCALE[kind].includes(value)) out.push({ kind, value, line })
  }
}

/** px (and rem/em at 16px) literals; inside calc()/clamp()/min()/max() only when nothing in the expression is fluid. */
function lengths(raw, kind) {
  if (/\b(calc|clamp|min|max)\(/.test(raw) && /env\(|v[hw]\b|[sdl]v[hw]|%|cq[iw]/.test(raw)) return []
  const out = []
  for (const m of raw.replace(/var\([^)]*\)/g, ' ').matchAll(/(-?\d*\.?\d+)(px|rem|em)\b/g)) {
    const n = Math.abs(Number(m[1])) * (m[2] === 'px' ? 1 : 16)
    if (m[2] === 'em' && kind !== 'font') continue
    out.push(Math.round(n * 100) / 100)
  }
  return out
}

/** Off-scale findings in one stylesheet: { kind, value, line }. Declarations may span lines. */
export function audit(css) {
  const out = []
  const text = strip(css)
  for (const m of text.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)) {
    const prop = m[1], raw = m[2]
    if (!PROPS.test(prop)) continue
    const line = text.slice(0, m.index).split('\n').length
    if (prop === 'font') {
      const size = /(?:^|\s)(\d*\.?\d+)(px|rem)(?:\s*\/|\s|$)/.exec(raw.trim())
      if (size) check('font', [Number(size[1]) * (size[2] === 'rem' ? 16 : 1)], line, out)
      continue
    }
    const kind = kindOf(prop)
    check(kind, lengths(raw, kind), line, out)
  }
  return out
}

/** Inline styles in TSX: fontSize: 14, borderRadius: 10, padding: '10px 16px'. */
export function auditTsx(source) {
  const out = []
  for (const m of source.matchAll(/\b(fontSize|borderRadius|padding|margin|gap|rowGap|columnGap|padding[A-Z]\w*|margin[A-Z]\w*)\s*:\s*(\d*\.?\d+|'[^']*'|"[^"]*")/g)) {
    const prop = m[1].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())
    const kind = kindOf(prop)
    const raw = /^\d/.test(m[2]) ? `${m[2]}px` : m[2].slice(1, -1)
    check(kind, lengths(raw, kind), source.slice(0, m.index).split('\n').length, out)
  }
  return out
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) return []
    return statSync(path).isDirectory() ? files(path) : /\.(css|tsx)$/.test(name) ? [path] : []
  })
}

const key = (file, f) => `${file}|${f.kind}|${f.value}`
/** Occurrences per file|kind|value: the baseline ratchets on counts, so copying an old off-scale value fails too. */
const tally = (findings) => findings.reduce((map, { file, found }) => { found.forEach((f) => map.set(key(file, f), (map.get(key(file, f)) ?? 0) + 1)); return map }, new Map())

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'))
  const list = (args.length ? args : ROOTS.filter(existsSync).flatMap(files)).map((f) => relative('.', f).split(sep).join('/'))
  const findings = list.map((file) => ({ file, found: (file.endsWith('.tsx') ? auditTsx : audit)(readFileSync(file, 'utf8')) }))
  const counts = { font: new Set(), radius: new Set(), space: new Set() }
  findings.forEach(({ found }) => found.forEach((f) => counts[f.kind].add(f.value)))
  const now = tally(findings)
  const known = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}
  if (argv.includes('--update')) {
    // The baseline only shrinks, unless --force: a regression can't be blessed by accident.
    const grew = [...now].filter(([k, n]) => n > (known[k] ?? 0))
    if (grew.length && !argv.includes('--force') && Object.keys(known).length) { grew.forEach(([k, n]) => console.error(`  grew ${k}: ${known[k] ?? 0} → ${n}`)); console.error('Baseline not updated: fix these, or pass --force.'); return 1 }
    writeFileSync(BASELINE, JSON.stringify(Object.fromEntries([...now].sort()), null, 1) + '\n')
    console.log(`baseline: ${[...now.values()].reduce((a, b) => a + b, 0)} off-scale uses recorded in ${list.length} files`)
    return 0
  }
  const fresh = [...now].filter(([k, n]) => STRICT.includes(k.split('|')[0]) || n > (known[k] ?? 0))
    .map(([k, n]) => { const [file, kind, value] = k.split('|'); const at = findings.find((f) => f.file === file).found.filter((f) => f.kind === kind && String(f.value) === value).map((f) => f.line); return `${file}:${at.join(',')}  ${kind} ${value}px ×${n} (was ${known[k] ?? 0}; scale: ${SCALE[kind].join(' ')})` })
  const total = findings.reduce((n, { found }) => n + found.length, 0)
  console.log(`design audit: ${list.length} files, ${total} off-scale uses (font ${counts.font.size} / radius ${counts.radius.size} / space ${counts.space.size} distinct values off scale)`)
  if (!argv.includes('--summary')) fresh.forEach((line) => console.log('  NEW ' + line))
  if (fresh.length) { console.error(`${fresh.length} new off-scale value(s). Use the --pa-fs-* / --pa-r-* / --pa-sp-* tokens.`); return 1 }
  return 0
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/').replace(/^\/?/, '/')}` || process.argv[1]?.endsWith('design-audit.mjs')) process.exitCode = main(process.argv.slice(2))
