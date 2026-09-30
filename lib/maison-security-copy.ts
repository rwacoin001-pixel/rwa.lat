import type { AppLocale } from '@/lib/app-locales'

/** Copy for /profile/security and /profile/referral (batch F1c). Templates use `{v}` slots filled with `fill()`. */
export type SecurityCopy = {
  kicker: string; titleA: string; titleB: string; lede: string
  card: string; levels: [string, string, string, string]; levelNote: string; progress: string
  stats: { passkeys: string; authenticator: string; recovery: string; sessions: string }
  on: string; off: string; next: string; open: string; allSet: string
  nextPasskey: string; nextTotp: string; nextTrust: string
  tabs: { methods: string; devices: string; sessions: string }
  passkeys: string; passkeysNote: string; passkeyAdd: string; passkeyAdding: string; passkeyNone: string; passkeyCreated: string; passkeyUsed: string; passkeyNever: string
  passkeyAdded: string; passkeyErrors: Record<string, string>
  totp: string; totpNote: string; totpOn: string; totpOff: string; totpSetup: string; totpActivated: string; recoveryLeft: string; recoveryLow: string
  enroll: { title: string; scan: string; manual: string; codes: string; codesNote: string; copyCodes: string; copied: string; saved: string; code: string; confirm: string; confirming: string; cancel: string; done: string; wrongCode: string }
  remove: string; removing: string; removeTitle: string; removeBody: string; keep: string; confirmRemove: string; removed: string
  devices: string; devicesNote: string; thisDevice: string; trust: Record<string, string>; firstSeen: string; lastSeen: string; sessionsOn: string
  trustThis: string; trusting: string; trusted: string; forget: string; forgetTitle: string; forgetBody: string
  sessions: string; sessionsNote: string; unknownDevice: string; signedIn: string; expires: string; current: string
  signOutHere: string; signOutHereBody: string; endSession: string; endSessionBody: string; endOthers: string; endOthersTitle: string; endOthersBody: string; ended: string; endedOthers: string; noOthers: string
  activity: string; activityNote: string; activityTitle: string; activityBody: string; showAll: string; showFewer: string
  /** Keyed by the server's audit action without the `security.` prefix; unknown actions are shown as sent. */
  events: Record<string, string>
  tips: string; tipsNote: string; tipItems: string[]; channels: string
  actionFailed: string; empty: string
}

export type ReferralCopy = {
  kicker: string; titleA: string; titleB: string; lede: string
  card: string; stats: { sent: string; accepted: string; pending: string; earned: string }
  create: string; createNote: string; email: string; emailHint: string; emailInvalid: string; createCta: string; creating: string
  linkTitle: string; linkOnce: string; copy: string; copied: string; share: string; expiresOn: string; newLink: string; linkFailed: string
  tabs: { invites: string; rewards: string }
  states: Record<string, string>; noEmail: string; sentOn: string; acceptedOn: string; expiresShort: string
  revoke: string; revokeTitle: string; revokeBody: string; keep: string; confirmRevoke: string; revoking: string
  invitesEmpty: string; invitesEmptyBody: string
  rewardsEmpty: string; rewardsEmptyBody: string; kinds: Record<string, string>; rewardStates: Record<string, string>; earnedOn: string; amountUnknown: string
  terms: string; termsItems: string[]
}

const en: { security: SecurityCopy; referral: ReferralCopy } = {
  security: {
    kicker: 'Security', titleA: 'Keys to', titleB: 'your account', lede: 'Sign-in methods, trusted devices and live sessions — all read from your account.',
    card: 'Account protection', levels: ['Basic', 'Protected', 'Strong', 'Fortified'], levelNote: 'Counted from passkeys, authenticator and this device’s trust.', progress: '{n} of 3 protections on',
    stats: { passkeys: 'Passkeys', authenticator: 'Authenticator', recovery: 'Recovery codes', sessions: 'Sessions' },
    on: 'On', off: 'Off', next: 'Recommended', open: 'Set up', allSet: 'All three protections are on.',
    nextPasskey: 'Add a passkey — sign in with your face, fingerprint or device PIN.', nextTotp: 'Turn on an authenticator app for sensitive actions.', nextTrust: 'Mark this device as trusted.',
    tabs: { methods: 'Methods', devices: 'Devices', sessions: 'Sessions' },
    passkeys: 'Passkeys', passkeysNote: 'Phishing-resistant sign-in bound to this site.', passkeyAdd: 'Add a passkey', passkeyAdding: 'Waiting for your device…', passkeyNone: 'No passkey yet.',
    passkeyCreated: 'Added {t}', passkeyUsed: 'Last used {t}', passkeyNever: 'Not used yet', passkeyAdded: 'Passkey added.',
    passkeyErrors: { PASSKEY_UNSUPPORTED: 'This browser or device can’t create passkeys.', PASSKEY_REGISTRATION_CANCELLED: 'Passkey setup was cancelled.', PASSKEY_ALREADY_REGISTERED: 'This passkey is already registered.' },
    totp: 'Authenticator app', totpNote: 'Six-digit codes that confirm withdrawals and security changes.', totpOn: 'Authenticator on', totpOff: 'Not set up', totpSetup: 'Set up authenticator',
    totpActivated: 'Turned on {t}', recoveryLeft: '{n} recovery codes left', recoveryLow: 'Few recovery codes left — keep the rest somewhere safe.',
    enroll: { title: 'Set up your authenticator', scan: 'Scan with your authenticator app', manual: 'Or enter this key', codes: 'Recovery codes', codesNote: 'Shown once. Each code works one time if you lose your phone.',
      copyCodes: 'Copy codes', copied: 'Copied', saved: 'I’ve stored these codes somewhere safe', code: 'Code from the app', confirm: 'Turn on', confirming: 'Checking…', cancel: 'Cancel', done: 'Authenticator is on.', wrongCode: 'That code didn’t match. Try the newest one.' },
    remove: 'Remove', removing: 'Removing…', removeTitle: 'Remove this method?', removeBody: 'You’ll confirm with another factor first. You can add it again later.', keep: 'Keep', confirmRemove: 'Remove', removed: 'Removed.',
    devices: 'Devices', devicesNote: 'Browsers and phones that have signed in.', thisDevice: 'This device', trust: { trusted: 'Trusted', untrusted: 'Not trusted', revoked: 'Removed' },
    firstSeen: 'First seen {t}', lastSeen: 'Last active {t}', sessionsOn: '{n} active sessions',
    trustThis: 'Trust this device', trusting: 'Trusting…', trusted: 'This device is now trusted.', forget: 'Remove device', forgetTitle: 'Remove this device?', forgetBody: 'Its sessions end right away. It will need to sign in again.',
    sessions: 'Sessions', sessionsNote: 'Where you are signed in right now.', unknownDevice: 'Unknown device', signedIn: 'Signed in {t}', expires: 'Expires {t}', current: 'Current',
    signOutHere: 'Sign out here', signOutHereBody: 'You’ll be signed out on this device.', endSession: 'End', endSessionBody: 'That device is signed out right away.', endOthers: 'Sign out everywhere else', endOthersTitle: 'Sign out other sessions?', endOthersBody: 'Every session except this one ends now.',
    ended: 'Session ended.', endedOthers: '{n} sessions ended.', noOthers: 'No other active sessions.',
    activity: 'Activity', activityNote: 'Recent security changes on your account, newest first.', activityTitle: 'No security activity yet', activityBody: 'Changes to passkeys, the authenticator, devices and sessions will be listed here.', showAll: 'Show all {n}', showFewer: 'Show fewer',
    events: { 'device.revoked': 'Device removed', 'device.trusted': 'Device trusted', 'passkey.assertion_started': 'Passkey sign-in requested', 'passkey.registered': 'Passkey added', 'passkey.registration_started': 'Passkey setup started', 'passkey.revoked': 'Passkey removed', 'recovery_code.used': 'Recovery code used', 'session.revoked': 'Session ended', 'sessions.revoked_others': 'Other sessions signed out', 'step_up.completed': 'Identity confirmed', 'totp.enrolled': 'Authenticator turned on', 'totp.enrollment_started': 'Authenticator setup started', 'totp.revoked': 'Authenticator turned off' },
    tips: 'Stay safe', tipsNote: 'We will never ask for these.', tipItems: ['We never ask for your codes, recovery codes or passkey by chat, phone or email.', 'Check links against our official channels before signing in.', 'Remove devices you no longer use.'], channels: 'Official channels',
    actionFailed: 'That didn’t go through.', empty: 'Nothing here yet.',
  },
  referral: {
    kicker: 'Invite', titleA: 'Bring someone', titleB: 'you trust', lede: 'Create one-time invite links and follow them here. Figures come from your account.',
    card: 'Invite pass', stats: { sent: 'Sent', accepted: 'Joined', pending: 'Open', earned: 'Rewards' },
    create: 'New invite', createNote: 'Each link works once and expires.', email: 'Friend’s email (optional)', emailHint: 'Only to help you recognise the invite; we don’t send emails from here.', emailInvalid: 'Enter a valid email or leave it blank.',
    createCta: 'Create invite link', creating: 'Creating…',
    linkTitle: 'Your invite link', linkOnce: 'Shown only now — copy or share it before leaving this page.', copy: 'Copy link', copied: 'Copied', share: 'Share', expiresOn: 'Expires {t}', newLink: 'Create another', linkFailed: 'Couldn’t create the link.',
    tabs: { invites: 'Invites', rewards: 'Rewards' },
    states: { pending: 'Open', accepted: 'Joined', revoked: 'Revoked', expired: 'Expired' }, noEmail: 'Link invite', sentOn: 'Created {t}', acceptedOn: 'Joined {t}', expiresShort: 'Expires {t}',
    revoke: 'Revoke', revokeTitle: 'Revoke this invite?', revokeBody: 'The link stops working immediately.', keep: 'Keep', confirmRevoke: 'Revoke', revoking: 'Revoking…',
    invitesEmpty: 'No invites yet', invitesEmptyBody: 'Create a link above to invite someone.',
    rewardsEmpty: 'No rewards yet', rewardsEmptyBody: 'Rewards show here only once they are recorded on your account.',
    kinds: { referral: 'Referral', loyalty: 'Loyalty', promo: 'Promotion', cashback: 'Cashback' }, rewardStates: { earned: 'Earned', redeemed: 'Redeemed', expired: 'Expired', revoked: 'Revoked' }, earnedOn: 'Recorded {t}', amountUnknown: 'Amount unit not confirmed',
    terms: 'How it works', termsItems: ['Invite links are single-use and carry an expiry date set by the server.', 'Rewards appear only after they are recorded on your account — nothing here is a promise of payment.', 'Invite only people you know. Don’t post links publicly.'],
  },
}

