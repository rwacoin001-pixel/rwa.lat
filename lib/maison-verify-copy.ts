import type { AppLocale } from '@/lib/app-locales'

/**
 * Verification copy (batch F1b): verification centre, identity (KYC), eligibility and risk profile.
 * `{x}` tokens go through fill(). Questionnaire text is keyed by question key for version 2026.1 only;
 * any other version (or a key/option-count mismatch) falls back to the server's own wording.
 */
type Row = { title: string; body: string }
type KycState = 'not_started' | 'in_progress' | 'submitted' | 'needs_information' | 'approved' | 'rejected' | 'expired'
type Decision = 'browse_only' | 'ineligible' | 'eligible' | 'manual_review'
type Band = 'conservative' | 'balanced' | 'growth' | 'aggressive'
type Screening = 'none' | 'pending' | 'clear' | 'potential_match' | 'confirmed_match' | 'dismissed'
type Reason = 'region_blocked' | 'kyc_not_approved' | 'sanctions_match' | 'sanctions_review' | 'risk_flag_open'
type QuestionKey = 'experience' | 'horizon' | 'drawdown' | 'objective' | 'stability' | 'liquidity'
type Five = [string, string, string, string, string]

export const RISK_COPY_VERSION = '2026.1'

export type VerifyCopy = {
  common: { retry: string; refresh: string; refreshing: string; open: string; notRecorded: string; unknown: string; failed: string; none: string }
  kyc: Record<KycState, Row>
  decisions: Record<Decision, Row>
  notAssessed: Row
  bands: Record<Band, Row>
  screening: Record<Screening, string>
  reasons: Record<Reason, Row & { fix: string }>
  scopes: Record<'default' | 'trading' | 'basket' | 'prediction' | 'stocks' | 'rwa' | 'compute', string>
  center: {
    kicker: string; titleA: string; titleB: string; lede: string; card: string; holder: string; access: string; identity: string; risk: string
    progress: string; assessed: string; policy: string; next: string; open: string; allSet: string
    nextKyc: string; nextRisk: string; nextRiskStale: string; nextEligibility: string
    steps: string; stepsNote: string; stepItems: Record<'kyc' | 'eligibility' | 'risk', Row>
    meta: { decided: string; submitted: string; started: string; completed: string; validUntil: string; checked: string; notStarted: string }
    allows: string; allowsNote: string; allowItems: Record<'browse' | 'invest' | 'hold', Row>; allowStates: { yes: string; needs: string; unaffected: string }
    privacy: string; privacyNote: string; privacyItems: [string, string, string, string]
  }
  kycPage: {
    kicker: string; titleA: string; titleB: string; lede: string; card: string; stages: [string, string, string]
    provider: string; caseRef: string; expires: string; reason: string; decided: string; reasonRaw: string
    actions: Record<'not_started' | 'in_progress' | 'needs_information' | 'rejected' | 'expired', string>
    opening: string; handoff: string; unavailableTitle: string; unavailableBody: string; insecure: string; already: string; failed: string
    toEligibility: string; needs: string; needsNote: string; needItems: [Row, Row, Row]; how: string; howNote: string; howItems: [string, string, string]
    reasonCodes: Record<string, string>
  }
  elig: {
    kicker: string; titleA: string; titleB: string; lede: string; card: string; level: string; identity: string; screening: string; region: string
    policy: string; decided: string; run: string; running: string; runFailed: string
    why: string; whyNote: string; noReasons: string
    products: string; productsNote: string; notChecked: string; check: string; recheckAll: string; checked: string
    how: string; howNote: string; howItems: [string, string, string, string]; regionsLink: string
  }
  risk: {
    kicker: string; titleA: string; titleB: string; lede: string; card: string; score: string; completed: string; validUntil: string; daysLeft: string; days: string; version: string
    staleTitle: string; staleBody: string; versionTitle: string; versionBody: string; retake: string; start: string; introTitle: string; introBody: string
    covers: string; coversNote: string; topics: Record<QuestionKey, string>; selfAssessment: string
    answers: string; answersNote: string; edit: string; bandsTitle: string; bandsNote: string; yours: string
    remove: string; removeTitle: string; removeBody: string; confirmRemove: string; keep: string; removing: string; removeFailed: string
    question: string; back: string; next: string; review: string; reviewTitle: string; reviewNote: string; submit: string; submitting: string; submitFailed: string
    incomplete: string; draft: string; exit: string; serverText: string; unanswered: string
  }
  questions: Record<QuestionKey, { prompt: string; options: Five }>
}

const en: VerifyCopy = {
  common: { retry: 'Try again', refresh: 'Refresh status', refreshing: 'Refreshing…', open: 'Open', notRecorded: 'Not recorded', unknown: 'Unavailable', failed: 'Something went wrong. Nothing was changed.', none: '—' },
  kyc: {
    not_started: { title: 'Not started', body: 'Verify your identity once to unlock new investments.' },
    in_progress: { title: 'In progress', body: 'You started verification but have not finished it yet.' },
    submitted: { title: 'Under review', body: 'Your documents are with our verification partner. We update this page when they decide.' },
    needs_information: { title: 'More information needed', body: 'The partner needs something else from you before they can decide.' },
    approved: { title: 'Verified', body: 'Your identity is verified.' },
    rejected: { title: 'Not approved', body: 'This attempt was not approved. You can start a new verification.' },
    expired: { title: 'Expired', body: 'Your verification has expired. Renew it to keep investing.' },
  },
  decisions: {
    eligible: { title: 'Full access', body: 'You can place new investments in this scope.' },
    browse_only: { title: 'Browse only', body: 'You can explore everything; new investments open after the steps below.' },
    manual_review: { title: 'Under review', body: 'Our compliance team is reviewing your account. New investments are paused meanwhile.' },
    ineligible: { title: 'Restricted', body: 'New investments are not available for this account under the current policy.' },
  },
  notAssessed: { title: 'Not assessed yet', body: 'No eligibility decision is on record. Run a check to see where you stand.' },
  bands: {
    conservative: { title: 'Conservative', body: 'Capital preservation first; small, short-lived swings only.' },
    balanced: { title: 'Balanced', body: 'Steady growth with moderate, temporary losses accepted.' },
    growth: { title: 'Growth', body: 'Long horizon; comfortable with meaningful drawdowns.' },
    aggressive: { title: 'Aggressive', body: 'Maximum growth; large swings are acceptable.' },
  },
  screening: { none: 'No case', pending: 'Pending', clear: 'Clear', potential_match: 'Potential match', confirmed_match: 'Match', dismissed: 'Dismissed' },
  reasons: {
    region_blocked: { title: 'Region not supported', body: 'The region on record is outside the regions this product serves.', fix: 'See access regions' },
    kyc_not_approved: { title: 'Identity not verified', body: 'New investments require an approved identity verification.', fix: 'Verify identity' },
    sanctions_match: { title: 'Screening match', body: 'Sanctions screening returned a match that needs compliance review.', fix: 'Contact support' },
    sanctions_review: { title: 'Screening under review', body: 'Sanctions screening flagged a possible match that is being reviewed.', fix: 'Contact support' },
    risk_flag_open: { title: 'Account review open', body: 'An open risk review on the account pauses new investments.', fix: 'Contact support' },
  },
  scopes: { default: 'All products', trading: 'Spot trading', basket: 'Baskets', prediction: 'Prediction markets', stocks: 'Tokenised stocks', rwa: 'Real-world assets', compute: 'Compute' },
  center: {
    kicker: 'Verification', titleA: 'Your', titleB: 'credentials', lede: 'Identity, eligibility and risk profile — the three records that decide what you can invest in.',
    card: 'Investor credential', holder: 'A-REIT account', access: 'Access', identity: 'Identity', risk: 'Risk profile',
    progress: '{n} of 3 complete', assessed: 'Assessed {t}', policy: 'Policy {v}', next: 'Next step', open: 'Open', allSet: 'All three records are complete and current.',
    nextKyc: 'Verify your identity to unlock new investments', nextRisk: 'Complete your risk profile — six questions', nextRiskStale: 'Your risk profile has expired — retake it', nextEligibility: 'Run an eligibility check',
    steps: 'Your records', stepsNote: 'Each record is kept separately and can be refreshed at any time.',
    stepItems: {
      kyc: { title: 'Identity verification', body: 'Hosted by our verification partner' },
      eligibility: { title: 'Eligibility', body: 'Region, identity and screening checks' },
      risk: { title: 'Risk profile', body: 'Six-question self-assessment' },
    },
    meta: { decided: 'Decided {t}', submitted: 'Submitted {t}', started: 'Started {t}', completed: 'Completed {t}', validUntil: 'Valid until {t}', checked: 'Checked {t}', notStarted: 'Not started' },
    allows: 'What your status allows', allowsNote: 'Eligibility is checked again every time you place a new investment.',
    allowItems: {
      browse: { title: 'Browse markets and research', body: 'Prices, disclosures, issuers and analytics' },
      invest: { title: 'New investments', body: 'Orders, basket subscriptions, predictions and trading' },
      hold: { title: 'Existing holdings', body: 'Viewing and redeeming what you already hold' },
    },
    allowStates: { yes: 'Available', needs: 'Needs full access', unaffected: 'Not gated by this check' },
    privacy: 'How your data is handled', privacyNote: 'What we keep, and where.',
    privacyItems: [
      'Documents and selfies go directly to our verification partner on their secure page; they are not uploaded to this app.',
      'We keep the verification state and an encrypted reference to the partner’s case — not your documents.',
      'Each eligibility decision records the evidence it used: identity state, screening state and region.',
      'A risk profile is valid for 12 months, and you can remove it at any time.',
    ],
  },
  kycPage: {
    kicker: 'Identity', titleA: 'Verify', titleB: 'once', lede: 'A one-time check with our regulated verification partner. It unlocks new investments across the app.',
    card: 'Identity verification', stages: ['Started', 'Submitted', 'Decision'],
    provider: 'Partner', caseRef: 'Case', expires: 'Valid until', reason: 'Reason', decided: 'Decided', reasonRaw: 'Code from the partner',
    actions: { not_started: 'Start verification', in_progress: 'Continue verification', needs_information: 'Provide information', rejected: 'Start a new verification', expired: 'Renew verification' },
    opening: 'Opening secure session…', handoff: 'You’ll continue on the partner’s secure page, then come back here.',
    unavailableTitle: 'Verification partner not connected', unavailableBody: 'Hosted identity verification is not available in this environment yet. Nothing was submitted.',
    insecure: 'The verification link was not a secure https address, so it was not opened.', already: 'Your identity is already verified — status refreshed.', failed: 'Could not start verification. Nothing was submitted.',
    toEligibility: 'Check eligibility', needs: 'What you’ll need', needsNote: 'Have these ready before you start.',
    needItems: [
      { title: 'Government photo ID', body: 'Passport, national ID card or driving licence — valid and unexpired' },
      { title: 'A device with a camera', body: 'For photos of the document and a short selfie check' },
      { title: 'Your legal name', body: 'It must match the document exactly' },
    ],
    how: 'How it works', howNote: 'Three steps, one time.',
    howItems: [
      'Open the partner’s secure page from this screen and follow their steps.',
      'The partner reviews your documents and sends us only the outcome.',
      'This page and your eligibility update when a decision arrives.',
    ],
    reasonCodes: { document_expired: 'The document has expired', document_unreadable: 'The document could not be read', name_mismatch: 'The name does not match', selfie_mismatch: 'The selfie did not match the document', underage: 'Age requirement not met' },
  },
  elig: {
    kicker: 'Eligibility', titleA: 'Your', titleB: 'access', lede: 'Whether you can place new investments, and exactly why. Decided by policy, not by hand.',
    card: 'Access decision', level: 'Access level', identity: 'Identity', screening: 'Screening', region: 'Region',
    policy: 'Policy {v}', decided: 'Decided {t}', run: 'Run eligibility check', running: 'Checking…', runFailed: 'The check could not run. Your previous decision is unchanged.',
    why: 'What decided this', whyNote: 'Each reason comes straight from the policy result.', noReasons: 'No restrictions recorded — every check passed.',
    products: 'By product', productsNote: 'Some products are checked separately.', notChecked: 'Not checked', check: 'Check', recheckAll: 'Re-check all', checked: 'Checked {t}',
    how: 'How access is decided', howNote: 'Four checks, in this order.',
    howItems: [
      'Region — the region on record must be one the product serves.',
      'Identity — your verification must be approved.',
      'Screening — sanctions screening must not show an open match.',
      'Account review — no high-severity review may be open.',
    ],
    regionsLink: 'Access regions',
  },
  risk: {
    kicker: 'Risk profile', titleA: 'Your', titleB: 'appetite', lede: 'Six questions about your experience, horizon and tolerance for loss. Honest answers keep your profile useful.',
    card: 'Risk profile', score: 'Score', completed: 'Completed', validUntil: 'Valid until', daysLeft: 'Remaining', days: '{n} days', version: 'Questionnaire {v}',
    staleTitle: 'This profile has expired', staleBody: 'Profiles are valid for 12 months. Retake the questionnaire to keep it current.',
    versionTitle: 'The questionnaire has changed', versionBody: 'Your profile was built on version {v}. Retake it to answer the current questions.',
    retake: 'Retake questionnaire', start: 'Start questionnaire', introTitle: 'No risk profile yet', introBody: 'It takes about a minute. You can change your answers before you submit.',
    covers: 'What it covers', coversNote: 'One question on each.',
    topics: { experience: 'Investing experience', horizon: 'Time horizon', drawdown: 'Loss tolerance', objective: 'Objective', stability: 'Income stability', liquidity: 'Liquidity needs' },
    selfAssessment: 'This is a self-assessment. It does not recommend products or build a portfolio for you.',
    answers: 'Your answers', answersNote: 'Tap one to change it — you’ll review before anything is saved.', edit: 'Edit',
    bandsTitle: 'Risk bands', bandsNote: 'Your score places you in one band.', yours: 'Yours',
    remove: 'Remove profile', removeTitle: 'Remove your risk profile?', removeBody: 'Your answers and band will be deleted. You can take the questionnaire again at any time.', confirmRemove: 'Remove', keep: 'Keep it', removing: 'Removing…', removeFailed: 'Could not remove the profile. It is unchanged.',
    question: 'Question {n} of {total}', back: 'Back', next: 'Next', review: 'Review answers', reviewTitle: 'Check your answers', reviewNote: 'Nothing is saved until you submit.',
    submit: 'Submit profile', submitting: 'Submitting…', submitFailed: 'Could not save your profile. Your answers are kept on this device.',
    incomplete: 'Answer every question to submit.', draft: 'Draft kept on this device', exit: 'Exit', serverText: 'Shown in the server’s wording', unanswered: 'Not answered',
  },
  questions: {
    experience: { prompt: 'How much investing experience do you have?', options: ['None', 'Less than 1 year', '1–3 years', '3–7 years', 'More than 7 years'] },
    horizon: { prompt: 'How long do you plan to keep this investment?', options: ['Under 6 months', '6–12 months', '1–3 years', '3–7 years', 'More than 7 years'] },
    drawdown: { prompt: 'What temporary loss could you tolerate without selling?', options: ['None', 'Up to 5%', 'Up to 10%', 'Up to 25%', 'More than 25%'] },
    objective: { prompt: 'What is your primary objective?', options: ['Preserve capital', 'Income with low risk', 'Balanced growth', 'High growth', 'Maximum growth'] },
    stability: { prompt: 'How stable is your income?', options: ['Very unstable', 'Somewhat unstable', 'Neutral', 'Stable', 'Very stable'] },
    liquidity: { prompt: 'How soon might you need this money back in cash?', options: ['Any time', 'Within a year', '1–3 years', '3+ years', 'I will not need it'] },
  },
}

