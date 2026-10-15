/**
 * PostCSS plugin: every `env(safe-area-inset-<side>[, fallback])` becomes
 * `max(env(safe-area-inset-<side>[, fallback]), var(--native-inset-<side>, 0px))`.
 *
 * The Android client draws the site edge to edge under transparent system bars and sets --native-inset-* on <html>
 * to the real status/navigation bar sizes, because WebView does not reliably report them through env(). Everywhere
 * else the variable is unset, so max(env(), 0px) equals env() and nothing changes.
 */
const PATTERN = /env\(\s*safe-area-inset-(top|right|bottom|left)\s*(,\s*[^()]*?)?\)/g

function rewrite(value) {
  if (!value.includes('safe-area-inset') || value.includes('--native-inset-')) return value
  return value.replace(PATTERN, (match, side) => `max(${match}, var(--native-inset-${side}, 0px))`)
}

const plugin = () => ({
  postcssPlugin: 'native-insets',
  Declaration(decl) {
    const next = rewrite(decl.value)
    if (next !== decl.value) decl.value = next
  },
})
plugin.postcss = true
plugin.rewrite = rewrite

module.exports = plugin
