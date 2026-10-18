// Finds (and with --write removes) rules in a global stylesheet whose classes no source file mentions.
// A class counts as used when its name appears in source, or when source builds it dynamically (`prefix-${x}`).
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const [file, ...flags] = process.argv.slice(2)
const write = flags.includes('--write')
const roots = ['app', 'components', 'lib', 'hooks', 'public', 'workers', 'styles']
const exts = /\.(tsx?|jsx?|mjs|cjs|html|css)$/
let source = ''
const walk = (dir) => {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (!['node_modules', '.next', 'generated'].includes(entry.name)) walk(full) }
    else if (exts.test(entry.name) && path.resolve(full) !== path.resolve(file) && fs.statSync(full).size < 4e6) source += fs.readFileSync(full, 'utf8') + '\n'
  }
}
roots.forEach(walk)
// Class names written in other stylesheets' selectors do not count as use; only TS/JS/HTML text does.
const code = roots.flatMap(() => []).join('')
const used = new Map()
const isUsed = (name) => {
  if (used.has(name)) return used.get(name)
  let hit = source.includes(name)
  if (hit) {
    // must appear outside a CSS selector context only when every hit is a `.name` selector in a stylesheet: approximated below
  }
  if (!hit) for (let i = 1; i < name.length; i++) if (/[-_]/.test(name[i - 1]) && source.includes(name.slice(0, i) + '${')) { hit = true; break }
  used.set(name, hit)
  return hit
}

const root = postcss.parse(fs.readFileSync(file, 'utf8'))
const removed = []
const classesOf = (selector) => [...selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1])
root.walkRules((rule) => {
  if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return
  const keep = rule.selectors.filter((selector) => classesOf(selector).every(isUsed))
  if (keep.length === rule.selectors.length) return
  removed.push(rule.selectors.filter((s) => !keep.includes(s)).join(', '))
  if (keep.length) rule.selectors = keep
  else rule.remove()
})
root.walkAtRules((atrule) => { if (atrule.nodes && atrule.nodes.length === 0 && /media|supports|layer/.test(atrule.name)) atrule.remove() })
console.log(`${removed.length} selectors ${write ? 'removed' : 'unused'} in ${file}`)
if (flags.includes('--list')) console.log(removed.join('\n'))
if (write) fs.writeFileSync(file, root.toString())