const zh: VerifyCopy = {
  common: { retry: '重试', refresh: '刷新状态', refreshing: '刷新中…', open: '打开', notRecorded: '未记录', unknown: '暂不可用', failed: '出了点问题，未做任何更改。', none: '—' },
  kyc: {
    not_started: { title: '未开始', body: '完成一次身份验证，即可开通新的投资。' },
    in_progress: { title: '进行中', body: '你已开始验证，但尚未完成。' },
    submitted: { title: '审核中', body: '资料已交给验证合作方审核，结果出来后此页会更新。' },
    needs_information: { title: '需要补充资料', body: '合作方需要你补充信息后才能作出决定。' },
    approved: { title: '已验证', body: '你的身份已通过验证。' },
    rejected: { title: '未通过', body: '本次验证未通过，你可以重新发起验证。' },
    expired: { title: '已过期', body: '身份验证已过期，续期后才能继续投资。' },
  },
  decisions: {
    eligible: { title: '完全开通', body: '你可以在此范围内进行新的投资。' },
    browse_only: { title: '仅可浏览', body: '你可以浏览全部内容；完成下方步骤后开通新投资。' },
    manual_review: { title: '人工审核中', body: '合规团队正在审核你的账户，期间暂停新的投资。' },
    ineligible: { title: '受限', body: '按当前政策，此账户暂不能进行新的投资。' },
  },
  notAssessed: { title: '尚未评估', body: '目前没有资格评估记录。运行一次检查即可了解你的状态。' },
  bands: {
    conservative: { title: '保守型', body: '以保本为先，只接受小幅、短暂的波动。' },
    balanced: { title: '稳健型', body: '追求稳定增长，接受适度的暂时亏损。' },
    growth: { title: '成长型', body: '投资期限较长，能承受较明显的回撤。' },
    aggressive: { title: '进取型', body: '追求最大增长，可接受大幅波动。' },
  },
  screening: { none: '无记录', pending: '处理中', clear: '无异常', potential_match: '疑似命中', confirmed_match: '命中', dismissed: '已排除' },
  reasons: {
    region_blocked: { title: '地区不支持', body: '记录中的地区不在此产品的服务范围内。', fix: '查看准入地区' },
    kyc_not_approved: { title: '身份未验证', body: '新的投资需要身份验证通过。', fix: '去验证身份' },
    sanctions_match: { title: '筛查命中', body: '制裁筛查结果命中，需要合规人工审核。', fix: '联系客服' },
    sanctions_review: { title: '筛查审核中', body: '制裁筛查标记了疑似命中，正在审核。', fix: '联系客服' },
    risk_flag_open: { title: '账户审核未结', body: '账户存在未结的风险审核，新投资暂停。', fix: '联系客服' },
  },
  scopes: { default: '全部产品', trading: '现货交易', basket: '组合篮子', prediction: '预测市场', stocks: '代币化股票', rwa: '现实世界资产', compute: '算力' },
  center: {
    kicker: '身份与资格', titleA: '你的', titleB: '投资凭证', lede: '身份验证、投资资格与风险测评——三项记录共同决定你能投资什么。',
    card: '投资者凭证', holder: 'A-REIT 账户', access: '权限', identity: '身份', risk: '风险测评',
    progress: '已完成 {n}/3', assessed: '评估于 {t}', policy: '政策 {v}', next: '下一步', open: '前往', allSet: '三项记录均已完成且在有效期内。',
    nextKyc: '验证身份以开通新投资', nextRisk: '完成风险测评——共 6 题', nextRiskStale: '风险测评已过期，请重新测评', nextEligibility: '运行一次资格检查',
    steps: '你的记录', stepsNote: '每项记录独立保存，可随时刷新。',
    stepItems: {
      kyc: { title: '身份验证', body: '由验证合作方托管完成' },
      eligibility: { title: '投资资格', body: '地区、身份与筛查检查' },
      risk: { title: '风险测评', body: '6 道自评问题' },
    },
    meta: { decided: '{t} 作出决定', submitted: '{t} 提交', started: '{t} 开始', completed: '{t} 完成', validUntil: '有效期至 {t}', checked: '{t} 检查', notStarted: '未开始' },
    allows: '当前状态可以做什么', allowsNote: '每次发起新投资时都会重新检查资格。',
    allowItems: {
      browse: { title: '浏览市场与研究', body: '价格、披露、发行方与分析' },
      invest: { title: '新的投资', body: '下单、申购篮子、预测与交易' },
      hold: { title: '已有持仓', body: '查看与赎回已持有的资产' },
    },
    allowStates: { yes: '可用', needs: '需完全开通', unaffected: '不受此检查限制' },
    privacy: '数据如何处理', privacyNote: '我们保存什么、保存在哪里。',
    privacyItems: [
      '证件与自拍直接提交到验证合作方的安全页面，不会上传到本应用。',
      '我们只保存验证状态和一份加密的合作方案件引用，不保存你的证件。',
      '每次资格决定都会记录所依据的证据：身份状态、筛查状态与地区。',
      '风险测评有效期 12 个月，你可以随时删除。',
    ],
  },
  kycPage: {
    kicker: '身份', titleA: '一次', titleB: '验证', lede: '由受监管的验证合作方完成的一次性检查，通过后即可在全应用开通新投资。',
    card: '身份验证', stages: ['已开始', '已提交', '决定'],
    provider: '合作方', caseRef: '案件', expires: '有效期至', reason: '原因', decided: '决定时间', reasonRaw: '合作方代码',
    actions: { not_started: '开始验证', in_progress: '继续验证', needs_information: '补充资料', rejected: '重新发起验证', expired: '续期验证' },
    opening: '正在打开安全会话…', handoff: '接下来将在合作方的安全页面继续，完成后返回此处。',
    unavailableTitle: '验证合作方未接入', unavailableBody: '当前环境尚未提供托管身份验证，未提交任何资料。',
    insecure: '验证链接不是安全的 https 地址，已拒绝打开。', already: '你的身份已通过验证，状态已刷新。', failed: '无法发起验证，未提交任何资料。',
    toEligibility: '查看投资资格', needs: '需要准备', needsNote: '开始前请先准备好。',
    needItems: [
      { title: '政府签发的带照片证件', body: '护照、身份证或驾照，须在有效期内' },
      { title: '带摄像头的设备', body: '用于拍摄证件和简短的自拍核验' },
      { title: '你的法定姓名', body: '须与证件完全一致' },
    ],
    how: '流程', howNote: '三步，只需一次。',
    howItems: ['在此页打开合作方的安全页面，按提示操作。', '合作方审核资料，只把结果发给我们。', '结果到达后，此页与你的投资资格会同步更新。'],
    reasonCodes: { document_expired: '证件已过期', document_unreadable: '证件无法识别', name_mismatch: '姓名不一致', selfie_mismatch: '自拍与证件不符', underage: '未满足年龄要求' },
  },
  elig: {
    kicker: '投资资格', titleA: '你的', titleB: '权限', lede: '你能否发起新的投资，以及确切原因。由政策决定，而非人工随意判断。',
    card: '权限决定', level: '权限等级', identity: '身份', screening: '筛查', region: '地区',
    policy: '政策 {v}', decided: '{t} 作出决定', run: '运行资格检查', running: '检查中…', runFailed: '检查未能运行，原有决定保持不变。',
    why: '决定依据', whyNote: '每条原因都直接来自政策结果。', noReasons: '没有任何限制记录，所有检查均通过。',
    products: '按产品', productsNote: '部分产品单独检查。', notChecked: '未检查', check: '检查', recheckAll: '全部重新检查', checked: '{t} 检查',
    how: '权限如何决定', howNote: '按顺序进行四项检查。',
    howItems: ['地区——记录中的地区须在产品服务范围内。', '身份——身份验证须已通过。', '筛查——制裁筛查不得有未结命中。', '账户审核——不得有未结的高风险审核。'],
    regionsLink: '准入地区',
  },
  risk: {
    kicker: '风险测评', titleA: '你的', titleB: '风险偏好', lede: '6 道关于经验、期限与亏损承受力的问题。如实作答，测评才有参考价值。',
    card: '风险测评', score: '得分', completed: '完成于', validUntil: '有效期至', daysLeft: '剩余', days: '{n} 天', version: '问卷 {v}',
    staleTitle: '测评已过期', staleBody: '测评有效期为 12 个月，请重新作答以保持最新。',
    versionTitle: '问卷已更新', versionBody: '你的测评基于 {v} 版本，请重新作答当前问题。',
    retake: '重新测评', start: '开始测评', introTitle: '尚无风险测评', introBody: '大约一分钟。提交前可以修改任何答案。',
    covers: '测评内容', coversNote: '每项一题。',
    topics: { experience: '投资经验', horizon: '投资期限', drawdown: '亏损承受力', objective: '投资目标', stability: '收入稳定性', liquidity: '流动性需求' },
    selfAssessment: '这是一份自我评估，不会为你推荐产品或配置组合。',
    answers: '你的答案', answersNote: '点按可修改——保存前会先让你确认。', edit: '修改',
    bandsTitle: '风险等级', bandsNote: '你的得分对应其中一个等级。', yours: '你的等级',
    remove: '删除测评', removeTitle: '删除风险测评？', removeBody: '你的答案与等级将被删除，之后可随时重新测评。', confirmRemove: '删除', keep: '保留', removing: '删除中…', removeFailed: '删除失败，测评未变。',
    question: '第 {n} 题 / 共 {total} 题', back: '上一题', next: '下一题', review: '检查答案', reviewTitle: '确认你的答案', reviewNote: '提交前不会保存任何内容。',
    submit: '提交测评', submitting: '提交中…', submitFailed: '保存失败，答案已保留在此设备上。',
    incomplete: '请回答全部问题后再提交。', draft: '草稿已保存在此设备', exit: '退出', serverText: '按服务端原文显示', unanswered: '未作答',
  },
  questions: {
    experience: { prompt: '你有多少投资经验？', options: ['没有', '不到 1 年', '1–3 年', '3–7 年', '7 年以上'] },
    horizon: { prompt: '你打算持有这笔投资多久？', options: ['不到 6 个月', '6–12 个月', '1–3 年', '3–7 年', '7 年以上'] },
    drawdown: { prompt: '在不卖出的前提下，你能承受多大的暂时亏损？', options: ['不能承受', '最多 5%', '最多 10%', '最多 25%', '超过 25%'] },
    objective: { prompt: '你的主要目标是什么？', options: ['保本', '低风险收益', '平衡增长', '高增长', '最大增长'] },
    stability: { prompt: '你的收入有多稳定？', options: ['非常不稳定', '不太稳定', '一般', '稳定', '非常稳定'] },
    liquidity: { prompt: '你可能多久后需要把这笔钱取回现金？', options: ['随时', '一年内', '1–3 年', '3 年以上', '不会需要'] },
  },
}

