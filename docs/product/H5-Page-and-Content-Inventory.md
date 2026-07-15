# H5 全页面与七语言内容清单

版本：1.0  
语言：English、简体中文、हिन्दी、Español、العربية、Français、Português。

## 1. 全局要求

- Settings 固定提供七语言选择；Welcome、Login、Register 页右上角提供语言按钮；
- 切换后立即更新当前页面、`html lang` 和 RTL 方向，并保存选择；
- 产品名可保留注册名称，但副标题、费用、风险、详情、订单、KYC、错误和长披露必须翻译；
- 数字、日期、货币和复数使用 locale 格式，不用拼接英语；
- 阿拉伯语采用 RTL，但金额、钱包地址、哈希和产品代码保持 LTR；
- 不允许以英语回退作为“完成”，每次构建执行缺 key 检查；
- 长文案由母语审校，法律与风险文本再由对应地区法务确认。

## 2. 页面清单

| 模块 | 必须完成的页面/状态 |
|---|---|
| Onboarding/Auth | Welcome、Login、Register、Verify email、Recovery、Guest 提示、OAuth/钱包错误、KYC intro/document/liveness/eligibility/result |
| Home | Guest 公开版、登录资产版、市场简报、今日事项、收益日历、机会卡片、最近活动 |
| Invest | 搜索、筛选、空状态、Compute/RWA/Stocks/Prediction 列表、Polymarket live/degraded/error |
| Product Detail | 发行/提供方、法律形态、收益来源、费用、期限、退出、里程碑、风险、文件、地区状态 |
| Order | Review、quote expired、processing、partial、failed、success、receipt、dispute |
| Portfolio | overview、allocation、income、history、position detail、redeem/exit request |
| Wallet | overview、asset detail、deposit、withdraw、transfer、network warning、success/failure、activity |
| AI | chat、plan、evidence、risk score、disclaimer、confirmation、execution handoff |
| Profile/Trust | KYC、security/devices、referral/rewards、records、support/dispute、marketing consent、official channels、scam report、settings、close account |
| Legal/System | About/operator, regulatory disclosure, fees, risk disclosure, terms, privacy, cookies, accessibility, status, maintenance, loading, offline, 404/500 |

## 3. 文案质量标准

英文为事实源；中文追求金融语义自然，不逐字翻译；西/法/葡保持正式金融语体；印地语避免不必要的英语混杂但保留 USDT/KYC 等通用缩写；阿拉伯语使用现代标准阿拉伯语并人工检查 RTL。按钮使用动词，风险提示说明后果和下一步，禁止夸张、承诺收益或泛化“AI 智能”。

## 4. 验收

逐语言、逐路由检查：无英文残留（品牌/代码除外）、无截断、无按钮遮挡、金额方向正确、44px 触控区、200% 文本缩放、减少动态/减少透明度、离线与加载状态。验收记录保存截图、设备宽度、语言、路由和版本号。

