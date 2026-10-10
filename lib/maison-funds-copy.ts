import type { AppLocale } from '@/lib/app-locales'

/** Money-out copy: step-up sheet, /assets/cash/withdraw, /assets/cash/transfer, /assets/cash/address-book. `{x}` tokens go through fill(). */
export type FundsCopy = {
  stepUp: {
    title: string; body: string; totp: string; recovery: string; passkey: string; totpLabel: string; recoveryLabel: string; passkeyBody: string; passkeyCta: string
    verify: string; verifying: string; cancel: string; noFactors: string; noFactorsBody: string; openSecurity: string; loadError: string
    required: string; waived: string
  }
  errors: Record<string, string>
  common: {
    available: string; amount: string; max: string; min: string; network: string; confirm: string; submitting: string; reference: string; state: string
    replay: string; activity: string; cash: string; again: string; stubNote: string; after: string; fee: string; cancelled: string; done: string; more: string
  }
  withdraw: {
    kicker: string; title: string; destination: string; saved: string; manual: string; bookEmpty: string; manageBook: string; address: string; addressInvalid: string
    bookRequired: string; usableFrom: string; review: string; total: string; insufficient: string; quoting: string; quoteError: string; indicative: string
    consent: string; submit: string; done: string; reason: string; reasons: Record<string, string>; to: string
  }
  transfer: {
    kicker: string; title: string; recipient: string; recipientHint: string; recipientInvalid: string; self: string; feeValue: string
    consent: string; submit: string; done: string; to: string; myCode: string; paste: string; pasteFailed: string
    /** `idTail` takes `{d}` = the recipient id's last 4 characters, appended to the consent line. */
    scan: string; idTail: string
  }
  receive: {
    kicker: string; title: string; lede: string; qr: string; idLabel: string; copy: string; copied: string; share: string; shareText: string
    note: string; safety: string; unavailable: string; signIn: string; transfer: string; action: string; scope: string
  }
  book: {
    kicker: string; title: string; note: string; add: string; label: string; labelHint: string; address: string; save: string; saving: string
    states: Record<string, string>; risk: Record<string, string>; usableFrom: string; revoke: string; revokeConfirm: string; revoking: string
    empty: string; emptyBody: string; saved: string; revoked: string; showRevoked: string; hideRevoked: string; loadError: string; close: string; labelRequired: string
  }
}

const en: FundsCopy = {
  stepUp: {
    title: 'Confirm it’s you', body: 'Verify to continue.',
    totp: 'Authenticator', recovery: 'Recovery code', passkey: 'Passkey', totpLabel: '6-digit code', recoveryLabel: 'Recovery code', passkeyBody: 'Use the passkey saved on this device.', passkeyCta: 'Use passkey',
    verify: 'Verify', verifying: 'Verifying…', cancel: 'Cancel', noFactors: 'No security factor yet', noFactorsBody: 'Set up a passkey or authenticator app first.', openSecurity: 'Open security settings', loadError: 'Could not load your security factors',
    required: 'Requires a fresh security check', waived: 'Local demo: the server waives the security check',
  },
  errors: {
    STEP_UP_REQUIRED: 'A fresh security check is required.', TOTP_INVALID: 'That code is not valid. Enter the latest one.', TOTP_NOT_CONFIGURED: 'No authenticator app is set up.',
    PASSKEY_NOT_FOUND: 'No active passkey on this account.', PASSKEY_VERIFICATION_FAILED: 'Passkey verification failed.', PASSKEY_CHALLENGE_INVALID: 'The passkey request expired. Try again.', PASSKEY_UNSUPPORTED: 'Passkeys are not supported on this browser.', PASSKEY_CANCELLED: 'Passkey check was cancelled.',
    WALLET_INSUFFICIENT_BALANCE: 'Available balance does not cover amount + fee.', WALLET_AMOUNT_BELOW_MINIMUM: 'Amount is below the network minimum.', WALLET_AMOUNT_INVALID: 'Enter a valid amount.',
    WALLET_ADDRESS_INVALID: 'The address is not valid for this network.', WALLET_ADDRESS_BOOK_REQUIRED: 'This environment requires a saved, screened address.', WALLET_ADDRESS_COOLDOWN_ACTIVE: 'This address is still cooling down.',
    WALLET_ADDRESS_REVIEW_REQUIRED: 'This address has not passed screening yet.', WALLET_ADDRESS_NOT_FOUND: 'Saved address not found.', WALLET_DEVICE_NOT_ELIGIBLE: 'Withdrawals need a trusted device older than the cooldown.',
    WALLET_EXECUTION_DISABLED: 'Withdrawals are paused right now.', WALLET_UNAVAILABLE: 'Wallet service is unavailable.', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: 'Above the per-transaction limit.', WALLET_DAILY_LIMIT_EXCEEDED: 'Above the daily limit.',
    WALLET_CALLBACK_PAYLOAD_INVALID: 'The request was rejected. Check the recipient.', NETWORK_ERROR: 'Network unavailable. Nothing was sent — try again.',
  },
  common: {
    available: 'Available {v}', amount: 'Amount', max: 'MAX', min: 'Min {v}', network: 'Network', confirm: 'Confirm', submitting: 'Submitting…', reference: 'Reference', state: 'State',
    replay: 'Already submitted — showing the original request.', activity: 'View activity', cash: 'Back to cash', again: 'New request', stubNote: 'Stub custodian: nothing is broadcast on-chain.', after: 'Available after', fee: 'Fee', cancelled: 'Security check cancelled — nothing was sent.', done: 'Done', more: 'More info',
  },
  withdraw: {
    kicker: 'Withdraw', title: 'Withdraw USDT', destination: 'Destination', saved: 'Saved', manual: 'New address', bookEmpty: 'No saved address on {n}.', manageBook: 'Manage address book', address: 'Address on {n}', addressInvalid: 'Not a valid {n} address.',
    bookRequired: 'Only saved, screened addresses can be used here.', usableFrom: 'Usable from {t}', review: 'Screening', total: 'Total debit', insufficient: 'Available balance does not cover amount + fee.', quoting: 'Quoting…', quoteError: 'Quote unavailable', indicative: 'Server quote · re-checked on submit',
    consent: 'I checked the network and address. Funds sent to a wrong address cannot be recovered.', submit: 'Request withdrawal', done: 'Withdrawal requested', reasons: { custody_partner_not_configured: 'Screening pending — test custodian not connected' }, reason: 'Note', to: 'To',
  },
  transfer: {
    kicker: 'Internal transfer', title: 'Transfer USDT', recipient: 'Recipient user ID', recipientHint: 'The recipient’s account ID (UUID). Internal transfers post instantly.', recipientInvalid: 'Enter a valid user ID (UUID).', self: 'You cannot transfer to yourself.', feeValue: 'None',
    consent: 'I confirmed the recipient ID. Posted transfers cannot be undone by me.', submit: 'Send transfer', done: 'Transfer posted', to: 'Recipient',
    myCode: 'My receive code', paste: 'Paste', pasteFailed: 'Clipboard unavailable — paste into the field.', scan: 'Scan receive code', idTail: 'The recipient ID ends in {d}.',
  },
  receive: {
    kicker: 'Receive', title: 'Internal receive', lede: 'Internal transfers between accounts post instantly and carry no fee.', qr: 'Scan to transfer to this account', idLabel: 'Your user ID', copy: 'Copy ID', copied: 'Copied', share: 'Share', shareText: 'Send me USDT on A-REIT', note: 'Others scan this code, or paste your user ID on their transfer screen, to send you USDT.', safety: 'Share only your user ID. We never ask for passwords, codes or keys.', unavailable: 'Sign in to see your receive code.', signIn: 'Sign in', transfer: 'Send a transfer', action: 'Receive', scope: 'Internal accounts only. Not an on-chain deposit address.',
  },
  book: {
    kicker: 'Security', title: 'Address book', note: 'New addresses are screened and become usable after a {h}-hour cooldown.', add: 'Add address', label: 'Label', labelHint: 'e.g. Cold wallet', address: 'Address', save: 'Save address', saving: 'Saving…',
    states: { active: 'Active', pending: 'Cooling down', revoked: 'Revoked' }, risk: { clear: 'Screened', manual_review: 'In review', blocked: 'Blocked' }, usableFrom: 'Usable from {t}', revoke: 'Revoke', revokeConfirm: 'Confirm revoke', revoking: 'Revoking…',
    empty: 'No saved addresses', emptyBody: 'Save a screened destination to withdraw faster and safer.', saved: 'Address saved · usable from {t}', revoked: 'Address revoked', showRevoked: 'Show revoked ({n})', hideRevoked: 'Hide revoked', loadError: 'Could not load the address book', close: 'Close', labelRequired: 'Add a label.',
  },
}

