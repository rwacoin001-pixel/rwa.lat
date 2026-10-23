import type { AppLocale } from './i18n'

/**
 * Palette A preview copy: A-REIT repositioned on commercial and industrial REITs.
 * Brand line "让资产清晰起来 / Bring assets into focus" (approved 2026-10-18); no return promises anywhere.
 * Chinese and English are written; the other locales fall back to English until the copy is approved.
 */
type Slogan = { lines: [string, string]; sub: string }
type Onboarding = {
  skip: string; next: string; create: string; signIn: string; step: string
  s1: { kicker: string; title: string; body: string; kinds: [string, string, string] }
  s2: { kicker: string; title: string; body: string; flow: [string, string, string, string]; shares: string; unit: string; ofBuilding: string; note: string }
  s3: { kicker: string; title: string; rows: [string, string][] }
}

const slogan: Partial<Record<AppLocale, Slogan>> = {
  'zh-CN': { lines: ['让资产', '清晰起来。'], sub: '商业与工业地产，按份额投资' },
  en: { lines: ['Bring assets', 'into focus.'], sub: 'Commercial and industrial real estate, by the share' },
}

const onboarding: Partial<Record<AppLocale, Onboarding>> = {
  'zh-CN': {
    skip: '跳过', next: '下一步', create: '创建账户', signIn: '我已有账户', step: '第 {n} 步，共 3 步',
    s1: { kicker: '投资什么', title: '投资看得见的空间', body: '写字楼、物流仓、产业园。按份额参与优质的商业与工业地产。', kinds: ['写字楼', '物流仓', '产业园'] },
    s2: {
      kicker: '收入从哪里来', title: '租金，按份额分给你', body: '租户按月支付租金，信托扣除费用后，按你持有的份额分派。拖动滑块看看。',
      flow: ['租户', '物业', '信托', '你'], shares: '你持有', unit: '份', ofBuilding: '一栋物业分成 100 份', note: '仅为示意，不代表实际分派金额',
    },
    s3: {
      kicker: '怎么保障', title: '每一步都清楚',
      rows: [['信息披露', '定期公布物业、租户和费用，看得到钱从哪里来。'], ['实名认证', '投资前完成身份认证，保护你的账户。'], ['份额记录', '每一份持有都有记录，随时可查。']],
    },
  },
  en: {
    skip: 'Skip', next: 'Next', create: 'Create account', signIn: 'I have an account', step: 'Step {n} of 3',
    s1: { kicker: 'What you invest in', title: 'Invest in spaces you can see', body: 'Offices, logistics, business parks. Own a share of quality commercial and industrial real estate.', kinds: ['Offices', 'Logistics', 'Parks'] },
    s2: {
      kicker: 'Where income comes from', title: 'Rent, shared by the unit', body: 'Tenants pay rent; after fees, the trust distributes it by the units you hold. Drag to see how.',
      flow: ['Tenants', 'Property', 'Trust', 'You'], shares: 'You hold', unit: 'units', ofBuilding: 'One property in 100 units', note: 'Illustration only, not an actual distribution',
    },
    s3: {
      kicker: 'How you are protected', title: 'Every step, in the open',
      rows: [['Disclosure', 'Properties, tenants and fees are published regularly.'], ['Verified identity', 'Verify before you invest to keep your account safe.'], ['Unit records', 'Every unit you hold is on record and easy to check.']],
    },
  },
}

export const paletteASlogan = (locale: AppLocale): Slogan => slogan[locale] ?? slogan.en!
export const paletteAOnboarding = (locale: AppLocale): Onboarding => onboarding[locale] ?? onboarding.en!
