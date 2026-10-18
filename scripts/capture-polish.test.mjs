import { runBrowserScript } from './browser-test-guard.mjs'

await runBrowserScript('capture-polish', new URL('./capture-polish.browser.mjs', import.meta.url).href)