const zh: FundsCopy = {
  stepUp: {
    title: '确认是你本人', body: '验证后继续。',
    totp: '验证器', recovery: '恢复码', passkey: '通行密钥', totpLabel: '6 位验证码', recoveryLabel: '恢复码', passkeyBody: '使用保存在本设备上的通行密钥。', passkeyCta: '使用通行密钥',
    verify: '验证', verifying: '验证中…', cancel: '取消', noFactors: '尚未设置安全因子', noFactorsBody: '请先绑定 Passkey 或动态验证码。', openSecurity: '前往安全设置', loadError: '无法加载安全因子',
    required: '需要重新进行安全验证', waived: '本地演示：服务端已豁免安全验证',
  },
  errors: {
    STEP_UP_REQUIRED: '需要重新进行安全验证。', TOTP_INVALID: '验证码无效，请输入最新的验证码。', TOTP_NOT_CONFIGURED: '尚未设置验证器应用。',
    PASSKEY_NOT_FOUND: '此账户没有可用的通行密钥。', PASSKEY_VERIFICATION_FAILED: '通行密钥验证失败。', PASSKEY_CHALLENGE_INVALID: '通行密钥请求已过期，请重试。', PASSKEY_UNSUPPORTED: '此浏览器不支持通行密钥。', PASSKEY_CANCELLED: '已取消通行密钥验证。',
    WALLET_INSUFFICIENT_BALANCE: '可用余额不足以支付金额与手续费。', WALLET_AMOUNT_BELOW_MINIMUM: '金额低于该网络最低限额。', WALLET_AMOUNT_INVALID: '请输入有效金额。',
    WALLET_ADDRESS_INVALID: '该地址不适用于此网络。', WALLET_ADDRESS_BOOK_REQUIRED: '当前环境仅允许使用已保存并通过筛查的地址。', WALLET_ADDRESS_COOLDOWN_ACTIVE: '该地址仍在冷却期内。',
    WALLET_ADDRESS_REVIEW_REQUIRED: '该地址尚未通过筛查。', WALLET_ADDRESS_NOT_FOUND: '未找到已保存的地址。', WALLET_DEVICE_NOT_ELIGIBLE: '提现需要使用超过冷却期的受信任设备。',
    WALLET_EXECUTION_DISABLED: '提现暂时暂停。', WALLET_UNAVAILABLE: '钱包服务不可用。', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: '超过单笔限额。', WALLET_DAILY_LIMIT_EXCEEDED: '超过每日限额。',
    WALLET_CALLBACK_PAYLOAD_INVALID: '请求被拒绝，请检查收款人。', NETWORK_ERROR: '网络不可用，未发送任何请求，请重试。',
  },
  common: {
    available: '可用 {v}', amount: '金额', max: '最大', min: '最低 {v}', network: '网络', confirm: '确认', submitting: '提交中…', reference: '编号', state: '状态',
    replay: '此前已提交，显示的是原始请求。', activity: '查看流水', cash: '返回现金', again: '再发起一笔', stubNote: '模拟托管：不会在链上广播。', after: '操作后可用', fee: '手续费', cancelled: '已取消安全验证，未发送任何请求。', done: '完成', more: '更多信息',
  },
  withdraw: {
    kicker: '提现', title: '提现 USDT', destination: '收款地址', saved: '已保存', manual: '新地址', bookEmpty: '{n} 上没有已保存的地址。', manageBook: '管理地址簿', address: '{n} 地址', addressInvalid: '不是有效的 {n} 地址。',
    bookRequired: '此处只能使用已保存并通过筛查的地址。', usableFrom: '{t} 起可用', review: '筛查', total: '合计扣款', insufficient: '可用余额不足以支付金额与手续费。', quoting: '报价中…', quoteError: '报价不可用', indicative: '服务端报价 · 提交时重新校验',
    consent: '我已核对网络和地址。转入错误地址的资金无法找回。', submit: '申请提现', done: '提现已申请', reasons: { custody_partner_not_configured: '待筛查——测试托管未接入' }, reason: '说明', to: '收款地址',
  },
  transfer: {
    kicker: '内部转账', title: '转账 USDT', recipient: '收款人用户 ID', recipientHint: '收款人的账户 ID（UUID）。内部转账即时入账。', recipientInvalid: '请输入有效的用户 ID（UUID）。', self: '不能转账给自己。', feeValue: '无',
    consent: '我已核对收款人 ID。已入账的转账无法由我撤回。', submit: '发送转账', done: '转账已入账', to: '收款人',
    myCode: '我的收款码', paste: '粘贴', pasteFailed: '无法读取剪贴板，请长按输入框粘贴。', scan: '扫描收款码', idTail: '收款 ID 末 4 位是 {d}。',
  },
  receive: {
    kicker: '收款', title: '站内收款', lede: '账户间内部转账即时入账，不收手续费。', qr: '扫码向此账户转账', idLabel: '你的用户 ID', copy: '复制 ID', copied: '已复制', share: '分享', shareText: '在 A-REIT 向我转账 USDT', note: '对方扫描此码，或在转账页粘贴你的用户 ID，即可向你转账。', safety: '只需分享用户 ID。我们不会索要密码、验证码或私钥。', unavailable: '登录后查看你的收款码。', signIn: '登录', transfer: '去转账', action: '收款', scope: '仅限站内账户，不是链上充值地址。',
  },
  book: {
    kicker: '安全', title: '地址簿', note: '新地址需经过筛查，并在 {h} 小时冷却期后才能使用。', add: '添加地址', label: '备注名', labelHint: '例如：冷钱包', address: '地址', save: '保存地址', saving: '保存中…',
    states: { active: '可用', pending: '冷却中', revoked: '已撤销' }, risk: { clear: '已筛查', manual_review: '审核中', blocked: '已拦截' }, usableFrom: '{t} 起可用', revoke: '撤销', revokeConfirm: '确认撤销', revoking: '撤销中…',
    empty: '暂无已保存地址', emptyBody: '保存经过筛查的收款地址，提现更快更安全。', saved: '地址已保存 · {t} 起可用', revoked: '地址已撤销', showRevoked: '显示已撤销（{n}）', hideRevoked: '隐藏已撤销', loadError: '无法加载地址簿', close: '关闭', labelRequired: '请填写备注名。',
  },
}