const hi: VerifyCopy = {
  common: { retry: 'फिर कोशिश करें', refresh: 'स्थिति रीफ़्रेश करें', refreshing: 'रीफ़्रेश हो रहा है…', open: 'खोलें', notRecorded: 'दर्ज नहीं', unknown: 'उपलब्ध नहीं', failed: 'कुछ गलत हो गया। कुछ भी नहीं बदला गया।', none: '—' },
  kyc: {
    not_started: { title: 'शुरू नहीं हुआ', body: 'नए निवेश खोलने के लिए एक बार पहचान सत्यापित करें।' },
    in_progress: { title: 'जारी है', body: 'आपने सत्यापन शुरू किया है, पर अभी पूरा नहीं किया।' },
    submitted: { title: 'समीक्षा में', body: 'आपके दस्तावेज़ सत्यापन पार्टनर के पास हैं। निर्णय आते ही यह पेज अपडेट होगा।' },
    needs_information: { title: 'और जानकारी चाहिए', body: 'निर्णय से पहले पार्टनर को आपसे कुछ और चाहिए।' },
    approved: { title: 'सत्यापित', body: 'आपकी पहचान सत्यापित है।' },
    rejected: { title: 'स्वीकृत नहीं', body: 'यह प्रयास स्वीकृत नहीं हुआ। आप नया सत्यापन शुरू कर सकते हैं।' },
    expired: { title: 'समाप्त', body: 'आपका सत्यापन समाप्त हो गया है। निवेश जारी रखने के लिए नवीनीकरण करें।' },
  },
  decisions: {
    eligible: { title: 'पूरी पहुँच', body: 'आप इस दायरे में नए निवेश कर सकते हैं।' },
    browse_only: { title: 'केवल ब्राउज़', body: 'आप सब कुछ देख सकते हैं; नीचे के चरणों के बाद नए निवेश खुलेंगे।' },
    manual_review: { title: 'समीक्षा में', body: 'अनुपालन टीम आपके खाते की समीक्षा कर रही है। तब तक नए निवेश रुके हैं।' },
    ineligible: { title: 'प्रतिबंधित', body: 'मौजूदा नीति के तहत इस खाते के लिए नए निवेश उपलब्ध नहीं हैं।' },
  },
  notAssessed: { title: 'अभी आकलन नहीं हुआ', body: 'कोई पात्रता निर्णय दर्ज नहीं है। अपनी स्थिति जानने के लिए जाँच चलाएँ।' },
  bands: {
    conservative: { title: 'रूढ़िवादी', body: 'पूँजी की सुरक्षा पहले; केवल छोटे, अल्पकालिक उतार-चढ़ाव।' },
    balanced: { title: 'संतुलित', body: 'स्थिर वृद्धि, मध्यम अस्थायी नुकसान स्वीकार।' },
    growth: { title: 'विकास', body: 'लंबी अवधि; बड़ी गिरावट से सहज।' },
    aggressive: { title: 'आक्रामक', body: 'अधिकतम वृद्धि; बड़े उतार-चढ़ाव स्वीकार्य।' },
  },
  screening: { none: 'कोई मामला नहीं', pending: 'लंबित', clear: 'साफ़', potential_match: 'संभावित मिलान', confirmed_match: 'मिलान', dismissed: 'ख़ारिज' },
  reasons: {
    region_blocked: { title: 'क्षेत्र समर्थित नहीं', body: 'दर्ज क्षेत्र इस उत्पाद के सेवा क्षेत्रों से बाहर है।', fix: 'पहुँच क्षेत्र देखें' },
    kyc_not_approved: { title: 'पहचान सत्यापित नहीं', body: 'नए निवेश के लिए स्वीकृत पहचान सत्यापन ज़रूरी है।', fix: 'पहचान सत्यापित करें' },
    sanctions_match: { title: 'स्क्रीनिंग मिलान', body: 'प्रतिबंध स्क्रीनिंग में मिलान मिला है, अनुपालन समीक्षा ज़रूरी है।', fix: 'सहायता से संपर्क करें' },
    sanctions_review: { title: 'स्क्रीनिंग समीक्षा में', body: 'स्क्रीनिंग ने संभावित मिलान चिह्नित किया है, समीक्षा जारी है।', fix: 'सहायता से संपर्क करें' },
    risk_flag_open: { title: 'खाता समीक्षा खुली', body: 'खाते पर खुली जोखिम समीक्षा के कारण नए निवेश रुके हैं।', fix: 'सहायता से संपर्क करें' },
  },
  scopes: { default: 'सभी उत्पाद', trading: 'स्पॉट ट्रेडिंग', basket: 'बास्केट', prediction: 'प्रेडिक्शन मार्केट', stocks: 'टोकनाइज़्ड स्टॉक', rwa: 'वास्तविक संपत्तियाँ', compute: 'कंप्यूट' },
  center: {
    kicker: 'सत्यापन', titleA: 'आपके', titleB: 'प्रमाण', lede: 'पहचान, पात्रता और जोखिम प्रोफ़ाइल — ये तीन रिकॉर्ड तय करते हैं कि आप किसमें निवेश कर सकते हैं।',
    card: 'निवेशक प्रमाणपत्र', holder: 'A-REIT खाता', access: 'पहुँच', identity: 'पहचान', risk: 'जोखिम प्रोफ़ाइल',
    progress: '3 में से {n} पूरे', assessed: '{t} को आकलित', policy: 'नीति {v}', next: 'अगला कदम', open: 'खोलें', allSet: 'तीनों रिकॉर्ड पूरे और वर्तमान हैं।',
    nextKyc: 'नए निवेश खोलने के लिए पहचान सत्यापित करें', nextRisk: 'जोखिम प्रोफ़ाइल पूरी करें — छह प्रश्न', nextRiskStale: 'आपकी जोखिम प्रोफ़ाइल समाप्त हो गई है — फिर से भरें', nextEligibility: 'पात्रता जाँच चलाएँ',
    steps: 'आपके रिकॉर्ड', stepsNote: 'हर रिकॉर्ड अलग रखा जाता है और कभी भी रीफ़्रेश किया जा सकता है।',
    stepItems: {
      kyc: { title: 'पहचान सत्यापन', body: 'हमारे सत्यापन पार्टनर द्वारा' },
      eligibility: { title: 'पात्रता', body: 'क्षेत्र, पहचान और स्क्रीनिंग जाँच' },
      risk: { title: 'जोखिम प्रोफ़ाइल', body: 'छह प्रश्नों का स्व-आकलन' },
    },
    meta: { decided: '{t} को निर्णय', submitted: '{t} को जमा', started: '{t} को शुरू', completed: '{t} को पूरा', validUntil: '{t} तक मान्य', checked: '{t} को जाँचा', notStarted: 'शुरू नहीं हुआ' },
    allows: 'आपकी स्थिति क्या अनुमति देती है', allowsNote: 'हर नए निवेश पर पात्रता फिर से जाँची जाती है।',
    allowItems: {
      browse: { title: 'मार्केट और रिसर्च देखें', body: 'कीमतें, खुलासे, जारीकर्ता और विश्लेषण' },
      invest: { title: 'नए निवेश', body: 'ऑर्डर, बास्केट सब्सक्रिप्शन, प्रेडिक्शन और ट्रेडिंग' },
      hold: { title: 'मौजूदा होल्डिंग', body: 'जो आपके पास है उसे देखना और रिडीम करना' },
    },
    allowStates: { yes: 'उपलब्ध', needs: 'पूरी पहुँच चाहिए', unaffected: 'इस जाँच से प्रभावित नहीं' },
    privacy: 'आपका डेटा कैसे संभाला जाता है', privacyNote: 'हम क्या रखते हैं, और कहाँ।',
    privacyItems: [
      'दस्तावेज़ और सेल्फ़ी सीधे पार्टनर के सुरक्षित पेज पर जाते हैं; वे इस ऐप पर अपलोड नहीं होते।',
      'हम केवल सत्यापन स्थिति और पार्टनर के मामले का एन्क्रिप्टेड संदर्भ रखते हैं — आपके दस्तावेज़ नहीं।',
      'हर पात्रता निर्णय अपने साक्ष्य दर्ज करता है: पहचान स्थिति, स्क्रीनिंग स्थिति और क्षेत्र।',
      'जोखिम प्रोफ़ाइल 12 महीने मान्य रहती है, और आप इसे कभी भी हटा सकते हैं।',
    ],
  },
  kycPage: {
    kicker: 'पहचान', titleA: 'एक बार', titleB: 'सत्यापित करें', lede: 'हमारे विनियमित सत्यापन पार्टनर के साथ एक बार की जाँच। इससे पूरे ऐप में नए निवेश खुलते हैं।',
    card: 'पहचान सत्यापन', stages: ['शुरू', 'जमा', 'निर्णय'],
    provider: 'पार्टनर', caseRef: 'मामला', expires: 'मान्य तक', reason: 'कारण', decided: 'निर्णय', reasonRaw: 'पार्टनर का कोड',
    actions: { not_started: 'सत्यापन शुरू करें', in_progress: 'सत्यापन जारी रखें', needs_information: 'जानकारी दें', rejected: 'नया सत्यापन शुरू करें', expired: 'सत्यापन नवीनीकृत करें' },
    opening: 'सुरक्षित सत्र खुल रहा है…', handoff: 'आप पार्टनर के सुरक्षित पेज पर आगे बढ़ेंगे, फिर यहाँ लौटेंगे।',
    unavailableTitle: 'सत्यापन पार्टनर जुड़ा नहीं है', unavailableBody: 'इस परिवेश में होस्टेड पहचान सत्यापन अभी उपलब्ध नहीं है। कुछ भी जमा नहीं हुआ।',
    insecure: 'सत्यापन लिंक सुरक्षित https पता नहीं था, इसलिए उसे नहीं खोला गया।', already: 'आपकी पहचान पहले से सत्यापित है — स्थिति रीफ़्रेश हुई।', failed: 'सत्यापन शुरू नहीं हो सका। कुछ भी जमा नहीं हुआ।',
    toEligibility: 'पात्रता देखें', needs: 'आपको क्या चाहिए', needsNote: 'शुरू करने से पहले इन्हें तैयार रखें।',
    needItems: [
      { title: 'सरकारी फ़ोटो पहचान पत्र', body: 'पासपोर्ट, राष्ट्रीय पहचान पत्र या ड्राइविंग लाइसेंस — मान्य और अवधि में' },
      { title: 'कैमरे वाला डिवाइस', body: 'दस्तावेज़ की तस्वीरों और छोटी सेल्फ़ी जाँच के लिए' },
      { title: 'आपका कानूनी नाम', body: 'दस्तावेज़ से बिल्कुल मेल खाना चाहिए' },
    ],
    how: 'यह कैसे काम करता है', howNote: 'तीन कदम, एक बार।',
    howItems: ['इस स्क्रीन से पार्टनर का सुरक्षित पेज खोलें और उनके चरण पूरे करें।', 'पार्टनर दस्तावेज़ों की समीक्षा करता है और हमें केवल परिणाम भेजता है।', 'निर्णय आते ही यह पेज और आपकी पात्रता अपडेट होती है।'],
    reasonCodes: { document_expired: 'दस्तावेज़ की अवधि समाप्त', document_unreadable: 'दस्तावेज़ पढ़ा नहीं जा सका', name_mismatch: 'नाम मेल नहीं खाता', selfie_mismatch: 'सेल्फ़ी दस्तावेज़ से मेल नहीं खाई', underage: 'आयु की शर्त पूरी नहीं' },
  },
  elig: {
    kicker: 'पात्रता', titleA: 'आपकी', titleB: 'पहुँच', lede: 'क्या आप नए निवेश कर सकते हैं, और ठीक-ठीक क्यों। यह नीति तय करती है, कोई व्यक्ति नहीं।',
    card: 'पहुँच निर्णय', level: 'पहुँच स्तर', identity: 'पहचान', screening: 'स्क्रीनिंग', region: 'क्षेत्र',
    policy: 'नीति {v}', decided: '{t} को निर्णय', run: 'पात्रता जाँच चलाएँ', running: 'जाँच हो रही है…', runFailed: 'जाँच नहीं चल सकी। आपका पिछला निर्णय अपरिवर्तित है।',
    why: 'इसे किसने तय किया', whyNote: 'हर कारण सीधे नीति परिणाम से आता है।', noReasons: 'कोई प्रतिबंध दर्ज नहीं — सभी जाँचें पास।',
    products: 'उत्पाद के अनुसार', productsNote: 'कुछ उत्पाद अलग से जाँचे जाते हैं।', notChecked: 'जाँचा नहीं', check: 'जाँचें', recheckAll: 'सब फिर जाँचें', checked: '{t} को जाँचा',
    how: 'पहुँच कैसे तय होती है', howNote: 'इसी क्रम में चार जाँचें।',
    howItems: ['क्षेत्र — दर्ज क्षेत्र उत्पाद के सेवा क्षेत्रों में होना चाहिए।', 'पहचान — आपका सत्यापन स्वीकृत होना चाहिए।', 'स्क्रीनिंग — प्रतिबंध स्क्रीनिंग में कोई खुला मिलान न हो।', 'खाता समीक्षा — कोई उच्च-गंभीरता समीक्षा खुली न हो।'],
    regionsLink: 'पहुँच क्षेत्र',
  },
  risk: {
    kicker: 'जोखिम प्रोफ़ाइल', titleA: 'आपकी', titleB: 'जोखिम क्षमता', lede: 'अनुभव, अवधि और नुकसान सहने की क्षमता पर छह प्रश्न। ईमानदार उत्तर प्रोफ़ाइल को उपयोगी रखते हैं।',
    card: 'जोखिम प्रोफ़ाइल', score: 'स्कोर', completed: 'पूरा हुआ', validUntil: 'मान्य तक', daysLeft: 'शेष', days: '{n} दिन', version: 'प्रश्नावली {v}',
    staleTitle: 'यह प्रोफ़ाइल समाप्त हो गई है', staleBody: 'प्रोफ़ाइल 12 महीने मान्य रहती है। इसे वर्तमान रखने के लिए फिर से भरें।',
    versionTitle: 'प्रश्नावली बदल गई है', versionBody: 'आपकी प्रोफ़ाइल संस्करण {v} पर बनी थी। मौजूदा प्रश्नों के उत्तर देने के लिए फिर से भरें।',
    retake: 'प्रश्नावली फिर भरें', start: 'प्रश्नावली शुरू करें', introTitle: 'अभी कोई जोखिम प्रोफ़ाइल नहीं', introBody: 'लगभग एक मिनट लगता है। जमा करने से पहले आप उत्तर बदल सकते हैं।',
    covers: 'इसमें क्या है', coversNote: 'हर विषय पर एक प्रश्न।',
    topics: { experience: 'निवेश अनुभव', horizon: 'समय अवधि', drawdown: 'नुकसान सहनशीलता', objective: 'उद्देश्य', stability: 'आय की स्थिरता', liquidity: 'तरलता ज़रूरतें' },
    selfAssessment: 'यह एक स्व-आकलन है। यह उत्पाद सुझाता नहीं और आपके लिए पोर्टफ़ोलियो नहीं बनाता।',
    answers: 'आपके उत्तर', answersNote: 'बदलने के लिए टैप करें — सहेजने से पहले आप समीक्षा करेंगे।', edit: 'बदलें',
    bandsTitle: 'जोखिम बैंड', bandsNote: 'आपका स्कोर आपको एक बैंड में रखता है।', yours: 'आपका',
    remove: 'प्रोफ़ाइल हटाएँ', removeTitle: 'जोखिम प्रोफ़ाइल हटाएँ?', removeBody: 'आपके उत्तर और बैंड हटा दिए जाएँगे। आप कभी भी फिर से प्रश्नावली भर सकते हैं।', confirmRemove: 'हटाएँ', keep: 'रखें', removing: 'हटाया जा रहा है…', removeFailed: 'प्रोफ़ाइल हटाई नहीं जा सकी। वह अपरिवर्तित है।',
    question: 'प्रश्न {n} / {total}', back: 'पीछे', next: 'आगे', review: 'उत्तरों की समीक्षा', reviewTitle: 'अपने उत्तर जाँचें', reviewNote: 'जमा करने तक कुछ भी सहेजा नहीं जाता।',
    submit: 'प्रोफ़ाइल जमा करें', submitting: 'जमा हो रहा है…', submitFailed: 'प्रोफ़ाइल सहेजी नहीं जा सकी। आपके उत्तर इस डिवाइस पर रखे गए हैं।',
    incomplete: 'जमा करने के लिए हर प्रश्न का उत्तर दें।', draft: 'ड्राफ़्ट इस डिवाइस पर रखा गया', exit: 'बाहर निकलें', serverText: 'सर्वर के शब्दों में दिखाया गया', unanswered: 'उत्तर नहीं दिया',
  },
  questions: {
    experience: { prompt: 'आपके पास निवेश का कितना अनुभव है?', options: ['कोई नहीं', '1 वर्ष से कम', '1–3 वर्ष', '3–7 वर्ष', '7 वर्ष से अधिक'] },
    horizon: { prompt: 'आप यह निवेश कितने समय तक रखना चाहते हैं?', options: ['6 महीने से कम', '6–12 महीने', '1–3 वर्ष', '3–7 वर्ष', '7 वर्ष से अधिक'] },
    drawdown: { prompt: 'बिना बेचे आप कितना अस्थायी नुकसान सह सकते हैं?', options: ['कोई नहीं', '5% तक', '10% तक', '25% तक', '25% से अधिक'] },
    objective: { prompt: 'आपका मुख्य उद्देश्य क्या है?', options: ['पूँजी सुरक्षित रखना', 'कम जोखिम वाली आय', 'संतुलित वृद्धि', 'उच्च वृद्धि', 'अधिकतम वृद्धि'] },
    stability: { prompt: 'आपकी आय कितनी स्थिर है?', options: ['बहुत अस्थिर', 'कुछ अस्थिर', 'सामान्य', 'स्थिर', 'बहुत स्थिर'] },
    liquidity: { prompt: 'आपको यह पैसा नकद में कितनी जल्दी वापस चाहिए हो सकता है?', options: ['कभी भी', 'एक वर्ष के भीतर', '1–3 वर्ष', '3+ वर्ष', 'मुझे इसकी ज़रूरत नहीं होगी'] },
  },
}

