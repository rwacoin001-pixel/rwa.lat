import {test} from 'node:test'
import assert from 'node:assert/strict'
import {transferRecipientFromCode} from '../lib/transfer-code'
const id='029f652b-6dc2-4b04-ac9f-2f69ff50daaf'
test('accepts actual platform receive codes but never follows QR links',()=>{
 assert.equal(transferRecipientFromCode(`https://rwa.lat/assets/cash/transfer?to=${id}`,'https://rwa.lat'),id)
 assert.equal(transferRecipientFromCode(id,'https://rwa.lat'),id)
 for(const text of [`https://evil.example/assets/cash/transfer?to=${id}`,`https://rwa.lat/login?to=${id}`,`https://rwa.lat/assets/cash/transfer?to=${id}&to=${id}`,'javascript:alert(1)','bad'])assert.equal(transferRecipientFromCode(text,'https://rwa.lat'),null)
})
