/** Same rules as the existing post composer in lib/community-guard.ts. Keep the parity test when changing either. */
const PATTERNS: RegExp[] = [
  /(微信|威信|薇信|vx|v信|wechat|weixin|whatsapp|telegram|电报|飞机号|tg群|qq号|line\s*id|加我|私聊我|私信我联系)/i,
  /(t\.me\/|wa\.me\/|chat\.whatsapp\.com)/i,
  /(带单|喊单|拉群|进群|跟单群|内幕|稳赚|保本|保证收益|包赚|零风险|翻倍)/,
  /(guaranteed\s+(return|profit|income)|risk[-\s]?free\s+(return|profit)|join\s+my\s+(group|channel)|dm\s+me\s+for\s+signals)/i,
  // Phone numbers: international with "+", or a mainland mobile; dates and prices do not match.
  /(\+\d{8,15}\b|(?<!\d)1[3-9]\d{9}(?!\d))/,
]

export function riskyDm(text: string): boolean {
  return PATTERNS.some(pattern => pattern.test(text))
}
