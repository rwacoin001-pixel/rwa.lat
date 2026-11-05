import { spawnSync, execFileSync } from 'node:child_process'
import { realpathSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolveBrand } from '../lib/brand/config.mjs'
import { artifactDigest } from '../lib/brand/artifact.mjs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const selected = process.argv[2] || 'all'
const brand = resolveBrand(process.argv[3] ?? process.env.SITE_BRAND)
const frontendConfig = brand.id === 'kimeng' ? 'wrangler.kimeng.jsonc' : 'wrangler.jsonc'
const mode = brand.id === 'kimeng' ? JSON.parse(readFileSync(resolve(root, frontendConfig), 'utf8')).vars.KIMENG_RELEASE_MODE : 'existing'
// Turbopack's native pipeline aborts on this project (0xC0000409 / 0x80000003) even though the
// sources parse fine. Compile with webpack, then let OpenNext package the finished .next:
// same output, stable on Windows. Each entry is a list of steps run in order.
const commands = {
  frontend: [
    ['node_modules/typescript/bin/tsc', '-p', 'packages/api-client/tsconfig.json'],
    ['node_modules/next/dist/bin/next', 'build', '--webpack'],
    ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'build', '--skipNextBuild'],
    // Android app: list of files it keeps on the phone, deployed as /app-pack/manifest.json.
    ['scripts/app-pack-manifest.mjs'],
  ],
  api: [['apps/api/node_modules/@nestjs/cli/bin/nest.js', 'build']],
  admin: [['apps/admin/node_modules/@nestjs/cli/bin/nest.js', 'build']],
  'admin-frontend': [['apps/admin-frontend/node_modules/next/dist/bin/next', 'build']],
}
if (selected !== 'all' && !commands[selected]) throw new Error('Choose all, frontend, api, admin or admin-frontend')
for (const name of selected === 'all' ? Object.keys(commands) : [selected]) {
  if (name === 'frontend' && execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim()) throw new Error('Commit the reviewed source before producing a branded release artifact')
  const cwd = name === 'frontend' ? root : resolve(root, 'apps', name)
  const env = { ...process.env }
  if (name === 'frontend') Object.assign(env, {
    SITE_BRAND: brand.id,
    NEXT_PUBLIC_SITE_BRAND: brand.id,
    KIMENG_RELEASE_MODE: mode,
    NEXT_PUBLIC_API_URL: '',
    NEXT_PUBLIC_API_BASE_URL: '',
    API_INTERNAL_URL: 'https://api.a-reit.com',
    RWA_LOCAL_PROXY: '1',
    RWA_PROXY_TARGET: 'https://api.a-reit.com',
    RWA_RELEASE_NO_WEBPACK_CACHE: '1',
  })
  for (const step of commands[name]) {
    const [script, ...baseArgs] = step
    const args = script.includes('@opennextjs/cloudflare') ? [...baseArgs, '--config', frontendConfig] : baseArgs
    console.log(`Building ${name}${commands[name].length > 1 ? ` (${step[step.length - 1]})` : ''}`)
    const result = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd, env, stdio: 'inherit', windowsHide: true })
    if (result.error || result.status !== 0) process.exit(result.status || 1)
  }
  if (name === 'frontend') {
    const manifestFile = resolve(root, '.next/server/app/manifest.webmanifest.body')
    if (!existsSync(manifestFile) || JSON.parse(readFileSync(manifestFile, 'utf8')).short_name !== brand.name) throw new Error('Built manifest does not match selected brand')
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
    const stamp = { brandId: brand.id, mode, sourceCommit: sha, nextBuildId: readFileSync(resolve(root, '.next/BUILD_ID'), 'utf8').trim(),
      apiOrigin: env.API_INTERNAL_URL, workerSha256: createHash('sha256').update(readFileSync(resolve(root, '.open-next/worker.js'))).digest('hex'), artifactSha256: artifactDigest(resolve(root, '.open-next')) }
    writeFileSync(resolve(root, '.open-next/brand-build.json'), JSON.stringify(stamp, null, 2) + '\n')
    console.log(`Verified ${brand.name} artifact from ${sha.slice(0, 8)}`)
  }
}
