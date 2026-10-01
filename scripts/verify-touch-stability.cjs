const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const ts = require('../node_modules/typescript')
const listeners = {}, timers = [], animations = []
class ElementFixture {
  constructor(kind = 'button') { this.kind = kind; this.style = {}; this.scrollTop = 0; this.classList = { contains: value => value === 'rwa-mobile' && this.kind === 'root' } }
  closest(selector) {
    if (selector.includes('data-press="off"')) return null
    if (selector.includes('data-sheet')) return this.sheet ?? null
    if (selector.includes('data-maison-page')) return this.page ?? null
    return this.kind === 'button' ? this : null
  }
  matches() { return false }
  getBoundingClientRect() { return { top: 0, width: 40, height: 40 } }
  animate(frames, options) { const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true } }; animations.push(animation); return animation }
}
global.Element = ElementFixture
global.getComputedStyle = () => ({ scale: '.96' })
global.window = { matchMedia: () => ({ matches: false }), addEventListener: (key, fn) => { listeners[key] = fn }, removeEventListener() {}, setTimeout: fn => { timers.push(fn); return timers.length }, clearTimeout() {} }
const filename = path.resolve(__dirname, '../components/press-feedback.tsx')
const fixture = new Module(filename)
fixture.require = name => name === 'react' ? { useEffect: fn => fn() } : require(name)
fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename)
fixture.exports.default()
const button = new ElementFixture()
listeners.pointerdown({ target: button, button: 0, clientX: 0, clientY: 0, pointerType: 'touch' })
listeners.pointermove({ clientX: 0, clientY: 30 })
assert.equal(animations.length, 1, 'Scrolling must cancel the press without a rebound animation')
assert.equal(animations[0].cancelled, true)
listeners.pointerdown({ target: button, button: 0, clientX: 0, clientY: 0 })
listeners.pointerup({})
assert.equal(animations.length, 3, 'A real tap retains its press and release animation')
const page = new ElementFixture('page'), target = new ElementFixture('content')
target.sheet = new ElementFixture('root'); target.page = page
listeners.touchstart({ target, touches: [{ clientX: 0, clientY: 100 }], timeStamp: 0 })
listeners.touchmove({ touches: [{ clientX: 0, clientY: 160 }], timeStamp: 20, preventDefault() { throw new Error('Route scroll must not be captured') } })
assert.equal(page.style.transform, undefined, 'Scrolling a route cannot translate the whole page')
const sheet = new ElementFixture('sheet'); target.sheet = sheet
listeners.touchstart({ target, touches: [{ clientX: 0, clientY: 100 }], timeStamp: 0 })
listeners.touchmove({ touches: [{ clientX: 0, clientY: 160 }], timeStamp: 20, preventDefault() { throw new Error('Sheet content scroll must not be captured') } })
assert.equal(sheet.style.transform, undefined, 'Only the top grip region may start sheet dragging')
listeners.touchstart({ target, touches: [{ clientX: 0, clientY: 10 }], timeStamp: 0 })
listeners.touchmove({ touches: [{ clientX: 0, clientY: 30 }], timeStamp: 20, preventDefault() {} })
listeners.touchmove({ touches: [{ clientX: 0, clientY: 5 }], timeStamp: 50, preventDefault() {} })
assert.equal(sheet.style.transform, 'translateY(0px)', 'Reversing a sheet drag must not lift it upward')
listeners.touchmove({ touches: [{ clientX: 0, clientY: 250 }], timeStamp: 70, preventDefault() {} })
listeners.touchcancel({})
assert.equal(sheet.style.transform, '', 'Interrupted gestures restore the sheet without dismissal')
assert.equal(timers.length, 0, 'Touch cancellation cannot schedule sheet dismissal')
const routeSource = fs.readFileSync(path.resolve(__dirname, '../components/rwa-h5.tsx'), 'utf8')
assert.doesNotMatch(routeSource, /setTimeout\(reset, (?:140|160|320)\)/, 'Late scroll resets must not interrupt a new scroll gesture')
console.log('PASS: scroll cancellation, tap feedback, route stability, sheet content and no delayed scroll reset')
