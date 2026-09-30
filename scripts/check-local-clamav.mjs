import assert from 'node:assert/strict'
import net from 'node:net'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Exercise the delivered Hermes INSTREAM implementation without changing it,
// writing malware fixtures to disk, touching uploads, or exposing credentials.
const source = readFileSync(resolve(import.meta.dirname, '../apps/api/scripts/scan-worker.mjs'), 'utf8')
const start = source.indexOf('function clamdScanBuffer(buf) {')
const end = source.indexOf('async function loadPg()', start)
if (start < 0 || end < start) throw new Error('Delivered scanner entry point changed; inspect before testing')
const scan = new Function('net', 'CLAMD_HOST', 'CLAMD_PORT', 'SCAN_TIMEOUT_MS', `${source.slice(start, end)}\nreturn clamdScanBuffer;`)(net, '127.0.0.1', 3310, 30_000)
const clean = await scan(Buffer.from('RWA.LAT isolated ClamAV health fixture. No business or personal information.'))
assert.equal(clean.status, 'clean')
// Public harmless antivirus test signature, assembled solely in memory.
const eicar = Buffer.from(['X5O!P%@AP[4\\PZX54(P^)7CC)7}', '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join(''))
const detected = await scan(eicar)
assert.equal(detected.status, 'infected')
console.log(JSON.stringify({ implementation: 'existing Hermes scanner', host: 'loopback', ordinaryFixture: clean.status, harmlessEicarFixture: detected.status, fixturesWritten: false, objectCallbackVerified: false }))