const zh: typeof en = {
  security: {
    kicker: '安全', titleA: '账户的', titleB: '钥匙', lede: '登录方式、受信设备和在线会话，全部读取自你的账户。',
    card: '账户防护', levels: ['基础', '已防护', '强', '全面'], levelNote: '按通行密钥、验证器与本设备信任状态计算。', progress: '已开启 {n}/3 项防护',
    stats: { passkeys: '通行密钥', authenticator: '验证器', recovery: '恢复码', sessions: '会话' },
    on: '已开启', off: '未开启', next: '建议', open: '去设置', allSet: '三项防护均已开启。',
    nextPasskey: '添加通行密钥，用面容、指纹或设备密码登录。', nextTotp: '开启验证器应用，用于敏感操作确认。', nextTrust: '将本设备标记为受信设备。',
    tabs: { methods: '验证方式', devices: '设备', sessions: '会话' },
    passkeys: '通行密钥', passkeysNote: '绑定本站、防钓鱼的登录方式。', passkeyAdd: '添加通行密钥', passkeyAdding: '等待设备确认…', passkeyNone: '尚未添加通行密钥。',
    passkeyCreated: '添加于 {t}', passkeyUsed: '最近使用 {t}', passkeyNever: '尚未使用', passkeyAdded: '通行密钥已添加。',
    passkeyErrors: { PASSKEY_UNSUPPORTED: '此浏览器或设备无法创建通行密钥。', PASSKEY_REGISTRATION_CANCELLED: '已取消通行密钥设置。', PASSKEY_ALREADY_REGISTERED: '该通行密钥已注册。' },
    totp: '验证器应用', totpNote: '6 位动态码，用于确认提现和安全设置变更。', totpOn: '验证器已开启', totpOff: '未设置', totpSetup: '设置验证器',
    totpActivated: '开启于 {t}', recoveryLeft: '剩余 {n} 个恢复码',recoveryLow: '恢复码所剩不多，请妥善保存剩余的码。',
    enroll: { title: '设置验证器', scan: '用验证器应用扫描', manual: '或手动输入密钥', codes: '恢复码', codesNote: '只显示一次。手机丢失时每个码可使用一次。',
      copyCodes: '复制恢复码', copied: '已复制', saved: '我已将恢复码保存在安全的地方', code: '应用中的验证码', confirm: '开启', confirming: '验证中…', cancel: '取消', done: '验证器已开启。', wrongCode: '验证码不匹配，请使用最新的验证码。' },
    remove: '移除', removing: '移除中…', removeTitle: '移除此验证方式？', removeBody: '需要先用另一种方式确认身份。之后可以重新添加。', keep: '保留', confirmRemove: '移除', removed: '已移除。',
    devices: '设备', devicesNote: '登录过的浏览器和手机。', thisDevice: '本设备', trust: { trusted: '受信', untrusted: '未受信', revoked: '已移除' },
    firstSeen: '首次出现 {t}', lastSeen: '最近活动 {t}', sessionsOn: '{n} 个活动会话',
    trustThis: '信任本设备', trusting: '处理中…', trusted: '本设备已设为受信。', forget: '移除设备', forgetTitle: '移除此设备？', forgetBody: '其会话会立即结束，需要重新登录。',
    sessions: '会话', sessionsNote: '你当前登录的位置。', unknownDevice: '未知设备', signedIn: '登录于 {t}', expires: '到期 {t}', current: '当前',
    signOutHere: '在此退出', signOutHereBody: '你将在本设备上退出登录。', endSession: '结束', endSessionBody: '该设备会立即退出登录。', endOthers: '退出其他所有会话', endOthersTitle: '退出其他会话？', endOthersBody: '除本会话外，其余会话将立即结束。',
    ended: '会话已结束。', endedOthers: '已结束 {n} 个会话。', noOthers: '没有其他活动会话。',
    activity: '动态', activityNote: '账户最近的安全变更，按时间倒序。', activityTitle: '暂无安全动态', activityBody: '通行密钥、验证器、设备和会话的变更会列在这里。', showAll: '显示全部 {n} 条', showFewer: '收起',
    events: { 'device.revoked': '已移除设备', 'device.trusted': '已信任设备', 'passkey.assertion_started': '发起通行密钥验证', 'passkey.registered': '已添加通行密钥', 'passkey.registration_started': '开始设置通行密钥', 'passkey.revoked': '已移除通行密钥', 'recovery_code.used': '已使用恢复码', 'session.revoked': '已结束会话', 'sessions.revoked_others': '已退出其他会话', 'step_up.completed': '已完成身份确认', 'totp.enrolled': '已开启验证器', 'totp.enrollment_started': '开始设置验证器', 'totp.revoked': '已关闭验证器' },
    tips: '安全提示', tipsNote: '我们绝不会索取以下信息。', tipItems: ['我们不会通过聊天、电话或邮件索取验证码、恢复码或通行密钥。', '登录前请对照官方渠道核对链接。', '移除不再使用的设备。'], channels: '官方渠道',
    actionFailed: '操作未完成。', empty: '暂无内容。',
  },
  referral: {
    kicker: '邀请', titleA: '邀请你', titleB: '信任的人', lede: '创建一次性邀请链接并在此跟进。数字均来自你的账户。',
    card: '邀请通行证', stats: { sent: '已创建', accepted: '已加入', pending: '待使用', earned: '奖励' },
    create: '新邀请', createNote: '每个链接只能使用一次，并会过期。', email: '好友邮箱（可选）', emailHint: '仅用于帮你识别这条邀请；此处不会发送邮件。', emailInvalid: '请输入有效邮箱，或留空。',
    createCta: '创建邀请链接', creating: '创建中…',
    linkTitle: '你的邀请链接', linkOnce: '仅此时显示——离开本页前请复制或分享。', copy: '复制链接', copied: '已复制', share: '分享', expiresOn: '{t} 过期', newLink: '再创建一个', linkFailed: '未能创建链接。',
    tabs: { invites: '邀请', rewards: '奖励' },
    states: { pending: '待使用', accepted: '已加入', revoked: '已撤销', expired: '已过期' }, noEmail: '链接邀请', sentOn: '创建于 {t}', acceptedOn: '加入于 {t}', expiresShort: '{t} 过期',
    revoke: '撤销', revokeTitle: '撤销这条邀请？', revokeBody: '链接会立即失效。', keep: '保留', confirmRevoke: '撤销', revoking: '撤销中…',
    invitesEmpty: '还没有邀请', invitesEmptyBody: '在上方创建链接来邀请他人。',
    rewardsEmpty: '还没有奖励', rewardsEmptyBody: '奖励只有在记入你的账户后才会显示。',
    kinds: { referral: '邀请', loyalty: '忠诚', promo: '活动', cashback: '返现' }, rewardStates: { earned: '已获得', redeemed: '已使用', expired: '已过期', revoked: '已撤销' }, earnedOn: '记录于 {t}', amountUnknown: '金额单位待确认',
    terms: '规则说明', termsItems: ['邀请链接仅可使用一次，过期时间由服务端设定。', '奖励只有记入账户后才显示——此处内容不构成任何付款承诺。', '只邀请你认识的人，不要公开发布链接。'],
  },
}