const hi: FundsCopy = {
  stepUp: {
    title: 'पुष्टि करें कि यह आप हैं', body: 'जारी रखने के लिए सत्यापित करें।',
    totp: 'ऑथेंटिकेटर', recovery: 'रिकवरी कोड', passkey: 'पासकी', totpLabel: '6 अंकों का कोड', recoveryLabel: 'रिकवरी कोड', passkeyBody: 'इस डिवाइस पर सहेजी गई पासकी का उपयोग करें।', passkeyCta: 'पासकी का उपयोग करें',
    verify: 'सत्यापित करें', verifying: 'सत्यापित हो रहा है…', cancel: 'रद्द करें', noFactors: 'अभी कोई सुरक्षा फ़ैक्टर नहीं', noFactorsBody: 'पहले पासकी या ऑथेंटिकेटर ऐप सेट करें।', openSecurity: 'सुरक्षा सेटिंग खोलें', loadError: 'सुरक्षा फ़ैक्टर लोड नहीं हो सके',
    required: 'नई सुरक्षा जाँच आवश्यक', waived: 'लोकल डेमो: सर्वर सुरक्षा जाँच माफ़ करता है',
  },
  errors: {
    STEP_UP_REQUIRED: 'नई सुरक्षा जाँच आवश्यक है।', TOTP_INVALID: 'कोड मान्य नहीं है। नवीनतम कोड दर्ज करें।', TOTP_NOT_CONFIGURED: 'कोई ऑथेंटिकेटर ऐप सेट नहीं है।',
    PASSKEY_NOT_FOUND: 'इस खाते में कोई सक्रिय पासकी नहीं है।', PASSKEY_VERIFICATION_FAILED: 'पासकी सत्यापन विफल रहा।', PASSKEY_CHALLENGE_INVALID: 'पासकी अनुरोध की समय-सीमा समाप्त हो गई। फिर से प्रयास करें।', PASSKEY_UNSUPPORTED: 'यह ब्राउज़र पासकी का समर्थन नहीं करता।', PASSKEY_CANCELLED: 'पासकी जाँच रद्द कर दी गई।',
    WALLET_INSUFFICIENT_BALANCE: 'उपलब्ध शेष राशि और शुल्क को कवर नहीं करता।', WALLET_AMOUNT_BELOW_MINIMUM: 'राशि नेटवर्क न्यूनतम से कम है।', WALLET_AMOUNT_INVALID: 'मान्य राशि दर्ज करें।',
    WALLET_ADDRESS_INVALID: 'यह पता इस नेटवर्क के लिए मान्य नहीं है।', WALLET_ADDRESS_BOOK_REQUIRED: 'इस वातावरण में सहेजा और जाँचा गया पता आवश्यक है।', WALLET_ADDRESS_COOLDOWN_ACTIVE: 'यह पता अभी कूलडाउन में है।',
    WALLET_ADDRESS_REVIEW_REQUIRED: 'यह पता अभी जाँच में पास नहीं हुआ है।', WALLET_ADDRESS_NOT_FOUND: 'सहेजा गया पता नहीं मिला।', WALLET_DEVICE_NOT_ELIGIBLE: 'निकासी के लिए कूलडाउन से पुराना विश्वसनीय डिवाइस चाहिए।',
    WALLET_EXECUTION_DISABLED: 'निकासी अभी रोकी गई है।', WALLET_UNAVAILABLE: 'वॉलेट सेवा उपलब्ध नहीं है।', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: 'प्रति लेनदेन सीमा से अधिक।', WALLET_DAILY_LIMIT_EXCEEDED: 'दैनिक सीमा से अधिक।',
    WALLET_CALLBACK_PAYLOAD_INVALID: 'अनुरोध अस्वीकार हुआ। प्राप्तकर्ता जाँचें।', NETWORK_ERROR: 'नेटवर्क उपलब्ध नहीं। कुछ नहीं भेजा गया — फिर से प्रयास करें।',
  },
  common: {
    available: 'उपलब्ध {v}', amount: 'राशि', max: 'MAX', min: 'न्यूनतम {v}', network: 'नेटवर्क', confirm: 'पुष्टि करें', submitting: 'सबमिट हो रहा है…', reference: 'संदर्भ', state: 'स्थिति',
    replay: 'पहले ही सबमिट किया गया — मूल अनुरोध दिखाया जा रहा है।', activity: 'गतिविधि देखें', cash: 'कैश पर वापस', again: 'नया अनुरोध', stubNote: 'स्टब कस्टोडियन: ऑन-चेन कुछ भी प्रसारित नहीं होता।', after: 'बाद में उपलब्ध', fee: 'शुल्क', cancelled: 'सुरक्षा जाँच रद्द — कुछ नहीं भेजा गया।', done: 'हो गया', more: 'अधिक जानकारी',
  },
  withdraw: {
    kicker: 'निकासी', title: 'USDT निकालें', destination: 'गंतव्य', saved: 'सहेजे गए', manual: 'नया पता', bookEmpty: '{n} पर कोई सहेजा गया पता नहीं।', manageBook: 'पता पुस्तिका प्रबंधित करें', address: '{n} पर पता', addressInvalid: 'मान्य {n} पता नहीं।',
    bookRequired: 'यहाँ केवल सहेजे और जाँचे गए पते उपयोग हो सकते हैं।', usableFrom: '{t} से उपयोग योग्य', review: 'जाँच', total: 'कुल डेबिट', insufficient: 'उपलब्ध शेष राशि और शुल्क को कवर नहीं करता।', quoting: 'कोट हो रहा है…', quoteError: 'कोट उपलब्ध नहीं', indicative: 'सर्वर कोट · सबमिट पर फिर जाँचा जाता है',
    consent: 'मैंने नेटवर्क और पता जाँच लिया है। गलत पते पर भेजा गया फंड वापस नहीं मिल सकता।', submit: 'निकासी का अनुरोध करें', done: 'निकासी अनुरोधित', reasons: { custody_partner_not_configured: 'स्क्रीनिंग लंबित — टेस्ट कस्टोडियन जुड़ा नहीं' }, reason: 'नोट', to: 'को',
  },
  transfer: {
    kicker: 'आंतरिक ट्रांसफ़र', title: 'USDT ट्रांसफ़र करें', recipient: 'प्राप्तकर्ता यूज़र ID', recipientHint: 'प्राप्तकर्ता की खाता ID (UUID)। आंतरिक ट्रांसफ़र तुरंत पोस्ट होते हैं।', recipientInvalid: 'मान्य यूज़र ID (UUID) दर्ज करें।', self: 'आप स्वयं को ट्रांसफ़र नहीं कर सकते।', feeValue: 'कोई नहीं',
    consent: 'मैंने प्राप्तकर्ता ID की पुष्टि कर ली है। पोस्ट हुए ट्रांसफ़र मैं वापस नहीं ले सकता।', submit: 'ट्रांसफ़र भेजें', done: 'ट्रांसफ़र पोस्ट हुआ', to: 'प्राप्तकर्ता',
    myCode: 'मेरा रिसीव कोड', paste: 'पेस्ट', pasteFailed: 'क्लिपबोर्ड उपलब्ध नहीं — फ़ील्ड में पेस्ट करें।', scan: 'रिसीव कोड स्कैन करें', idTail: 'प्राप्तकर्ता ID के अंतिम 4 अक्षर {d} हैं।',
  },
  receive: {
    kicker: 'प्राप्त करें', title: 'आंतरिक प्राप्ति', lede: 'खातों के बीच आंतरिक ट्रांसफ़र तुरंत पोस्ट होते हैं, कोई शुल्क नहीं।', qr: 'इस खाते में ट्रांसफ़र के लिए स्कैन करें', idLabel: 'आपकी यूज़र ID', copy: 'ID कॉपी करें', copied: 'कॉपी हुआ', share: 'शेयर करें', shareText: 'A-REIT पर मुझे USDT भेजें', note: 'दूसरे यह कोड स्कैन करें, या अपनी ट्रांसफ़र स्क्रीन पर आपकी यूज़र ID पेस्ट करें।', safety: 'केवल यूज़र ID साझा करें। हम कभी पासवर्ड, कोड या कुंजी नहीं माँगते।', unavailable: 'अपना रिसीव कोड देखने के लिए साइन इन करें।', signIn: 'साइन इन', transfer: 'ट्रांसफ़र भेजें', action: 'प्राप्त करें', scope: 'केवल ऐप के भीतर के खाते। यह ऑन-चेन जमा पता नहीं है।',
  },
  book: {
    kicker: 'सुरक्षा', title: 'पता पुस्तिका', note: 'नए पते जाँचे जाते हैं और {h} घंटे के कूलडाउन के बाद उपयोग योग्य होते हैं।', add: 'पता जोड़ें', label: 'लेबल', labelHint: 'जैसे कोल्ड वॉलेट', address: 'पता', save: 'पता सहेजें', saving: 'सहेजा जा रहा है…',
    states: { active: 'सक्रिय', pending: 'कूलडाउन में', revoked: 'रद्द' }, risk: { clear: 'जाँचा गया', manual_review: 'समीक्षा में', blocked: 'अवरुद्ध' }, usableFrom: '{t} से उपयोग योग्य', revoke: 'रद्द करें', revokeConfirm: 'रद्द करने की पुष्टि करें', revoking: 'रद्द हो रहा है…',
    empty: 'कोई सहेजा गया पता नहीं', emptyBody: 'तेज़ और सुरक्षित निकासी के लिए जाँचा गया गंतव्य सहेजें।', saved: 'पता सहेजा गया · {t} से उपयोग योग्य', revoked: 'पता रद्द किया गया', showRevoked: 'रद्द दिखाएँ ({n})', hideRevoked: 'रद्द छिपाएँ', loadError: 'पता पुस्तिका लोड नहीं हो सकी', close: 'बंद करें', labelRequired: 'लेबल जोड़ें।',
  },
}

