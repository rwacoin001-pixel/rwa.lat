import type { AppLocale } from '@/lib/app-locales'

/**
 * Account copy (batch F1a): profile, support desk (list / new / ticket), settings and fees & limits.
 * `{x}` tokens go through fill(). Dates come from Intl; network columns reuse walletCopy.cash.
 */
type Row = { title: string; body: string }
type KycState = 'not_started' | 'in_progress' | 'submitted' | 'needs_information' | 'approved' | 'rejected' | 'expired'
type TicketStatus = 'open' | 'pending' | 'investigating' | 'waiting_user' | 'resolved' | 'closed'
type TicketCategory = 'support' | 'dispute' | 'appeal' | 'scam_report'

export type AccountCopy = {
  profile: {
    kicker: string; title: string; lede: string; plate: string; demo: string
    email: string; emailOk: string; emailNo: string; identity: string; security: string; securityNone: string; totp: string; passkeys: string
    sessionEnds: string; userId: string; unknown: string; copyId: string; idCopied: string; receiveCode: string
    kyc: Record<KycState, string>
    next: string; nextKyc: Partial<Record<KycState, string>>; nextSecurity: string; allSet: string; open: string
    groups: { identity: string; records: string; help: string; prefs: string }
    rows: Record<'verification' | 'security' | 'channels' | 'documents' | 'statements' | 'fees' | 'support' | 'scam' | 'trust' | 'settings' | 'communication' | 'referral', Row>
    signOut: string; signingOut: string; signOutFailed: string; closeAccount: string; signIn: string; guestBody: string
  }
  support: {
    kicker: string; title: string; lede: string; tickets: string; active: string; waiting: string; done: string; newTicket: string
    filters: { all: string; active: string; waiting: string; closed: string }
    ticket: string; status: string; empty: string; emptyBody: string; emptyFilter: string; updated: string
    routes: string; routesNote: string; routeItems: { scam: string; channels: string; fees: string; trust: string }; safety: string
    statuses: Record<TicketStatus, string>; categories: Record<TicketCategory, string>; categoryNotes: Record<TicketCategory, string>
  }
  compose: {
    kicker: string; title: string; lede: string; topic: string; details: string; subject: string; subjectPh: string; body: string; bodyPh: string
    order: string; orderPh: string; orderHint: string; optional: string; safety: string; submit: string; submitting: string
    errSubject: string; errBody: string; errOrder: string; errTopic: string; failed: string; session: string
    created: string; createdBody: string; reference: string; openTicket: string; allTickets: string
  }
  ticket: {
    title: string; notFound: string; notFoundBody: string; back: string; opened: string; updated: string
    stages: [string, string, string, string]; waitingYou: string; waitingBody: string
    thread: string; threadNote: string; you: string; team: string; system: string
    events: { created: string; status: string; assigned: string; updated: string }
    reply: string; replyPh: string; send: string; sending: string; replyFailed: string; errReply: string
    closedNote: string; newTicket: string; close: string; closeTitle: string; closeBody: string; confirmClose: string; keepOpen: string; closing: string; closeFailed: string
  }
  settings: {
    kicker: string; title: string; lede: string; language: string; languageNote: string; saved: string
    appearance: string; appearanceNote: string; themes: Record<'light' | 'dark' | 'system', Row>; showing: string
    notifications: string; notificationsNote: string; notificationsTitle: string; notificationsBody: string; communication: string
    currency: string; currencyNote: string; currencyValue: string; currencyBody: string; storage: string
  }
  fees: {
    kicker: string; title: string; lede: string; version: string; binding: string; schedule: string; live: string
    trading: string; tradingNote: string; classes: { default: string; stocks: string; prediction: string; tbill: string }; minFee: string; rate: string; predictionSplit: string
    management: string; managementNote: string; mClasses: { rwa: string; compute: string; stocks: string; prediction: string }; perYear: string; none: string
    network: string; networkNote: string; limits: string; limitsNote: string; minInvest: string; minInvestNote: string; dailyMax: string; minWithdraw: string; perNetwork: string
    controls: string; controlsNote: string; addressBook: string; addressCooldown: string; deviceCooldown: string; approvals: string; yes: string; no: string
    redemption: string; redemptionStd: string; redemptionBody: string; notesTitle: string; notes: [string, string, string, string]
  }
}

const en: AccountCopy = {
  profile: {
    kicker: 'Account', title: 'Your account', lede: 'Identity, security and preferences in one place.', plate: 'Signed in as', demo: 'Demo session',
    email: 'Email', emailOk: 'Verified', emailNo: 'Unverified', identity: 'Identity', security: 'Security', securityNone: 'Not set', totp: '2FA', passkeys: '{n} passkey',
    sessionEnds: 'Session ends {t}', userId: 'User ID', unknown: 'Unavailable', copyId: 'Copy user ID', idCopied: 'Copied', receiveCode: 'Receive code',
    kyc: { not_started: 'Not started', in_progress: 'In progress', submitted: 'In review', needs_information: 'Action needed', approved: 'Verified', rejected: 'Not approved', expired: 'Expired' },
    next: 'Next step',
    nextKyc: { not_started: 'Verify your identity to invest in listed products.', in_progress: 'Finish your identity verification.', submitted: 'Your verification is in review. We will update the status here.', needs_information: 'Verification needs more information from you.', rejected: 'Verification was not approved. See the reason and your options.', expired: 'Your verification has expired. Renew it to keep investing.' },
    nextSecurity: 'Add an authenticator or passkey to protect withdrawals.', allSet: 'Identity verified and sign-in protected.', open: 'Open',
    groups: { identity: 'Identity & security', records: 'Records & costs', help: 'Help & trust', prefs: 'Preferences' },
    rows: {
      verification: { title: 'Verification', body: 'Identity, eligibility, risk profile' },
      security: { title: 'Security', body: 'Authenticator, passkeys, sessions' },
      channels: { title: 'Official channels', body: 'Check links and contacts are really ours' },
      documents: { title: 'Documents', body: 'Orders and records' },
      statements: { title: 'Statements', body: 'Monthly ledger summary and CSV' },
      fees: { title: 'Fees & limits', body: 'Published schedule and live network policy' },
      support: { title: 'Support', body: 'Tickets and replies' },
      scam: { title: 'Report a scam', body: 'Impersonation or suspicious contact' },
      trust: { title: 'Trust center', body: 'Access, disclosures, legal' },
      settings: { title: 'Settings', body: 'Language, appearance, notifications' },
      communication: { title: 'Communication', body: 'Email and product updates' },
      referral: { title: 'Referral', body: 'Invitations and rewards' },
    },
    signOut: 'Sign out', signingOut: 'Signing out…', signOutFailed: 'The server did not confirm sign-out. This device has been signed out.', closeAccount: 'Close account', signIn: 'Sign in', guestBody: 'Sign in to see your identity status, security, tickets and preferences.',
  },
  support: {
    kicker: 'Help desk', title: 'Support', lede: 'Open a ticket and follow every reply and status change here.', tickets: 'Tickets', active: 'Active', waiting: 'Awaiting you', done: 'Resolved', newTicket: 'New ticket',
    filters: { all: 'All', active: 'Active', waiting: 'Awaiting you', closed: 'Closed' },
    ticket: 'Ticket', status: 'Status', empty: 'No tickets yet', emptyBody: 'When you open a ticket it will appear here with its status.', emptyFilter: 'No tickets in this view', updated: 'Updated {t}',
    routes: 'Other routes', routesNote: 'Faster for some issues', routeItems: { scam: 'Report a scam', channels: 'Official channels', fees: 'Fees & limits', trust: 'Trust center' },
    safety: 'We will never ask for your password, recovery codes or private keys — in a ticket or anywhere else.',
    statuses: { open: 'Received', pending: 'Pending', investigating: 'Investigating', waiting_user: 'Awaiting you', resolved: 'Resolved', closed: 'Closed' },
    categories: { support: 'Account & usage', dispute: 'Order dispute', appeal: 'Appeal & review', scam_report: 'Scam report' },
    categoryNotes: { support: 'Sign-in, settings, how things work', dispute: 'An order, deposit or withdrawal went wrong', appeal: 'Ask us to review a decision', scam_report: 'Someone impersonated us or asked for funds' },
  },
  compose: {
    kicker: 'New ticket', title: 'Tell us what happened', lede: 'Clear details get a faster answer. You can add more in the ticket later.', topic: 'Topic', details: 'Details',
    subject: 'Subject', subjectPh: 'e.g. Withdrawal still pending after 2 hours', body: 'Description', bodyPh: 'What happened, when, and what you expected instead.',
    order: 'Order ID', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: 'Shown on the order detail page.', optional: 'Optional',
    safety: 'Do not include passwords, recovery codes or private keys.', submit: 'Submit ticket', submitting: 'Submitting…',
    errSubject: 'Add a subject.', errBody: 'Describe the issue in at least {n} characters.', errOrder: 'Order ID must be a full UUID.', errTopic: 'Choose a topic.',
    failed: 'The ticket was not created.', session: 'Your session has ended. Sign in again to submit.',
    created: 'Ticket created', createdBody: 'We will reply in the ticket. Status changes show there too.', reference: 'Reference', openTicket: 'Open ticket', allTickets: 'All tickets',
  },
  ticket: {
    title: 'Ticket', notFound: 'Ticket not found', notFoundBody: 'It may belong to another account, or the link is incomplete.', back: 'Back to support', opened: 'Opened {t}', updated: 'Updated {t}',
    stages: ['Received', 'In review', 'Resolved', 'Closed'], waitingYou: 'Awaiting your reply', waitingBody: 'Support needs more information before continuing.',
    thread: 'Conversation', threadNote: 'Messages and status changes, oldest first', you: 'You', team: 'Support', system: 'System',
    events: { created: 'Ticket opened', status: 'Status · {from} → {to}', assigned: 'Assigned to a specialist', updated: 'Ticket updated' },
    reply: 'Reply', replyPh: 'Add details or answer a question…', send: 'Send', sending: 'Sending…', replyFailed: 'Your reply was not sent.', errReply: 'Write a reply first.',
    closedNote: 'This ticket is closed. Open a new one if you need more help.', newTicket: 'New ticket',
    close: 'Close ticket', closeTitle: 'Close this ticket?', closeBody: 'Closing ends the conversation. You cannot reply afterwards, but you can open a new ticket at any time.', confirmClose: 'Close ticket', keepOpen: 'Keep open', closing: 'Closing…', closeFailed: 'The ticket was not closed.',
  },
  settings: {
    kicker: 'Preferences', title: 'Settings', lede: 'Changes apply immediately.', language: 'Language', languageNote: 'Interface and number formats', saved: 'Saved on this device',
    appearance: 'Appearance', appearanceNote: 'Warm or cool palette', themes: { light: { title: 'Warm', body: 'Ivory and lacquer' }, dark: { title: 'Cool', body: 'Night navy and gold' }, system: { title: 'System', body: 'Follows your device' } }, showing: 'Now showing {name}',
    notifications: 'Notifications', notificationsNote: 'Channels and alerts', notificationsTitle: 'Notification channels are not connected yet', notificationsBody: 'Per-channel alerts will appear here once the account preference service is linked. Nothing is saved from this section.', communication: 'Communication preferences',
    currency: 'Display currency', currencyNote: 'Amounts across the app', currencyValue: 'USDT', currencyBody: 'Platform unit · other currencies are not available yet',
    storage: 'Language and appearance are stored in this browser only; they are not synced to your account.',
  },
  fees: {
    kicker: 'Costs', title: 'Fees & limits', lede: 'What you pay, when, and which limits apply.', version: 'Schedule {v} · updated {d}', binding: 'The binding amount is always the one on the confirmation screen before you submit.', schedule: 'Schedule', live: 'Live',
    trading: 'Trading fees', tradingNote: 'Charged per order, on the order amount', classes: { default: 'RWA & AI compute', stocks: 'Stock baskets', prediction: 'Prediction markets', tbill: 'Tokenized T-bills' }, minFee: 'Minimum {v} per order', rate: 'Rate', predictionSplit: 'place + payout',
    management: 'Management fees', managementNote: 'Per year, accrued from product yield — never charged to your balance', mClasses: { rwa: 'RWA', compute: 'AI compute', stocks: 'Stock baskets', prediction: 'Prediction markets' }, perYear: 'p.a.', none: 'None',
    network: 'Networks', networkNote: 'Server policy, per network', limits: 'Limits', limitsNote: 'Account and product limits', minInvest: 'Minimum investment', minInvestNote: 'Product terms prevail', dailyMax: 'Daily withdrawal maximum', minWithdraw: 'Minimum withdrawal', perNetwork: 'Per network, above',
    controls: 'Withdrawal controls', controlsNote: 'Enforced by the server', addressBook: 'Saved address required', addressCooldown: 'New address cooldown', deviceCooldown: 'New device cooldown', approvals: 'Approvals required', yes: 'Yes', no: 'No',
    redemption: 'Redemption', redemptionStd: 'Standard redemption', redemptionBody: 'Early exit follows each product’s terms. Locked periods cannot be redeemed; requests outside a window move to the next one.',
    notesTitle: 'How fees apply', notes: ['Fees are shown on the confirmation screen before anything is charged. There are no hidden fees.', 'Network fees are blockchain settlement costs and can change with congestion; the confirmation screen shows the current amount.', 'Management fees are accrued from product yield, not charged to your account separately.', 'Limits and windows follow each product’s terms; this page summarises the schedule.'],
  },
}