const es: VerifyCopy = {
  common: { retry: 'Reintentar', refresh: 'Actualizar estado', refreshing: 'Actualizando…', open: 'Abrir', notRecorded: 'Sin registrar', unknown: 'No disponible', failed: 'Algo salió mal. No se cambió nada.', none: '—' },
  kyc: {
    not_started: { title: 'Sin iniciar', body: 'Verifica tu identidad una vez para habilitar nuevas inversiones.' },
    in_progress: { title: 'En curso', body: 'Iniciaste la verificación pero aún no la terminaste.' },
    submitted: { title: 'En revisión', body: 'Tus documentos están con nuestro socio de verificación. Actualizaremos esta página cuando decidan.' },
    needs_information: { title: 'Se necesita más información', body: 'El socio necesita algo más de ti antes de decidir.' },
    approved: { title: 'Verificada', body: 'Tu identidad está verificada.' },
    rejected: { title: 'No aprobada', body: 'Este intento no fue aprobado. Puedes iniciar una nueva verificación.' },
    expired: { title: 'Caducada', body: 'Tu verificación caducó. Renuévala para seguir invirtiendo.' },
  },
  decisions: {
    eligible: { title: 'Acceso completo', body: 'Puedes realizar nuevas inversiones en este ámbito.' },
    browse_only: { title: 'Solo explorar', body: 'Puedes explorarlo todo; las nuevas inversiones se habilitan tras los pasos de abajo.' },
    manual_review: { title: 'En revisión', body: 'Nuestro equipo de cumplimiento revisa tu cuenta. Mientras tanto, las nuevas inversiones están en pausa.' },
    ineligible: { title: 'Restringido', body: 'Con la política actual, esta cuenta no puede realizar nuevas inversiones.' },
  },
  notAssessed: { title: 'Aún sin evaluar', body: 'No hay ninguna decisión de elegibilidad registrada. Ejecuta una comprobación para ver tu situación.' },
  bands: {
    conservative: { title: 'Conservador', body: 'Primero preservar el capital; solo oscilaciones pequeñas y breves.' },
    balanced: { title: 'Equilibrado', body: 'Crecimiento estable aceptando pérdidas temporales moderadas.' },
    growth: { title: 'Crecimiento', body: 'Horizonte largo; cómodo con caídas importantes.' },
    aggressive: { title: 'Agresivo', body: 'Máximo crecimiento; se aceptan grandes oscilaciones.' },
  },
  screening: { none: 'Sin caso', pending: 'Pendiente', clear: 'Sin coincidencias', potential_match: 'Posible coincidencia', confirmed_match: 'Coincidencia', dismissed: 'Descartado' },
  reasons: {
    region_blocked: { title: 'Región no admitida', body: 'La región registrada está fuera de las que atiende este producto.', fix: 'Ver regiones de acceso' },
    kyc_not_approved: { title: 'Identidad sin verificar', body: 'Las nuevas inversiones requieren una verificación de identidad aprobada.', fix: 'Verificar identidad' },
    sanctions_match: { title: 'Coincidencia en el control', body: 'El control de sanciones devolvió una coincidencia que requiere revisión.', fix: 'Contactar con soporte' },
    sanctions_review: { title: 'Control en revisión', body: 'El control de sanciones marcó una posible coincidencia que se está revisando.', fix: 'Contactar con soporte' },
    risk_flag_open: { title: 'Revisión de cuenta abierta', body: 'Una revisión de riesgo abierta en la cuenta pausa las nuevas inversiones.', fix: 'Contactar con soporte' },
  },
  scopes: { default: 'Todos los productos', trading: 'Trading al contado', basket: 'Cestas', prediction: 'Mercados de predicción', stocks: 'Acciones tokenizadas', rwa: 'Activos reales', compute: 'Cómputo' },
  center: {
    kicker: 'Verificación', titleA: 'Tus', titleB: 'credenciales', lede: 'Identidad, elegibilidad y perfil de riesgo: los tres registros que deciden en qué puedes invertir.',
    card: 'Credencial de inversor', holder: 'Cuenta A-REIT', access: 'Acceso', identity: 'Identidad', risk: 'Perfil de riesgo',
    progress: '{n} de 3 completos', assessed: 'Evaluado {t}', policy: 'Política {v}', next: 'Siguiente paso', open: 'Abrir', allSet: 'Los tres registros están completos y vigentes.',
    nextKyc: 'Verifica tu identidad para habilitar nuevas inversiones', nextRisk: 'Completa tu perfil de riesgo: seis preguntas', nextRiskStale: 'Tu perfil de riesgo caducó: vuelve a hacerlo', nextEligibility: 'Ejecuta una comprobación de elegibilidad',
    steps: 'Tus registros', stepsNote: 'Cada registro se guarda por separado y puede actualizarse en cualquier momento.',
    stepItems: {
      kyc: { title: 'Verificación de identidad', body: 'Gestionada por nuestro socio de verificación' },
      eligibility: { title: 'Elegibilidad', body: 'Controles de región, identidad y sanciones' },
      risk: { title: 'Perfil de riesgo', body: 'Autoevaluación de seis preguntas' },
    },
    meta: { decided: 'Decidido {t}', submitted: 'Enviado {t}', started: 'Iniciado {t}', completed: 'Completado {t}', validUntil: 'Válido hasta {t}', checked: 'Comprobado {t}', notStarted: 'Sin iniciar' },
    allows: 'Qué permite tu estado', allowsNote: 'La elegibilidad se vuelve a comprobar cada vez que haces una nueva inversión.',
    allowItems: {
      browse: { title: 'Explorar mercados y análisis', body: 'Precios, divulgaciones, emisores y analítica' },
      invest: { title: 'Nuevas inversiones', body: 'Órdenes, suscripciones a cestas, predicciones y trading' },
      hold: { title: 'Posiciones existentes', body: 'Ver y reembolsar lo que ya tienes' },
    },
    allowStates: { yes: 'Disponible', needs: 'Requiere acceso completo', unaffected: 'No depende de esta comprobación' },
    privacy: 'Cómo tratamos tus datos', privacyNote: 'Qué guardamos y dónde.',
    privacyItems: [
      'Los documentos y selfis van directamente a la página segura de nuestro socio; no se suben a esta app.',
      'Guardamos el estado de la verificación y una referencia cifrada al caso del socio, no tus documentos.',
      'Cada decisión de elegibilidad registra la evidencia usada: estado de identidad, estado del control y región.',
      'Un perfil de riesgo es válido 12 meses y puedes eliminarlo en cualquier momento.',
    ],
  },
  kycPage: {
    kicker: 'Identidad', titleA: 'Verifica', titleB: 'una vez', lede: 'Una comprobación única con nuestro socio de verificación regulado. Habilita nuevas inversiones en toda la app.',
    card: 'Verificación de identidad', stages: ['Iniciada', 'Enviada', 'Decisión'],
    provider: 'Socio', caseRef: 'Caso', expires: 'Válida hasta', reason: 'Motivo', decided: 'Decidida', reasonRaw: 'Código del socio',
    actions: { not_started: 'Iniciar verificación', in_progress: 'Continuar verificación', needs_information: 'Aportar información', rejected: 'Iniciar una nueva verificación', expired: 'Renovar verificación' },
    opening: 'Abriendo sesión segura…', handoff: 'Continuarás en la página segura del socio y luego volverás aquí.',
    unavailableTitle: 'Socio de verificación no conectado', unavailableBody: 'La verificación de identidad alojada aún no está disponible en este entorno. No se envió nada.',
    insecure: 'El enlace de verificación no era una dirección https segura, así que no se abrió.', already: 'Tu identidad ya está verificada; estado actualizado.', failed: 'No se pudo iniciar la verificación. No se envió nada.',
    toEligibility: 'Ver elegibilidad', needs: 'Qué necesitarás', needsNote: 'Tenlo a mano antes de empezar.',
    needItems: [
      { title: 'Documento oficial con foto', body: 'Pasaporte, documento nacional o permiso de conducir, vigente' },
      { title: 'Un dispositivo con cámara', body: 'Para fotografiar el documento y un breve selfi' },
      { title: 'Tu nombre legal', body: 'Debe coincidir exactamente con el documento' },
    ],
    how: 'Cómo funciona', howNote: 'Tres pasos, una sola vez.',
    howItems: ['Abre la página segura del socio desde esta pantalla y sigue sus pasos.', 'El socio revisa tus documentos y solo nos envía el resultado.', 'Esta página y tu elegibilidad se actualizan cuando llega la decisión.'],
    reasonCodes: { document_expired: 'El documento está caducado', document_unreadable: 'No se pudo leer el documento', name_mismatch: 'El nombre no coincide', selfie_mismatch: 'El selfi no coincide con el documento', underage: 'No cumple el requisito de edad' },
  },
  elig: {
    kicker: 'Elegibilidad', titleA: 'Tu', titleB: 'acceso', lede: 'Si puedes hacer nuevas inversiones y exactamente por qué. Lo decide la política, no una persona.',
    card: 'Decisión de acceso', level: 'Nivel de acceso', identity: 'Identidad', screening: 'Control', region: 'Región',
    policy: 'Política {v}', decided: 'Decidido {t}', run: 'Comprobar elegibilidad', running: 'Comprobando…', runFailed: 'No se pudo ejecutar la comprobación. Tu decisión anterior no cambia.',
    why: 'Qué lo decidió', whyNote: 'Cada motivo procede directamente del resultado de la política.', noReasons: 'Sin restricciones registradas: todas las comprobaciones pasaron.',
    products: 'Por producto', productsNote: 'Algunos productos se comprueban por separado.', notChecked: 'Sin comprobar', check: 'Comprobar', recheckAll: 'Comprobar todo', checked: 'Comprobado {t}',
    how: 'Cómo se decide el acceso', howNote: 'Cuatro comprobaciones, en este orden.',
    howItems: ['Región: la región registrada debe estar entre las que atiende el producto.', 'Identidad: tu verificación debe estar aprobada.', 'Control: el control de sanciones no debe tener coincidencias abiertas.', 'Revisión de cuenta: no puede haber revisiones de gravedad alta abiertas.'],
    regionsLink: 'Regiones de acceso',
  },
  risk: {
    kicker: 'Perfil de riesgo', titleA: 'Tu', titleB: 'apetito', lede: 'Seis preguntas sobre tu experiencia, horizonte y tolerancia a pérdidas. Responder con sinceridad mantiene útil tu perfil.',
    card: 'Perfil de riesgo', score: 'Puntuación', completed: 'Completado', validUntil: 'Válido hasta', daysLeft: 'Restante', days: '{n} días', version: 'Cuestionario {v}',
    staleTitle: 'Este perfil caducó', staleBody: 'Los perfiles son válidos 12 meses. Vuelve a hacer el cuestionario para mantenerlo al día.',
    versionTitle: 'El cuestionario cambió', versionBody: 'Tu perfil se basó en la versión {v}. Vuelve a hacerlo para responder las preguntas actuales.',
    retake: 'Repetir cuestionario', start: 'Empezar cuestionario', introTitle: 'Aún no tienes perfil de riesgo', introBody: 'Lleva un minuto. Puedes cambiar tus respuestas antes de enviar.',
    covers: 'Qué abarca', coversNote: 'Una pregunta por tema.',
    topics: { experience: 'Experiencia inversora', horizon: 'Horizonte temporal', drawdown: 'Tolerancia a pérdidas', objective: 'Objetivo', stability: 'Estabilidad de ingresos', liquidity: 'Necesidad de liquidez' },
    selfAssessment: 'Es una autoevaluación. No recomienda productos ni crea una cartera por ti.',
    answers: 'Tus respuestas', answersNote: 'Toca una para cambiarla; revisarás antes de guardar nada.', edit: 'Editar',
    bandsTitle: 'Niveles de riesgo', bandsNote: 'Tu puntuación te sitúa en un nivel.', yours: 'El tuyo',
    remove: 'Eliminar perfil', removeTitle: '¿Eliminar tu perfil de riesgo?', removeBody: 'Se borrarán tus respuestas y tu nivel. Puedes volver a hacer el cuestionario cuando quieras.', confirmRemove: 'Eliminar', keep: 'Conservarlo', removing: 'Eliminando…', removeFailed: 'No se pudo eliminar el perfil. No ha cambiado.',
    question: 'Pregunta {n} de {total}', back: 'Atrás', next: 'Siguiente', review: 'Revisar respuestas', reviewTitle: 'Revisa tus respuestas', reviewNote: 'No se guarda nada hasta que envíes.',
    submit: 'Enviar perfil', submitting: 'Enviando…', submitFailed: 'No se pudo guardar tu perfil. Tus respuestas se conservan en este dispositivo.',
    incomplete: 'Responde todas las preguntas para enviar.', draft: 'Borrador guardado en este dispositivo', exit: 'Salir', serverText: 'Mostrado con el texto del servidor', unanswered: 'Sin responder',
  },
  questions: {
    experience: { prompt: '¿Cuánta experiencia inversora tienes?', options: ['Ninguna', 'Menos de 1 año', '1–3 años', '3–7 años', 'Más de 7 años'] },
    horizon: { prompt: '¿Cuánto tiempo piensas mantener esta inversión?', options: ['Menos de 6 meses', '6–12 meses', '1–3 años', '3–7 años', 'Más de 7 años'] },
    drawdown: { prompt: '¿Qué pérdida temporal tolerarías sin vender?', options: ['Ninguna', 'Hasta un 5%', 'Hasta un 10%', 'Hasta un 25%', 'Más de un 25%'] },
    objective: { prompt: '¿Cuál es tu objetivo principal?', options: ['Preservar el capital', 'Ingresos con bajo riesgo', 'Crecimiento equilibrado', 'Crecimiento alto', 'Crecimiento máximo'] },
    stability: { prompt: '¿Qué tan estables son tus ingresos?', options: ['Muy inestables', 'Algo inestables', 'Neutros', 'Estables', 'Muy estables'] },
    liquidity: { prompt: '¿En cuánto tiempo podrías necesitar recuperar este dinero en efectivo?', options: ['En cualquier momento', 'En un año', '1–3 años', 'Más de 3 años', 'No lo necesitaré'] },
  },
}

