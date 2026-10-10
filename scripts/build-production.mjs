import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'))
const selected = process.argv[2] || 'all'
// Turbopack's native pipeline aborts on this project (0xC0000409 / 0x80000003) even though the
// sources parse fine. Compile with webpack, then let OpenNext package the finished .next:
// same output, stable on Windows. Each entry is a list of steps run in order.
const commands = {
  frontend: [
    ['node_modules/@opennextjs/cloudflare/dist/cli/index.js', 'build'],
  ],
  api: [['apps/api/node_modules/@nestjs/cli/bin/nest.js', 'build']],
  admin: [['apps/admin/node_modules/@nestjs/cli/bin/nest.js', 'build']],
  'admin-frontend': [['apps/admin-frontend/node_modules/next/dist/bin/next', 'build']],
}
if (selected !== 'all' && !commands[selected]) throw new Error('Choose all, frontend, api, admin or admin-frontend')
for (const name of selected === 'all' ? Object.keys(commands) : [selected]) {
  const cwd = name === 'frontend' ? root : resolve(root, 'apps', name)
  const env = { ...process.env }
  if (name === 'frontend') Object.assign(env, {
    NEXT_PUBLIC_API_URL: '',
    NEXT_PUBLIC_API_BASE_URL: '',
    API_INTERNAL_URL: 'https://api.a-reit.com',
    RWA_LOCAL_PROXY: '1',
    RWA_PROXY_TARGET: 'https://api.a-reit.com',
  })
  for (const step of commands[name]) {
    const [script, ...args] = step
    console.log(`Building ${name}${commands[name].length > 1 ? ` (${step[step.length - 1]})` : ''}`)
    const result = spawnSync(process.execPath, [resolve(root, script), ...args], { cwd, env, stdio: 'inherit', windowsHide: true })
    if (result.error || result.status !== 0) process.exit(result.status || 1)
  }
}
