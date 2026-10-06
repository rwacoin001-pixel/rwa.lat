import type { AccountScope } from '@/lib/api/ai-customer'

// Picks the smallest account snapshot a question needs. The server only ever reads the signed-in
// caller's own rows; this just keeps unrelated turns from paying for (and sharing) a lookup.
const SELF = /我|本人|自己|俺|\b(my|mine|me|i've|i have|did i|have i|am i|do i have)\b/i
const ACCOUNT = /账户|帐户|賬戶|帳戶|账号|帳號|\baccount\b/i
// Words that are only ever about one's own account, so "余额多少" needs no 我; "如何充值" stays general.
const PERSONAL = /余额|餘額|持仓|持倉|仓位|倉位|到账|到帳/
const TOPICS: [AccountScope, RegExp][] = [
  ['balances', /余额|餘額|到账|到帳|充值|充了|入金|提现|提現|出金|冻结|凍結|可用资金|可用資金|钱包|錢包|\b(balances?|deposit(ed|s)?|withdraw(al|n|s)?|funds|wallet|cash)\b/i],
  ['positions', /持仓|持倉|仓位|倉位|持有|盈亏|盈虧|收益|下注|押注|投资组合|投資組合|\b(positions?|holdings?|portfolio|p&l|profits?|bets?)\b/i],
  ['orders', /订单|訂單|成交|申购|申購|赎回|贖回|下单|下單|买了|買了|交易记录|交易記錄|\b(orders?|purchases?|bought|redeem(ed|ption)?|trades?|transactions?)\b/i],
  ['qualification', /资格|資格|实名|實名|认证|認證|审核|審核|合格投资者|合格投資者|\b(kyc|eligib\w*|qualif\w*|verif\w*|accredit\w*)\b/i],
]

export function accountScopesFor(message: string): AccountScope[] {
  const self = SELF.test(message), account = ACCOUNT.test(message)
  if (!self && !account && !PERSONAL.test(message)) return []
  const scopes = TOPICS.filter(([, pattern]) => pattern.test(message)).map(([scope]) => scope)
  // "我的账户怎么样" names no topic: a balance + holdings overview answers it without pulling everything.
  return scopes.length ? scopes : account && self ? ['balances', 'positions'] : []
}
