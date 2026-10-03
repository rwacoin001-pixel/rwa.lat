import { execFileSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cwd = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).trim()
if (git('branch', '--show-current') !== 'main') throw new Error('Release requires the user-approved merge into main')
if (git('status', '--porcelain')) throw new Error('Release requires a clean source tree')
const sha = git('rev-parse', 'HEAD')
const upstream = git('ls-remote', 'origin', 'refs/heads/main').split(/\s+/)[0]
if (sha !== upstream) throw new Error('Push the approved main commit before release')
console.log(`Merged release source: ${sha}`)
