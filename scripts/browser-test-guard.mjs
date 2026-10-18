// The *.browser.mjs acceptance scripts drive a real Chrome (Playwright) against a running dev server that serves
// /dev/mobile-polish, so they cannot run in a plain `node --test scripts/*.test.mjs` pass. Each <name>.test.mjs wrapper
// runs its script only when the environment is provided, and otherwise reports an explicit skip with the reason.
//
// To run one locally:
//   RWA_PLAYWRIGHT_DIR=<dir containing node_modules/playwright's parent, i.e. where `playwright` resolves> \
//   RWA_PREVIEW_URL=http://localhost:3034 node --test scripts/<name>.test.mjs
import test from 'node:test'

export async function runBrowserScript(name, scriptUrl) {
  const missing = ['RWA_PLAYWRIGHT_DIR', 'RWA_PREVIEW_URL'].filter((key) => !process.env[key])
  if (missing.length) {
    test(name, { skip: `browser acceptance script: needs ${missing.join(' and ')} (Playwright + Chrome + a running dev server with /dev/mobile-polish); see scripts/browser-test-guard.mjs` }, () => {})
    return
  }
  await import(scriptUrl)
}