const es: FundsCopy = {
  stepUp: {
    title: 'Confirma que eres tú', body: 'Verifica para continuar.',
    totp: 'Autenticador', recovery: 'Código de recuperación', passkey: 'Llave de acceso', totpLabel: 'Código de 6 dígitos', recoveryLabel: 'Código de recuperación', passkeyBody: 'Usa la llave de acceso guardada en este dispositivo.', passkeyCta: 'Usar llave de acceso',
    verify: 'Verificar', verifying: 'Verificando…', cancel: 'Cancelar', noFactors: 'Aún no hay factor de seguridad', noFactorsBody: 'Configura primero una llave de acceso o una app de autenticación.', openSecurity: 'Abrir ajustes de seguridad', loadError: 'No se pudieron cargar tus factores de seguridad',
    required: 'Requiere una verificación de seguridad reciente', waived: 'Demo local: el servidor omite la verificación',
  },
  errors: {
    STEP_UP_REQUIRED: 'Se requiere una verificación de seguridad reciente.', TOTP_INVALID: 'El código no es válido. Introduce el más reciente.', TOTP_NOT_CONFIGURED: 'No hay app de autenticación configurada.',
    PASSKEY_NOT_FOUND: 'Esta cuenta no tiene una llave de acceso activa.', PASSKEY_VERIFICATION_FAILED: 'Falló la verificación con llave de acceso.', PASSKEY_CHALLENGE_INVALID: 'La solicitud caducó. Inténtalo de nuevo.', PASSKEY_UNSUPPORTED: 'Este navegador no admite llaves de acceso.', PASSKEY_CANCELLED: 'Se canceló la verificación.',
    WALLET_INSUFFICIENT_BALANCE: 'El saldo disponible no cubre importe + comisión.', WALLET_AMOUNT_BELOW_MINIMUM: 'El importe es inferior al mínimo de la red.', WALLET_AMOUNT_INVALID: 'Introduce un importe válido.',
    WALLET_ADDRESS_INVALID: 'La dirección no es válida para esta red.', WALLET_ADDRESS_BOOK_REQUIRED: 'Este entorno exige una dirección guardada y verificada.', WALLET_ADDRESS_COOLDOWN_ACTIVE: 'La dirección sigue en periodo de espera.',
    WALLET_ADDRESS_REVIEW_REQUIRED: 'La dirección aún no ha superado la verificación.', WALLET_ADDRESS_NOT_FOUND: 'No se encontró la dirección guardada.', WALLET_DEVICE_NOT_ELIGIBLE: 'Los retiros requieren un dispositivo de confianza con antigüedad suficiente.',
    WALLET_EXECUTION_DISABLED: 'Los retiros están pausados ahora mismo.', WALLET_UNAVAILABLE: 'El servicio de billetera no está disponible.', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: 'Supera el límite por operación.', WALLET_DAILY_LIMIT_EXCEEDED: 'Supera el límite diario.',
    WALLET_CALLBACK_PAYLOAD_INVALID: 'Solicitud rechazada. Revisa el destinatario.', NETWORK_ERROR: 'Red no disponible. No se envió nada: inténtalo de nuevo.',
  },
  common: {
    available: 'Disponible {v}', amount: 'Importe', max: 'MÁX', min: 'Mín. {v}', network: 'Red', confirm: 'Confirmar', submitting: 'Enviando…', reference: 'Referencia', state: 'Estado',
    replay: 'Ya se envió: se muestra la solicitud original.', activity: 'Ver actividad', cash: 'Volver a efectivo', again: 'Nueva solicitud', stubNote: 'Custodio simulado: no se emite nada en cadena.', after: 'Disponible después', fee: 'Comisión', cancelled: 'Verificación cancelada: no se envió nada.', done: 'Listo', more: 'Más información',
  },
  withdraw: {
    kicker: 'Retirar', title: 'Retirar USDT', destination: 'Destino', saved: 'Guardadas', manual: 'Nueva dirección', bookEmpty: 'No hay direcciones guardadas en {n}.', manageBook: 'Gestionar libreta', address: 'Dirección en {n}', addressInvalid: 'No es una dirección {n} válida.',
    bookRequired: 'Aquí solo se pueden usar direcciones guardadas y verificadas.', usableFrom: 'Disponible desde {t}', review: 'Verificación', total: 'Cargo total', insufficient: 'El saldo disponible no cubre importe + comisión.', quoting: 'Cotizando…', quoteError: 'Cotización no disponible', indicative: 'Cotización del servidor · se revalida al enviar',
    consent: 'He comprobado la red y la dirección. Los fondos enviados a una dirección errónea no se pueden recuperar.', submit: 'Solicitar retiro', done: 'Retiro solicitado', reasons: { custody_partner_not_configured: 'Verificación pendiente: custodio de prueba no conectado' }, reason: 'Nota', to: 'A',
  },
  transfer: {
    kicker: 'Transferencia interna', title: 'Transferir USDT', recipient: 'ID de usuario destinatario', recipientHint: 'El ID de cuenta del destinatario (UUID). Las transferencias internas se registran al instante.', recipientInvalid: 'Introduce un ID de usuario válido (UUID).', self: 'No puedes transferirte a ti mismo.', feeValue: 'Ninguna',
    consent: 'He confirmado el ID del destinatario. No puedo deshacer una transferencia registrada.', submit: 'Enviar transferencia', done: 'Transferencia registrada', to: 'Destinatario',
    myCode: 'Mi código de cobro', paste: 'Pegar', pasteFailed: 'Portapapeles no disponible: pega en el campo.', scan: 'Escanear código de cobro', idTail: 'El ID del destinatario termina en {d}.',
  },
  receive: {
    kicker: 'Recibir', title: 'Cobro interno', lede: 'Las transferencias internas entre cuentas se registran al instante y sin comisión.', qr: 'Escanea para transferir a esta cuenta', idLabel: 'Tu ID de usuario', copy: 'Copiar ID', copied: 'Copiado', share: 'Compartir', shareText: 'Envíame USDT en A-REIT', note: 'Otros escanean este código o pegan tu ID de usuario en su pantalla de transferencia para enviarte USDT.', safety: 'Comparte solo tu ID de usuario. Nunca pedimos contraseñas, códigos ni claves.', unavailable: 'Inicia sesión para ver tu código de cobro.', signIn: 'Iniciar sesión', transfer: 'Enviar transferencia', action: 'Recibir', scope: 'Solo cuentas internas. No es una dirección de depósito en cadena.',
  },
  book: {
    kicker: 'Seguridad', title: 'Libreta de direcciones', note: 'Las nuevas direcciones se verifican y se pueden usar tras {h} horas de espera.', add: 'Añadir dirección', label: 'Etiqueta', labelHint: 'p. ej. Billetera fría', address: 'Dirección', save: 'Guardar dirección', saving: 'Guardando…',
    states: { active: 'Activa', pending: 'En espera', revoked: 'Revocada' }, risk: { clear: 'Verificada', manual_review: 'En revisión', blocked: 'Bloqueada' }, usableFrom: 'Disponible desde {t}', revoke: 'Revocar', revokeConfirm: 'Confirmar revocación', revoking: 'Revocando…',
    empty: 'No hay direcciones guardadas', emptyBody: 'Guarda un destino verificado para retirar más rápido y con más seguridad.', saved: 'Dirección guardada · disponible desde {t}', revoked: 'Dirección revocada', showRevoked: 'Mostrar revocadas ({n})', hideRevoked: 'Ocultar revocadas', loadError: 'No se pudo cargar la libreta', close: 'Cerrar', labelRequired: 'Añade una etiqueta.',
  },
}

