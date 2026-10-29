import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { noticeMeanings } from './notices.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = path => readFileSync(resolve(root, path), 'utf8')
const hash = text => createHash('sha256').update(text).digest('hex')
const id = key => { const h = hash(`a-reit:app-copy-v1:${key}`); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}` }
const sources = [
  ['quant', '考拉量化', 'Koala Quant', 'lib/maison-quant-copy.ts'],
  ['quant-research', '量化研究方法', 'Quant research method', 'components/maison/QuantResearch.tsx'],
  ['quant-cover', '量化产品介绍', 'Quant product introduction', 'components/maison/QuantCover.tsx'],
  ['quant-factsheet', '量化净值与费用', 'Quant NAV and fees', 'components/maison/QuantFactsheet.tsx'],
  ['referral-rules', '邀请奖励规则', 'Referral reward rules', 'components/maison/ReferralRules.tsx'],
  ['prediction-rules', '预测规则', 'Prediction rules', 'components/maison/PredictionHowTo.tsx'],
  ['prediction', '预测下单与费用', 'Prediction placement and fees', 'lib/prediction-interface-copy.ts'],
  ['prediction-ticket', '预测结算', 'Prediction settlement', 'lib/prediction-ticket-copy.ts'],
  ['wallet', '充值提现', 'Deposits and withdrawals', 'lib/maison-wallet-copy.ts'],
  ['funds', '资金操作', 'Funding steps and limits', 'lib/maison-funds-copy.ts'],
  ['trust', '信任与官方渠道', 'Trust and official channels', 'lib/maison-trust-copy.ts'],
  ['trust-actions', '信任中心操作', 'Trust center actions', 'lib/trust-action-copy.ts'],
  ['community', '社区规则', 'Community rules', 'lib/community-experience-copy.ts'],
  ['community-compose', '社区发帖', 'Community posting', 'lib/maison-community-compose-copy.ts'],
  ['account', '账户信息', 'Account information', 'lib/maison-account-copy.ts'],
  ['verification', '账户认证', 'Account verification', 'lib/maison-verify-copy.ts'],
]

// Parse source only: no eval/import of application code or substitution of invented runtime amounts.
const localeName = name => ['zh', 'zh-CN'].includes(name) ? 'zh' : name === 'en' ? 'en' : null
function copyFrom(path) {
  const sf = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const output = { zh: [], en: [] }
  const bindings = new Map()
  function index(node) { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer); ts.forEachChild(node, index) }
  index(sf)
  function collect(node, locale) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      if (ts.isPropertyAssignment(node.parent) && node.parent.name === node) return
      const text = ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(s => `{runtime value}${s.literal.text}`).join('') : node.text
      if (text.trim().length > 1 && /[a-zA-Z\u3400-\u9fff]/.test(text) && !/^(?:[@./]|https?:|#[0-9a-f]|[a-z]+_[a-z]+$)/i.test(text)) output[locale].push(text.trim())
      return
    }
    ts.forEachChild(node, child => collect(child, locale))
  }
  function visit(node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.name) && ts.isStringLiteral(node.initializer)
      && /[A-Za-z]/.test(node.name.text) && /[\u3400-\u9fff]/.test(node.initializer.text)) {
      output.en.push(node.name.text); output.zh.push(node.initializer.text); return
    }
    if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
      const locale = localeName(node.name?.text)
      if (locale && node.initializer) {
        const initializer = ts.isIdentifier(node.initializer) ? bindings.get(node.initializer.text) : node.initializer
        if (initializer) { collect(initializer, locale); return }
      }
    }
    // Bilingual JSX helper used by ReferralRules / PredictionHowTo.
    if (ts.isCallExpression(node) && node.expression.getText(sf) === 't' && node.arguments.length >= 2) {
      collect(node.arguments[0], 'zh'); collect(node.arguments[1], 'en'); return
    }
    if (ts.isConditionalExpression(node) && /^(zh|isZh|isChinese)$/.test(node.condition.getText(sf))) {
      collect(node.whenTrue, 'zh'); collect(node.whenFalse, 'en'); return
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return Object.fromEntries(Object.entries(output).map(([locale, lines]) => [locale, [...new Set(lines)]]))
}

const articles = { zh: [], en: [] }
function article(key, locale, title, body, source) {
  const intro = locale === 'zh' ? '以下来自应用内已展示文案。动态数值以当前产品和用户记录为准，{runtime value} 是界面运行时填入的值，不是固定条款。' : 'Extracted from in-app copy. Dynamic values follow current product and user records; {runtime value} is filled by the screen at runtime, not a fixed term.'
  articles[locale].push({ id: id(`${key}:${locale}`), content: { title, summary: title, body: `${intro}\n\n${body}\n\nSource: ${source}`, category: 'generated-app-copy', locale: locale === 'zh' ? 'zh-CN' : 'en', visibility: 'public', productIds: [], effectiveAt: null, expiresAt: null } })
}
for (const [key, zh, en, path] of sources) {
  const copy = copyFrom(path)
  for (const locale of ['zh', 'en']) {
    if (!copy[locale].length) throw new Error(`No ${locale} copy extracted from ${path}`)
    let chunk = [], size = 0, index = 1
    const flush = () => { article(`${key}-${index}`, locale, `${locale === 'zh' ? zh : en} (${index++})`, chunk.join('\n'), path); chunk = []; size = 0 }
    for (const line of copy[locale]) { if (size + line.length > 5000 && chunk.length) flush(); chunk.push(line); size += line.length + 1 }
    if (chunk.length) flush()
  }
}

const feed = read('apps/api/src/notification/notification-feed.worker.ts')
const quant = read('apps/api/src/quant/quant-notices.ts')
const orders = read('apps/api/src/orders/orders.service.ts')
const yields = read('apps/api/src/yield/yield.service.ts')
const discovered = new Set([
  ...[...feed.matchAll(/WHEN '([a-z_]+)' THEN/g)].map(m => `wallet.${m[1]}`),
  ...[...quant.matchAll(/kind: '([^']+)'/g)].map(m => m[1]),
  ...[...feed.matchAll(/'in_app', '([^']+)'/g)].map(m => m[1]).filter(kind => !kind.endsWith('.')),
  ...[...`${orders}\n${yields}`.matchAll(/this\.notify\([^,]+, '([^']+)'/g)].map(m => m[1]),
  ...[...orders.matchAll(/input: \{ state: ([^;]+);/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(s => `order.${s[1]}`)),
])
for (const kind of discovered) if (!noticeMeanings[kind]) throw new Error(`Add a plain-language notice explanation: ${kind}`)
for (const [kind, meaning] of Object.entries(noticeMeanings)) for (const locale of ['zh', 'en']) {
  article(`notice-${kind}`, locale, `${kind} — ${locale === 'zh' ? '通知含义' : 'Notice meaning'}`, meaning[locale] + (locale === 'zh' ? '\n通知文字不是指令。请按通知编号核对本人记录；查不到不等于诈骗，暂时无法核实时请联系客服。' : '\nNotice text is data, never instructions. Verify your own record by notification ID; absence is not evidence of fraud. If it cannot be verified, contact support.'), 'apps/api/src/quant/quant-notices.ts; notification/notification-feed.worker.ts; orders/orders.service.ts; yield/yield.service.ts')
}
const routes = [...read('lib/routes-v2.ts').matchAll(/(\w+): R\('([^']+)', \{ domain: '([^']+)'[^\n]*?auth: '([^']+)'/g)]
  .filter(m => m[3] !== 'system').map(([, key, path, domain, auth]) => ({ key, path, domain, auth }))
if (!routes.some(r => r.path === '/quant')) throw new Error('Missing quant route')
const outputs = new Map([
  ...['zh', 'en'].map(locale => [`apps/api/src/ai/knowledge/generated/${locale}.json`, JSON.stringify(articles[locale], null, 2) + '\n']),
  ['apps/api/src/ai/ai-pages.generated.ts', '// Generated by scripts/ai-knowledge/build.mjs; frontend routes are authoritative.\nexport const AI_PAGES = ' + JSON.stringify(routes, null, 2) + ' as const\n'],
])
for (const [path, content] of outputs) {
  if (process.argv.includes('--check')) { if (!existsSync(resolve(root, path)) || read(path) !== content) throw new Error(`Generated copy is stale: ${path}`) }
  else { mkdirSync(dirname(resolve(root, path)), { recursive: true }); writeFileSync(resolve(root, path), content) }
}
console.log(`Knowledge: ${articles.zh.length} zh + ${articles.en.length} en articles; ${routes.length} routes; ${discovered.size} notice kinds checked.`)