const zh: AccountCopy = {
  profile: {
    kicker: '账户', title: '我的账户', lede: '身份、安全与偏好集中管理。', plate: '当前登录', demo: '演示会话',
    email: '邮箱', emailOk: '已验证', emailNo: '未验证', identity: '身份', security: '安全', securityNone: '未设置', totp: '验证器', passkeys: '{n} 个通行密钥',
    sessionEnds: '会话于 {t} 结束', userId: '用户 ID', unknown: '暂不可用', copyId: '复制用户 ID', idCopied: '已复制', receiveCode: '收款码',
    kyc: { not_started: '未开始', in_progress: '进行中', submitted: '审核中', needs_information: '需补充', approved: '已认证', rejected: '未通过', expired: '已过期' },
    next: '下一步',
    nextKyc: { not_started: '完成身份认证后即可投资已上架产品。', in_progress: '继续完成身份认证。', submitted: '认证审核中，结果会在这里更新。', needs_information: '认证需要你补充材料。', rejected: '认证未通过，可查看原因和后续选项。', expired: '认证已过期，续期后才能继续投资。' },
    nextSecurity: '添加验证器或通行密钥，保护提现操作。', allSet: '身份已认证，登录已受保护。', open: '前往',
    groups: { identity: '身份与安全', records: '记录与费用', help: '帮助与信任', prefs: '偏好' },
    rows: {
      verification: { title: '认证', body: '身份、资格、风险测评' },
      security: { title: '安全', body: '验证器、通行密钥、会话' },
      channels: { title: '官方渠道', body: '核对链接和联系方式是否属于我们' },
      documents: { title: '文档', body: '订单与记录' },
      statements: { title: '对账单', body: '月度账本汇总与 CSV' },
      fees: { title: '费用与限额', body: '公布费率与实时网络政策' },
      support: { title: '客服', body: '工单与回复' },
      scam: { title: '举报诈骗', body: '冒充或可疑联系' },
      trust: { title: '信任中心', body: '准入、披露、法律' },
      settings: { title: '设置', body: '语言、外观、通知' },
      communication: { title: '沟通偏好', body: '邮件与产品动态' },
      referral: { title: '邀请', body: '邀请与奖励' },
    },
    signOut: '退出登录', signingOut: '正在退出…', signOutFailed: '服务器未确认退出，本设备已退出登录。', closeAccount: '注销账户', signIn: '登录', guestBody: '登录后查看身份状态、安全设置、工单和偏好。',
  },
  support: {
    kicker: '服务台', title: '客服', lede: '提交工单后，所有回复和状态变化都在这里跟进。', tickets: '工单', active: '处理中', waiting: '待你回复', done: '已解决', newTicket: '新建工单',
    filters: { all: '全部', active: '处理中', waiting: '待你回复', closed: '已关闭' },
    ticket: '工单', status: '状态', empty: '暂无工单', emptyBody: '提交工单后会显示在这里，并带有当前状态。', emptyFilter: '此视图下没有工单', updated: '更新于 {t}',
    routes: '其他途径', routesNote: '部分问题更快', routeItems: { scam: '举报诈骗', channels: '官方渠道', fees: '费用与限额', trust: '信任中心' },
    safety: '我们不会以任何方式索要你的密码、恢复码或私钥，工单中也不会。',
    statuses: { open: '已受理', pending: '待处理', investigating: '调查中', waiting_user: '待你回复', resolved: '已解决', closed: '已关闭' },
    categories: { support: '账户与使用', dispute: '订单争议', appeal: '申诉与复核', scam_report: '诈骗举报' },
    categoryNotes: { support: '登录、设置、功能说明', dispute: '订单、充值或提现出现问题', appeal: '请求复核某项决定', scam_report: '有人冒充我们或索要资金' },
  },
  compose: {
    kicker: '新建工单', title: '说说发生了什么', lede: '信息越清楚，回复越快。之后可以在工单里继续补充。', topic: '类型', details: '详情',
    subject: '主题', subjectPh: '例如：提现 2 小时仍在处理中', body: '描述', bodyPh: '发生了什么、什么时间，以及你期望的结果。',
    order: '订单号', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: '可在订单详情页找到。', optional: '选填',
    safety: '请勿填写密码、恢复码或私钥。', submit: '提交工单', submitting: '正在提交…',
    errSubject: '请填写主题。', errBody: '请至少用 {n} 个字描述问题。', errOrder: '订单号须为完整 UUID。', errTopic: '请选择类型。',
    failed: '工单未创建。', session: '会话已结束，请重新登录后提交。',
    created: '工单已创建', createdBody: '我们会在工单内回复，状态变化也会显示在那里。', reference: '编号', openTicket: '查看工单', allTickets: '全部工单',
  },
  ticket: {
    title: '工单', notFound: '未找到工单', notFoundBody: '它可能属于其他账户，或链接不完整。', back: '返回客服', opened: '创建于 {t}', updated: '更新于 {t}',
    stages: ['已受理', '处理中', '已解决', '已关闭'], waitingYou: '等待你的回复', waitingBody: '客服需要更多信息才能继续处理。',
    thread: '沟通记录', threadNote: '消息与状态变化，按时间顺序', you: '你', team: '客服', system: '系统',
    events: { created: '工单已创建', status: '状态 · {from} → {to}', assigned: '已分配专员', updated: '工单已更新' },
    reply: '回复', replyPh: '补充细节或回答问题…', send: '发送', sending: '正在发送…', replyFailed: '回复未发送。', errReply: '请先填写回复内容。',
    closedNote: '此工单已关闭。如需更多帮助，请新建工单。', newTicket: '新建工单',
    close: '关闭工单', closeTitle: '确定关闭此工单？', closeBody: '关闭后将结束沟通，不能再回复；你可以随时新建工单。', confirmClose: '确认关闭', keepOpen: '暂不关闭', closing: '正在关闭…', closeFailed: '工单未关闭。',
  },
  settings: {
    kicker: '偏好', title: '设置', lede: '修改即时生效。', language: '语言', languageNote: '界面与数字格式', saved: '已保存在本设备',
    appearance: '外观', appearanceNote: '暖色或冷色', themes: { light: { title: '暖色', body: '象牙白与漆黑' }, dark: { title: '冷色', body: '夜蓝与金' }, system: { title: '跟随系统', body: '随设备切换' } }, showing: '当前显示：{name}',
    notifications: '通知', notificationsNote: '渠道与提醒', notificationsTitle: '通知渠道尚未接通', notificationsBody: '账户偏好服务接通后，这里会显示各渠道的提醒开关。本区域不会保存任何设置。', communication: '沟通偏好',
    currency: '显示币种', currencyNote: '全站金额', currencyValue: 'USDT', currencyBody: '平台记账单位 · 暂不支持其他币种',
    storage: '语言和外观仅保存在当前浏览器，不会同步到账户。',
  },
  fees: {
    kicker: '费用', title: '费用与限额', lede: '收费项目、收取时机，以及适用的限额。', version: '费率表 {v} · 更新于 {d}', binding: '最终金额始终以提交前确认页显示的为准。', schedule: '费率表', live: '实时',
    trading: '交易费', tradingNote: '按订单金额，每笔收取', classes: { default: 'RWA 与 AI 算力', stocks: '股票组合', prediction: '预测市场', tbill: '代币化短期国债' }, minFee: '每笔最低 {v}', rate: '费率', predictionSplit: '下注 + 派彩',
    management: '管理费', managementNote: '年化，从产品收益中计提，不从余额扣除', mClasses: { rwa: 'RWA', compute: 'AI 算力', stocks: '股票组合', prediction: '预测市场' }, perYear: '年化', none: '无',
    network: '网络', networkNote: '服务端政策，按网络', limits: '限额', limitsNote: '账户与产品限额', minInvest: '最低投资额', minInvestNote: '以产品条款为准', dailyMax: '每日提现上限', minWithdraw: '最低提现额', perNetwork: '按网络，见上表',
    controls: '提现管控', controlsNote: '由服务端执行', addressBook: '须使用已保存地址', addressCooldown: '新地址冷却期', deviceCooldown: '新设备冷却期', approvals: '所需审批', yes: '是', no: '否',
    redemption: '赎回', redemptionStd: '标准赎回', redemptionBody: '提前退出按各产品条款执行；锁定期内不可赎回，窗口期外的申请顺延至下一窗口。',
    notesTitle: '费用如何适用', notes: ['费用在确认页展示后才会收取，没有隐藏费用。', '网络费是区块链结算成本，可能随拥堵调整，以确认页实时金额为准。', '管理费从产品收益中计提，不单独向账户收取。', '限额和窗口以各产品条款为准；本页为费率汇总。'],
  },
}

