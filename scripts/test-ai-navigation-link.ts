import assert from 'node:assert/strict'
import { aiNavigationLink } from '../lib/ai-navigation-link'
assert.equal(aiNavigationLink('/assets/cash/deposit'),'/assets/cash/deposit')
assert.equal(aiNavigationLink('https://a-reit.com/markets?tab=predictions'),'/markets?tab=predictions')
assert.equal(aiNavigationLink('/prediction/event-32224'),'/prediction/event-32224')
for(const href of ['javascript:alert(1)','//evil.test','https://a-reit.com.evil.test/home','/admin','/assets/cash/transfer?to=someone&amount=100','/prediction/:id','/home?confirmed=true','/home\\evil','/home#script']) assert.equal(aiNavigationLink(href),null,href)
console.log('Verified AI navigation links passed')