const ar: VerifyCopy = {
  common: { retry: 'أعد المحاولة', refresh: 'تحديث الحالة', refreshing: 'جارٍ التحديث…', open: 'فتح', notRecorded: 'غير مسجّل', unknown: 'غير متاح', failed: 'حدث خطأ. لم يتغير شيء.', none: '—' },
  kyc: {
    not_started: { title: 'لم يبدأ', body: 'تحقّق من هويتك مرة واحدة لفتح الاستثمارات الجديدة.' },
    in_progress: { title: 'قيد التنفيذ', body: 'بدأت التحقق لكنك لم تُكمله بعد.' },
    submitted: { title: 'قيد المراجعة', body: 'مستنداتك لدى شريك التحقق. سنحدّث هذه الصفحة عند صدور القرار.' },
    needs_information: { title: 'مطلوب مزيد من المعلومات', body: 'يحتاج الشريك إلى شيء آخر منك قبل اتخاذ القرار.' },
    approved: { title: 'موثّقة', body: 'تم التحقق من هويتك.' },
    rejected: { title: 'لم تُقبل', body: 'لم تُقبل هذه المحاولة. يمكنك بدء تحقق جديد.' },
    expired: { title: 'منتهية', body: 'انتهت صلاحية التحقق. جدّده لمواصلة الاستثمار.' },
  },
  decisions: {
    eligible: { title: 'وصول كامل', body: 'يمكنك إجراء استثمارات جديدة ضمن هذا النطاق.' },
    browse_only: { title: 'تصفّح فقط', body: 'يمكنك استكشاف كل شيء؛ تُفتح الاستثمارات الجديدة بعد الخطوات أدناه.' },
    manual_review: { title: 'قيد المراجعة', body: 'يراجع فريق الامتثال حسابك، والاستثمارات الجديدة متوقفة مؤقتًا.' },
    ineligible: { title: 'مقيّد', body: 'وفق السياسة الحالية، الاستثمارات الجديدة غير متاحة لهذا الحساب.' },
  },
  notAssessed: { title: 'لم يُقيَّم بعد', body: 'لا يوجد قرار أهلية مسجّل. شغّل فحصًا لمعرفة وضعك.' },
  bands: {
    conservative: { title: 'متحفّظ', body: 'الحفاظ على رأس المال أولًا؛ تقلبات صغيرة وقصيرة فقط.' },
    balanced: { title: 'متوازن', body: 'نمو ثابت مع قبول خسائر مؤقتة معتدلة.' },
    growth: { title: 'نمو', body: 'أفق طويل؛ مرتاح مع تراجعات ملموسة.' },
    aggressive: { title: 'مُقدِم', body: 'أقصى نمو؛ التقلبات الكبيرة مقبولة.' },
  },
  screening: { none: 'لا توجد حالة', pending: 'قيد الانتظار', clear: 'سليم', potential_match: 'تطابق محتمل', confirmed_match: 'تطابق', dismissed: 'مستبعد' },
  reasons: {
    region_blocked: { title: 'المنطقة غير مدعومة', body: 'المنطقة المسجّلة خارج المناطق التي يخدمها هذا المنتج.', fix: 'عرض مناطق الوصول' },
    kyc_not_approved: { title: 'الهوية غير موثّقة', body: 'تتطلب الاستثمارات الجديدة تحققًا معتمدًا من الهوية.', fix: 'تحقّق من الهوية' },
    sanctions_match: { title: 'تطابق في الفحص', body: 'أظهر فحص العقوبات تطابقًا يحتاج إلى مراجعة الامتثال.', fix: 'تواصل مع الدعم' },
    sanctions_review: { title: 'الفحص قيد المراجعة', body: 'رصد فحص العقوبات تطابقًا محتملًا تجري مراجعته.', fix: 'تواصل مع الدعم' },
    risk_flag_open: { title: 'مراجعة حساب مفتوحة', body: 'مراجعة مخاطر مفتوحة على الحساب توقف الاستثمارات الجديدة.', fix: 'تواصل مع الدعم' },
  },
  scopes: { default: 'كل المنتجات', trading: 'التداول الفوري', basket: 'السلال', prediction: 'أسواق التوقع', stocks: 'أسهم مرمّزة', rwa: 'أصول حقيقية', compute: 'قدرة حوسبة' },
  center: {
    kicker: 'التحقق', titleA: 'اعتماداتك', titleB: 'الاستثمارية', lede: 'الهوية والأهلية وملف المخاطر — السجلات الثلاثة التي تحدد ما يمكنك الاستثمار فيه.',
    card: 'اعتماد المستثمر', holder: 'حساب A-REIT', access: 'الوصول', identity: 'الهوية', risk: 'ملف المخاطر',
    progress: 'اكتمل {n} من 3', assessed: 'قُيّم {t}', policy: 'السياسة {v}', next: 'الخطوة التالية', open: 'فتح', allSet: 'السجلات الثلاثة مكتملة وسارية.',
    nextKyc: 'تحقّق من هويتك لفتح الاستثمارات الجديدة', nextRisk: 'أكمل ملف المخاطر — ستة أسئلة', nextRiskStale: 'انتهت صلاحية ملف المخاطر — أعد تعبئته', nextEligibility: 'شغّل فحص الأهلية',
    steps: 'سجلاتك', stepsNote: 'يُحفظ كل سجل بشكل منفصل ويمكن تحديثه في أي وقت.',
    stepItems: {
      kyc: { title: 'التحقق من الهوية', body: 'يستضيفه شريك التحقق لدينا' },
      eligibility: { title: 'الأهلية', body: 'فحوص المنطقة والهوية والعقوبات' },
      risk: { title: 'ملف المخاطر', body: 'تقييم ذاتي من ستة أسئلة' },
    },
    meta: { decided: 'صدر القرار {t}', submitted: 'أُرسل {t}', started: 'بدأ {t}', completed: 'اكتمل {t}', validUntil: 'ساري حتى {t}', checked: 'فُحص {t}', notStarted: 'لم يبدأ' },
    allows: 'ما تسمح به حالتك', allowsNote: 'يُعاد فحص الأهلية في كل مرة تُجري فيها استثمارًا جديدًا.',
    allowItems: {
      browse: { title: 'تصفّح الأسواق والأبحاث', body: 'الأسعار والإفصاحات والجهات المُصدِرة والتحليلات' },
      invest: { title: 'استثمارات جديدة', body: 'الأوامر والاشتراك في السلال والتوقعات والتداول' },
      hold: { title: 'المراكز الحالية', body: 'عرض ما تملكه واسترداده' },
    },
    allowStates: { yes: 'متاح', needs: 'يتطلب وصولًا كاملًا', unaffected: 'لا يخضع لهذا الفحص' },
    privacy: 'كيف نتعامل مع بياناتك', privacyNote: 'ما نحتفظ به وأين.',
    privacyItems: [
      'تُرسل المستندات والصور الذاتية مباشرة إلى صفحة الشريك الآمنة؛ لا تُرفع إلى هذا التطبيق.',
      'نحتفظ بحالة التحقق ومرجع مشفّر لحالة الشريك فقط — لا بمستنداتك.',
      'يسجّل كل قرار أهلية الأدلة التي استند إليها: حالة الهوية وحالة الفحص والمنطقة.',
      'ملف المخاطر صالح 12 شهرًا، ويمكنك حذفه في أي وقت.',
    ],
  },
  kycPage: {
    kicker: 'الهوية', titleA: 'تحقّق', titleB: 'مرة واحدة', lede: 'فحص لمرة واحدة مع شريك تحقق مرخّص. يفتح الاستثمارات الجديدة في كل التطبيق.',
    card: 'التحقق من الهوية', stages: ['بدأ', 'أُرسل', 'القرار'],
    provider: 'الشريك', caseRef: 'الحالة', expires: 'ساري حتى', reason: 'السبب', decided: 'القرار', reasonRaw: 'رمز من الشريك',
    actions: { not_started: 'ابدأ التحقق', in_progress: 'تابع التحقق', needs_information: 'قدّم المعلومات', rejected: 'ابدأ تحققًا جديدًا', expired: 'جدّد التحقق' },
    opening: 'جارٍ فتح جلسة آمنة…', handoff: 'ستتابع على صفحة الشريك الآمنة ثم تعود إلى هنا.',
    unavailableTitle: 'شريك التحقق غير متصل', unavailableBody: 'التحقق المستضاف من الهوية غير متاح في هذه البيئة بعد. لم يُرسل أي شيء.',
    insecure: 'رابط التحقق ليس عنوان https آمنًا، لذلك لم يُفتح.', already: 'هويتك موثّقة بالفعل — تم تحديث الحالة.', failed: 'تعذّر بدء التحقق. لم يُرسل أي شيء.',
    toEligibility: 'عرض الأهلية', needs: 'ما ستحتاجه', needsNote: 'جهّزها قبل أن تبدأ.',
    needItems: [
      { title: 'هوية رسمية بصورة', body: 'جواز سفر أو بطاقة هوية وطنية أو رخصة قيادة سارية' },
      { title: 'جهاز مزوّد بكاميرا', body: 'لتصوير المستند وفحص قصير بصورة ذاتية' },
      { title: 'اسمك القانوني', body: 'يجب أن يطابق المستند تمامًا' },
    ],
    how: 'كيف يعمل', howNote: 'ثلاث خطوات، مرة واحدة.',
    howItems: ['افتح صفحة الشريك الآمنة من هذه الشاشة واتبع خطواته.', 'يراجع الشريك مستنداتك ويرسل إلينا النتيجة فقط.', 'تتحدّث هذه الصفحة وأهليتك عند وصول القرار.'],
    reasonCodes: { document_expired: 'المستند منتهي الصلاحية', document_unreadable: 'تعذّرت قراءة المستند', name_mismatch: 'الاسم غير مطابق', selfie_mismatch: 'الصورة الذاتية لا تطابق المستند', underage: 'شرط السن غير مستوفى' },
  },
  elig: {
    kicker: 'الأهلية', titleA: 'مستوى', titleB: 'وصولك', lede: 'هل يمكنك إجراء استثمارات جديدة، ولماذا بالتحديد. تقرره السياسة لا الأشخاص.',
    card: 'قرار الوصول', level: 'مستوى الوصول', identity: 'الهوية', screening: 'الفحص', region: 'المنطقة',
    policy: 'السياسة {v}', decided: 'صدر القرار {t}', run: 'شغّل فحص الأهلية', running: 'جارٍ الفحص…', runFailed: 'تعذّر تشغيل الفحص. قرارك السابق لم يتغير.',
    why: 'ما الذي حدّد ذلك', whyNote: 'كل سبب مأخوذ مباشرة من نتيجة السياسة.', noReasons: 'لا قيود مسجّلة — اجتزت كل الفحوص.',
    products: 'حسب المنتج', productsNote: 'تُفحص بعض المنتجات بشكل منفصل.', notChecked: 'لم يُفحص', check: 'افحص', recheckAll: 'أعد فحص الكل', checked: 'فُحص {t}',
    how: 'كيف يُقرَّر الوصول', howNote: 'أربعة فحوص بهذا الترتيب.',
    howItems: ['المنطقة — يجب أن تكون المنطقة المسجّلة ضمن ما يخدمه المنتج.', 'الهوية — يجب أن يكون تحققك معتمدًا.', 'الفحص — يجب ألا يظهر فحص العقوبات تطابقًا مفتوحًا.', 'مراجعة الحساب — يجب ألا توجد مراجعة عالية الخطورة مفتوحة.'],
    regionsLink: 'مناطق الوصول',
  },
  risk: {
    kicker: 'ملف المخاطر', titleA: 'شهيّتك', titleB: 'للمخاطر', lede: 'ستة أسئلة عن خبرتك وأفقك الزمني وتحمّلك للخسارة. الإجابات الصادقة تُبقي ملفك مفيدًا.',
    card: 'ملف المخاطر', score: 'الدرجة', completed: 'اكتمل', validUntil: 'ساري حتى', daysLeft: 'المتبقي', days: '{n} يومًا', version: 'الاستبيان {v}',
    staleTitle: 'انتهت صلاحية هذا الملف', staleBody: 'الملفات صالحة 12 شهرًا. أعد الاستبيان لإبقائه محدّثًا.',
    versionTitle: 'تغيّر الاستبيان', versionBody: 'بُني ملفك على الإصدار {v}. أعد الاستبيان للإجابة عن الأسئلة الحالية.',
    retake: 'أعد الاستبيان', start: 'ابدأ الاستبيان', introTitle: 'لا يوجد ملف مخاطر بعد', introBody: 'يستغرق دقيقة تقريبًا. يمكنك تغيير إجاباتك قبل الإرسال.',
    covers: 'ما يغطيه', coversNote: 'سؤال واحد لكل محور.',
    topics: { experience: 'الخبرة الاستثمارية', horizon: 'الأفق الزمني', drawdown: 'تحمّل الخسارة', objective: 'الهدف', stability: 'استقرار الدخل', liquidity: 'الحاجة للسيولة' },
    selfAssessment: 'هذا تقييم ذاتي. لا يوصي بمنتجات ولا يبني محفظة لك.',
    answers: 'إجاباتك', answersNote: 'اضغط على إجابة لتغييرها — ستراجع قبل حفظ أي شيء.', edit: 'تعديل',
    bandsTitle: 'فئات المخاطر', bandsNote: 'تضعك درجتك في فئة واحدة.', yours: 'فئتك',
    remove: 'احذف الملف', removeTitle: 'حذف ملف المخاطر؟', removeBody: 'ستُحذف إجاباتك وفئتك. يمكنك إعادة الاستبيان في أي وقت.', confirmRemove: 'احذف', keep: 'أبقِه', removing: 'جارٍ الحذف…', removeFailed: 'تعذّر حذف الملف. لم يتغير.',
    question: 'السؤال {n} من {total}', back: 'رجوع', next: 'التالي', review: 'راجع الإجابات', reviewTitle: 'تحقّق من إجاباتك', reviewNote: 'لا يُحفظ شيء حتى ترسل.',
    submit: 'أرسل الملف', submitting: 'جارٍ الإرسال…', submitFailed: 'تعذّر حفظ ملفك. إجاباتك محفوظة على هذا الجهاز.',
    incomplete: 'أجب عن كل الأسئلة للإرسال.', draft: 'المسودة محفوظة على هذا الجهاز', exit: 'خروج', serverText: 'معروض بصياغة الخادم', unanswered: 'بلا إجابة',
  },
  questions: {
    experience: { prompt: 'ما مقدار خبرتك في الاستثمار؟', options: ['لا شيء', 'أقل من سنة', '1–3 سنوات', '3–7 سنوات', 'أكثر من 7 سنوات'] },
    horizon: { prompt: 'كم تنوي الاحتفاظ بهذا الاستثمار؟', options: ['أقل من 6 أشهر', '6–12 شهرًا', '1–3 سنوات', '3–7 سنوات', 'أكثر من 7 سنوات'] },
    drawdown: { prompt: 'ما الخسارة المؤقتة التي تتحمّلها دون أن تبيع؟', options: ['لا شيء', 'حتى 5%', 'حتى 10%', 'حتى 25%', 'أكثر من 25%'] },
    objective: { prompt: 'ما هدفك الأساسي؟', options: ['الحفاظ على رأس المال', 'دخل بمخاطر منخفضة', 'نمو متوازن', 'نمو مرتفع', 'أقصى نمو'] },
    stability: { prompt: 'ما مدى استقرار دخلك؟', options: ['غير مستقر جدًا', 'غير مستقر نوعًا ما', 'محايد', 'مستقر', 'مستقر جدًا'] },
    liquidity: { prompt: 'متى قد تحتاج إلى استعادة هذا المال نقدًا؟', options: ['في أي وقت', 'خلال سنة', '1–3 سنوات', 'أكثر من 3 سنوات', 'لن أحتاجه'] },
  },
}