const hi: typeof en = {
  security: {
    kicker: 'सुरक्षा', titleA: 'आपके खाते की', titleB: 'चाबियाँ', lede: 'साइन-इन तरीके, भरोसेमंद डिवाइस और चालू सत्र — सब आपके खाते से पढ़े गए।',
    card: 'खाता सुरक्षा', levels: ['बुनियादी', 'सुरक्षित', 'मज़बूत', 'पूर्ण'], levelNote: 'पासकी, ऑथेंटिकेटर और इस डिवाइस के भरोसे से गिना गया।', progress: '3 में से {n} सुरक्षा चालू',
    stats: { passkeys: 'पासकी', authenticator: 'ऑथेंटिकेटर', recovery: 'रिकवरी कोड', sessions: 'सत्र' },
    on: 'चालू', off: 'बंद', next: 'सुझाव', open: 'सेट करें', allSet: 'तीनों सुरक्षाएँ चालू हैं।',
    nextPasskey: 'पासकी जोड़ें — चेहरे, फ़िंगरप्रिंट या डिवाइस PIN से साइन इन करें।', nextTotp: 'संवेदनशील कार्यों के लिए ऑथेंटिकेटर ऐप चालू करें।', nextTrust: 'इस डिवाइस को भरोसेमंद चिह्नित करें।',
    tabs: { methods: 'तरीके', devices: 'डिवाइस', sessions: 'सत्र' },
    passkeys: 'पासकी', passkeysNote: 'इस साइट से बंधा, फ़िशिंग-रोधी साइन-इन।', passkeyAdd: 'पासकी जोड़ें', passkeyAdding: 'आपके डिवाइस की प्रतीक्षा…', passkeyNone: 'अभी कोई पासकी नहीं।',
    passkeyCreated: '{t} को जोड़ी गई', passkeyUsed: 'अंतिम उपयोग {t}', passkeyNever: 'अभी उपयोग नहीं हुई', passkeyAdded: 'पासकी जोड़ दी गई।',
    passkeyErrors: { PASSKEY_UNSUPPORTED: 'यह ब्राउज़र या डिवाइस पासकी नहीं बना सकता।', PASSKEY_REGISTRATION_CANCELLED: 'पासकी सेटअप रद्द हुआ।', PASSKEY_ALREADY_REGISTERED: 'यह पासकी पहले से पंजीकृत है।' },
    totp: 'ऑथेंटिकेटर ऐप', totpNote: 'छह अंकों के कोड जो निकासी और सुरक्षा बदलावों की पुष्टि करते हैं।', totpOn: 'ऑथेंटिकेटर चालू', totpOff: 'सेट नहीं', totpSetup: 'ऑथेंटिकेटर सेट करें',
    totpActivated: '{t} को चालू किया', recoveryLeft: '{n} रिकवरी कोड बचे', recoveryLow: 'कम रिकवरी कोड बचे हैं — बाकी सुरक्षित रखें।',
    enroll: { title: 'ऑथेंटिकेटर सेट करें', scan: 'अपने ऑथेंटिकेटर ऐप से स्कैन करें', manual: 'या यह कुंजी दर्ज करें', codes: 'रिकवरी कोड', codesNote: 'केवल एक बार दिखते हैं। फ़ोन खोने पर हर कोड एक बार काम करता है।',
      copyCodes: 'कोड कॉपी करें', copied: 'कॉपी हुआ', saved: 'मैंने ये कोड सुरक्षित जगह रख लिए हैं', code: 'ऐप का कोड', confirm: 'चालू करें', confirming: 'जाँच हो रही है…', cancel: 'रद्द करें', done: 'ऑथेंटिकेटर चालू है।', wrongCode: 'कोड मेल नहीं खाया। नवीनतम कोड आज़माएँ।' },
    remove: 'हटाएँ', removing: 'हटाया जा रहा है…', removeTitle: 'यह तरीका हटाएँ?', removeBody: 'पहले किसी दूसरे तरीके से पुष्टि करेंगे। बाद में फिर जोड़ सकते हैं।', keep: 'रखें', confirmRemove: 'हटाएँ', removed: 'हटा दिया गया।',
    devices: 'डिवाइस', devicesNote: 'जिन ब्राउज़र और फ़ोन से साइन इन हुआ है।', thisDevice: 'यह डिवाइस', trust: { trusted: 'भरोसेमंद', untrusted: 'भरोसेमंद नहीं', revoked: 'हटाया गया' },
    firstSeen: 'पहली बार {t}', lastSeen: 'अंतिम सक्रिय {t}', sessionsOn: '{n} सक्रिय सत्र',
    trustThis: 'इस डिवाइस पर भरोसा करें', trusting: 'प्रक्रिया जारी…', trusted: 'यह डिवाइस अब भरोसेमंद है।', forget: 'डिवाइस हटाएँ', forgetTitle: 'यह डिवाइस हटाएँ?', forgetBody: 'इसके सत्र तुरंत समाप्त होंगे। इसे फिर से साइन इन करना होगा।',
    sessions: 'सत्र', sessionsNote: 'जहाँ आप अभी साइन इन हैं।', unknownDevice: 'अज्ञात डिवाइस', signedIn: '{t} को साइन इन', expires: '{t} को समाप्त', current: 'वर्तमान',
    signOutHere: 'यहाँ साइन आउट', signOutHereBody: 'आप इस डिवाइस पर साइन आउट हो जाएँगे।', endSession: 'समाप्त', endSessionBody: 'वह डिवाइस तुरंत साइन आउट हो जाएगा।', endOthers: 'बाकी सब जगह साइन आउट', endOthersTitle: 'अन्य सत्र साइन आउट करें?', endOthersBody: 'इस सत्र को छोड़कर सभी सत्र अभी समाप्त होंगे।',
    ended: 'सत्र समाप्त हुआ।', endedOthers: '{n} सत्र समाप्त हुए।', noOthers: 'कोई अन्य सक्रिय सत्र नहीं।',
    activity: 'गतिविधि', activityNote: 'आपके खाते में हाल के सुरक्षा बदलाव, नए पहले।', activityTitle: 'अभी कोई सुरक्षा गतिविधि नहीं', activityBody: 'पासकी, ऑथेंटिकेटर, डिवाइस और सत्रों में बदलाव यहाँ दिखेंगे।', showAll: 'सभी {n} दिखाएँ', showFewer: 'कम दिखाएँ',
    events: { 'device.revoked': 'डिवाइस हटाया गया', 'device.trusted': 'डिवाइस भरोसेमंद किया गया', 'passkey.assertion_started': 'पासकी साइन-इन का अनुरोध', 'passkey.registered': 'पासकी जोड़ी गई', 'passkey.registration_started': 'पासकी सेटअप शुरू हुआ', 'passkey.revoked': 'पासकी हटाई गई', 'recovery_code.used': 'रिकवरी कोड इस्तेमाल हुआ', 'session.revoked': 'सत्र समाप्त', 'sessions.revoked_others': 'अन्य सत्रों से साइन आउट', 'step_up.completed': 'पहचान की पुष्टि हुई', 'totp.enrolled': 'ऑथेंटिकेटर चालू किया गया', 'totp.enrollment_started': 'ऑथेंटिकेटर सेटअप शुरू हुआ', 'totp.revoked': 'ऑथेंटिकेटर बंद किया गया' },
    tips: 'सुरक्षित रहें', tipsNote: 'हम ये कभी नहीं माँगेंगे।', tipItems: ['हम चैट, फ़ोन या ईमेल से आपके कोड, रिकवरी कोड या पासकी कभी नहीं माँगते।', 'साइन इन से पहले लिंक को हमारे आधिकारिक चैनलों से मिलाएँ।', 'जो डिवाइस अब उपयोग नहीं करते, उन्हें हटाएँ।'], channels: 'आधिकारिक चैनल',
    actionFailed: 'यह पूरा नहीं हुआ।', empty: 'अभी यहाँ कुछ नहीं।',
  },
  referral: {
    kicker: 'आमंत्रण', titleA: 'भरोसेमंद व्यक्ति को', titleB: 'आमंत्रित करें', lede: 'एक-बार के आमंत्रण लिंक बनाएँ और यहाँ ट्रैक करें। आँकड़े आपके खाते से आते हैं।',
    card: 'आमंत्रण पास', stats: { sent: 'बनाए', accepted: 'जुड़े', pending: 'खुले', earned: 'इनाम' },
    create: 'नया आमंत्रण', createNote: 'हर लिंक एक बार काम करता है और समाप्त होता है।', email: 'मित्र का ईमेल (वैकल्पिक)', emailHint: 'सिर्फ़ पहचान के लिए; यहाँ से ईमेल नहीं भेजा जाता।', emailInvalid: 'मान्य ईमेल दर्ज करें या खाली छोड़ें।',
    createCta: 'आमंत्रण लिंक बनाएँ', creating: 'बनाया जा रहा है…',
    linkTitle: 'आपका आमंत्रण लिंक', linkOnce: 'केवल अभी दिख रहा है — पेज छोड़ने से पहले कॉपी या शेयर करें।', copy: 'लिंक कॉपी करें', copied: 'कॉपी हुआ', share: 'शेयर करें', expiresOn: '{t} को समाप्त', newLink: 'एक और बनाएँ', linkFailed: 'लिंक नहीं बन सका।',
    tabs: { invites: 'आमंत्रण', rewards: 'इनाम' },
    states: { pending: 'खुला', accepted: 'जुड़ा', revoked: 'रद्द', expired: 'समाप्त' }, noEmail: 'लिंक आमंत्रण', sentOn: '{t} को बनाया', acceptedOn: '{t} को जुड़ा', expiresShort: '{t} को समाप्त',
    revoke: 'रद्द करें', revokeTitle: 'यह आमंत्रण रद्द करें?', revokeBody: 'लिंक तुरंत काम करना बंद कर देगा।', keep: 'रखें', confirmRevoke: 'रद्द करें', revoking: 'रद्द हो रहा है…',
    invitesEmpty: 'अभी कोई आमंत्रण नहीं', invitesEmptyBody: 'किसी को आमंत्रित करने के लिए ऊपर लिंक बनाएँ।',
    rewardsEmpty: 'अभी कोई इनाम नहीं', rewardsEmptyBody: 'इनाम तभी दिखते हैं जब वे आपके खाते में दर्ज हो जाते हैं।',
    kinds: { referral: 'रेफ़रल', loyalty: 'लॉयल्टी', promo: 'प्रचार', cashback: 'कैशबैक' }, rewardStates: { earned: 'अर्जित', redeemed: 'उपयोग किया', expired: 'समाप्त', revoked: 'रद्द' }, earnedOn: '{t} को दर्ज', amountUnknown: 'राशि की इकाई अपुष्ट',
    terms: 'यह कैसे काम करता है', termsItems: ['आमंत्रण लिंक एक बार उपयोग के लिए हैं और सर्वर द्वारा तय समाप्ति तिथि रखते हैं।', 'इनाम खाते में दर्ज होने के बाद ही दिखते हैं — यहाँ कुछ भी भुगतान का वादा नहीं है।', 'केवल परिचितों को आमंत्रित करें। लिंक सार्वजनिक न करें।'],
  },
}

