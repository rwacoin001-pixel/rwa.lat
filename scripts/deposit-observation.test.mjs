import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {test} from 'node:test'
const exports={}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../lib/deposit-observation.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports})
const {captureDepositBaseline,isObservedDepositChange}=exports
test('delayed history establishes a baseline without announcing an old credited deposit',()=>{
  const historical={id:'old',kind:'deposit',state:'credited'}
  let baseline=captureDepositBaseline(undefined)
  assert.equal(baseline,null)
  assert.equal(isObservedDepositChange(baseline,historical),false)
  baseline=captureDepositBaseline([historical])
  assert.equal(isObservedDepositChange(baseline,historical),false)
})
test('a loaded empty history and a pending-to-credited transition identify new arrivals',()=>{
  assert.equal(isObservedDepositChange(captureDepositBaseline([]),{id:'new',kind:'deposit',state:'credited'}),true)
  const baseline=captureDepositBaseline([{id:'new',kind:'deposit',state:'confirming'}])
  assert.equal(isObservedDepositChange(baseline,{id:'new',kind:'deposit',state:'credited'}),true)
  assert.equal(isObservedDepositChange(baseline,{id:'other',kind:'transfer',state:'credited'}),false)
})