const fr: VerifyCopy = {
  common: { retry: 'Réessayer', refresh: 'Actualiser le statut', refreshing: 'Actualisation…', open: 'Ouvrir', notRecorded: 'Non renseigné', unknown: 'Indisponible', failed: 'Un problème est survenu. Rien n’a été modifié.', none: '—' },
  kyc: {
    not_started: { title: 'Non commencée', body: 'Vérifiez votre identité une fois pour débloquer les nouveaux investissements.' },
    in_progress: { title: 'En cours', body: 'Vous avez commencé la vérification sans la terminer.' },
    submitted: { title: 'En examen', body: 'Vos documents sont chez notre partenaire de vérification. Cette page sera mise à jour à sa décision.' },
    needs_information: { title: 'Informations requises', body: 'Le partenaire a besoin d’un complément avant de décider.' },
    approved: { title: 'Vérifiée', body: 'Votre identité est vérifiée.' },
    rejected: { title: 'Non approuvée', body: 'Cette tentative n’a pas été approuvée. Vous pouvez en lancer une nouvelle.' },
    expired: { title: 'Expirée', body: 'Votre vérification a expiré. Renouvelez-la pour continuer à investir.' },
  },
  decisions: {
    eligible: { title: 'Accès complet', body: 'Vous pouvez effectuer de nouveaux investissements dans ce périmètre.' },
    browse_only: { title: 'Consultation seule', body: 'Vous pouvez tout explorer ; les nouveaux investissements s’ouvrent après les étapes ci-dessous.' },
    manual_review: { title: 'En examen', body: 'Notre équipe conformité examine votre compte. Les nouveaux investissements sont suspendus d’ici là.' },
    ineligible: { title: 'Restreint', body: 'Selon la politique actuelle, ce compte ne peut pas effectuer de nouveaux investissements.' },
  },
  notAssessed: { title: 'Pas encore évalué', body: 'Aucune décision d’éligibilité n’est enregistrée. Lancez une vérification pour connaître votre situation.' },
  bands: {
    conservative: { title: 'Prudent', body: 'Préserver le capital avant tout ; seulement de petites variations brèves.' },
    balanced: { title: 'Équilibré', body: 'Croissance régulière, pertes temporaires modérées acceptées.' },
    growth: { title: 'Croissance', body: 'Horizon long ; à l’aise avec des baisses marquées.' },
    aggressive: { title: 'Dynamique', body: 'Croissance maximale ; fortes variations acceptées.' },
  },
  screening: { none: 'Aucun dossier', pending: 'En attente', clear: 'Aucune alerte', potential_match: 'Correspondance possible', confirmed_match: 'Correspondance', dismissed: 'Écarté' },
  reasons: {
    region_blocked: { title: 'Région non prise en charge', body: 'La région enregistrée ne fait pas partie de celles que sert ce produit.', fix: 'Voir les régions d’accès' },
    kyc_not_approved: { title: 'Identité non vérifiée', body: 'Les nouveaux investissements exigent une vérification d’identité approuvée.', fix: 'Vérifier l’identité' },
    sanctions_match: { title: 'Correspondance au filtrage', body: 'Le filtrage des sanctions a renvoyé une correspondance à examiner.', fix: 'Contacter le support' },
    sanctions_review: { title: 'Filtrage en examen', body: 'Le filtrage des sanctions a signalé une correspondance possible en cours d’examen.', fix: 'Contacter le support' },
    risk_flag_open: { title: 'Examen de compte ouvert', body: 'Un examen de risque ouvert sur le compte suspend les nouveaux investissements.', fix: 'Contacter le support' },
  },
  scopes: { default: 'Tous les produits', trading: 'Trading au comptant', basket: 'Paniers', prediction: 'Marchés prédictifs', stocks: 'Actions tokenisées', rwa: 'Actifs réels', compute: 'Calcul' },
  center: {
    kicker: 'Vérification', titleA: 'Vos', titleB: 'accréditations', lede: 'Identité, éligibilité et profil de risque : les trois dossiers qui déterminent ce dans quoi vous pouvez investir.',
    card: 'Accréditation investisseur', holder: 'Compte A-REIT', access: 'Accès', identity: 'Identité', risk: 'Profil de risque',
    progress: '{n} sur 3 complétés', assessed: 'Évalué le {t}', policy: 'Politique {v}', next: 'Prochaine étape', open: 'Ouvrir', allSet: 'Les trois dossiers sont complets et à jour.',
    nextKyc: 'Vérifiez votre identité pour débloquer les nouveaux investissements', nextRisk: 'Complétez votre profil de risque — six questions', nextRiskStale: 'Votre profil de risque a expiré — refaites-le', nextEligibility: 'Lancez une vérification d’éligibilité',
    steps: 'Vos dossiers', stepsNote: 'Chaque dossier est conservé séparément et peut être actualisé à tout moment.',
    stepItems: {
      kyc: { title: 'Vérification d’identité', body: 'Assurée par notre partenaire de vérification' },
      eligibility: { title: 'Éligibilité', body: 'Contrôles de région, d’identité et de filtrage' },
      risk: { title: 'Profil de risque', body: 'Auto-évaluation en six questions' },
    },
    meta: { decided: 'Décidé le {t}', submitted: 'Envoyé le {t}', started: 'Commencé le {t}', completed: 'Complété le {t}', validUntil: 'Valable jusqu’au {t}', checked: 'Vérifié le {t}', notStarted: 'Non commencé' },
    allows: 'Ce que votre statut permet', allowsNote: 'L’éligibilité est revérifiée à chaque nouvel investissement.',
    allowItems: {
      browse: { title: 'Explorer marchés et analyses', body: 'Prix, informations, émetteurs et analyses' },
      invest: { title: 'Nouveaux investissements', body: 'Ordres, souscriptions aux paniers, prédictions et trading' },
      hold: { title: 'Positions existantes', body: 'Consulter et racheter ce que vous détenez' },
    },
    allowStates: { yes: 'Disponible', needs: 'Accès complet requis', unaffected: 'Non soumis à ce contrôle' },
    privacy: 'Traitement de vos données', privacyNote: 'Ce que nous conservons, et où.',
    privacyItems: [
      'Documents et selfies vont directement sur la page sécurisée du partenaire ; ils ne sont pas envoyés à cette app.',
      'Nous conservons le statut de vérification et une référence chiffrée au dossier du partenaire — pas vos documents.',
      'Chaque décision d’éligibilité enregistre les éléments utilisés : statut d’identité, statut de filtrage et région.',
      'Un profil de risque est valable 12 mois, et vous pouvez le supprimer à tout moment.',
    ],
  },
  kycPage: {
    kicker: 'Identité', titleA: 'Vérifiez', titleB: 'une fois', lede: 'Un contrôle unique avec notre partenaire de vérification réglementé. Il débloque les nouveaux investissements dans toute l’app.',
    card: 'Vérification d’identité', stages: ['Commencée', 'Envoyée', 'Décision'],
    provider: 'Partenaire', caseRef: 'Dossier', expires: 'Valable jusqu’au', reason: 'Motif', decided: 'Décidée', reasonRaw: 'Code du partenaire',
    actions: { not_started: 'Commencer la vérification', in_progress: 'Reprendre la vérification', needs_information: 'Fournir les informations', rejected: 'Lancer une nouvelle vérification', expired: 'Renouveler la vérification' },
    opening: 'Ouverture de la session sécurisée…', handoff: 'Vous continuerez sur la page sécurisée du partenaire, puis reviendrez ici.',
    unavailableTitle: 'Partenaire de vérification non connecté', unavailableBody: 'La vérification d’identité hébergée n’est pas encore disponible dans cet environnement. Rien n’a été envoyé.',
    insecure: 'Le lien de vérification n’était pas une adresse https sécurisée ; il n’a pas été ouvert.', already: 'Votre identité est déjà vérifiée — statut actualisé.', failed: 'Impossible de lancer la vérification. Rien n’a été envoyé.',
    toEligibility: 'Voir l’éligibilité', needs: 'Ce qu’il vous faut', needsNote: 'Préparez-les avant de commencer.',
    needItems: [
      { title: 'Pièce d’identité officielle avec photo', body: 'Passeport, carte d’identité ou permis de conduire en cours de validité' },
      { title: 'Un appareil avec caméra', body: 'Pour photographier le document et un court selfie' },
      { title: 'Votre nom légal', body: 'Il doit correspondre exactement au document' },
    ],
    how: 'Comment ça marche', howNote: 'Trois étapes, une seule fois.',
    howItems: ['Ouvrez la page sécurisée du partenaire depuis cet écran et suivez ses étapes.', 'Le partenaire examine vos documents et ne nous transmet que le résultat.', 'Cette page et votre éligibilité se mettent à jour à l’arrivée de la décision.'],
    reasonCodes: { document_expired: 'Le document a expiré', document_unreadable: 'Le document est illisible', name_mismatch: 'Le nom ne correspond pas', selfie_mismatch: 'Le selfie ne correspond pas au document', underage: 'Condition d’âge non remplie' },
  },
  elig: {
    kicker: 'Éligibilité', titleA: 'Votre', titleB: 'accès', lede: 'Si vous pouvez effectuer de nouveaux investissements, et pourquoi exactement. Décidé par la politique, pas au cas par cas.',
    card: 'Décision d’accès', level: 'Niveau d’accès', identity: 'Identité', screening: 'Filtrage', region: 'Région',
    policy: 'Politique {v}', decided: 'Décidé le {t}', run: 'Vérifier l’éligibilité', running: 'Vérification…', runFailed: 'La vérification n’a pas pu s’exécuter. Votre décision précédente est inchangée.',
    why: 'Ce qui l’a décidé', whyNote: 'Chaque motif provient directement du résultat de la politique.', noReasons: 'Aucune restriction enregistrée — tous les contrôles sont passés.',
    products: 'Par produit', productsNote: 'Certains produits sont vérifiés séparément.', notChecked: 'Non vérifié', check: 'Vérifier', recheckAll: 'Tout revérifier', checked: 'Vérifié le {t}',
    how: 'Comment l’accès est décidé', howNote: 'Quatre contrôles, dans cet ordre.',
    howItems: ['Région — la région enregistrée doit faire partie de celles que sert le produit.', 'Identité — votre vérification doit être approuvée.', 'Filtrage — le filtrage des sanctions ne doit présenter aucune correspondance ouverte.', 'Examen de compte — aucun examen de gravité élevée ne doit être ouvert.'],
    regionsLink: 'Régions d’accès',
  },
  risk: {
    kicker: 'Profil de risque', titleA: 'Votre', titleB: 'appétence', lede: 'Six questions sur votre expérience, votre horizon et votre tolérance aux pertes. Des réponses sincères gardent votre profil utile.',
    card: 'Profil de risque', score: 'Score', completed: 'Complété', validUntil: 'Valable jusqu’au', daysLeft: 'Restant', days: '{n} jours', version: 'Questionnaire {v}',
    staleTitle: 'Ce profil a expiré', staleBody: 'Les profils sont valables 12 mois. Refaites le questionnaire pour le garder à jour.',
    versionTitle: 'Le questionnaire a changé', versionBody: 'Votre profil repose sur la version {v}. Refaites-le pour répondre aux questions actuelles.',
    retake: 'Refaire le questionnaire', start: 'Commencer le questionnaire', introTitle: 'Pas encore de profil de risque', introBody: 'Environ une minute. Vous pouvez modifier vos réponses avant d’envoyer.',
    covers: 'Ce qu’il couvre', coversNote: 'Une question par thème.',
    topics: { experience: 'Expérience d’investissement', horizon: 'Horizon', drawdown: 'Tolérance aux pertes', objective: 'Objectif', stability: 'Stabilité des revenus', liquidity: 'Besoin de liquidité' },
    selfAssessment: 'C’est une auto-évaluation. Elle ne recommande pas de produits et ne construit pas de portefeuille pour vous.',
    answers: 'Vos réponses', answersNote: 'Touchez-en une pour la modifier — vous relirez avant tout enregistrement.', edit: 'Modifier',
    bandsTitle: 'Niveaux de risque', bandsNote: 'Votre score vous place dans un niveau.', yours: 'Le vôtre',
    remove: 'Supprimer le profil', removeTitle: 'Supprimer votre profil de risque ?', removeBody: 'Vos réponses et votre niveau seront effacés. Vous pourrez refaire le questionnaire à tout moment.', confirmRemove: 'Supprimer', keep: 'Le garder', removing: 'Suppression…', removeFailed: 'Impossible de supprimer le profil. Il est inchangé.',
    question: 'Question {n} sur {total}', back: 'Retour', next: 'Suivant', review: 'Relire les réponses', reviewTitle: 'Vérifiez vos réponses', reviewNote: 'Rien n’est enregistré avant l’envoi.',
    submit: 'Envoyer le profil', submitting: 'Envoi…', submitFailed: 'Impossible d’enregistrer votre profil. Vos réponses sont conservées sur cet appareil.',
    incomplete: 'Répondez à toutes les questions pour envoyer.', draft: 'Brouillon conservé sur cet appareil', exit: 'Quitter', serverText: 'Affiché dans la formulation du serveur', unanswered: 'Sans réponse',
  },
  questions: {
    experience: { prompt: 'Quelle expérience de l’investissement avez-vous ?', options: ['Aucune', 'Moins d’un an', '1 à 3 ans', '3 à 7 ans', 'Plus de 7 ans'] },
    horizon: { prompt: 'Combien de temps comptez-vous conserver cet investissement ?', options: ['Moins de 6 mois', '6 à 12 mois', '1 à 3 ans', '3 à 7 ans', 'Plus de 7 ans'] },
    drawdown: { prompt: 'Quelle perte temporaire pourriez-vous tolérer sans vendre ?', options: ['Aucune', 'Jusqu’à 5 %', 'Jusqu’à 10 %', 'Jusqu’à 25 %', 'Plus de 25 %'] },
    objective: { prompt: 'Quel est votre objectif principal ?', options: ['Préserver le capital', 'Revenu à faible risque', 'Croissance équilibrée', 'Forte croissance', 'Croissance maximale'] },
    stability: { prompt: 'Vos revenus sont-ils stables ?', options: ['Très instables', 'Plutôt instables', 'Neutres', 'Stables', 'Très stables'] },
    liquidity: { prompt: 'Dans combien de temps pourriez-vous avoir besoin de récupérer cet argent ?', options: ['À tout moment', 'D’ici un an', '1 à 3 ans', 'Plus de 3 ans', 'Je n’en aurai pas besoin'] },
  },
}