const es: typeof en = {
  security: {
    kicker: 'Seguridad', titleA: 'Las llaves de', titleB: 'tu cuenta', lede: 'Métodos de acceso, dispositivos de confianza y sesiones activas, leídos de tu cuenta.',
    card: 'Protección de la cuenta', levels: ['Básica', 'Protegida', 'Fuerte', 'Blindada'], levelNote: 'Según llaves de acceso, autenticador y confianza de este dispositivo.', progress: '{n} de 3 protecciones activas',
    stats: { passkeys: 'Llaves de acceso', authenticator: 'Autenticador', recovery: 'Códigos de recuperación', sessions: 'Sesiones' },
    on: 'Activo', off: 'Inactivo', next: 'Recomendado', open: 'Configurar', allSet: 'Las tres protecciones están activas.',
    nextPasskey: 'Añade una llave de acceso: entra con tu cara, huella o PIN del dispositivo.', nextTotp: 'Activa una app de autenticación para acciones sensibles.', nextTrust: 'Marca este dispositivo como de confianza.',
    tabs: { methods: 'Métodos', devices: 'Dispositivos', sessions: 'Sesiones' },
    passkeys: 'Llaves de acceso', passkeysNote: 'Acceso resistente al phishing, ligado a este sitio.', passkeyAdd: 'Añadir llave de acceso', passkeyAdding: 'Esperando a tu dispositivo…', passkeyNone: 'Aún no hay llaves de acceso.',
    passkeyCreated: 'Añadida el {t}', passkeyUsed: 'Último uso {t}', passkeyNever: 'Sin usar todavía', passkeyAdded: 'Llave de acceso añadida.',
    passkeyErrors: { PASSKEY_UNSUPPORTED: 'Este navegador o dispositivo no puede crear llaves de acceso.', PASSKEY_REGISTRATION_CANCELLED: 'Se canceló la configuración.', PASSKEY_ALREADY_REGISTERED: 'Esta llave ya está registrada.' },
    totp: 'App de autenticación', totpNote: 'Códigos de seis dígitos para confirmar retiros y cambios de seguridad.', totpOn: 'Autenticador activo', totpOff: 'Sin configurar', totpSetup: 'Configurar autenticador',
    totpActivated: 'Activado el {t}', recoveryLeft: 'Quedan {n} códigos de recuperación', recoveryLow: 'Quedan pocos códigos: guarda el resto en un lugar seguro.',
    enroll: { title: 'Configura tu autenticador', scan: 'Escanea con tu app de autenticación', manual: 'O introduce esta clave', codes: 'Códigos de recuperación', codesNote: 'Se muestran una sola vez. Cada código sirve una vez si pierdes el teléfono.',
      copyCodes: 'Copiar códigos', copied: 'Copiado', saved: 'He guardado estos códigos en un lugar seguro', code: 'Código de la app', confirm: 'Activar', confirming: 'Comprobando…', cancel: 'Cancelar', done: 'El autenticador está activo.', wrongCode: 'El código no coincide. Prueba con el más reciente.' },
    remove: 'Quitar', removing: 'Quitando…', removeTitle: '¿Quitar este método?', removeBody: 'Primero confirmarás con otro factor. Puedes volver a añadirlo después.', keep: 'Mantener', confirmRemove: 'Quitar', removed: 'Quitado.',
    devices: 'Dispositivos', devicesNote: 'Navegadores y teléfonos que han iniciado sesión.', thisDevice: 'Este dispositivo', trust: { trusted: 'De confianza', untrusted: 'Sin confianza', revoked: 'Quitado' },
    firstSeen: 'Visto por primera vez {t}', lastSeen: 'Última actividad {t}', sessionsOn: '{n} sesiones activas',
    trustThis: 'Confiar en este dispositivo', trusting: 'Procesando…', trusted: 'Este dispositivo ya es de confianza.', forget: 'Quitar dispositivo', forgetTitle: '¿Quitar este dispositivo?', forgetBody: 'Sus sesiones terminan al instante. Tendrá que volver a iniciar sesión.',
    sessions: 'Sesiones', sessionsNote: 'Dónde tienes la sesión iniciada ahora.', unknownDevice: 'Dispositivo desconocido', signedIn: 'Inicio {t}', expires: 'Caduca {t}', current: 'Actual',
    signOutHere: 'Cerrar sesión aquí', signOutHereBody: 'Se cerrará tu sesión en este dispositivo.', endSession: 'Cerrar', endSessionBody: 'Ese dispositivo se desconecta al instante.', endOthers: 'Cerrar las demás sesiones', endOthersTitle: '¿Cerrar las otras sesiones?', endOthersBody: 'Todas las sesiones salvo esta terminan ahora.',
    ended: 'Sesión cerrada.', endedOthers: '{n} sesiones cerradas.', noOthers: 'No hay otras sesiones activas.',
    activity: 'Actividad', activityNote: 'Cambios de seguridad recientes en tu cuenta, del más nuevo al más antiguo.', activityTitle: 'Aún no hay actividad de seguridad', activityBody: 'Aquí aparecerán los cambios en llaves de acceso, autenticador, dispositivos y sesiones.', showAll: 'Ver los {n}', showFewer: 'Ver menos',
    events: { 'device.revoked': 'Dispositivo eliminado', 'device.trusted': 'Dispositivo de confianza', 'passkey.assertion_started': 'Inicio con llave de acceso solicitado', 'passkey.registered': 'Llave de acceso añadida', 'passkey.registration_started': 'Configuración de llave de acceso iniciada', 'passkey.revoked': 'Llave de acceso eliminada', 'recovery_code.used': 'Código de recuperación usado', 'session.revoked': 'Sesión cerrada', 'sessions.revoked_others': 'Otras sesiones cerradas', 'step_up.completed': 'Identidad confirmada', 'totp.enrolled': 'Autenticador activado', 'totp.enrollment_started': 'Configuración del autenticador iniciada', 'totp.revoked': 'Autenticador desactivado' },
    tips: 'Mantente seguro', tipsNote: 'Nunca te pediremos esto.', tipItems: ['Nunca pedimos tus códigos, códigos de recuperación ni llave de acceso por chat, teléfono o email.', 'Comprueba los enlaces con nuestros canales oficiales antes de entrar.', 'Quita los dispositivos que ya no uses.'], channels: 'Canales oficiales',
    actionFailed: 'No se pudo completar.', empty: 'Nada por aquí todavía.',
  },
  referral: {
    kicker: 'Invitar', titleA: 'Invita a alguien', titleB: 'de confianza', lede: 'Crea enlaces de invitación de un solo uso y síguelos aquí. Las cifras vienen de tu cuenta.',
    card: 'Pase de invitación', stats: { sent: 'Creadas', accepted: 'Unidos', pending: 'Abiertas', earned: 'Recompensas' },
    create: 'Nueva invitación', createNote: 'Cada enlace funciona una vez y caduca.', email: 'Email de tu contacto (opcional)', emailHint: 'Solo para que reconozcas la invitación; no enviamos emails desde aquí.', emailInvalid: 'Introduce un email válido o déjalo vacío.',
    createCta: 'Crear enlace de invitación', creating: 'Creando…',
    linkTitle: 'Tu enlace de invitación', linkOnce: 'Solo se muestra ahora: cópialo o compártelo antes de salir.', copy: 'Copiar enlace', copied: 'Copiado', share: 'Compartir', expiresOn: 'Caduca el {t}', newLink: 'Crear otro', linkFailed: 'No se pudo crear el enlace.',
    tabs: { invites: 'Invitaciones', rewards: 'Recompensas' },
    states: { pending: 'Abierta', accepted: 'Unido', revoked: 'Revocada', expired: 'Caducada' }, noEmail: 'Invitación por enlace', sentOn: 'Creada el {t}', acceptedOn: 'Se unió el {t}', expiresShort: 'Caduca {t}',
    revoke: 'Revocar', revokeTitle: '¿Revocar esta invitación?', revokeBody: 'El enlace deja de funcionar al instante.', keep: 'Mantener', confirmRevoke: 'Revocar', revoking: 'Revocando…',
    invitesEmpty: 'Aún no hay invitaciones', invitesEmptyBody: 'Crea un enlace arriba para invitar a alguien.',
    rewardsEmpty: 'Aún no hay recompensas', rewardsEmptyBody: 'Las recompensas aparecen solo cuando se registran en tu cuenta.',
    kinds: { referral: 'Referido', loyalty: 'Fidelidad', promo: 'Promoción', cashback: 'Reembolso' }, rewardStates: { earned: 'Obtenida', redeemed: 'Canjeada', expired: 'Caducada', revoked: 'Revocada' }, earnedOn: 'Registrada el {t}', amountUnknown: 'Unidad del importe sin confirmar',
    terms: 'Cómo funciona', termsItems: ['Los enlaces son de un solo uso y tienen una caducidad fijada por el servidor.', 'Las recompensas aparecen solo cuando se registran en tu cuenta; nada aquí es una promesa de pago.', 'Invita solo a personas que conoces. No publiques los enlaces.'],
  },
}