const hi: AccountCopy = {
  profile: {
    kicker: 'खाता', title: 'आपका खाता', lede: 'पहचान, सुरक्षा और प्राथमिकताएँ एक ही जगह।', plate: 'इस रूप में साइन इन', demo: 'डेमो सत्र',
    email: 'ईमेल', emailOk: 'सत्यापित', emailNo: 'असत्यापित', identity: 'पहचान', security: 'सुरक्षा', securityNone: 'सेट नहीं', totp: '2FA', passkeys: '{n} पासकी',
    sessionEnds: 'सत्र {t} को समाप्त', userId: 'यूज़र ID', unknown: 'उपलब्ध नहीं', copyId: 'यूज़र ID कॉपी करें', idCopied: 'कॉपी हुआ', receiveCode: 'रिसीव कोड',
    kyc: { not_started: 'शुरू नहीं', in_progress: 'प्रगति में', submitted: 'समीक्षा में', needs_information: 'कार्रवाई ज़रूरी', approved: 'सत्यापित', rejected: 'स्वीकृत नहीं', expired: 'समाप्त' },
    next: 'अगला कदम',
    nextKyc: { not_started: 'सूचीबद्ध उत्पादों में निवेश के लिए अपनी पहचान सत्यापित करें।', in_progress: 'अपना पहचान सत्यापन पूरा करें।', submitted: 'आपका सत्यापन समीक्षा में है। स्थिति यहीं अपडेट होगी।', needs_information: 'सत्यापन के लिए आपसे और जानकारी चाहिए।', rejected: 'सत्यापन स्वीकृत नहीं हुआ। कारण और विकल्प देखें।', expired: 'आपका सत्यापन समाप्त हो गया है। निवेश जारी रखने के लिए नवीनीकरण करें।' },
    nextSecurity: 'निकासी की सुरक्षा के लिए ऑथेंटिकेटर या पासकी जोड़ें।', allSet: 'पहचान सत्यापित और साइन-इन सुरक्षित।', open: 'खोलें',
    groups: { identity: 'पहचान और सुरक्षा', records: 'रिकॉर्ड और लागत', help: 'सहायता और भरोसा', prefs: 'प्राथमिकताएँ' },
    rows: {
      verification: { title: 'सत्यापन', body: 'पहचान, पात्रता, जोखिम प्रोफ़ाइल' },
      security: { title: 'सुरक्षा', body: 'ऑथेंटिकेटर, पासकी, सत्र' },
      channels: { title: 'आधिकारिक चैनल', body: 'जाँचें कि लिंक और संपर्क सचमुच हमारे हैं' },
      documents: { title: 'दस्तावेज़', body: 'ऑर्डर और रिकॉर्ड' },
      statements: { title: 'स्टेटमेंट', body: 'मासिक लेजर सारांश और CSV' },
      fees: { title: 'शुल्क और सीमाएँ', body: 'प्रकाशित अनुसूची और लाइव नेटवर्क नीति' },
      support: { title: 'सहायता', body: 'टिकट और जवाब' },
      scam: { title: 'धोखाधड़ी रिपोर्ट करें', body: 'नकल या संदिग्ध संपर्क' },
      trust: { title: 'ट्रस्ट सेंटर', body: 'पहुँच, प्रकटीकरण, कानूनी' },
      settings: { title: 'सेटिंग्स', body: 'भाषा, रूप, सूचनाएँ' },
      communication: { title: 'संचार', body: 'ईमेल और उत्पाद अपडेट' },
      referral: { title: 'रेफ़रल', body: 'आमंत्रण और पुरस्कार' },
    },
    signOut: 'साइन आउट', signingOut: 'साइन आउट हो रहा है…', signOutFailed: 'सर्वर ने साइन-आउट की पुष्टि नहीं की। यह डिवाइस साइन आउट हो गया है।', closeAccount: 'खाता बंद करें', signIn: 'साइन इन करें', guestBody: 'अपनी पहचान स्थिति, सुरक्षा, टिकट और प्राथमिकताएँ देखने के लिए साइन इन करें।',
  },
  support: {
    kicker: 'हेल्प डेस्क', title: 'सहायता', lede: 'टिकट खोलें और हर जवाब व स्थिति परिवर्तन यहीं देखें।', tickets: 'टिकट', active: 'सक्रिय', waiting: 'आपकी प्रतीक्षा', done: 'हल हुए', newTicket: 'नया टिकट',
    filters: { all: 'सभी', active: 'सक्रिय', waiting: 'आपकी प्रतीक्षा', closed: 'बंद' },
    ticket: 'टिकट', status: 'स्थिति', empty: 'अभी कोई टिकट नहीं', emptyBody: 'टिकट खोलने पर वह अपनी स्थिति के साथ यहाँ दिखेगा।', emptyFilter: 'इस दृश्य में कोई टिकट नहीं', updated: '{t} को अपडेट',
    routes: 'अन्य रास्ते', routesNote: 'कुछ मामलों में तेज़', routeItems: { scam: 'धोखाधड़ी रिपोर्ट करें', channels: 'आधिकारिक चैनल', fees: 'शुल्क और सीमाएँ', trust: 'ट्रस्ट सेंटर' },
    safety: 'हम कभी भी आपका पासवर्ड, रिकवरी कोड या प्राइवेट की नहीं माँगेंगे — न टिकट में, न कहीं और।',
    statuses: { open: 'प्राप्त', pending: 'लंबित', investigating: 'जाँच में', waiting_user: 'आपकी प्रतीक्षा', resolved: 'हल हुआ', closed: 'बंद' },
    categories: { support: 'खाता और उपयोग', dispute: 'ऑर्डर विवाद', appeal: 'अपील और समीक्षा', scam_report: 'धोखाधड़ी रिपोर्ट' },
    categoryNotes: { support: 'साइन-इन, सेटिंग्स, चीज़ें कैसे काम करती हैं', dispute: 'ऑर्डर, जमा या निकासी में समस्या', appeal: 'किसी निर्णय की समीक्षा का अनुरोध', scam_report: 'किसी ने हमारी नकल की या पैसे माँगे' },
  },
  compose: {
    kicker: 'नया टिकट', title: 'बताइए क्या हुआ', lede: 'स्पष्ट जानकारी से जवाब जल्दी मिलता है। बाद में टिकट में और जोड़ सकते हैं।', topic: 'विषय-वर्ग', details: 'विवरण',
    subject: 'विषय', subjectPh: 'जैसे: 2 घंटे बाद भी निकासी लंबित', body: 'विवरण', bodyPh: 'क्या हुआ, कब, और आप क्या अपेक्षा कर रहे थे।',
    order: 'ऑर्डर ID', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: 'ऑर्डर विवरण पेज पर दिखता है।', optional: 'वैकल्पिक',
    safety: 'पासवर्ड, रिकवरी कोड या प्राइवेट की शामिल न करें।', submit: 'टिकट जमा करें', submitting: 'जमा हो रहा है…',
    errSubject: 'विषय जोड़ें।', errBody: 'समस्या कम से कम {n} अक्षरों में बताएँ।', errOrder: 'ऑर्डर ID पूरा UUID होना चाहिए।', errTopic: 'विषय-वर्ग चुनें।',
    failed: 'टिकट नहीं बना।', session: 'आपका सत्र समाप्त हो गया। जमा करने के लिए फिर से साइन इन करें।',
    created: 'टिकट बन गया', createdBody: 'हम टिकट में जवाब देंगे। स्थिति परिवर्तन भी वहीं दिखेंगे।', reference: 'संदर्भ', openTicket: 'टिकट खोलें', allTickets: 'सभी टिकट',
  },
  ticket: {
    title: 'टिकट', notFound: 'टिकट नहीं मिला', notFoundBody: 'यह किसी अन्य खाते का हो सकता है, या लिंक अधूरा है।', back: 'सहायता पर वापस', opened: '{t} को खोला', updated: '{t} को अपडेट',
    stages: ['प्राप्त', 'समीक्षा में', 'हल हुआ', 'बंद'], waitingYou: 'आपके जवाब की प्रतीक्षा', waitingBody: 'आगे बढ़ने से पहले सहायता टीम को और जानकारी चाहिए।',
    thread: 'बातचीत', threadNote: 'संदेश और स्थिति परिवर्तन, पुराने पहले', you: 'आप', team: 'सहायता', system: 'सिस्टम',
    events: { created: 'टिकट खोला गया', status: 'स्थिति · {from} → {to}', assigned: 'विशेषज्ञ को सौंपा गया', updated: 'टिकट अपडेट हुआ' },
    reply: 'जवाब', replyPh: 'विवरण जोड़ें या प्रश्न का उत्तर दें…', send: 'भेजें', sending: 'भेजा जा रहा है…', replyFailed: 'आपका जवाब नहीं भेजा गया।', errReply: 'पहले जवाब लिखें।',
    closedNote: 'यह टिकट बंद है। और मदद चाहिए तो नया टिकट खोलें।', newTicket: 'नया टिकट',
    close: 'टिकट बंद करें', closeTitle: 'यह टिकट बंद करें?', closeBody: 'बंद करने पर बातचीत समाप्त हो जाती है। बाद में जवाब नहीं दे सकेंगे, पर कभी भी नया टिकट खोल सकते हैं।', confirmClose: 'टिकट बंद करें', keepOpen: 'खुला रखें', closing: 'बंद हो रहा है…', closeFailed: 'टिकट बंद नहीं हुआ।',
  },
  settings: {
    kicker: 'प्राथमिकताएँ', title: 'सेटिंग्स', lede: 'बदलाव तुरंत लागू होते हैं।', language: 'भाषा', languageNote: 'इंटरफ़ेस और संख्या प्रारूप', saved: 'इस डिवाइस पर सहेजा गया',
    appearance: 'रूप', appearanceNote: 'गर्म या ठंडा पैलेट', themes: { light: { title: 'गर्म', body: 'हाथीदाँत और लाख' }, dark: { title: 'ठंडा', body: 'रात्रि नीला और सोना' }, system: { title: 'सिस्टम', body: 'डिवाइस के अनुसार' } }, showing: 'अभी दिख रहा: {name}',
    notifications: 'सूचनाएँ', notificationsNote: 'चैनल और अलर्ट', notificationsTitle: 'सूचना चैनल अभी जुड़े नहीं हैं', notificationsBody: 'खाता प्राथमिकता सेवा जुड़ने पर हर चैनल के अलर्ट यहाँ दिखेंगे। इस भाग से कुछ भी सहेजा नहीं जाता।', communication: 'संचार प्राथमिकताएँ',
    currency: 'प्रदर्शन मुद्रा', currencyNote: 'ऐप में सभी राशियाँ', currencyValue: 'USDT', currencyBody: 'प्लेटफ़ॉर्म इकाई · अन्य मुद्राएँ अभी उपलब्ध नहीं',
    storage: 'भाषा और रूप केवल इस ब्राउज़र में सहेजे जाते हैं; खाते से सिंक नहीं होते।',
  },
  fees: {
    kicker: 'लागत', title: 'शुल्क और सीमाएँ', lede: 'आप क्या और कब चुकाते हैं, और कौन-सी सीमाएँ लागू हैं।', version: 'अनुसूची {v} · {d} को अपडेट', binding: 'बाध्यकारी राशि हमेशा वही है जो जमा करने से पहले पुष्टि स्क्रीन पर दिखती है।', schedule: 'अनुसूची', live: 'लाइव',
    trading: 'ट्रेडिंग शुल्क', tradingNote: 'हर ऑर्डर पर, ऑर्डर राशि पर', classes: { default: 'RWA और AI कंप्यूट', stocks: 'स्टॉक बास्केट', prediction: 'प्रेडिक्शन मार्केट', tbill: 'टोकनाइज़्ड T-बिल' }, minFee: 'प्रति ऑर्डर न्यूनतम {v}', rate: 'दर', predictionSplit: 'प्लेस + पेआउट',
    management: 'प्रबंधन शुल्क', managementNote: 'वार्षिक, उत्पाद प्रतिफल से — आपके बैलेंस से कभी नहीं', mClasses: { rwa: 'RWA', compute: 'AI कंप्यूट', stocks: 'स्टॉक बास्केट', prediction: 'प्रेडिक्शन मार्केट' }, perYear: 'वार्षिक', none: 'कोई नहीं',
    network: 'नेटवर्क', networkNote: 'सर्वर नीति, प्रति नेटवर्क', limits: 'सीमाएँ', limitsNote: 'खाता और उत्पाद सीमाएँ', minInvest: 'न्यूनतम निवेश', minInvestNote: 'उत्पाद शर्तें लागू', dailyMax: 'दैनिक अधिकतम निकासी', minWithdraw: 'न्यूनतम निकासी', perNetwork: 'प्रति नेटवर्क, ऊपर देखें',
    controls: 'निकासी नियंत्रण', controlsNote: 'सर्वर द्वारा लागू', addressBook: 'सहेजा पता आवश्यक', addressCooldown: 'नए पते का कूलडाउन', deviceCooldown: 'नए डिवाइस का कूलडाउन', approvals: 'आवश्यक अनुमोदन', yes: 'हाँ', no: 'नहीं',
    redemption: 'रिडेम्पशन', redemptionStd: 'मानक रिडेम्पशन', redemptionBody: 'जल्दी निकासी हर उत्पाद की शर्तों के अनुसार। लॉक अवधि में रिडीम नहीं हो सकता; विंडो के बाहर के अनुरोध अगली विंडो में जाते हैं।',
    notesTitle: 'शुल्क कैसे लागू होते हैं', notes: ['कुछ भी वसूलने से पहले शुल्क पुष्टि स्क्रीन पर दिखाए जाते हैं। कोई छिपा शुल्क नहीं।', 'नेटवर्क शुल्क ब्लॉकचेन निपटान लागत है और भीड़ के साथ बदल सकता है; पुष्टि स्क्रीन वर्तमान राशि दिखाती है।', 'प्रबंधन शुल्क उत्पाद प्रतिफल से लिया जाता है, खाते से अलग से नहीं।', 'सीमाएँ और विंडो हर उत्पाद की शर्तों के अनुसार; यह पेज अनुसूची का सारांश है।'],
  },
}

