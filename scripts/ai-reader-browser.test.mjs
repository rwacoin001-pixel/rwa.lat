import { runBrowserScript } from './browser-test-guard.mjs'

await runBrowserScript('ai-reader-browser', new URL('./ai-reader-browser.browser.mjs', import.meta.url).href)