const ar: FundsCopy = {
  stepUp: {
    title: 'أكِّد هويتك', body: 'تحقق للمتابعة.',
    totp: 'تطبيق المصادقة', recovery: 'رمز الاسترداد', passkey: 'مفتاح المرور', totpLabel: 'رمز من 6 أرقام', recoveryLabel: 'رمز الاسترداد', passkeyBody: 'استخدم مفتاح المرور المحفوظ على هذا الجهاز.', passkeyCta: 'استخدام مفتاح المرور',
    verify: 'تحقق', verifying: 'جارٍ التحقق…', cancel: 'إلغاء', noFactors: 'لا يوجد عامل أمان بعد', noFactorsBody: 'اضبط مفتاح مرور أو تطبيق مصادقة أولاً.', openSecurity: 'فتح إعدادات الأمان', loadError: 'تعذر تحميل عوامل الأمان',
    required: 'يتطلب تحققًا أمنيًا حديثًا', waived: 'عرض محلي: الخادم يعفي من التحقق الأمني',
  },
  errors: {
    STEP_UP_REQUIRED: 'يلزم تحقق أمني حديث.', TOTP_INVALID: 'الرمز غير صالح. أدخل أحدث رمز.', TOTP_NOT_CONFIGURED: 'لم يتم إعداد تطبيق مصادقة.',
    PASSKEY_NOT_FOUND: 'لا يوجد مفتاح مرور نشط لهذا الحساب.', PASSKEY_VERIFICATION_FAILED: 'فشل التحقق بمفتاح المرور.', PASSKEY_CHALLENGE_INVALID: 'انتهت صلاحية الطلب. حاول مجددًا.', PASSKEY_UNSUPPORTED: 'هذا المتصفح لا يدعم مفاتيح المرور.', PASSKEY_CANCELLED: 'تم إلغاء التحقق.',
    WALLET_INSUFFICIENT_BALANCE: 'الرصيد المتاح لا يغطي المبلغ والرسوم.', WALLET_AMOUNT_BELOW_MINIMUM: 'المبلغ أقل من الحد الأدنى للشبكة.', WALLET_AMOUNT_INVALID: 'أدخل مبلغًا صالحًا.',
    WALLET_ADDRESS_INVALID: 'العنوان غير صالح لهذه الشبكة.', WALLET_ADDRESS_BOOK_REQUIRED: 'تتطلب هذه البيئة عنوانًا محفوظًا ومفحوصًا.', WALLET_ADDRESS_COOLDOWN_ACTIVE: 'العنوان ما زال في فترة الانتظار.',
    WALLET_ADDRESS_REVIEW_REQUIRED: 'لم يجتز العنوان الفحص بعد.', WALLET_ADDRESS_NOT_FOUND: 'لم يتم العثور على العنوان المحفوظ.', WALLET_DEVICE_NOT_ELIGIBLE: 'يتطلب السحب جهازًا موثوقًا تجاوز فترة الانتظار.',
    WALLET_EXECUTION_DISABLED: 'عمليات السحب متوقفة حاليًا.', WALLET_UNAVAILABLE: 'خدمة المحفظة غير متاحة.', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: 'يتجاوز حد العملية الواحدة.', WALLET_DAILY_LIMIT_EXCEEDED: 'يتجاوز الحد اليومي.',
    WALLET_CALLBACK_PAYLOAD_INVALID: 'تم رفض الطلب. تحقق من المستلم.', NETWORK_ERROR: 'الشبكة غير متاحة. لم يُرسل شيء — حاول مجددًا.',
  },
  common: {
    available: 'المتاح {v}', amount: 'المبلغ', max: 'الحد الأقصى', min: 'الحد الأدنى {v}', network: 'الشبكة', confirm: 'تأكيد', submitting: 'جارٍ الإرسال…', reference: 'المرجع', state: 'الحالة',
    replay: 'أُرسل مسبقًا — يُعرض الطلب الأصلي.', activity: 'عرض النشاط', cash: 'العودة إلى النقد', again: 'طلب جديد', stubNote: 'أمين حفظ تجريبي: لا يُبث أي شيء على السلسلة.', after: 'المتاح بعد العملية', fee: 'الرسوم', cancelled: 'أُلغي التحقق الأمني — لم يُرسل شيء.', done: 'تم', more: 'مزيد من المعلومات',
  },
  withdraw: {
    kicker: 'سحب', title: 'سحب USDT', destination: 'الوجهة', saved: 'محفوظة', manual: 'عنوان جديد', bookEmpty: 'لا يوجد عنوان محفوظ على {n}.', manageBook: 'إدارة دفتر العناوين', address: 'العنوان على {n}', addressInvalid: 'ليس عنوان {n} صالحًا.',
    bookRequired: 'لا يمكن هنا إلا استخدام العناوين المحفوظة والمفحوصة.', usableFrom: 'قابل للاستخدام من {t}', review: 'الفحص', total: 'إجمالي الخصم', insufficient: 'الرصيد المتاح لا يغطي المبلغ والرسوم.', quoting: 'جارٍ التسعير…', quoteError: 'التسعير غير متاح', indicative: 'تسعير الخادم · يُعاد التحقق عند الإرسال',
    consent: 'تحققت من الشبكة والعنوان. لا يمكن استرداد الأموال المرسلة إلى عنوان خاطئ.', submit: 'طلب سحب', done: 'تم طلب السحب', reasons: { custody_partner_not_configured: 'الفحص معلّق — أمين الحفظ التجريبي غير متصل' }, reason: 'ملاحظة', to: 'إلى',
  },
  transfer: {
    kicker: 'تحويل داخلي', title: 'تحويل USDT', recipient: 'معرّف المستخدم المستلم', recipientHint: 'معرّف حساب المستلم (UUID). تُقيَّد التحويلات الداخلية فورًا.', recipientInvalid: 'أدخل معرّف مستخدم صالحًا (UUID).', self: 'لا يمكنك التحويل إلى نفسك.', feeValue: 'لا شيء',
    consent: 'تأكدت من معرّف المستلم. لا يمكنني التراجع عن تحويل مقيَّد.', submit: 'إرسال التحويل', done: 'تم قيد التحويل', to: 'المستلم',
    myCode: 'رمز الاستلام الخاص بي', paste: 'لصق', pasteFailed: 'الحافظة غير متاحة — الصق في الحقل.', scan: 'مسح رمز الاستلام', idTail: 'ينتهي معرّف المستلم بـ {d}.',
  },
  receive: {
    kicker: 'استلام', title: 'استلام داخلي', lede: 'تُقيَّد التحويلات الداخلية بين الحسابات فورًا وبلا رسوم.', qr: 'امسح للتحويل إلى هذا الحساب', idLabel: 'معرّف المستخدم الخاص بك', copy: 'نسخ المعرّف', copied: 'تم النسخ', share: 'مشاركة', shareText: 'أرسل لي USDT على A-REIT', note: 'يمسح الآخرون هذا الرمز أو يلصقون معرّفك في شاشة التحويل لإرسال USDT إليك.', safety: 'شارك معرّف المستخدم فقط. لا نطلب كلمات المرور أو الرموز أو المفاتيح أبدًا.', unavailable: 'سجّل الدخول لعرض رمز الاستلام.', signIn: 'تسجيل الدخول', transfer: 'إرسال تحويل', action: 'استلام', scope: 'للحسابات الداخلية فقط. ليس عنوان إيداع على السلسلة.',
  },
  book: {
    kicker: 'الأمان', title: 'دفتر العناوين', note: 'تُفحص العناوين الجديدة وتصبح قابلة للاستخدام بعد انتظار {h} ساعة.', add: 'إضافة عنوان', label: 'التسمية', labelHint: 'مثل: محفظة باردة', address: 'العنوان', save: 'حفظ العنوان', saving: 'جارٍ الحفظ…',
    states: { active: 'نشط', pending: 'في الانتظار', revoked: 'ملغى' }, risk: { clear: 'مفحوص', manual_review: 'قيد المراجعة', blocked: 'محظور' }, usableFrom: 'قابل للاستخدام من {t}', revoke: 'إلغاء', revokeConfirm: 'تأكيد الإلغاء', revoking: 'جارٍ الإلغاء…',
    empty: 'لا توجد عناوين محفوظة', emptyBody: 'احفظ وجهة مفحوصة لسحب أسرع وأكثر أمانًا.', saved: 'تم حفظ العنوان · قابل للاستخدام من {t}', revoked: 'تم إلغاء العنوان', showRevoked: 'عرض الملغاة ({n})', hideRevoked: 'إخفاء الملغاة', loadError: 'تعذر تحميل دفتر العناوين', close: 'إغلاق', labelRequired: 'أضف تسمية.',
  },
}