const es: AccountCopy = {
  profile: {
    kicker: 'Cuenta', title: 'Tu cuenta', lede: 'Identidad, seguridad y preferencias en un solo lugar.', plate: 'Sesión iniciada como', demo: 'Sesión demo',
    email: 'Correo', emailOk: 'Verificado', emailNo: 'Sin verificar', identity: 'Identidad', security: 'Seguridad', securityNone: 'Sin configurar', totp: '2FA', passkeys: '{n} llave de acceso',
    sessionEnds: 'La sesión termina el {t}', userId: 'ID de usuario', unknown: 'No disponible', copyId: 'Copiar ID de usuario', idCopied: 'Copiado', receiveCode: 'Código de cobro',
    kyc: { not_started: 'Sin iniciar', in_progress: 'En curso', submitted: 'En revisión', needs_information: 'Requiere acción', approved: 'Verificada', rejected: 'No aprobada', expired: 'Caducada' },
    next: 'Siguiente paso',
    nextKyc: { not_started: 'Verifica tu identidad para invertir en productos listados.', in_progress: 'Termina tu verificación de identidad.', submitted: 'Tu verificación está en revisión. El estado se actualizará aquí.', needs_information: 'La verificación necesita más información.', rejected: 'La verificación no fue aprobada. Consulta el motivo y tus opciones.', expired: 'Tu verificación caducó. Renuévala para seguir invirtiendo.' },
    nextSecurity: 'Añade un autenticador o una llave de acceso para proteger los retiros.', allSet: 'Identidad verificada e inicio de sesión protegido.', open: 'Abrir',
    groups: { identity: 'Identidad y seguridad', records: 'Registros y costes', help: 'Ayuda y confianza', prefs: 'Preferencias' },
    rows: {
      verification: { title: 'Verificación', body: 'Identidad, elegibilidad, perfil de riesgo' },
      security: { title: 'Seguridad', body: 'Autenticador, llaves de acceso, sesiones' },
      channels: { title: 'Canales oficiales', body: 'Comprueba que enlaces y contactos son nuestros' },
      documents: { title: 'Documentos', body: 'Órdenes y registros' },
      statements: { title: 'Extractos', body: 'Resumen mensual del libro mayor y CSV' },
      fees: { title: 'Comisiones y límites', body: 'Tarifa publicada y política de red en vivo' },
      support: { title: 'Soporte', body: 'Tickets y respuestas' },
      scam: { title: 'Denunciar fraude', body: 'Suplantación o contacto sospechoso' },
      trust: { title: 'Centro de confianza', body: 'Acceso, divulgaciones, legal' },
      settings: { title: 'Ajustes', body: 'Idioma, apariencia, notificaciones' },
      communication: { title: 'Comunicación', body: 'Correo y novedades del producto' },
      referral: { title: 'Referidos', body: 'Invitaciones y recompensas' },
    },
    signOut: 'Cerrar sesión', signingOut: 'Cerrando sesión…', signOutFailed: 'El servidor no confirmó el cierre. Este dispositivo ya cerró la sesión.', closeAccount: 'Cerrar cuenta', signIn: 'Iniciar sesión', guestBody: 'Inicia sesión para ver tu verificación, seguridad, tickets y preferencias.',
  },
  support: {
    kicker: 'Mesa de ayuda', title: 'Soporte', lede: 'Abre un ticket y sigue aquí cada respuesta y cambio de estado.', tickets: 'Tickets', active: 'Activos', waiting: 'Esperan tu respuesta', done: 'Resueltos', newTicket: 'Nuevo ticket',
    filters: { all: 'Todos', active: 'Activos', waiting: 'Esperan tu respuesta', closed: 'Cerrados' },
    ticket: 'Ticket', status: 'Estado', empty: 'Aún no hay tickets', emptyBody: 'Cuando abras un ticket aparecerá aquí con su estado.', emptyFilter: 'No hay tickets en esta vista', updated: 'Actualizado {t}',
    routes: 'Otras vías', routesNote: 'Más rápidas para algunos casos', routeItems: { scam: 'Denunciar fraude', channels: 'Canales oficiales', fees: 'Comisiones y límites', trust: 'Centro de confianza' },
    safety: 'Nunca te pediremos tu contraseña, códigos de recuperación ni claves privadas, ni en un ticket ni en ningún otro sitio.',
    statuses: { open: 'Recibido', pending: 'Pendiente', investigating: 'Investigando', waiting_user: 'Espera tu respuesta', resolved: 'Resuelto', closed: 'Cerrado' },
    categories: { support: 'Cuenta y uso', dispute: 'Disputa de orden', appeal: 'Apelación y revisión', scam_report: 'Denuncia de fraude' },
    categoryNotes: { support: 'Acceso, ajustes, cómo funciona', dispute: 'Falló una orden, depósito o retiro', appeal: 'Pide que revisemos una decisión', scam_report: 'Alguien nos suplantó o pidió fondos' },
  },
  compose: {
    kicker: 'Nuevo ticket', title: 'Cuéntanos qué pasó', lede: 'Los detalles claros obtienen respuesta antes. Puedes añadir más en el ticket después.', topic: 'Tema', details: 'Detalles',
    subject: 'Asunto', subjectPh: 'p. ej. Retiro pendiente tras 2 horas', body: 'Descripción', bodyPh: 'Qué pasó, cuándo y qué esperabas.',
    order: 'ID de orden', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: 'Aparece en el detalle de la orden.', optional: 'Opcional',
    safety: 'No incluyas contraseñas, códigos de recuperación ni claves privadas.', submit: 'Enviar ticket', submitting: 'Enviando…',
    errSubject: 'Añade un asunto.', errBody: 'Describe el problema en al menos {n} caracteres.', errOrder: 'El ID de orden debe ser un UUID completo.', errTopic: 'Elige un tema.',
    failed: 'No se creó el ticket.', session: 'Tu sesión terminó. Inicia sesión de nuevo para enviarlo.',
    created: 'Ticket creado', createdBody: 'Responderemos en el ticket. Los cambios de estado también aparecen allí.', reference: 'Referencia', openTicket: 'Abrir ticket', allTickets: 'Todos los tickets',
  },
  ticket: {
    title: 'Ticket', notFound: 'Ticket no encontrado', notFoundBody: 'Puede pertenecer a otra cuenta o el enlace está incompleto.', back: 'Volver a soporte', opened: 'Abierto {t}', updated: 'Actualizado {t}',
    stages: ['Recibido', 'En revisión', 'Resuelto', 'Cerrado'], waitingYou: 'Espera tu respuesta', waitingBody: 'Soporte necesita más información para continuar.',
    thread: 'Conversación', threadNote: 'Mensajes y cambios de estado, del más antiguo al más reciente', you: 'Tú', team: 'Soporte', system: 'Sistema',
    events: { created: 'Ticket abierto', status: 'Estado · {from} → {to}', assigned: 'Asignado a un especialista', updated: 'Ticket actualizado' },
    reply: 'Responder', replyPh: 'Añade detalles o responde una pregunta…', send: 'Enviar', sending: 'Enviando…', replyFailed: 'No se envió tu respuesta.', errReply: 'Escribe una respuesta primero.',
    closedNote: 'Este ticket está cerrado. Abre uno nuevo si necesitas más ayuda.', newTicket: 'Nuevo ticket',
    close: 'Cerrar ticket', closeTitle: '¿Cerrar este ticket?', closeBody: 'Al cerrarlo termina la conversación. No podrás responder después, pero puedes abrir un ticket nuevo cuando quieras.', confirmClose: 'Cerrar ticket', keepOpen: 'Mantener abierto', closing: 'Cerrando…', closeFailed: 'No se cerró el ticket.',
  },
  settings: {
    kicker: 'Preferencias', title: 'Ajustes', lede: 'Los cambios se aplican al instante.', language: 'Idioma', languageNote: 'Interfaz y formato de números', saved: 'Guardado en este dispositivo',
    appearance: 'Apariencia', appearanceNote: 'Paleta cálida o fría', themes: { light: { title: 'Cálida', body: 'Marfil y laca' }, dark: { title: 'Fría', body: 'Azul noche y oro' }, system: { title: 'Sistema', body: 'Sigue a tu dispositivo' } }, showing: 'Mostrando: {name}',
    notifications: 'Notificaciones', notificationsNote: 'Canales y alertas', notificationsTitle: 'Los canales de notificación aún no están conectados', notificationsBody: 'Las alertas por canal aparecerán aquí cuando se conecte el servicio de preferencias de la cuenta. Esta sección no guarda nada.', communication: 'Preferencias de comunicación',
    currency: 'Moneda de visualización', currencyNote: 'Importes en toda la app', currencyValue: 'USDT', currencyBody: 'Unidad de la plataforma · otras monedas aún no disponibles',
    storage: 'El idioma y la apariencia se guardan solo en este navegador; no se sincronizan con tu cuenta.',
  },
  fees: {
    kicker: 'Costes', title: 'Comisiones y límites', lede: 'Qué pagas, cuándo y qué límites se aplican.', version: 'Tarifa {v} · actualizada {d}', binding: 'El importe vinculante es siempre el de la pantalla de confirmación antes de enviar.', schedule: 'Tarifa', live: 'En vivo',
    trading: 'Comisiones de operación', tradingNote: 'Por orden, sobre el importe', classes: { default: 'RWA y cómputo IA', stocks: 'Cestas de acciones', prediction: 'Mercados de predicción', tbill: 'Letras del Tesoro tokenizadas' }, minFee: 'Mínimo {v} por orden', rate: 'Tasa', predictionSplit: 'entrada + liquidación',
    management: 'Comisiones de gestión', managementNote: 'Anual, devengada del rendimiento del producto; nunca se cobra de tu saldo', mClasses: { rwa: 'RWA', compute: 'Cómputo IA', stocks: 'Cestas de acciones', prediction: 'Mercados de predicción' }, perYear: 'anual', none: 'Ninguna',
    network: 'Redes', networkNote: 'Política del servidor, por red', limits: 'Límites', limitsNote: 'Límites de cuenta y producto', minInvest: 'Inversión mínima', minInvestNote: 'Prevalecen las condiciones del producto', dailyMax: 'Retiro diario máximo', minWithdraw: 'Retiro mínimo', perNetwork: 'Por red, arriba',
    controls: 'Controles de retiro', controlsNote: 'Aplicados por el servidor', addressBook: 'Dirección guardada obligatoria', addressCooldown: 'Espera de nueva dirección', deviceCooldown: 'Espera de nuevo dispositivo', approvals: 'Aprobaciones necesarias', yes: 'Sí', no: 'No',
    redemption: 'Reembolso', redemptionStd: 'Reembolso estándar', redemptionBody: 'La salida anticipada sigue las condiciones de cada producto. Los periodos bloqueados no se pueden reembolsar; las solicitudes fuera de ventana pasan a la siguiente.',
    notesTitle: 'Cómo se aplican', notes: ['Las comisiones se muestran en la confirmación antes de cobrar nada. No hay comisiones ocultas.', 'Las comisiones de red son costes de liquidación en blockchain y pueden variar con la congestión; la confirmación muestra el importe actual.', 'Las comisiones de gestión se devengan del rendimiento del producto, no se cobran aparte.', 'Límites y ventanas siguen las condiciones de cada producto; esta página resume la tarifa.'],
  },
}

