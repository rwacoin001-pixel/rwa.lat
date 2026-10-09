import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminErrorMessage } from '../src/lib/admin-errors.ts'

test('reads structured core errors without losing their useful message', () => {
  assert.equal(adminErrorMessage({ error: { code: 'invalid', message: '请填写原因' } }, 422), '请填写原因')
  assert.equal(adminErrorMessage({ message: ['字段错误', '请重试'] }, 400), '字段错误；请重试')
})
test('distinguishes authentication, permission, unavailable and timeout errors', () => {
  assert.match(adminErrorMessage(null, 401), /登录/)
  assert.match(adminErrorMessage(null, 403), /权限/)
  assert.match(adminErrorMessage(null, 503), /不可用/)
  assert.match(adminErrorMessage(null, 504), /超时/)
})
test('never renders an HTML error page or non-string metadata as the message', () => {
  assert.equal(adminErrorMessage({ message: '<html>Private debug page</html>' }, 502), '服务请求失败，请刷新重试。')
  assert.equal(adminErrorMessage({ error: { message: { secret: 'private' } } }, 502), '服务请求失败，请刷新重试。')
})