const ar: typeof en = {
  security: {
    kicker: 'الأمان', titleA: 'مفاتيح', titleB: 'حسابك', lede: 'طرق تسجيل الدخول والأجهزة الموثوقة والجلسات النشطة — كلها مقروءة من حسابك.',
    card: 'حماية الحساب', levels: ['أساسية', 'محمي', 'قوية', 'محصّن'], levelNote: 'تُحسب من مفاتيح المرور والمصادِق وثقة هذا الجهاز.', progress: '{n} من 3 حمايات مفعّلة',
    stats: { passkeys: 'مفاتيح المرور', authenticator: 'المصادِق', recovery: 'رموز الاسترداد', sessions: 'الجلسات' },
    on: 'مفعّل', off: 'غير مفعّل', next: 'مقترح', open: 'إعداد', allSet: 'الحمايات الثلاث مفعّلة.',
    nextPasskey: 'أضف مفتاح مرور — سجّل الدخول بوجهك أو بصمتك أو رمز الجهاز.', nextTotp: 'فعّل تطبيق مصادقة للإجراءات الحساسة.', nextTrust: 'اجعل هذا الجهاز موثوقًا.',
    tabs: { methods: 'الطرق', devices: 'الأجهزة', sessions: 'الجلسات' },
    passkeys: 'مفاتيح المرور', passkeysNote: 'دخول مقاوم للتصيّد ومرتبط بهذا الموقع.', passkeyAdd: 'إضافة مفتاح مرور', passkeyAdding: 'بانتظار جهازك…', passkeyNone: 'لا يوجد مفتاح مرور بعد.',
    passkeyCreated: 'أضيف في {t}', passkeyUsed: 'آخر استخدام {t}', passkeyNever: 'لم يُستخدم بعد', passkeyAdded: 'تمت إضافة مفتاح المرور.',
    passkeyErrors: { PASSKEY_UNSUPPORTED: 'لا يدعم هذا المتصفح أو الجهاز إنشاء مفاتيح المرور.', PASSKEY_REGISTRATION_CANCELLED: 'أُلغي إعداد مفتاح المرور.', PASSKEY_ALREADY_REGISTERED: 'مفتاح المرور هذا مسجّل مسبقًا.' },
    totp: 'تطبيق المصادقة', totpNote: 'رموز من ستة أرقام لتأكيد السحب وتغييرات الأمان.', totpOn: 'المصادِق مفعّل', totpOff: 'غير مُعد', totpSetup: 'إعداد المصادِق',
    totpActivated: 'فُعّل في {t}', recoveryLeft: 'تبقّى {n} من رموز الاسترداد', recoveryLow: 'تبقّى القليل من رموز الاسترداد — احفظ البقية في مكان آمن.',
    enroll: { title: 'إعداد المصادِق', scan: 'امسح باستخدام تطبيق المصادقة', manual: 'أو أدخل هذا المفتاح', codes: 'رموز الاسترداد', codesNote: 'تُعرض مرة واحدة. كل رمز يعمل مرة واحدة إذا فقدت هاتفك.',
      copyCodes: 'نسخ الرموز', copied: 'تم النسخ', saved: 'حفظت هذه الرموز في مكان آمن', code: 'الرمز من التطبيق', confirm: 'تفعيل', confirming: 'جارٍ التحقق…', cancel: 'إلغاء', done: 'المصادِق مفعّل.', wrongCode: 'الرمز غير مطابق. جرّب أحدث رمز.' },
    remove: 'إزالة', removing: 'جارٍ الإزالة…', removeTitle: 'إزالة هذه الطريقة؟', removeBody: 'ستؤكد أولًا بعامل آخر. يمكنك إضافتها لاحقًا.', keep: 'إبقاء', confirmRemove: 'إزالة', removed: 'تمت الإزالة.',
    devices: 'الأجهزة', devicesNote: 'المتصفحات والهواتف التي سجّلت الدخول.', thisDevice: 'هذا الجهاز', trust: { trusted: 'موثوق', untrusted: 'غير موثوق', revoked: 'أُزيل' },
    firstSeen: 'أول ظهور {t}', lastSeen: 'آخر نشاط {t}', sessionsOn: '{n} جلسات نشطة',
    trustThis: 'الوثوق بهذا الجهاز', trusting: 'جارٍ المعالجة…', trusted: 'أصبح هذا الجهاز موثوقًا.', forget: 'إزالة الجهاز', forgetTitle: 'إزالة هذا الجهاز؟', forgetBody: 'تنتهي جلساته فورًا وسيحتاج إلى تسجيل الدخول مجددًا.',
    sessions: 'الجلسات', sessionsNote: 'حيث أنت مسجّل الدخول الآن.', unknownDevice: 'جهاز غير معروف', signedIn: 'دخول {t}', expires: 'تنتهي {t}', current: 'الحالية',
    signOutHere: 'تسجيل الخروج هنا', signOutHereBody: 'سيتم تسجيل خروجك على هذا الجهاز.', endSession: 'إنهاء', endSessionBody: 'يُسجَّل خروج ذلك الجهاز فورًا.', endOthers: 'تسجيل الخروج من كل مكان آخر', endOthersTitle: 'إنهاء الجلسات الأخرى؟', endOthersBody: 'تنتهي كل الجلسات الآن عدا هذه.',
    ended: 'انتهت الجلسة.', endedOthers: 'انتهت {n} جلسات.', noOthers: 'لا توجد جلسات نشطة أخرى.',
    activity: 'النشاط', activityNote: 'أحدث تغييرات الأمان في حسابك، الأحدث أولًا.', activityTitle: 'لا يوجد نشاط أمني بعد', activityBody: 'ستظهر هنا التغييرات على مفاتيح المرور والمصادق والأجهزة والجلسات.', showAll: 'عرض الكل ({n})', showFewer: 'عرض أقل',
    events: { 'device.revoked': 'أُزيل جهاز', 'device.trusted': 'وُثِّق جهاز', 'passkey.assertion_started': 'طُلب تسجيل الدخول بمفتاح مرور', 'passkey.registered': 'أُضيف مفتاح مرور', 'passkey.registration_started': 'بدأ إعداد مفتاح مرور', 'passkey.revoked': 'أُزيل مفتاح مرور', 'recovery_code.used': 'استُخدم رمز استرداد', 'session.revoked': 'أُنهيت جلسة', 'sessions.revoked_others': 'سُجِّل الخروج من الجلسات الأخرى', 'step_up.completed': 'تم تأكيد الهوية', 'totp.enrolled': 'فُعِّل المصادق', 'totp.enrollment_started': 'بدأ إعداد المصادق', 'totp.revoked': 'أُوقف المصادق' },
    tips: 'ابقَ آمنًا', tipsNote: 'لن نطلب هذه منك أبدًا.', tipItems: ['لا نطلب رموزك أو رموز الاسترداد أو مفتاح المرور عبر الدردشة أو الهاتف أو البريد.', 'طابق الروابط مع قنواتنا الرسمية قبل تسجيل الدخول.', 'أزل الأجهزة التي لم تعد تستخدمها.'], channels: 'القنوات الرسمية',
    actionFailed: 'لم يكتمل الإجراء.', empty: 'لا شيء هنا بعد.',
  },
  referral: {
    kicker: 'دعوة', titleA: 'ادعُ شخصًا', titleB: 'تثق به', lede: 'أنشئ روابط دعوة لمرة واحدة وتابعها هنا. الأرقام من حسابك.',
    card: 'بطاقة الدعوة', stats: { sent: 'المُنشأة', accepted: 'انضموا', pending: 'مفتوحة', earned: 'المكافآت' },
    create: 'دعوة جديدة', createNote: 'كل رابط يعمل مرة واحدة وينتهي.', email: 'بريد صديقك (اختياري)', emailHint: 'لمساعدتك على التعرّف إلى الدعوة فقط؛ لا نرسل بريدًا من هنا.', emailInvalid: 'أدخل بريدًا صالحًا أو اتركه فارغًا.',
    createCta: 'إنشاء رابط دعوة', creating: 'جارٍ الإنشاء…',
    linkTitle: 'رابط دعوتك', linkOnce: 'يظهر الآن فقط — انسخه أو شاركه قبل مغادرة الصفحة.', copy: 'نسخ الرابط', copied: 'تم النسخ', share: 'مشاركة', expiresOn: 'ينتهي {t}', newLink: 'إنشاء آخر', linkFailed: 'تعذّر إنشاء الرابط.',
    tabs: { invites: 'الدعوات', rewards: 'المكافآت' },
    states: { pending: 'مفتوحة', accepted: 'انضم', revoked: 'ملغاة', expired: 'منتهية' }, noEmail: 'دعوة برابط', sentOn: 'أُنشئت {t}', acceptedOn: 'انضم {t}', expiresShort: 'تنتهي {t}',
    revoke: 'إلغاء', revokeTitle: 'إلغاء هذه الدعوة؟', revokeBody: 'يتوقف الرابط عن العمل فورًا.', keep: 'إبقاء', confirmRevoke: 'إلغاء', revoking: 'جارٍ الإلغاء…',
    invitesEmpty: 'لا دعوات بعد', invitesEmptyBody: 'أنشئ رابطًا في الأعلى لدعوة أحدهم.',
    rewardsEmpty: 'لا مكافآت بعد', rewardsEmptyBody: 'تظهر المكافآت فقط بعد تسجيلها في حسابك.',
    kinds: { referral: 'إحالة', loyalty: 'ولاء', promo: 'عرض', cashback: 'استرداد نقدي' }, rewardStates: { earned: 'مكتسبة', redeemed: 'مستخدمة', expired: 'منتهية', revoked: 'ملغاة' }, earnedOn: 'سُجّلت {t}', amountUnknown: 'وحدة المبلغ غير مؤكدة',
    terms: 'كيف يعمل', termsItems: ['روابط الدعوة لاستخدام واحد ولها تاريخ انتهاء يحدده الخادم.', 'تظهر المكافآت فقط بعد تسجيلها في حسابك — لا شيء هنا وعد بالدفع.', 'ادعُ من تعرفهم فقط. لا تنشر الروابط علنًا.'],
  },
}