const ar: AccountCopy = {
  profile: {
    kicker: 'الحساب', title: 'حسابك', lede: 'الهوية والأمان والتفضيلات في مكان واحد.', plate: 'مسجّل الدخول باسم', demo: 'جلسة تجريبية',
    email: 'البريد', emailOk: 'موثّق', emailNo: 'غير موثّق', identity: 'الهوية', security: 'الأمان', securityNone: 'غير مُعدّ', totp: '2FA', passkeys: '{n} مفتاح مرور',
    sessionEnds: 'تنتهي الجلسة {t}', userId: 'معرّف المستخدم', unknown: 'غير متاح', copyId: 'نسخ معرّف المستخدم', idCopied: 'تم النسخ', receiveCode: 'رمز الاستلام',
    kyc: { not_started: 'لم يبدأ', in_progress: 'قيد التنفيذ', submitted: 'قيد المراجعة', needs_information: 'مطلوب إجراء', approved: 'موثّقة', rejected: 'غير مقبولة', expired: 'منتهية' },
    next: 'الخطوة التالية',
    nextKyc: { not_started: 'وثّق هويتك للاستثمار في المنتجات المدرجة.', in_progress: 'أكمل توثيق هويتك.', submitted: 'توثيقك قيد المراجعة، وستُحدَّث الحالة هنا.', needs_information: 'يحتاج التوثيق إلى معلومات إضافية منك.', rejected: 'لم يُقبل التوثيق. اطّلع على السبب وخياراتك.', expired: 'انتهت صلاحية توثيقك. جدّده لمواصلة الاستثمار.' },
    nextSecurity: 'أضف تطبيق مصادقة أو مفتاح مرور لحماية السحب.', allSet: 'الهوية موثّقة وتسجيل الدخول محمي.', open: 'فتح',
    groups: { identity: 'الهوية والأمان', records: 'السجلات والتكاليف', help: 'المساعدة والثقة', prefs: 'التفضيلات' },
    rows: {
      verification: { title: 'التوثيق', body: 'الهوية، الأهلية، ملف المخاطر' },
      security: { title: 'الأمان', body: 'المصادقة، مفاتيح المرور، الجلسات' },
      channels: { title: 'القنوات الرسمية', body: 'تحقق من أن الروابط وجهات الاتصال تابعة لنا' },
      documents: { title: 'المستندات', body: 'الأوامر والسجلات' },
      statements: { title: 'الكشوف', body: 'ملخص شهري لدفتر الأستاذ وCSV' },
      fees: { title: 'الرسوم والحدود', body: 'الجدول المنشور وسياسة الشبكة المباشرة' },
      support: { title: 'الدعم', body: 'التذاكر والردود' },
      scam: { title: 'الإبلاغ عن احتيال', body: 'انتحال أو تواصل مريب' },
      trust: { title: 'مركز الثقة', body: 'الوصول، الإفصاحات، الشؤون القانونية' },
      settings: { title: 'الإعدادات', body: 'اللغة، المظهر، الإشعارات' },
      communication: { title: 'التواصل', body: 'البريد وتحديثات المنتج' },
      referral: { title: 'الإحالة', body: 'الدعوات والمكافآت' },
    },
    signOut: 'تسجيل الخروج', signingOut: 'جارٍ تسجيل الخروج…', signOutFailed: 'لم يؤكد الخادم تسجيل الخروج. تم تسجيل خروج هذا الجهاز.', closeAccount: 'إغلاق الحساب', signIn: 'تسجيل الدخول', guestBody: 'سجّل الدخول لعرض حالة التحقق والأمان والتذاكر والتفضيلات.',
  },
  support: {
    kicker: 'مكتب المساعدة', title: 'الدعم', lede: 'افتح تذكرة وتابع هنا كل رد وتغيير في الحالة.', tickets: 'التذاكر', active: 'نشطة', waiting: 'بانتظارك', done: 'محلولة', newTicket: 'تذكرة جديدة',
    filters: { all: 'الكل', active: 'نشطة', waiting: 'بانتظارك', closed: 'مغلقة' },
    ticket: 'التذكرة', status: 'الحالة', empty: 'لا توجد تذاكر بعد', emptyBody: 'عند فتح تذكرة ستظهر هنا مع حالتها.', emptyFilter: 'لا توجد تذاكر في هذا العرض', updated: 'حُدّثت {t}',
    routes: 'طرق أخرى', routesNote: 'أسرع لبعض المشكلات', routeItems: { scam: 'الإبلاغ عن احتيال', channels: 'القنوات الرسمية', fees: 'الرسوم والحدود', trust: 'مركز الثقة' },
    safety: 'لن نطلب أبدًا كلمة مرورك أو رموز الاسترداد أو المفاتيح الخاصة، لا في تذكرة ولا في أي مكان آخر.',
    statuses: { open: 'مستلمة', pending: 'معلّقة', investigating: 'قيد التحقيق', waiting_user: 'بانتظارك', resolved: 'محلولة', closed: 'مغلقة' },
    categories: { support: 'الحساب والاستخدام', dispute: 'نزاع أمر', appeal: 'تظلّم ومراجعة', scam_report: 'بلاغ احتيال' },
    categoryNotes: { support: 'تسجيل الدخول، الإعدادات، طريقة العمل', dispute: 'حدث خطأ في أمر أو إيداع أو سحب', appeal: 'اطلب مراجعة قرار', scam_report: 'انتحل أحدهم صفتنا أو طلب أموالًا' },
  },
  compose: {
    kicker: 'تذكرة جديدة', title: 'أخبرنا بما حدث', lede: 'التفاصيل الواضحة تحصل على رد أسرع. يمكنك الإضافة لاحقًا في التذكرة.', topic: 'الموضوع', details: 'التفاصيل',
    subject: 'العنوان', subjectPh: 'مثال: السحب معلّق منذ ساعتين', body: 'الوصف', bodyPh: 'ماذا حدث ومتى، وما الذي كنت تتوقعه.',
    order: 'معرّف الأمر', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: 'يظهر في صفحة تفاصيل الأمر.', optional: 'اختياري',
    safety: 'لا تُدرج كلمات المرور أو رموز الاسترداد أو المفاتيح الخاصة.', submit: 'إرسال التذكرة', submitting: 'جارٍ الإرسال…',
    errSubject: 'أضف عنوانًا.', errBody: 'صف المشكلة في {n} أحرف على الأقل.', errOrder: 'يجب أن يكون معرّف الأمر UUID كاملًا.', errTopic: 'اختر موضوعًا.',
    failed: 'لم تُنشأ التذكرة.', session: 'انتهت جلستك. سجّل الدخول مجددًا للإرسال.',
    created: 'أُنشئت التذكرة', createdBody: 'سنرد داخل التذكرة، وتظهر تغييرات الحالة هناك أيضًا.', reference: 'المرجع', openTicket: 'فتح التذكرة', allTickets: 'كل التذاكر',
  },
  ticket: {
    title: 'التذكرة', notFound: 'التذكرة غير موجودة', notFoundBody: 'قد تكون تابعة لحساب آخر، أو الرابط غير مكتمل.', back: 'العودة إلى الدعم', opened: 'فُتحت {t}', updated: 'حُدّثت {t}',
    stages: ['مستلمة', 'قيد المراجعة', 'محلولة', 'مغلقة'], waitingYou: 'بانتظار ردك', waitingBody: 'يحتاج الدعم إلى معلومات إضافية للمتابعة.',
    thread: 'المحادثة', threadNote: 'الرسائل وتغييرات الحالة، الأقدم أولًا', you: 'أنت', team: 'الدعم', system: 'النظام',
    events: { created: 'فُتحت التذكرة', status: 'الحالة · {from} ← {to}', assigned: 'أُسندت إلى مختص', updated: 'حُدّثت التذكرة' },
    reply: 'رد', replyPh: 'أضف تفاصيل أو أجب عن سؤال…', send: 'إرسال', sending: 'جارٍ الإرسال…', replyFailed: 'لم يُرسل ردك.', errReply: 'اكتب ردًا أولًا.',
    closedNote: 'هذه التذكرة مغلقة. افتح تذكرة جديدة إذا احتجت مساعدة إضافية.', newTicket: 'تذكرة جديدة',
    close: 'إغلاق التذكرة', closeTitle: 'إغلاق هذه التذكرة؟', closeBody: 'الإغلاق ينهي المحادثة. لن تتمكن من الرد بعده، لكن يمكنك فتح تذكرة جديدة في أي وقت.', confirmClose: 'إغلاق التذكرة', keepOpen: 'إبقاؤها مفتوحة', closing: 'جارٍ الإغلاق…', closeFailed: 'لم تُغلق التذكرة.',
  },
  settings: {
    kicker: 'التفضيلات', title: 'الإعدادات', lede: 'تُطبّق التغييرات فورًا.', language: 'اللغة', languageNote: 'الواجهة وتنسيق الأرقام', saved: 'محفوظ على هذا الجهاز',
    appearance: 'المظهر', appearanceNote: 'لوحة دافئة أو باردة', themes: { light: { title: 'دافئ', body: 'عاجي وورنيش' }, dark: { title: 'بارد', body: 'كحلي ليلي وذهبي' }, system: { title: 'النظام', body: 'يتبع جهازك' } }, showing: 'المعروض الآن: {name}',
    notifications: 'الإشعارات', notificationsNote: 'القنوات والتنبيهات', notificationsTitle: 'قنوات الإشعارات غير متصلة بعد', notificationsBody: 'ستظهر تنبيهات كل قناة هنا عند ربط خدمة تفضيلات الحساب. لا يُحفظ أي شيء من هذا القسم.', communication: 'تفضيلات التواصل',
    currency: 'عملة العرض', currencyNote: 'المبالغ في التطبيق', currencyValue: 'USDT', currencyBody: 'وحدة المنصة · العملات الأخرى غير متاحة بعد',
    storage: 'تُحفظ اللغة والمظهر في هذا المتصفح فقط ولا تُزامَن مع حسابك.',
  },
  fees: {
    kicker: 'التكاليف', title: 'الرسوم والحدود', lede: 'ما تدفعه ومتى، والحدود المطبّقة.', version: 'الجدول {v} · حُدّث {d}', binding: 'المبلغ المُلزم هو دائمًا المعروض في شاشة التأكيد قبل الإرسال.', schedule: 'الجدول', live: 'مباشر',
    trading: 'رسوم التداول', tradingNote: 'لكل أمر، على مبلغ الأمر', classes: { default: 'RWA وحوسبة الذكاء الاصطناعي', stocks: 'سلال الأسهم', prediction: 'أسواق التنبؤ', tbill: 'أذون خزانة مرمّزة' }, minFee: 'حد أدنى {v} لكل أمر', rate: 'النسبة', predictionSplit: 'الرهان + الدفع',
    management: 'رسوم الإدارة', managementNote: 'سنويًا، تُستحق من عائد المنتج ولا تُخصم من رصيدك', mClasses: { rwa: 'RWA', compute: 'حوسبة الذكاء الاصطناعي', stocks: 'سلال الأسهم', prediction: 'أسواق التنبؤ' }, perYear: 'سنويًا', none: 'لا شيء',
    network: 'الشبكات', networkNote: 'سياسة الخادم لكل شبكة', limits: 'الحدود', limitsNote: 'حدود الحساب والمنتج', minInvest: 'الحد الأدنى للاستثمار', minInvestNote: 'شروط المنتج هي المرجع', dailyMax: 'الحد اليومي للسحب', minWithdraw: 'الحد الأدنى للسحب', perNetwork: 'لكل شبكة، أعلاه',
    controls: 'ضوابط السحب', controlsNote: 'يطبّقها الخادم', addressBook: 'يلزم عنوان محفوظ', addressCooldown: 'مهلة العنوان الجديد', deviceCooldown: 'مهلة الجهاز الجديد', approvals: 'الموافقات المطلوبة', yes: 'نعم', no: 'لا',
    redemption: 'الاسترداد', redemptionStd: 'الاسترداد القياسي', redemptionBody: 'يتبع الخروج المبكر شروط كل منتج. لا يمكن الاسترداد خلال فترات القفل، وتنتقل الطلبات خارج النافذة إلى النافذة التالية.',
    notesTitle: 'كيف تُطبّق الرسوم', notes: ['تُعرض الرسوم في شاشة التأكيد قبل تحصيل أي شيء. لا توجد رسوم خفية.', 'رسوم الشبكة تكلفة تسوية على البلوك تشين وقد تتغير مع الازدحام؛ تعرض شاشة التأكيد المبلغ الحالي.', 'تُستحق رسوم الإدارة من عائد المنتج ولا تُحصّل من حسابك بشكل منفصل.', 'تتبع الحدود والنوافذ شروط كل منتج؛ هذه الصفحة ملخص للجدول.'],
  },
}

