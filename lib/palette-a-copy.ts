import type { AppLocale } from './i18n'

/**
 * Palette A preview copy. Brand line "好资产，一目了然 / Good assets, at a glance." (chosen 2026-10-24); it covers
 * the whole app (REITs, baskets, quant, AI), not one product. No return promises; referral rewards "per the rules".
 * Chinese and English are written; the other locales fall back to English until the copy is approved.
 */
type Slogan = { lines: [string, string]; sub: string }
type Onboarding = {
  skip: string; step: string; start: string; signIn: string; create: string
  s0: { title: [string, string]; sub: string; hint: string; chips: [string, string, string, string]; stats: [string, string][]; cta: string }
  s1: { title: string; hint: string; items: [string, string][] }
  s2: { title: string; hint: string; tags: [string, string, string] }
  s3: { title: string; body: string; note: string; hint: string }
}

const slogan: Partial<Record<AppLocale, Slogan>> = {
  'zh-CN': { lines: ['好资产，', '一目了然。'], sub: '地产信托、资产组合、量化策略，一个账户看清' },
  en: { lines: ['Good assets,', 'at a glance.'], sub: 'REITs, baskets and quant strategies, one clear account' },
}

const onboarding: Partial<Record<AppLocale, Onboarding>> = {
  'zh-CN': {
    skip: '跳过', step: '第 {n} 步，共 4 步', start: '开始', signIn: '我已有账户', create: '创建账户',
    s0: { title: ['好资产，', '一目了然。'], sub: '地产信托、资产组合、量化策略，一个账户看清', hint: '按住', chips: ['地产信托', '资产组合', '量化策略', 'AI 助手'], stats: [['4', '类产品'], ['1', '个账户'], ['7', '种语言']], cta: '开始了解' },
    s1: { title: '一个账户，多种资产', hint: '左右拖动，看看每一种', items: [['地产信托', '写字楼、物流仓、产业园'], ['资产组合', '一篮子资产，一次配置'], ['考拉量化', '规则驱动的量化策略'], ['AI 助手', '随时问，帮你看清']] },
    s2: { title: '看清每一份', hint: '手指划过玻璃', tags: ['来源', '费用', '风险'] },
    s3: { title: '邀请好友，一起得奖励', body: '好友用你的邀请码注册并投资后，你可以获得奖励。', note: '奖励以平台规则为准', hint: '拖一拖' },
  },
  en: {
    skip: 'Skip', step: 'Step {n} of 4', start: 'Start', signIn: 'I have an account', create: 'Create account',
    s0: { title: ['Good assets,', 'at a glance.'], sub: 'REITs, baskets and quant strategies, one clear account', hint: 'Press and hold', chips: ['REITs', 'Baskets', 'Quant', 'AI assistant'], stats: [['4', 'products'], ['1', 'account'], ['7', 'languages']], cta: 'Take a look' },
    s1: { title: 'One account, many assets', hint: 'Drag to look around', items: [['REITs', 'Offices, logistics, business parks'], ['Baskets', 'A set of assets in one go'], ['Koala Quant', 'Rule-driven quant strategies'], ['AI assistant', 'Ask anything, see it clearly']] },
    s2: { title: 'See every unit clearly', hint: 'Wipe the glass', tags: ['Source', 'Fees', 'Risk'] },
    s3: { title: 'Invite friends, earn together', body: 'When friends sign up with your code and invest, you can earn rewards.', note: 'Rewards follow the platform rules', hint: 'Give it a pull' },
  },
}
export const paletteASlogan = (locale: AppLocale): Slogan => slogan[locale] ?? slogan.en!
export const paletteAOnboarding = (locale: AppLocale): Onboarding => onboarding[locale] ?? onboarding.en!
