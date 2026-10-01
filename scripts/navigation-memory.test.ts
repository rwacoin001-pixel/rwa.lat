import assert from 'node:assert/strict'
import {test} from 'node:test'
import {NavigationMemory,mergeDisplayPage} from '../lib/navigation-memory'

test('separate visits to the same URL restore their own viewport and filters',()=>{
  const memory=new NavigationMemory()
  memory.savePosition('visit-one',{x:0,y:1480,panel:240})
  memory.save('visit-one','filter','politics')
  memory.savePosition('visit-two',{x:0,y:320,panel:0})
  memory.save('visit-two','filter','sports')
  assert.deepEqual(memory.position('visit-one'),{x:0,y:1480,panel:240})
  assert.equal(memory.read('visit-one','filter'),'politics')
  assert.equal(memory.read('visit-two','filter'),'sports')
})
test('navigation display cache is bounded and cleared when the session changes',()=>{
  const memory=new NavigationMemory(2)
  for(const id of ['one','two','three'])memory.save(id,'tab','predictions')
  assert.equal(memory.read('one','tab'),undefined)
  assert.equal(memory.read('three','tab'),'predictions')
  memory.clear()
  assert.equal(memory.read('three','tab'),undefined)
})
test('background refresh preserves loaded pages and replaces stale records',()=>{
  const previous=[{id:'a',price:1},{id:'b',price:2},{id:'c',price:3},{id:'d',price:4}]
  assert.deepEqual(mergeDisplayPage(previous,[{id:'a',price:10},{id:'b',price:20}],0),[
    {id:'a',price:10},{id:'b',price:20},{id:'c',price:3},{id:'d',price:4},
  ])
  assert.deepEqual(mergeDisplayPage(previous,[{id:'c',price:30},{id:'d',price:40},{id:'e',price:5}],2),[
    {id:'a',price:1},{id:'b',price:2},{id:'c',price:30},{id:'d',price:40},{id:'e',price:5},
  ])
})