const fr: AccountCopy = {
  profile: {
    kicker: 'Compte', title: 'Votre compte', lede: 'Identité, sécurité et préférences au même endroit.', plate: 'Connecté en tant que', demo: 'Session démo',
    email: 'E-mail', emailOk: 'Vérifié', emailNo: 'Non vérifié', identity: 'Identité', security: 'Sécurité', securityNone: 'Non configurée', totp: '2FA', passkeys: '{n} clé d’accès',
    sessionEnds: 'La session se termine le {t}', userId: 'ID utilisateur', unknown: 'Indisponible', copyId: 'Copier l’ID utilisateur', idCopied: 'Copié', receiveCode: 'Code de réception',
    kyc: { not_started: 'Non commencée', in_progress: 'En cours', submitted: 'En examen', needs_information: 'Action requise', approved: 'Vérifiée', rejected: 'Non approuvée', expired: 'Expirée' },
    next: 'Étape suivante',
    nextKyc: { not_started: 'Vérifiez votre identité pour investir dans les produits listés.', in_progress: 'Terminez votre vérification d’identité.', submitted: 'Votre vérification est en examen. Le statut sera mis à jour ici.', needs_information: 'La vérification nécessite des informations supplémentaires.', rejected: 'La vérification n’a pas été approuvée. Consultez le motif et vos options.', expired: 'Votre vérification a expiré. Renouvelez-la pour continuer à investir.' },
    nextSecurity: 'Ajoutez une application d’authentification ou une clé d’accès pour protéger les retraits.', allSet: 'Identité vérifiée et connexion protégée.', open: 'Ouvrir',
    groups: { identity: 'Identité et sécurité', records: 'Relevés et coûts', help: 'Aide et confiance', prefs: 'Préférences' },
    rows: {
      verification: { title: 'Vérification', body: 'Identité, éligibilité, profil de risque' },
      security: { title: 'Sécurité', body: 'Authentificateur, clés d’accès, sessions' },
      channels: { title: 'Canaux officiels', body: 'Vérifiez que liens et contacts sont bien les nôtres' },
      documents: { title: 'Documents', body: 'Ordres et relevés' },
      statements: { title: 'Relevés', body: 'Synthèse mensuelle du grand livre et CSV' },
      fees: { title: 'Frais et limites', body: 'Barème publié et politique réseau en direct' },
      support: { title: 'Assistance', body: 'Tickets et réponses' },
      scam: { title: 'Signaler une arnaque', body: 'Usurpation ou contact suspect' },
      trust: { title: 'Centre de confiance', body: 'Accès, informations, mentions légales' },
      settings: { title: 'Réglages', body: 'Langue, apparence, notifications' },
      communication: { title: 'Communication', body: 'E-mails et nouveautés produit' },
      referral: { title: 'Parrainage', body: 'Invitations et récompenses' },
    },
    signOut: 'Se déconnecter', signingOut: 'Déconnexion…', signOutFailed: 'Le serveur n’a pas confirmé la déconnexion. Cet appareil est déconnecté.', closeAccount: 'Clôturer le compte', signIn: 'Se connecter', guestBody: 'Connectez-vous pour voir votre vérification, votre sécurité, vos tickets et vos préférences.',
  },
  support: {
    kicker: 'Service d’aide', title: 'Assistance', lede: 'Ouvrez un ticket et suivez ici chaque réponse et changement de statut.', tickets: 'Tickets', active: 'Actifs', waiting: 'En attente de vous', done: 'Résolus', newTicket: 'Nouveau ticket',
    filters: { all: 'Tous', active: 'Actifs', waiting: 'En attente de vous', closed: 'Fermés' },
    ticket: 'Ticket', status: 'Statut', empty: 'Aucun ticket', emptyBody: 'Vos tickets apparaîtront ici avec leur statut.', emptyFilter: 'Aucun ticket dans cette vue', updated: 'Mis à jour {t}',
    routes: 'Autres voies', routesNote: 'Plus rapides pour certains cas', routeItems: { scam: 'Signaler une arnaque', channels: 'Canaux officiels', fees: 'Frais et limites', trust: 'Centre de confiance' },
    safety: 'Nous ne vous demanderons jamais votre mot de passe, vos codes de récupération ou vos clés privées, ni dans un ticket ni ailleurs.',
    statuses: { open: 'Reçu', pending: 'En attente', investigating: 'En analyse', waiting_user: 'En attente de vous', resolved: 'Résolu', closed: 'Fermé' },
    categories: { support: 'Compte et utilisation', dispute: 'Litige sur un ordre', appeal: 'Recours et réexamen', scam_report: 'Signalement d’arnaque' },
    categoryNotes: { support: 'Connexion, réglages, fonctionnement', dispute: 'Un ordre, dépôt ou retrait a échoué', appeal: 'Demandez le réexamen d’une décision', scam_report: 'Quelqu’un s’est fait passer pour nous ou a demandé des fonds' },
  },
  compose: {
    kicker: 'Nouveau ticket', title: 'Dites-nous ce qui s’est passé', lede: 'Des détails clairs obtiennent une réponse plus rapide. Vous pourrez compléter dans le ticket.', topic: 'Sujet', details: 'Détails',
    subject: 'Objet', subjectPh: 'ex. Retrait en attente depuis 2 heures', body: 'Description', bodyPh: 'Ce qui s’est passé, quand, et ce que vous attendiez.',
    order: 'ID d’ordre', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: 'Visible sur la page de détail de l’ordre.', optional: 'Facultatif',
    safety: 'N’indiquez ni mot de passe, ni code de récupération, ni clé privée.', submit: 'Envoyer le ticket', submitting: 'Envoi…',
    errSubject: 'Ajoutez un objet.', errBody: 'Décrivez le problème en au moins {n} caractères.', errOrder: 'L’ID d’ordre doit être un UUID complet.', errTopic: 'Choisissez un sujet.',
    failed: 'Le ticket n’a pas été créé.', session: 'Votre session a expiré. Reconnectez-vous pour envoyer.',
    created: 'Ticket créé', createdBody: 'Nous répondrons dans le ticket. Les changements de statut y apparaissent aussi.', reference: 'Référence', openTicket: 'Ouvrir le ticket', allTickets: 'Tous les tickets',
  },
  ticket: {
    title: 'Ticket', notFound: 'Ticket introuvable', notFoundBody: 'Il appartient peut-être à un autre compte, ou le lien est incomplet.', back: 'Retour à l’assistance', opened: 'Ouvert {t}', updated: 'Mis à jour {t}',
    stages: ['Reçu', 'En examen', 'Résolu', 'Fermé'], waitingYou: 'En attente de votre réponse', waitingBody: 'L’assistance a besoin d’informations pour continuer.',
    thread: 'Conversation', threadNote: 'Messages et changements de statut, du plus ancien au plus récent', you: 'Vous', team: 'Assistance', system: 'Système',
    events: { created: 'Ticket ouvert', status: 'Statut · {from} → {to}', assigned: 'Attribué à un spécialiste', updated: 'Ticket mis à jour' },
    reply: 'Répondre', replyPh: 'Ajoutez des détails ou répondez à une question…', send: 'Envoyer', sending: 'Envoi…', replyFailed: 'Votre réponse n’a pas été envoyée.', errReply: 'Rédigez d’abord une réponse.',
    closedNote: 'Ce ticket est fermé. Ouvrez-en un nouveau si vous avez besoin d’aide.', newTicket: 'Nouveau ticket',
    close: 'Fermer le ticket', closeTitle: 'Fermer ce ticket ?', closeBody: 'La fermeture met fin à la conversation. Vous ne pourrez plus répondre, mais vous pouvez ouvrir un nouveau ticket à tout moment.', confirmClose: 'Fermer le ticket', keepOpen: 'Laisser ouvert', closing: 'Fermeture…', closeFailed: 'Le ticket n’a pas été fermé.',
  },
  settings: {
    kicker: 'Préférences', title: 'Réglages', lede: 'Les changements s’appliquent immédiatement.', language: 'Langue', languageNote: 'Interface et format des nombres', saved: 'Enregistré sur cet appareil',
    appearance: 'Apparence', appearanceNote: 'Palette chaude ou froide', themes: { light: { title: 'Chaude', body: 'Ivoire et laque' }, dark: { title: 'Froide', body: 'Bleu nuit et or' }, system: { title: 'Système', body: 'Suit votre appareil' } }, showing: 'Affichage : {name}',
    notifications: 'Notifications', notificationsNote: 'Canaux et alertes', notificationsTitle: 'Les canaux de notification ne sont pas encore connectés', notificationsBody: 'Les alertes par canal apparaîtront ici une fois le service de préférences du compte relié. Rien n’est enregistré depuis cette section.', communication: 'Préférences de communication',
    currency: 'Devise d’affichage', currencyNote: 'Montants dans l’app', currencyValue: 'USDT', currencyBody: 'Unité de la plateforme · autres devises pas encore disponibles',
    storage: 'La langue et l’apparence sont enregistrées dans ce navigateur uniquement ; elles ne sont pas synchronisées avec votre compte.',
  },
  fees: {
    kicker: 'Coûts', title: 'Frais et limites', lede: 'Ce que vous payez, quand, et quelles limites s’appliquent.', version: 'Barème {v} · mis à jour le {d}', binding: 'Le montant qui fait foi est toujours celui de l’écran de confirmation avant l’envoi.', schedule: 'Barème', live: 'Direct',
    trading: 'Frais de transaction', tradingNote: 'Par ordre, sur le montant', classes: { default: 'RWA et calcul IA', stocks: 'Paniers d’actions', prediction: 'Marchés prédictifs', tbill: 'Bons du Trésor tokenisés' }, minFee: 'Minimum {v} par ordre', rate: 'Taux', predictionSplit: 'mise + paiement',
    management: 'Frais de gestion', managementNote: 'Annuels, prélevés sur le rendement du produit — jamais sur votre solde', mClasses: { rwa: 'RWA', compute: 'Calcul IA', stocks: 'Paniers d’actions', prediction: 'Marchés prédictifs' }, perYear: 'par an', none: 'Aucun',
    network: 'Réseaux', networkNote: 'Politique du serveur, par réseau', limits: 'Limites', limitsNote: 'Limites du compte et des produits', minInvest: 'Investissement minimum', minInvestNote: 'Les conditions du produit prévalent', dailyMax: 'Retrait quotidien maximum', minWithdraw: 'Retrait minimum', perNetwork: 'Par réseau, ci-dessus',
    controls: 'Contrôles de retrait', controlsNote: 'Appliqués par le serveur', addressBook: 'Adresse enregistrée requise', addressCooldown: 'Délai nouvelle adresse', deviceCooldown: 'Délai nouvel appareil', approvals: 'Approbations requises', yes: 'Oui', no: 'Non',
    redemption: 'Rachat', redemptionStd: 'Rachat standard', redemptionBody: 'La sortie anticipée suit les conditions de chaque produit. Les périodes bloquées ne sont pas rachetables ; les demandes hors fenêtre passent à la suivante.',
    notesTitle: 'Application des frais', notes: ['Les frais sont affichés à la confirmation avant tout prélèvement. Aucun frais caché.', 'Les frais de réseau sont des coûts de règlement blockchain et varient avec la congestion ; la confirmation affiche le montant actuel.', 'Les frais de gestion sont prélevés sur le rendement du produit, pas facturés séparément.', 'Limites et fenêtres suivent les conditions de chaque produit ; cette page résume le barème.'],
  },
}