const fr: typeof en = {
  security: {
    kicker: 'Sécurité', titleA: 'Les clés de', titleB: 'votre compte', lede: 'Méthodes de connexion, appareils de confiance et sessions actives — lus depuis votre compte.',
    card: 'Protection du compte', levels: ['Basique', 'Protégé', 'Solide', 'Renforcé'], levelNote: 'Calculé d’après les clés d’accès, l’authentificateur et la confiance de cet appareil.', progress: '{n} protections sur 3 actives',
    stats: { passkeys: 'Clés d’accès', authenticator: 'Authentificateur', recovery: 'Codes de secours', sessions: 'Sessions' },
    on: 'Activé', off: 'Désactivé', next: 'Recommandé', open: 'Configurer', allSet: 'Les trois protections sont actives.',
    nextPasskey: 'Ajoutez une clé d’accès : connectez-vous avec votre visage, empreinte ou code de l’appareil.', nextTotp: 'Activez une application d’authentification pour les actions sensibles.', nextTrust: 'Marquez cet appareil comme fiable.',
    tabs: { methods: 'Méthodes', devices: 'Appareils', sessions: 'Sessions' },
    passkeys: 'Clés d’accès', passkeysNote: 'Connexion résistante à l’hameçonnage, liée à ce site.', passkeyAdd: 'Ajouter une clé d’accès', passkeyAdding: 'En attente de votre appareil…', passkeyNone: 'Aucune clé d’accès pour l’instant.',
    passkeyCreated: 'Ajoutée le {t}', passkeyUsed: 'Dernière utilisation {t}', passkeyNever: 'Pas encore utilisée', passkeyAdded: 'Clé d’accès ajoutée.',
    passkeyErrors: { PASSKEY_UNSUPPORTED: 'Ce navigateur ou appareil ne peut pas créer de clé d’accès.', PASSKEY_REGISTRATION_CANCELLED: 'La configuration a été annulée.', PASSKEY_ALREADY_REGISTERED: 'Cette clé d’accès est déjà enregistrée.' },
    totp: 'Application d’authentification', totpNote: 'Codes à six chiffres pour confirmer retraits et changements de sécurité.', totpOn: 'Authentificateur actif', totpOff: 'Non configuré', totpSetup: 'Configurer l’authentificateur',
    totpActivated: 'Activé le {t}', recoveryLeft: '{n} codes de secours restants', recoveryLow: 'Peu de codes de secours restants — gardez les autres en lieu sûr.',
    enroll: { title: 'Configurer l’authentificateur', scan: 'Scannez avec votre application', manual: 'Ou saisissez cette clé', codes: 'Codes de secours', codesNote: 'Affichés une seule fois. Chaque code sert une fois si vous perdez votre téléphone.',
      copyCodes: 'Copier les codes', copied: 'Copié', saved: 'J’ai conservé ces codes en lieu sûr', code: 'Code de l’application', confirm: 'Activer', confirming: 'Vérification…', cancel: 'Annuler', done: 'L’authentificateur est actif.', wrongCode: 'Code incorrect. Essayez le plus récent.' },
    remove: 'Retirer', removing: 'Retrait…', removeTitle: 'Retirer cette méthode ?', removeBody: 'Vous confirmerez d’abord avec un autre facteur. Vous pourrez la rajouter ensuite.', keep: 'Conserver', confirmRemove: 'Retirer', removed: 'Retiré.',
    devices: 'Appareils', devicesNote: 'Navigateurs et téléphones connectés.', thisDevice: 'Cet appareil', trust: { trusted: 'Fiable', untrusted: 'Non fiable', revoked: 'Retiré' },
    firstSeen: 'Vu pour la première fois {t}', lastSeen: 'Dernière activité {t}', sessionsOn: '{n} sessions actives',
    trustThis: 'Faire confiance à cet appareil', trusting: 'En cours…', trusted: 'Cet appareil est désormais fiable.', forget: 'Retirer l’appareil', forgetTitle: 'Retirer cet appareil ?', forgetBody: 'Ses sessions prennent fin immédiatement. Il devra se reconnecter.',
    sessions: 'Sessions', sessionsNote: 'Là où vous êtes connecté en ce moment.', unknownDevice: 'Appareil inconnu', signedIn: 'Connexion {t}', expires: 'Expire {t}', current: 'Actuelle',
    signOutHere: 'Se déconnecter ici', signOutHereBody: 'Vous serez déconnecté sur cet appareil.', endSession: 'Fermer', endSessionBody: 'Cet appareil est déconnecté immédiatement.', endOthers: 'Déconnecter partout ailleurs', endOthersTitle: 'Fermer les autres sessions ?', endOthersBody: 'Toutes les sessions sauf celle-ci prennent fin maintenant.',
    ended: 'Session fermée.', endedOthers: '{n} sessions fermées.', noOthers: 'Aucune autre session active.',
    activity: 'Activité', activityNote: 'Changements de sécurité récents sur votre compte, du plus récent au plus ancien.', activityTitle: 'Aucune activité de sécurité pour l’instant', activityBody: 'Les changements de clés d’accès, d’authentificateur, d’appareils et de sessions apparaîtront ici.', showAll: 'Tout afficher ({n})', showFewer: 'Afficher moins',
    events: { 'device.revoked': 'Appareil retiré', 'device.trusted': 'Appareil approuvé', 'passkey.assertion_started': 'Connexion par clé d’accès demandée', 'passkey.registered': 'Clé d’accès ajoutée', 'passkey.registration_started': 'Configuration de clé d’accès commencée', 'passkey.revoked': 'Clé d’accès retirée', 'recovery_code.used': 'Code de récupération utilisé', 'session.revoked': 'Session fermée', 'sessions.revoked_others': 'Autres sessions déconnectées', 'step_up.completed': 'Identité confirmée', 'totp.enrolled': 'Authentificateur activé', 'totp.enrollment_started': 'Configuration de l’authentificateur commencée', 'totp.revoked': 'Authentificateur désactivé' },
    tips: 'Restez protégé', tipsNote: 'Nous ne vous demanderons jamais ceci.', tipItems: ['Nous ne demandons jamais vos codes, codes de secours ou clé d’accès par chat, téléphone ou e-mail.', 'Vérifiez les liens auprès de nos canaux officiels avant de vous connecter.', 'Retirez les appareils que vous n’utilisez plus.'], channels: 'Canaux officiels',
    actionFailed: 'L’action n’a pas abouti.', empty: 'Rien pour l’instant.',
  },
  referral: {
    kicker: 'Inviter', titleA: 'Invitez une personne', titleB: 'de confiance', lede: 'Créez des liens d’invitation à usage unique et suivez-les ici. Les chiffres viennent de votre compte.',
    card: 'Pass d’invitation', stats: { sent: 'Créées', accepted: 'Inscrits', pending: 'Ouvertes', earned: 'Récompenses' },
    create: 'Nouvelle invitation', createNote: 'Chaque lien fonctionne une fois et expire.', email: 'E-mail de votre proche (facultatif)', emailHint: 'Seulement pour reconnaître l’invitation ; aucun e-mail n’est envoyé d’ici.', emailInvalid: 'Saisissez un e-mail valide ou laissez vide.',
    createCta: 'Créer un lien d’invitation', creating: 'Création…',
    linkTitle: 'Votre lien d’invitation', linkOnce: 'Affiché maintenant seulement — copiez-le ou partagez-le avant de quitter la page.', copy: 'Copier le lien', copied: 'Copié', share: 'Partager', expiresOn: 'Expire le {t}', newLink: 'En créer un autre', linkFailed: 'Impossible de créer le lien.',
    tabs: { invites: 'Invitations', rewards: 'Récompenses' },
    states: { pending: 'Ouverte', accepted: 'Inscrit', revoked: 'Révoquée', expired: 'Expirée' }, noEmail: 'Invitation par lien', sentOn: 'Créée le {t}', acceptedOn: 'Inscrit le {t}', expiresShort: 'Expire {t}',
    revoke: 'Révoquer', revokeTitle: 'Révoquer cette invitation ?', revokeBody: 'Le lien cesse de fonctionner immédiatement.', keep: 'Conserver', confirmRevoke: 'Révoquer', revoking: 'Révocation…',
    invitesEmpty: 'Aucune invitation', invitesEmptyBody: 'Créez un lien ci-dessus pour inviter quelqu’un.',
    rewardsEmpty: 'Aucune récompense', rewardsEmptyBody: 'Les récompenses n’apparaissent qu’une fois enregistrées sur votre compte.',
    kinds: { referral: 'Parrainage', loyalty: 'Fidélité', promo: 'Promotion', cashback: 'Remboursement' }, rewardStates: { earned: 'Obtenue', redeemed: 'Utilisée', expired: 'Expirée', revoked: 'Révoquée' }, earnedOn: 'Enregistrée le {t}', amountUnknown: 'Unité du montant non confirmée',
    terms: 'Fonctionnement', termsItems: ['Les liens sont à usage unique et ont une date d’expiration fixée par le serveur.', 'Les récompenses n’apparaissent qu’une fois enregistrées sur votre compte — rien ici n’est une promesse de paiement.', 'N’invitez que des personnes que vous connaissez. Ne publiez pas les liens.'],
  },
}

