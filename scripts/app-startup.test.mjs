import assert from 'node:assert/strict'
import { shouldShowAppStartup } from '../lib/app-startup.ts'
const normal = { pathname: '/home', installed: true, seen: false, reducedMotion: false }
assert.equal(shouldShowAppStartup(normal), true)
for (const pathname of ['/desktop', '/desktop/', '/auth/callback/google', '/dev/mobile-polish', '/terms', '/privacy']) assert.equal(shouldShowAppStartup({ ...normal, pathname }), false)
assert.equal(shouldShowAppStartup({ ...normal, seen: true }), false)
assert.equal(shouldShowAppStartup({ ...normal, installed: false }), false)
assert.equal(shouldShowAppStartup({ ...normal, reducedMotion: true }), false)
console.log('PASS: startup respects public routes, installed app, session and reduced-motion boundaries')
