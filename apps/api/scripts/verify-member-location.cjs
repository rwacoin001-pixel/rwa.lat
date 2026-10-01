require('reflect-metadata')
const assert = require('node:assert/strict')
const { plainToInstance } = require('class-transformer')
const { validate } = require('class-validator')
const { MemberPostDto } = require('../dist/community/community-member.dto')
;(async () => {
  const errors = value => validate(plainToInstance(MemberPostDto, value), { whitelist: true, forbidNonWhitelisted: true })
  assert((await errors({ body: 'test' })).length > 0, 'Location is mandatory')
  assert.equal((await errors({ body: 'test', location: { city: 'Singapore', countryCode: 'SG', source: 'device' } })).length, 0)
  for (const location of [null, { city: '', countryCode: 'SG', source: 'device' }, { city: 'Singapore', countryCode: 'invalid', source: 'device' }, { city: 'Singapore', countryCode: 'SG', source: 'manual' }, { city: 'Singapore', countryCode: 'SG', source: 'device', latitude: 1 }]) {
    assert((await errors({ body: 'test', location })).length > 0, 'Reject incomplete, manual or precise location payload')
  }
  console.log('PASS: mandatory nested post location; invalid and precise location payloads rejected')
})().catch(error => { console.error(error); process.exitCode = 1 })