const pt: VerifyCopy = {
  common: { retry: 'Tentar novamente', refresh: 'Atualizar estado', refreshing: 'Atualizando…', open: 'Abrir', notRecorded: 'Não registrado', unknown: 'Indisponível', failed: 'Algo deu errado. Nada foi alterado.', none: '—' },
  kyc: {
    not_started: { title: 'Não iniciada', body: 'Verifique sua identidade uma vez para liberar novos investimentos.' },
    in_progress: { title: 'Em andamento', body: 'Você iniciou a verificação, mas ainda não terminou.' },
    submitted: { title: 'Em análise', body: 'Seus documentos estão com nosso parceiro de verificação. Atualizaremos esta página quando decidirem.' },
    needs_information: { title: 'Mais informações necessárias', body: 'O parceiro precisa de algo mais antes de decidir.' },
    approved: { title: 'Verificada', body: 'Sua identidade está verificada.' },
    rejected: { title: 'Não aprovada', body: 'Esta tentativa não foi aprovada. Você pode iniciar uma nova verificação.' },
    expired: { title: 'Expirada', body: 'Sua verificação expirou. Renove-a para continuar investindo.' },
  },
  decisions: {
    eligible: { title: 'Acesso total', body: 'Você pode fazer novos investimentos neste escopo.' },
    browse_only: { title: 'Apenas navegar', body: 'Você pode explorar tudo; novos investimentos são liberados após as etapas abaixo.' },
    manual_review: { title: 'Em análise', body: 'Nossa equipe de compliance está analisando sua conta. Novos investimentos ficam pausados até lá.' },
    ineligible: { title: 'Restrito', body: 'Pela política atual, esta conta não pode fazer novos investimentos.' },
  },
  notAssessed: { title: 'Ainda não avaliado', body: 'Não há decisão de elegibilidade registrada. Execute uma verificação para ver sua situação.' },
  bands: {
    conservative: { title: 'Conservador', body: 'Preservar o capital primeiro; apenas oscilações pequenas e breves.' },
    balanced: { title: 'Moderado', body: 'Crescimento estável, aceitando perdas temporárias moderadas.' },
    growth: { title: 'Crescimento', body: 'Horizonte longo; confortável com quedas relevantes.' },
    aggressive: { title: 'Arrojado', body: 'Crescimento máximo; grandes oscilações são aceitáveis.' },
  },
  screening: { none: 'Sem caso', pending: 'Pendente', clear: 'Sem ocorrências', potential_match: 'Possível correspondência', confirmed_match: 'Correspondência', dismissed: 'Descartado' },
  reasons: {
    region_blocked: { title: 'Região não atendida', body: 'A região registrada está fora das regiões atendidas por este produto.', fix: 'Ver regiões de acesso' },
    kyc_not_approved: { title: 'Identidade não verificada', body: 'Novos investimentos exigem uma verificação de identidade aprovada.', fix: 'Verificar identidade' },
    sanctions_match: { title: 'Correspondência na triagem', body: 'A triagem de sanções retornou uma correspondência que precisa de análise.', fix: 'Falar com o suporte' },
    sanctions_review: { title: 'Triagem em análise', body: 'A triagem de sanções apontou uma possível correspondência em análise.', fix: 'Falar com o suporte' },
    risk_flag_open: { title: 'Análise de conta aberta', body: 'Uma análise de risco aberta na conta pausa novos investimentos.', fix: 'Falar com o suporte' },
  },
  scopes: { default: 'Todos os produtos', trading: 'Negociação à vista', basket: 'Cestas', prediction: 'Mercados de previsão', stocks: 'Ações tokenizadas', rwa: 'Ativos reais', compute: 'Computação' },
  center: {
    kicker: 'Verificação', titleA: 'Suas', titleB: 'credenciais', lede: 'Identidade, elegibilidade e perfil de risco — os três registros que decidem em que você pode investir.',
    card: 'Credencial de investidor', holder: 'Conta A-REIT', access: 'Acesso', identity: 'Identidade', risk: 'Perfil de risco',
    progress: '{n} de 3 concluídos', assessed: 'Avaliado em {t}', policy: 'Política {v}', next: 'Próximo passo', open: 'Abrir', allSet: 'Os três registros estão completos e vigentes.',
    nextKyc: 'Verifique sua identidade para liberar novos investimentos', nextRisk: 'Complete seu perfil de risco — seis perguntas', nextRiskStale: 'Seu perfil de risco expirou — refaça', nextEligibility: 'Execute uma verificação de elegibilidade',
    steps: 'Seus registros', stepsNote: 'Cada registro é mantido separadamente e pode ser atualizado a qualquer momento.',
    stepItems: {
      kyc: { title: 'Verificação de identidade', body: 'Feita pelo nosso parceiro de verificação' },
      eligibility: { title: 'Elegibilidade', body: 'Checagens de região, identidade e triagem' },
      risk: { title: 'Perfil de risco', body: 'Autoavaliação de seis perguntas' },
    },
    meta: { decided: 'Decidido em {t}', submitted: 'Enviado em {t}', started: 'Iniciado em {t}', completed: 'Concluído em {t}', validUntil: 'Válido até {t}', checked: 'Verificado em {t}', notStarted: 'Não iniciado' },
    allows: 'O que seu status permite', allowsNote: 'A elegibilidade é verificada de novo a cada novo investimento.',
    allowItems: {
      browse: { title: 'Explorar mercados e análises', body: 'Preços, divulgações, emissores e análises' },
      invest: { title: 'Novos investimentos', body: 'Ordens, assinaturas de cestas, previsões e negociação' },
      hold: { title: 'Posições existentes', body: 'Ver e resgatar o que você já tem' },
    },
    allowStates: { yes: 'Disponível', needs: 'Requer acesso total', unaffected: 'Não depende desta checagem' },
    privacy: 'Como tratamos seus dados', privacyNote: 'O que guardamos e onde.',
    privacyItems: [
      'Documentos e selfies vão direto para a página segura do parceiro; não são enviados a este app.',
      'Guardamos o estado da verificação e uma referência criptografada ao caso do parceiro — não seus documentos.',
      'Cada decisão de elegibilidade registra as evidências usadas: estado da identidade, estado da triagem e região.',
      'Um perfil de risco vale 12 meses, e você pode removê-lo a qualquer momento.',
    ],
  },
  kycPage: {
    kicker: 'Identidade', titleA: 'Verifique', titleB: 'uma vez', lede: 'Uma checagem única com nosso parceiro de verificação regulado. Libera novos investimentos em todo o app.',
    card: 'Verificação de identidade', stages: ['Iniciada', 'Enviada', 'Decisão'],
    provider: 'Parceiro', caseRef: 'Caso', expires: 'Válida até', reason: 'Motivo', decided: 'Decidida', reasonRaw: 'Código do parceiro',
    actions: { not_started: 'Iniciar verificação', in_progress: 'Continuar verificação', needs_information: 'Enviar informações', rejected: 'Iniciar nova verificação', expired: 'Renovar verificação' },
    opening: 'Abrindo sessão segura…', handoff: 'Você continuará na página segura do parceiro e depois voltará para cá.',
    unavailableTitle: 'Parceiro de verificação não conectado', unavailableBody: 'A verificação de identidade hospedada ainda não está disponível neste ambiente. Nada foi enviado.',
    insecure: 'O link de verificação não era um endereço https seguro, então não foi aberto.', already: 'Sua identidade já está verificada — estado atualizado.', failed: 'Não foi possível iniciar a verificação. Nada foi enviado.',
    toEligibility: 'Ver elegibilidade', needs: 'O que você vai precisar', needsNote: 'Tenha isto em mãos antes de começar.',
    needItems: [
      { title: 'Documento oficial com foto', body: 'Passaporte, RG ou carteira de motorista, dentro da validade' },
      { title: 'Um aparelho com câmera', body: 'Para fotografar o documento e uma rápida selfie' },
      { title: 'Seu nome legal', body: 'Deve corresponder exatamente ao documento' },
    ],
    how: 'Como funciona', howNote: 'Três passos, uma única vez.',
    howItems: ['Abra a página segura do parceiro nesta tela e siga os passos.', 'O parceiro analisa seus documentos e nos envia apenas o resultado.', 'Esta página e sua elegibilidade são atualizadas quando a decisão chega.'],
    reasonCodes: { document_expired: 'O documento está vencido', document_unreadable: 'Não foi possível ler o documento', name_mismatch: 'O nome não confere', selfie_mismatch: 'A selfie não confere com o documento', underage: 'Requisito de idade não atendido' },
  },
  elig: {
    kicker: 'Elegibilidade', titleA: 'Seu', titleB: 'acesso', lede: 'Se você pode fazer novos investimentos, e exatamente por quê. Decidido pela política, não caso a caso.',
    card: 'Decisão de acesso', level: 'Nível de acesso', identity: 'Identidade', screening: 'Triagem', region: 'Região',
    policy: 'Política {v}', decided: 'Decidido em {t}', run: 'Verificar elegibilidade', running: 'Verificando…', runFailed: 'Não foi possível executar a verificação. Sua decisão anterior não mudou.',
    why: 'O que decidiu isso', whyNote: 'Cada motivo vem diretamente do resultado da política.', noReasons: 'Nenhuma restrição registrada — todas as checagens passaram.',
    products: 'Por produto', productsNote: 'Alguns produtos são verificados separadamente.', notChecked: 'Não verificado', check: 'Verificar', recheckAll: 'Verificar tudo de novo', checked: 'Verificado em {t}',
    how: 'Como o acesso é decidido', howNote: 'Quatro checagens, nesta ordem.',
    howItems: ['Região — a região registrada deve estar entre as atendidas pelo produto.', 'Identidade — sua verificação deve estar aprovada.', 'Triagem — a triagem de sanções não pode ter correspondência aberta.', 'Análise de conta — não pode haver análise de alta gravidade aberta.'],
    regionsLink: 'Regiões de acesso',
  },
  risk: {
    kicker: 'Perfil de risco', titleA: 'Seu', titleB: 'apetite', lede: 'Seis perguntas sobre sua experiência, horizonte e tolerância a perdas. Respostas sinceras mantêm seu perfil útil.',
    card: 'Perfil de risco', score: 'Pontuação', completed: 'Concluído', validUntil: 'Válido até', daysLeft: 'Restante', days: '{n} dias', version: 'Questionário {v}',
    staleTitle: 'Este perfil expirou', staleBody: 'Os perfis valem 12 meses. Refaça o questionário para mantê-lo atualizado.',
    versionTitle: 'O questionário mudou', versionBody: 'Seu perfil foi feito na versão {v}. Refaça para responder às perguntas atuais.',
    retake: 'Refazer questionário', start: 'Começar questionário', introTitle: 'Ainda sem perfil de risco', introBody: 'Leva cerca de um minuto. Você pode mudar as respostas antes de enviar.',
    covers: 'O que ele cobre', coversNote: 'Uma pergunta por tema.',
    topics: { experience: 'Experiência com investimentos', horizon: 'Horizonte', drawdown: 'Tolerância a perdas', objective: 'Objetivo', stability: 'Estabilidade de renda', liquidity: 'Necessidade de liquidez' },
    selfAssessment: 'É uma autoavaliação. Não recomenda produtos nem monta uma carteira para você.',
    answers: 'Suas respostas', answersNote: 'Toque em uma para mudá-la — você revisará antes de salvar.', edit: 'Editar',
    bandsTitle: 'Faixas de risco', bandsNote: 'Sua pontuação coloca você em uma faixa.', yours: 'A sua',
    remove: 'Remover perfil', removeTitle: 'Remover seu perfil de risco?', removeBody: 'Suas respostas e sua faixa serão apagadas. Você pode refazer o questionário quando quiser.', confirmRemove: 'Remover', keep: 'Manter', removing: 'Removendo…', removeFailed: 'Não foi possível remover o perfil. Ele não mudou.',
    question: 'Pergunta {n} de {total}', back: 'Voltar', next: 'Próxima', review: 'Revisar respostas', reviewTitle: 'Confira suas respostas', reviewNote: 'Nada é salvo até você enviar.',
    submit: 'Enviar perfil', submitting: 'Enviando…', submitFailed: 'Não foi possível salvar seu perfil. Suas respostas ficaram neste aparelho.',
    incomplete: 'Responda todas as perguntas para enviar.', draft: 'Rascunho guardado neste aparelho', exit: 'Sair', serverText: 'Exibido no texto do servidor', unanswered: 'Sem resposta',
  },
  questions: {
    experience: { prompt: 'Quanta experiência com investimentos você tem?', options: ['Nenhuma', 'Menos de 1 ano', '1–3 anos', '3–7 anos', 'Mais de 7 anos'] },
    horizon: { prompt: 'Por quanto tempo pretende manter este investimento?', options: ['Menos de 6 meses', '6–12 meses', '1–3 anos', '3–7 anos', 'Mais de 7 anos'] },
    drawdown: { prompt: 'Que perda temporária você toleraria sem vender?', options: ['Nenhuma', 'Até 5%', 'Até 10%', 'Até 25%', 'Mais de 25%'] },
    objective: { prompt: 'Qual é seu objetivo principal?', options: ['Preservar o capital', 'Renda com baixo risco', 'Crescimento equilibrado', 'Crescimento alto', 'Crescimento máximo'] },
    stability: { prompt: 'Quão estável é sua renda?', options: ['Muito instável', 'Um pouco instável', 'Neutra', 'Estável', 'Muito estável'] },
    liquidity: { prompt: 'Em quanto tempo você pode precisar desse dinheiro de volta?', options: ['A qualquer momento', 'Em até um ano', '1–3 anos', 'Mais de 3 anos', 'Não vou precisar'] },
  },
}

export const verifyCopy: Record<AppLocale, VerifyCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
