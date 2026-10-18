import { runBrowserScript } from './browser-test-guard.mjs'

await runBrowserScript('mobile-polish-ui', new URL('./mobile-polish-ui.browser.mjs', import.meta.url).href)
