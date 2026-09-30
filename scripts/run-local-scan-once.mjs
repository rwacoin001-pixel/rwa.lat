import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

// Use the existing Hermes scanner; validate the local target and redact its output.
const root = resolve(import.meta.dirname, '..')
const require = createRequire(resolve(root, 'apps/api/package.json'))
const env = require('dotenv').parse(readFileSync(resolve(root, 'apps/api/.env')))
const mode=process.argv[2]??'--once'
if(!['--once','--loop'].includes(mode))throw new Error('Use --once or --loop')
const target = new URL(env.DATABASE_URL)
if (!['localhost','127.0.0.1','[::1]'].includes(target.hostname) || target.pathname !== '/rwa_lat_dev') throw new Error('Local scan rehearsal requires rwa_lat_dev')
const api = env.SCAN_WORKER_API_BASE || 'http://127.0.0.1:4000'
if (!/^http:\/\/(127\.0\.0\.1|localhost):4000\/?$/.test(api)) throw new Error('Scan callback must target local API 4000')
if (env.OBJECT_STORAGE_SCAN_PROVIDER !== 'clamav') throw new Error('Existing ClamAV provider configuration required')
if(env.APP_ENV!=='development')throw new Error('Local scan helper requires development configuration')
const child = spawn(process.execPath, ['scripts/scan-worker.mjs', ...(mode==='--loop'?['--loop','30']:['--once'])], { cwd: resolve(root, 'apps/api'), env: { ...process.env, ...env, SCAN_WORKER_API_BASE: api }, windowsHide: true, stdio: ['ignore','pipe','pipe'] })
let output = ''; let error = ''
let lastCallbacks=0
child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8')
child.stdout.on('data', chunk => {
  output = (output + chunk).slice(-100000)
  if(mode==='--loop'){
    const callbacks=(output.match(/回调 HTTP 201/g)??[]).length
    if(callbacks>lastCallbacks){lastCallbacks=callbacks;console.log(JSON.stringify({scanner:'existing Hermes scanner',acknowledgedCallbacks:callbacks,clean:(output.match(/→ clean \| 回调 HTTP 201/g)??[]).length,errors:Boolean(error)||/回调 HTTP (?!201)\d+/.test(output)}))}
  }
})
child.stderr.on('data', chunk => { error = (error + chunk).slice(-100000) })
const timer = mode==='--once'?setTimeout(() => { child.kill(); console.error('Local scanner exceeded rehearsal timeout; pending objects are not accepted.'); process.exitCode = 1 }, 180000):undefined
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill())
if(mode==='--loop')console.log(JSON.stringify({scanner:'existing apps/api/scripts/scan-worker.mjs',mode,intervalSeconds:30,credentialsLogged:false}))
child.on('error', () => { clearTimeout(timer); console.error('Could not start the existing local scanner.'); process.exitCode = 1 })
child.on('exit', code => {
  clearTimeout(timer)
  console.log(JSON.stringify({ scanner: 'existing apps/api/scripts/scan-worker.mjs', exitCode: code,
    noPendingObjects: output.includes('无待扫描对象'), acknowledgedCallbacks: (output.match(/回调 HTTP 201/g) ?? []).length,
    clean: (output.match(/→ clean \| 回调 HTTP 201/g) ?? []).length, infected: (output.match(/→ infected \| 回调 HTTP 201/g) ?? []).length,
    errors: Boolean(error) || /回调 HTTP (?!201)\d+/.test(output) }))
  if (code !== 0 || error || /回调 HTTP (?!201)\d+/.test(output)) process.exitCode = 1
})