const pt: AccountCopy = {
  profile: {
    kicker: 'Conta', title: 'Sua conta', lede: 'Identidade, segurança e preferências em um só lugar.', plate: 'Conectado como', demo: 'Sessão demo',
    email: 'E-mail', emailOk: 'Verificado', emailNo: 'Não verificado', identity: 'Identidade', security: 'Segurança', securityNone: 'Não configurada', totp: '2FA', passkeys: '{n} chave de acesso',
    sessionEnds: 'A sessão termina em {t}', userId: 'ID do usuário', unknown: 'Indisponível', copyId: 'Copiar ID de usuário', idCopied: 'Copiado', receiveCode: 'Código de recebimento',
    kyc: { not_started: 'Não iniciada', in_progress: 'Em andamento', submitted: 'Em análise', needs_information: 'Ação necessária', approved: 'Verificada', rejected: 'Não aprovada', expired: 'Expirada' },
    next: 'Próximo passo',
    nextKyc: { not_started: 'Verifique sua identidade para investir em produtos listados.', in_progress: 'Conclua sua verificação de identidade.', submitted: 'Sua verificação está em análise. O status será atualizado aqui.', needs_information: 'A verificação precisa de mais informações.', rejected: 'A verificação não foi aprovada. Veja o motivo e suas opções.', expired: 'Sua verificação expirou. Renove para continuar investindo.' },
    nextSecurity: 'Adicione um autenticador ou chave de acesso para proteger saques.', allSet: 'Identidade verificada e acesso protegido.', open: 'Abrir',
    groups: { identity: 'Identidade e segurança', records: 'Registros e custos', help: 'Ajuda e confiança', prefs: 'Preferências' },
    rows: {
      verification: { title: 'Verificação', body: 'Identidade, elegibilidade, perfil de risco' },
      security: { title: 'Segurança', body: 'Autenticador, chaves de acesso, sessões' },
      channels: { title: 'Canais oficiais', body: 'Confira se links e contatos são nossos' },
      documents: { title: 'Documentos', body: 'Ordens e registros' },
      statements: { title: 'Extratos', body: 'Resumo mensal do livro-razão e CSV' },
      fees: { title: 'Taxas e limites', body: 'Tabela publicada e política de rede ao vivo' },
      support: { title: 'Suporte', body: 'Chamados e respostas' },
      scam: { title: 'Denunciar golpe', body: 'Falsificação ou contato suspeito' },
      trust: { title: 'Central de confiança', body: 'Acesso, divulgações, jurídico' },
      settings: { title: 'Configurações', body: 'Idioma, aparência, notificações' },
      communication: { title: 'Comunicação', body: 'E-mail e novidades do produto' },
      referral: { title: 'Indicação', body: 'Convites e recompensas' },
    },
    signOut: 'Sair', signingOut: 'Saindo…', signOutFailed: 'O servidor não confirmou a saída. Este dispositivo foi desconectado.', closeAccount: 'Encerrar conta', signIn: 'Entrar', guestBody: 'Entre para ver sua verificação, segurança, chamados e preferências.',
  },
  support: {
    kicker: 'Central de ajuda', title: 'Suporte', lede: 'Abra um chamado e acompanhe aqui cada resposta e mudança de status.', tickets: 'Chamados', active: 'Ativos', waiting: 'Aguardando você', done: 'Resolvidos', newTicket: 'Novo chamado',
    filters: { all: 'Todos', active: 'Ativos', waiting: 'Aguardando você', closed: 'Fechados' },
    ticket: 'Chamado', status: 'Status', empty: 'Nenhum chamado ainda', emptyBody: 'Quando você abrir um chamado, ele aparecerá aqui com o status.', emptyFilter: 'Nenhum chamado nesta visão', updated: 'Atualizado {t}',
    routes: 'Outros caminhos', routesNote: 'Mais rápidos para alguns casos', routeItems: { scam: 'Denunciar golpe', channels: 'Canais oficiais', fees: 'Taxas e limites', trust: 'Central de confiança' },
    safety: 'Nunca pediremos sua senha, códigos de recuperação ou chaves privadas — nem em um chamado, nem em nenhum outro lugar.',
    statuses: { open: 'Recebido', pending: 'Pendente', investigating: 'Investigando', waiting_user: 'Aguardando você', resolved: 'Resolvido', closed: 'Fechado' },
    categories: { support: 'Conta e uso', dispute: 'Disputa de ordem', appeal: 'Recurso e revisão', scam_report: 'Denúncia de golpe' },
    categoryNotes: { support: 'Acesso, configurações, como funciona', dispute: 'Uma ordem, depósito ou saque deu errado', appeal: 'Peça a revisão de uma decisão', scam_report: 'Alguém se passou por nós ou pediu fundos' },
  },
  compose: {
    kicker: 'Novo chamado', title: 'Conte o que aconteceu', lede: 'Detalhes claros recebem resposta mais rápida. Você pode acrescentar mais no chamado depois.', topic: 'Tema', details: 'Detalhes',
    subject: 'Assunto', subjectPh: 'ex.: Saque pendente há 2 horas', body: 'Descrição', bodyPh: 'O que aconteceu, quando e o que você esperava.',
    order: 'ID da ordem', orderPh: '00000000-0000-0000-0000-000000000000', orderHint: 'Aparece na página de detalhes da ordem.', optional: 'Opcional',
    safety: 'Não inclua senhas, códigos de recuperação ou chaves privadas.', submit: 'Enviar chamado', submitting: 'Enviando…',
    errSubject: 'Adicione um assunto.', errBody: 'Descreva o problema em pelo menos {n} caracteres.', errOrder: 'O ID da ordem deve ser um UUID completo.', errTopic: 'Escolha um tema.',
    failed: 'O chamado não foi criado.', session: 'Sua sessão terminou. Entre novamente para enviar.',
    created: 'Chamado criado', createdBody: 'Responderemos no chamado. As mudanças de status também aparecem lá.', reference: 'Referência', openTicket: 'Abrir chamado', allTickets: 'Todos os chamados',
  },
  ticket: {
    title: 'Chamado', notFound: 'Chamado não encontrado', notFoundBody: 'Ele pode pertencer a outra conta, ou o link está incompleto.', back: 'Voltar ao suporte', opened: 'Aberto {t}', updated: 'Atualizado {t}',
    stages: ['Recebido', 'Em análise', 'Resolvido', 'Fechado'], waitingYou: 'Aguardando sua resposta', waitingBody: 'O suporte precisa de mais informações para continuar.',
    thread: 'Conversa', threadNote: 'Mensagens e mudanças de status, das mais antigas', you: 'Você', team: 'Suporte', system: 'Sistema',
    events: { created: 'Chamado aberto', status: 'Status · {from} → {to}', assigned: 'Atribuído a um especialista', updated: 'Chamado atualizado' },
    reply: 'Responder', replyPh: 'Acrescente detalhes ou responda a uma pergunta…', send: 'Enviar', sending: 'Enviando…', replyFailed: 'Sua resposta não foi enviada.', errReply: 'Escreva uma resposta primeiro.',
    closedNote: 'Este chamado está fechado. Abra um novo se precisar de mais ajuda.', newTicket: 'Novo chamado',
    close: 'Fechar chamado', closeTitle: 'Fechar este chamado?', closeBody: 'Fechar encerra a conversa. Você não poderá responder depois, mas pode abrir um novo chamado a qualquer momento.', confirmClose: 'Fechar chamado', keepOpen: 'Manter aberto', closing: 'Fechando…', closeFailed: 'O chamado não foi fechado.',
  },
  settings: {
    kicker: 'Preferências', title: 'Configurações', lede: 'As alterações valem na hora.', language: 'Idioma', languageNote: 'Interface e formato de números', saved: 'Salvo neste dispositivo',
    appearance: 'Aparência', appearanceNote: 'Paleta quente ou fria', themes: { light: { title: 'Quente', body: 'Marfim e laca' }, dark: { title: 'Fria', body: 'Azul-noite e ouro' }, system: { title: 'Sistema', body: 'Segue seu dispositivo' } }, showing: 'Exibindo: {name}',
    notifications: 'Notificações', notificationsNote: 'Canais e alertas', notificationsTitle: 'Os canais de notificação ainda não estão conectados', notificationsBody: 'Os alertas por canal aparecerão aqui quando o serviço de preferências da conta for conectado. Nada é salvo nesta seção.', communication: 'Preferências de comunicação',
    currency: 'Moeda de exibição', currencyNote: 'Valores no app', currencyValue: 'USDT', currencyBody: 'Unidade da plataforma · outras moedas ainda indisponíveis',
    storage: 'Idioma e aparência ficam salvos apenas neste navegador; não são sincronizados com sua conta.',
  },
  fees: {
    kicker: 'Custos', title: 'Taxas e limites', lede: 'O que você paga, quando e quais limites se aplicam.', version: 'Tabela {v} · atualizada em {d}', binding: 'O valor que vale é sempre o da tela de confirmação antes do envio.', schedule: 'Tabela', live: 'Ao vivo',
    trading: 'Taxas de negociação', tradingNote: 'Por ordem, sobre o valor', classes: { default: 'RWA e computação IA', stocks: 'Cestas de ações', prediction: 'Mercados de previsão', tbill: 'T-bills tokenizados' }, minFee: 'Mínimo de {v} por ordem', rate: 'Taxa', predictionSplit: 'entrada + pagamento',
    management: 'Taxas de gestão', managementNote: 'Anuais, provisionadas do rendimento do produto — nunca cobradas do seu saldo', mClasses: { rwa: 'RWA', compute: 'Computação IA', stocks: 'Cestas de ações', prediction: 'Mercados de previsão' }, perYear: 'a.a.', none: 'Nenhuma',
    network: 'Redes', networkNote: 'Política do servidor, por rede', limits: 'Limites', limitsNote: 'Limites de conta e produto', minInvest: 'Investimento mínimo', minInvestNote: 'Prevalecem os termos do produto', dailyMax: 'Saque diário máximo', minWithdraw: 'Saque mínimo', perNetwork: 'Por rede, acima',
    controls: 'Controles de saque', controlsNote: 'Aplicados pelo servidor', addressBook: 'Endereço salvo obrigatório', addressCooldown: 'Carência de novo endereço', deviceCooldown: 'Carência de novo dispositivo', approvals: 'Aprovações necessárias', yes: 'Sim', no: 'Não',
    redemption: 'Resgate', redemptionStd: 'Resgate padrão', redemptionBody: 'A saída antecipada segue os termos de cada produto. Períodos bloqueados não podem ser resgatados; pedidos fora da janela passam para a próxima.',
    notesTitle: 'Como as taxas se aplicam', notes: ['As taxas aparecem na confirmação antes de qualquer cobrança. Não há taxas ocultas.', 'Taxas de rede são custos de liquidação em blockchain e podem mudar com o congestionamento; a confirmação mostra o valor atual.', 'Taxas de gestão são provisionadas do rendimento do produto, não cobradas à parte.', 'Limites e janelas seguem os termos de cada produto; esta página resume a tabela.'],
  },
}

export const accountCopy: Record<AppLocale, AccountCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
