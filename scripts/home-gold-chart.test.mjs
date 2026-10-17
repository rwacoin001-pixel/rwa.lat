import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function chartHarness() {
  const effects = [], cleanups = [], states = [], intervals = new Map(), timers = new Map()
  let frame = null, nextTimer = 0, stateIndex = 0, refIndex = 0
  const mount = { replaceChildren() {}, append() {}, querySelector: () => frame }
  const root = {}
  const react = {
    useRef: () => ({ current: refIndex++ === 0 ? root : mount }),
    useState: initial => { const index = stateIndex++; states[index] = index === 0 ? true : initial; return [states[index], value => { states[index] = value }] },
    useEffect: fn => effects.push(fn),
  }
  const window = {
    setInterval: fn => { const id=++nextTimer; intervals.set(id, fn); return id },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, ms) => { const id=++nextTimer; timers.set(id, {fn,ms}); return id },
    clearTimeout: id => timers.delete(id),
  }
  const document = { createElement: () => ({ style:{}, append(){}, className:'', textContent:'' }) }
  const imports = {
    react, 'react/jsx-runtime': { jsx: (type,props) => ({type,props}), jsxs: (type,props) => ({type,props}) },
    'lucide-react': { ArrowUpRight(){} }, '@/lib/i18n': { useI18n:()=>({locale:'en'}) },
    '@/lib/rwa-theme': { useRwaTheme:()=>({theme:'dark'}) }, '@/lib/api/_query': {}, '@/lib/api/market-context': {}, './HomeTradingView.module.css': {},
  }
  const code = ts.transpileModule(readFileSync('components/home/HomeTradingView.tsx','utf8'), { compilerOptions: {module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true} }).outputText
  const exports = {}
  new Function('require','exports','window','document','IntersectionObserver',code)(id=>{if(!(id in imports))throw Error(id);return imports[id]},exports,window,document,class{observe(){}disconnect(){}})
  exports.HomeTradingView()
  effects.forEach(fn => {const cleanup=fn();if(cleanup)cleanups.push(cleanup)})
  return { states, frameReady(){ frame={contentWindow:{location:{href:'https://www.tradingview-widget.com/embed-widget/advanced-chart/'}}}; [...intervals.values()].forEach(fn=>fn()) }, deadline(){ for(const [id,t] of timers) if(t.ms===8000){timers.delete(id);t.fn()} }, cleanup(){ cleanups.forEach(fn=>fn()) }, intervals }
}

test('a gold chart arriving after the slow-network deadline replaces the error overlay', () => {
  const h=chartHarness(); h.deadline(); assert.equal(h.states[1],true)
  h.frameReady(); assert.equal(h.states[2],true); assert.equal(h.states[1],false)
})
test('a normally loaded chart is not replaced by the timeout', () => {
  const h=chartHarness(); h.frameReady(); h.deadline()
  assert.equal(h.states[2],true); assert.equal(h.states[1],false)
})
test('chart polling stops when the component leaves the page', () => {
  const h=chartHarness();h.cleanup();assert.equal(h.intervals.size,0)
})