const fr: FundsCopy = {
  stepUp: {
    title: 'Confirmez votre identité', body: 'Vérifiez pour continuer.',
    totp: 'Authentificateur', recovery: 'Code de secours', passkey: 'Clé d’accès', totpLabel: 'Code à 6 chiffres', recoveryLabel: 'Code de secours', passkeyBody: 'Utilisez la clé d’accès enregistrée sur cet appareil.', passkeyCta: 'Utiliser la clé d’accès',
    verify: 'Vérifier', verifying: 'Vérification…', cancel: 'Annuler', noFactors: 'Aucun facteur de sécurité', noFactorsBody: 'Configurez d’abord une clé d’accès ou une application d’authentification.', openSecurity: 'Ouvrir la sécurité', loadError: 'Impossible de charger vos facteurs de sécurité',
    required: 'Vérification de sécurité récente requise', waived: 'Démo locale : le serveur dispense de la vérification',
  },
  errors: {
    STEP_UP_REQUIRED: 'Une vérification de sécurité récente est requise.', TOTP_INVALID: 'Code invalide. Saisissez le plus récent.', TOTP_NOT_CONFIGURED: 'Aucune application d’authentification configurée.',
    PASSKEY_NOT_FOUND: 'Aucune clé d’accès active sur ce compte.', PASSKEY_VERIFICATION_FAILED: 'La vérification par clé d’accès a échoué.', PASSKEY_CHALLENGE_INVALID: 'La demande a expiré. Réessayez.', PASSKEY_UNSUPPORTED: 'Ce navigateur ne prend pas en charge les clés d’accès.', PASSKEY_CANCELLED: 'Vérification annulée.',
    WALLET_INSUFFICIENT_BALANCE: 'Le solde disponible ne couvre pas montant + frais.', WALLET_AMOUNT_BELOW_MINIMUM: 'Montant inférieur au minimum du réseau.', WALLET_AMOUNT_INVALID: 'Saisissez un montant valide.',
    WALLET_ADDRESS_INVALID: 'Adresse non valide pour ce réseau.', WALLET_ADDRESS_BOOK_REQUIRED: 'Cet environnement exige une adresse enregistrée et contrôlée.', WALLET_ADDRESS_COOLDOWN_ACTIVE: 'Cette adresse est encore en délai d’attente.',
    WALLET_ADDRESS_REVIEW_REQUIRED: 'Cette adresse n’a pas encore passé le contrôle.', WALLET_ADDRESS_NOT_FOUND: 'Adresse enregistrée introuvable.', WALLET_DEVICE_NOT_ELIGIBLE: 'Les retraits exigent un appareil de confiance ancien d’au moins le délai requis.',
    WALLET_EXECUTION_DISABLED: 'Les retraits sont suspendus pour le moment.', WALLET_UNAVAILABLE: 'Service de portefeuille indisponible.', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: 'Au-delà de la limite par opération.', WALLET_DAILY_LIMIT_EXCEEDED: 'Au-delà de la limite quotidienne.',
    WALLET_CALLBACK_PAYLOAD_INVALID: 'Demande refusée. Vérifiez le destinataire.', NETWORK_ERROR: 'Réseau indisponible. Rien n’a été envoyé — réessayez.',
  },
  common: {
    available: 'Disponible {v}', amount: 'Montant', max: 'MAX', min: 'Min. {v}', network: 'Réseau', confirm: 'Confirmer', submitting: 'Envoi…', reference: 'Référence', state: 'État',
    replay: 'Déjà envoyé — affichage de la demande d’origine.', activity: 'Voir l’activité', cash: 'Retour aux liquidités', again: 'Nouvelle demande', stubNote: 'Dépositaire simulé : rien n’est diffusé on-chain.', after: 'Disponible après', fee: 'Frais', cancelled: 'Vérification annulée — rien n’a été envoyé.', done: 'Terminé', more: 'Plus d’infos',
  },
  withdraw: {
    kicker: 'Retrait', title: 'Retirer des USDT', destination: 'Destination', saved: 'Enregistrées', manual: 'Nouvelle adresse', bookEmpty: 'Aucune adresse enregistrée sur {n}.', manageBook: 'Gérer le carnet', address: 'Adresse sur {n}', addressInvalid: 'Adresse {n} non valide.',
    bookRequired: 'Seules les adresses enregistrées et contrôlées sont utilisables ici.', usableFrom: 'Utilisable dès {t}', review: 'Contrôle', total: 'Débit total', insufficient: 'Le solde disponible ne couvre pas montant + frais.', quoting: 'Cotation…', quoteError: 'Cotation indisponible', indicative: 'Cotation serveur · revérifiée à l’envoi',
    consent: 'J’ai vérifié le réseau et l’adresse. Des fonds envoyés à une mauvaise adresse sont irrécupérables.', submit: 'Demander le retrait', done: 'Retrait demandé', reasons: { custody_partner_not_configured: 'Contrôle en attente — dépositaire de test non connecté' }, reason: 'Note', to: 'Vers',
  },
  transfer: {
    kicker: 'Virement interne', title: 'Transférer des USDT', recipient: 'ID utilisateur du destinataire', recipientHint: 'L’ID de compte du destinataire (UUID). Les virements internes sont comptabilisés immédiatement.', recipientInvalid: 'Saisissez un ID utilisateur valide (UUID).', self: 'Vous ne pouvez pas vous virer des fonds.', feeValue: 'Aucun',
    consent: 'J’ai vérifié l’ID du destinataire. Je ne peux pas annuler un virement comptabilisé.', submit: 'Envoyer le virement', done: 'Virement comptabilisé', to: 'Destinataire',
    myCode: 'Mon code de réception', paste: 'Coller', pasteFailed: 'Presse-papiers indisponible — collez dans le champ.', scan: 'Scanner un code de réception', idTail: 'L’ID du destinataire se termine par {d}.',
  },
  receive: {
    kicker: 'Recevoir', title: 'Réception interne', lede: 'Les virements internes entre comptes sont comptabilisés immédiatement, sans frais.', qr: 'Scannez pour virer vers ce compte', idLabel: 'Votre ID utilisateur', copy: 'Copier l’ID', copied: 'Copié', share: 'Partager', shareText: 'Envoyez-moi des USDT sur A-REIT', note: 'Les autres scannent ce code ou collent votre ID utilisateur dans leur écran de virement pour vous envoyer des USDT.', safety: 'Partagez uniquement votre ID utilisateur. Nous ne demandons jamais de mot de passe, code ou clé.', unavailable: 'Connectez-vous pour voir votre code de réception.', signIn: 'Connexion', transfer: 'Faire un virement', action: 'Recevoir', scope: 'Comptes internes uniquement. Pas une adresse de dépôt on-chain.',
  },
  book: {
    kicker: 'Sécurité', title: 'Carnet d’adresses', note: 'Les nouvelles adresses sont contrôlées et utilisables après un délai de {h} heures.', add: 'Ajouter une adresse', label: 'Libellé', labelHint: 'ex. Portefeuille froid', address: 'Adresse', save: 'Enregistrer', saving: 'Enregistrement…',
    states: { active: 'Active', pending: 'En attente', revoked: 'Révoquée' }, risk: { clear: 'Contrôlée', manual_review: 'En revue', blocked: 'Bloquée' }, usableFrom: 'Utilisable dès {t}', revoke: 'Révoquer', revokeConfirm: 'Confirmer la révocation', revoking: 'Révocation…',
    empty: 'Aucune adresse enregistrée', emptyBody: 'Enregistrez une destination contrôlée pour retirer plus vite et plus sûrement.', saved: 'Adresse enregistrée · utilisable dès {t}', revoked: 'Adresse révoquée', showRevoked: 'Afficher les révoquées ({n})', hideRevoked: 'Masquer les révoquées', loadError: 'Impossible de charger le carnet', close: 'Fermer', labelRequired: 'Ajoutez un libellé.',
  },
}

