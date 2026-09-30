import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rememberOAuthState, consumeOAuthState } from '../lib/api/oauth-state'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
const state = 'a'.repeat(43)
const url = `https://accounts.google.com/o/oauth2/v2/auth?state=${state}`
test('OAuth callback belongs to the initiating tab/provider and is single use', () => {
  const tab = storage()
  rememberOAuthState(tab, 'google', url, 1000)
  assert.equal(consumeOAuthState(storage(), 'google', state, 1001), false)
  assert.equal(consumeOAuthState(tab, 'x', state, 1001), false)
  assert.equal(consumeOAuthState(tab, 'google', 'b'.repeat(43), 1001), false)
  assert.equal(consumeOAuthState(tab, 'google', state, 1001), true)
  assert.equal(consumeOAuthState(tab, 'google', state, 1001), false)
})
test('expired and malformed state fails closed', () => {
  const tab = storage()
  rememberOAuthState(tab, 'google', url, 1000)
  assert.equal(consumeOAuthState(tab, 'google', state, 601000), false)
  assert.throws(() => rememberOAuthState(tab, 'google', 'https://accounts.google.com/'))
  tab.setItem('rwa.oauth-state.google', '{')
  assert.equal(consumeOAuthState(tab, 'google', state), false)
})
