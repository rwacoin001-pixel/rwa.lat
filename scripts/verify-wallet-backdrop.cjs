const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('../node_modules/typescript')
const Module = require('node:module')
const path = require('node:path')
let effect, copy, stripped = []
global.window = { scrollY: 220 }
global.document = { querySelector: () => ({ dataset: { sheet: 'false' }, cloneNode: () => copy }) }
copy = { dataset: {}, style: {}, setAttribute() {}, removeAttribute: name => stripped.push(name), querySelectorAll: selector => [{ removeAttribute: name => stripped.push(name) }] }
const filename = path.resolve(__dirname, '../components/wallet-page-backdrop.tsx')
const fixture = new Module(filename)
fixture.require = name => name === 'react' ? { useRef: current => ({ current }), useLayoutEffect: fn => { effect = fn } } : name === 'react/jsx-runtime' ? { jsx: (type, props) => ({ type, props }) } : require(name)
fixture._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename)
fixture.exports.captureWalletBackdrop()
assert.equal(copy.inert, true)
assert.equal(copy.style.transform, 'translateY(-220px)')
assert(stripped.includes('data-maison-page'), 'Cloned page cannot interfere with viewport restoration')
const rendered = fixture.exports.WalletPageBackdrop()
let child = null
rendered.props.ref.current = { append: value => { child = value }, replaceChildren: () => { child = null } }
const cleanup = effect(); assert.equal(child, copy)
cleanup(); assert.equal(child, null)
effect(); assert.equal(child, copy, 'Strict effect replay retains the background snapshot')
const source = fs.readFileSync(path.resolve(__dirname, '../components/rwa-h5.tsx'), 'utf8')
assert(source.includes('(?:wallet|assets\\/cash)'), 'Wallet menu aliases must capture the underlying page')
console.log('PASS: inert captured page, scroll alignment, restoration isolation, strict effect replay, cash menu aliases')