const pt: FundsCopy = {
  stepUp: {
    title: 'Confirme que é você', body: 'Verifique para continuar.',
    totp: 'Autenticador', recovery: 'Código de recuperação', passkey: 'Chave de acesso', totpLabel: 'Código de 6 dígitos', recoveryLabel: 'Código de recuperação', passkeyBody: 'Use a chave de acesso salva neste dispositivo.', passkeyCta: 'Usar chave de acesso',
    verify: 'Verificar', verifying: 'Verificando…', cancel: 'Cancelar', noFactors: 'Nenhum fator de segurança ainda', noFactorsBody: 'Configure primeiro uma chave de acesso ou um app autenticador.', openSecurity: 'Abrir segurança', loadError: 'Não foi possível carregar seus fatores de segurança',
    required: 'Exige uma verificação de segurança recente', waived: 'Demo local: o servidor dispensa a verificação',
  },
  errors: {
    STEP_UP_REQUIRED: 'É necessária uma verificação de segurança recente.', TOTP_INVALID: 'Código inválido. Digite o mais recente.', TOTP_NOT_CONFIGURED: 'Nenhum app autenticador configurado.',
    PASSKEY_NOT_FOUND: 'Nenhuma chave de acesso ativa nesta conta.', PASSKEY_VERIFICATION_FAILED: 'A verificação com chave de acesso falhou.', PASSKEY_CHALLENGE_INVALID: 'A solicitação expirou. Tente de novo.', PASSKEY_UNSUPPORTED: 'Este navegador não suporta chaves de acesso.', PASSKEY_CANCELLED: 'Verificação cancelada.',
    WALLET_INSUFFICIENT_BALANCE: 'O saldo disponível não cobre valor + taxa.', WALLET_AMOUNT_BELOW_MINIMUM: 'Valor abaixo do mínimo da rede.', WALLET_AMOUNT_INVALID: 'Digite um valor válido.',
    WALLET_ADDRESS_INVALID: 'Endereço inválido para esta rede.', WALLET_ADDRESS_BOOK_REQUIRED: 'Este ambiente exige um endereço salvo e verificado.', WALLET_ADDRESS_COOLDOWN_ACTIVE: 'Este endereço ainda está em carência.',
    WALLET_ADDRESS_REVIEW_REQUIRED: 'Este endereço ainda não passou na verificação.', WALLET_ADDRESS_NOT_FOUND: 'Endereço salvo não encontrado.', WALLET_DEVICE_NOT_ELIGIBLE: 'Saques exigem um dispositivo confiável com carência cumprida.',
    WALLET_EXECUTION_DISABLED: 'Os saques estão pausados no momento.', WALLET_UNAVAILABLE: 'Serviço de carteira indisponível.', WALLET_PER_TRANSACTION_LIMIT_EXCEEDED: 'Acima do limite por operação.', WALLET_DAILY_LIMIT_EXCEEDED: 'Acima do limite diário.',
    WALLET_CALLBACK_PAYLOAD_INVALID: 'Solicitação recusada. Verifique o destinatário.', NETWORK_ERROR: 'Rede indisponível. Nada foi enviado — tente de novo.',
  },
  common: {
    available: 'Disponível {v}', amount: 'Valor', max: 'MÁX', min: 'Mín. {v}', network: 'Rede', confirm: 'Confirmar', submitting: 'Enviando…', reference: 'Referência', state: 'Estado',
    replay: 'Já enviado — exibindo a solicitação original.', activity: 'Ver atividade', cash: 'Voltar ao caixa', again: 'Nova solicitação', stubNote: 'Custodiante simulado: nada é transmitido on-chain.', after: 'Disponível depois', fee: 'Taxa', cancelled: 'Verificação cancelada — nada foi enviado.', done: 'Concluir', more: 'Mais informações',
  },
  withdraw: {
    kicker: 'Saque', title: 'Sacar USDT', destination: 'Destino', saved: 'Salvos', manual: 'Novo endereço', bookEmpty: 'Nenhum endereço salvo em {n}.', manageBook: 'Gerenciar agenda', address: 'Endereço em {n}', addressInvalid: 'Endereço {n} inválido.',
    bookRequired: 'Aqui só podem ser usados endereços salvos e verificados.', usableFrom: 'Utilizável a partir de {t}', review: 'Verificação', total: 'Débito total', insufficient: 'O saldo disponível não cobre valor + taxa.', quoting: 'Cotando…', quoteError: 'Cotação indisponível', indicative: 'Cotação do servidor · reverificada no envio',
    consent: 'Conferi a rede e o endereço. Fundos enviados a um endereço errado não podem ser recuperados.', submit: 'Solicitar saque', done: 'Saque solicitado', reasons: { custody_partner_not_configured: 'Verificação pendente — custodiante de teste não conectado' }, reason: 'Nota', to: 'Para',
  },
  transfer: {
    kicker: 'Transferência interna', title: 'Transferir USDT', recipient: 'ID de usuário do destinatário', recipientHint: 'O ID da conta do destinatário (UUID). Transferências internas são lançadas na hora.', recipientInvalid: 'Digite um ID de usuário válido (UUID).', self: 'Você não pode transferir para si mesmo.', feeValue: 'Nenhuma',
    consent: 'Conferi o ID do destinatário. Não posso desfazer uma transferência lançada.', submit: 'Enviar transferência', done: 'Transferência lançada', to: 'Destinatário',
    myCode: 'Meu código de recebimento', paste: 'Colar', pasteFailed: 'Área de transferência indisponível — cole no campo.', scan: 'Escanear código de recebimento', idTail: 'O ID do destinatário termina em {d}.',
  },
  receive: {
    kicker: 'Receber', title: 'Recebimento interno', lede: 'Transferências internas entre contas são lançadas na hora e sem taxa.', qr: 'Escaneie para transferir a esta conta', idLabel: 'Seu ID de usuário', copy: 'Copiar ID', copied: 'Copiado', share: 'Compartilhar', shareText: 'Envie-me USDT na A-REIT', note: 'Outras pessoas escaneiam este código ou colam seu ID de usuário na tela de transferência para enviar USDT a você.', safety: 'Compartilhe só seu ID de usuário. Nunca pedimos senhas, códigos ou chaves.', unavailable: 'Entre para ver seu código de recebimento.', signIn: 'Entrar', transfer: 'Enviar transferência', action: 'Receber', scope: 'Somente contas internas. Não é um endereço de depósito on-chain.',
  },
  book: {
    kicker: 'Segurança', title: 'Agenda de endereços', note: 'Novos endereços são verificados e ficam utilizáveis após {h} horas de carência.', add: 'Adicionar endereço', label: 'Rótulo', labelHint: 'ex.: Carteira fria', address: 'Endereço', save: 'Salvar endereço', saving: 'Salvando…',
    states: { active: 'Ativo', pending: 'Em carência', revoked: 'Revogado' }, risk: { clear: 'Verificado', manual_review: 'Em revisão', blocked: 'Bloqueado' }, usableFrom: 'Utilizável a partir de {t}', revoke: 'Revogar', revokeConfirm: 'Confirmar revogação', revoking: 'Revogando…',
    empty: 'Nenhum endereço salvo', emptyBody: 'Salve um destino verificado para sacar com mais rapidez e segurança.', saved: 'Endereço salvo · utilizável a partir de {t}', revoked: 'Endereço revogado', showRevoked: 'Mostrar revogados ({n})', hideRevoked: 'Ocultar revogados', loadError: 'Não foi possível carregar a agenda', close: 'Fechar', labelRequired: 'Adicione um rótulo.',
  },
}

export const fundsCopy: Record<AppLocale, FundsCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
