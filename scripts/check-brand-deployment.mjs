import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {validateBrandDeployment} from '../lib/brand/deployment.mjs'
import {artifactDigest} from '../lib/brand/artifact.mjs'
const id=process.argv[2]
if(!['areit','kimeng'].includes(id))throw new Error('Choose areit or kimeng explicitly')
const root=new URL('../',import.meta.url)
const read=relative=>readFileSync(new URL(relative,root))
const config=JSON.parse(read(id==='kimeng'?'wrangler.kimeng.jsonc':'wrangler.jsonc'))
const stamp=JSON.parse(read('.open-next/brand-build.json'))
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim()
const workerHash=createHash('sha256').update(read('.open-next/worker.js')).digest('hex')
console.log(JSON.stringify(validateBrandDeployment(id,config,stamp,sourceCommit,workerHash,artifactDigest(new URL('.open-next/',root))),null,2))