const pt: typeof en = {
  security: {
    kicker: 'Segurança', titleA: 'As chaves da', titleB: 'sua conta', lede: 'Métodos de acesso, dispositivos confiáveis e sessões ativas — lidos da sua conta.',
    card: 'Proteção da conta', levels: ['Básica', 'Protegida', 'Forte', 'Blindada'], levelNote: 'Calculada a partir de chaves de acesso, autenticador e confiança deste aparelho.', progress: '{n} de 3 proteções ativas',
    stats: { passkeys: 'Chaves de acesso', authenticator: 'Autenticador', recovery: 'Códigos de recuperação', sessions: 'Sessões' },
    on: 'Ativo', off: 'Inativo', next: 'Recomendado', open: 'Configurar', allSet: 'As três proteções estão ativas.',
    nextPasskey: 'Adicione uma chave de acesso — entre com rosto, digital ou PIN do aparelho.', nextTotp: 'Ative um app autenticador para ações sensíveis.', nextTrust: 'Marque este aparelho como confiável.',
    tabs: { methods: 'Métodos', devices: 'Aparelhos', sessions: 'Sessões' },
    passkeys: 'Chaves de acesso', passkeysNote: 'Acesso resistente a phishing, vinculado a este site.', passkeyAdd: 'Adicionar chave de acesso', passkeyAdding: 'Aguardando seu aparelho…', passkeyNone: 'Nenhuma chave de acesso ainda.',
    passkeyCreated: 'Adicionada em {t}', passkeyUsed: 'Último uso {t}', passkeyNever: 'Ainda não usada', passkeyAdded: 'Chave de acesso adicionada.',
    passkeyErrors: { PASSKEY_UNSUPPORTED: 'Este navegador ou aparelho não cria chaves de acesso.', PASSKEY_REGISTRATION_CANCELLED: 'A configuração foi cancelada.', PASSKEY_ALREADY_REGISTERED: 'Esta chave já está registrada.' },
    totp: 'App autenticador', totpNote: 'Códigos de seis dígitos para confirmar saques e mudanças de segurança.', totpOn: 'Autenticador ativo', totpOff: 'Não configurado', totpSetup: 'Configurar autenticador',
    totpActivated: 'Ativado em {t}', recoveryLeft: '{n} códigos de recuperação restantes', recoveryLow: 'Poucos códigos restantes — guarde os demais em local seguro.',
    enroll: { title: 'Configure seu autenticador', scan: 'Escaneie com seu app autenticador', manual: 'Ou digite esta chave', codes: 'Códigos de recuperação', codesNote: 'Exibidos uma única vez. Cada código funciona uma vez se você perder o celular.',
      copyCodes: 'Copiar códigos', copied: 'Copiado', saved: 'Guardei estes códigos em local seguro', code: 'Código do app', confirm: 'Ativar', confirming: 'Verificando…', cancel: 'Cancelar', done: 'O autenticador está ativo.', wrongCode: 'O código não confere. Use o mais recente.' },
    remove: 'Remover', removing: 'Removendo…', removeTitle: 'Remover este método?', removeBody: 'Você confirmará antes com outro fator. Pode adicioná-lo de novo depois.', keep: 'Manter', confirmRemove: 'Remover', removed: 'Removido.',
    devices: 'Aparelhos', devicesNote: 'Navegadores e celulares que entraram na conta.', thisDevice: 'Este aparelho', trust: { trusted: 'Confiável', untrusted: 'Não confiável', revoked: 'Removido' },
    firstSeen: 'Visto pela primeira vez {t}', lastSeen: 'Última atividade {t}', sessionsOn: '{n} sessões ativas',
    trustThis: 'Confiar neste aparelho', trusting: 'Processando…', trusted: 'Este aparelho agora é confiável.', forget: 'Remover aparelho', forgetTitle: 'Remover este aparelho?', forgetBody: 'As sessões dele terminam na hora. Será preciso entrar de novo.',
    sessions: 'Sessões', sessionsNote: 'Onde você está conectado agora.', unknownDevice: 'Aparelho desconhecido', signedIn: 'Entrada {t}', expires: 'Expira {t}', current: 'Atual',
    signOutHere: 'Sair aqui', signOutHereBody: 'Você sairá da conta neste aparelho.', endSession: 'Encerrar', endSessionBody: 'Esse aparelho sai da conta na hora.', endOthers: 'Sair de todos os outros', endOthersTitle: 'Encerrar outras sessões?', endOthersBody: 'Todas as sessões, exceto esta, terminam agora.',
    ended: 'Sessão encerrada.', endedOthers: '{n} sessões encerradas.', noOthers: 'Nenhuma outra sessão ativa.',
    activity: 'Atividade', activityNote: 'Alterações de segurança recentes na sua conta, das mais novas às mais antigas.', activityTitle: 'Ainda não há atividade de segurança', activityBody: 'Alterações em chaves de acesso, autenticador, dispositivos e sessões aparecerão aqui.', showAll: 'Mostrar todas ({n})', showFewer: 'Mostrar menos',
    events: { 'device.revoked': 'Dispositivo removido', 'device.trusted': 'Dispositivo confiável', 'passkey.assertion_started': 'Entrada com chave de acesso solicitada', 'passkey.registered': 'Chave de acesso adicionada', 'passkey.registration_started': 'Configuração de chave de acesso iniciada', 'passkey.revoked': 'Chave de acesso removida', 'recovery_code.used': 'Código de recuperação usado', 'session.revoked': 'Sessão encerrada', 'sessions.revoked_others': 'Outras sessões encerradas', 'step_up.completed': 'Identidade confirmada', 'totp.enrolled': 'Autenticador ativado', 'totp.enrollment_started': 'Configuração do autenticador iniciada', 'totp.revoked': 'Autenticador desativado' },
    tips: 'Fique seguro', tipsNote: 'Nunca pediremos isto.', tipItems: ['Nunca pedimos seus códigos, códigos de recuperação ou chave de acesso por chat, telefone ou e-mail.', 'Confira os links nos nossos canais oficiais antes de entrar.', 'Remova aparelhos que você não usa mais.'], channels: 'Canais oficiais',
    actionFailed: 'Não foi possível concluir.', empty: 'Nada aqui ainda.',
  },
  referral: {
    kicker: 'Convidar', titleA: 'Convide alguém', titleB: 'de confiança', lede: 'Crie links de convite de uso único e acompanhe-os aqui. Os números vêm da sua conta.',
    card: 'Passe de convite', stats: { sent: 'Criados', accepted: 'Entraram', pending: 'Abertos', earned: 'Recompensas' },
    create: 'Novo convite', createNote: 'Cada link funciona uma vez e expira.', email: 'E-mail do seu contato (opcional)', emailHint: 'Só para você reconhecer o convite; não enviamos e-mails daqui.', emailInvalid: 'Digite um e-mail válido ou deixe em branco.',
    createCta: 'Criar link de convite', creating: 'Criando…',
    linkTitle: 'Seu link de convite', linkOnce: 'Exibido só agora — copie ou compartilhe antes de sair da página.', copy: 'Copiar link', copied: 'Copiado', share: 'Compartilhar', expiresOn: 'Expira em {t}', newLink: 'Criar outro', linkFailed: 'Não foi possível criar o link.',
    tabs: { invites: 'Convites', rewards: 'Recompensas' },
    states: { pending: 'Aberto', accepted: 'Entrou', revoked: 'Revogado', expired: 'Expirado' }, noEmail: 'Convite por link', sentOn: 'Criado em {t}', acceptedOn: 'Entrou em {t}', expiresShort: 'Expira {t}',
    revoke: 'Revogar', revokeTitle: 'Revogar este convite?', revokeBody: 'O link para de funcionar na hora.', keep: 'Manter', confirmRevoke: 'Revogar', revoking: 'Revogando…',
    invitesEmpty: 'Nenhum convite ainda', invitesEmptyBody: 'Crie um link acima para convidar alguém.',
    rewardsEmpty: 'Nenhuma recompensa ainda', rewardsEmptyBody: 'As recompensas só aparecem depois de registradas na sua conta.',
    kinds: { referral: 'Indicação', loyalty: 'Fidelidade', promo: 'Promoção', cashback: 'Cashback' }, rewardStates: { earned: 'Obtida', redeemed: 'Resgatada', expired: 'Expirada', revoked: 'Revogada' }, earnedOn: 'Registrada em {t}', amountUnknown: 'Unidade do valor não confirmada',
    terms: 'Como funciona', termsItems: ['Os links são de uso único e têm validade definida pelo servidor.', 'As recompensas só aparecem depois de registradas na sua conta — nada aqui é promessa de pagamento.', 'Convide apenas pessoas que você conhece. Não publique os links.'],
  },
}

export const securityCopy: Record<AppLocale, SecurityCopy> = { en: en.security, 'zh-CN': zh.security, hi: hi.security, es: es.security, ar: ar.security, fr: fr.security, pt: pt.security }
export const referralCopy: Record<AppLocale, ReferralCopy> = { en: en.referral, 'zh-CN': zh.referral, hi: hi.referral, es: es.referral, ar: ar.referral, fr: fr.referral, pt: pt.referral }
