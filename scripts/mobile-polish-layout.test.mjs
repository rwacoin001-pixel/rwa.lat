import { runBrowserScript } from './browser-test-guard.mjs'

await runBrowserScript('mobile-polish-layout', new URL('./mobile-polish-layout.browser.mjs', import.meta.url).href)
