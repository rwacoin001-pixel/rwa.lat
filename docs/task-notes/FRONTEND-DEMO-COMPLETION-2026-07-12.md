# RWA.LAT 前端 Demo 完成度审计（2026-07-12）

**审计范围：** `FE-006`、`FE-007`、`FE-008`、`FE-009`、`FE-010`、`FE-012`、`FE-014`、`FE-015`、`DESIGN-001`、`DESIGN-002`  
**审计原则：** 已完整阅读 `DESIGN.md`、`docs/Task-Board.md`、现有 `docs/task-notes/`、前端源码、Polymarket 只读适配器和 `assets/generated/` 原型资产。只按仓库中可复核的代码、页面、素材和验证记录判断，不把 Demo 交互、服务端密钥存在或静态页面等同于生产闭环。  
**文档边界：** 本文件是审计快照和主任务板状态建议；不直接修改 `docs/Task-Board.md`。

## 结论摘要

当前仓库已经具备可运行、信息密度较高的 H5/PWA Demo 骨架：首页、12 个演示项目、项目资料、投资组合、钱包、账户入口和公开 Polymarket 市场发现均有实现。仍不能宣称“全部完成”：认证/KYC 尚未形成真实会话与全状态闭环，Polymarket 真实交易明确关闭，订单、钱包、个人中心和全局异常只覆盖了部分状态，补充原型也未覆盖任务板要求的全部页面组。

| ID | 任务板状态 | 审计建议 | Demo 结论 | 生产结论 |
|---|---|---|---|---|
| FE-006 | 待完成 | **进行中 / 部分完成** | 欢迎、登录、注册、邮件验证、恢复、访客与退出入口已存在 | 未接真实会话、权限差异和原操作回跳 |
| FE-007 | 原型完成 | **部分完成** | KYC 起始页与三步说明存在 | 补件、审核中、拒绝、受限、草稿回跳及服务端驱动未闭环 |
| FE-008 | 原型完成 | **保持原型完成** | 首页、目录、筛选、12 个项目和详情资料较完整 | 资产目录、披露、价格、资格和数据新鲜度仍是 Demo/本地数据 |
| FE-009 | 原型完成 | **进行中；只读 Demo 不得写成交易完成** | Gamma 市场发现和公开 CLOB 数据接口存在 | 下单、撤单、部分成交、映射、结算、对账与合规未实现 |
| FE-010 | 部分完成 | **保持部分完成** | 报价倒计时、金额校验、确认和成功回执存在 | 处理中、部分成交、失败、可追踪争议和幂等后端缺失 |
| FE-012 | 部分完成 | **保持部分完成** | 充值、提现、转账、确认、资产和活动页存在 | 钱包/账本 API、费用、白名单管理、交易详情和审核状态机缺失 |
| FE-014 | 部分完成 | **保持部分完成** | 个人中心、退出、安全、通知、记录、支持和设置入口存在 | 设备注销、重验、订阅、工单状态和关闭账户未闭环 |
| FE-015 | 待完成 | **进行中 / 部分完成** | 已有离线、目录空态、行情回退、报价过期和金额错误 | 尚未覆盖所有 P0 页的加载、错误、受限、维护和数据过期 |
| DESIGN-001 | 进行中 | **保持进行中，完成视觉验收后再转待审核** | 六组核心长图和素材 README 已存在 | 缺少逐页实现对照、响应式/动效/可访问性验收记录 |
| DESIGN-002 | 进行中 | **保持进行中** | 个人中心、首次使用及三张认证参考图存在 | AI、订单全状态、通知/客服及认证精准还原的完整验收不足 |

## 分项证据与验收

### FE-006 登录、注册、会话、访客与恢复

**已有证据**

- `lib/rwa-routes.ts` 已登记 `/welcome`、`/login`、`/register`、`/verify-email`、`/recovery`。
- `components/rwa-h5.tsx` 的 `AuthScreen` 提供欢迎、邮箱登录/注册、验证码、恢复、Google/钱包 Demo 入口和访客入口；`ProfileScreen` 已提供明确的 `Sign out of RWA.LAT`。
- 前端对 Demo 行为有提示，没有把 OAuth、钱包签名或邮件发送伪装成生产能力。

**验收判定：部分通过。** 页面路由和主要入口存在；但登录只是客户端跳转，验证码接受任意六位，访客与登录用户没有统一权限状态，投资/钱包操作未由会话守卫拦截，也没有保存并返回原操作路径。前端尚未消费 `API-002/API-003` 会话能力，且不存在 `docs/task-notes/FE-006.md`，因此不能进入“待审核”。

**未完成 / 阻塞**

- 工程内工作：真实 API 调用、Bearer/刷新会话、受保护路由、访客权限矩阵、登录后 return-to、错误/限流/超时状态。
- 依赖：`API-003` 尚在进行中；真实 OAuth、邮件和钱包供应链还需要环境与合作方配置。

### FE-007 KYC 与资格状态

**已有证据**

- `/profile/kyc` 深链存在。
- `AccountFlowScreen(kind="kyc")` 展示证件、活体和资格三步流程、处理时长和开始按钮。
- 后端 `API-004` 已有类型化 KYC/筛查桩和统一资格判定，但当前前端没有调用这些接口。

**验收判定：部分通过。** 目前主要是第一步介绍页；开始按钮只产生 Demo 提示。任务要求的补件、审核中、拒绝、地区/产品受限、申诉或返回订单草稿均无独立路由/状态，不能证明“所有状态由服务端驱动”。建议主任务板从“原型完成”改为“部分完成”，补齐后再恢复。

**未完成 / 阻塞**

- 工程内工作：状态机页面、证件上传适配器、原因码、资格结果、受限 CTA、订单草稿回跳和异常状态。
- 外部：`PARTNER-001`、`LEGAL-001`、`INFRA-003`；真实供应商和正式规则矩阵未确定。

### FE-008 首页、投资目录、筛选与资产详情

**已有证据**

- `HomeScreen` 已覆盖总资产、资产轨道、AI 简报、市场摘要、今日事项、收益日历、机会分类、匹配项目和近期活动。
- `InvestScreen` 已覆盖搜索、低风险筛选、收益排序、分类、空结果恢复和执行台入口。
- `lib/demo-catalog.ts` 定义 12 个明确标注 Demo 的算力、RWA 和股票项目；`projectProfiles` 提供发行主体/载体、结构、地点、规模、结算、投资逻辑、现金流、节点、风险和文件。
- `ProjectIntelligence` 在项目详情中展示上述业务信息；`public/media/generated/project-assets/` 与 CSS 项目 ID 映射为目录卡片提供差异化视觉。

**验收判定：原型层通过，生产层未通过。** 内容丰富度和主要交互满足 Demo 展示；但除 Polymarket 外数据均来自本地演示目录，文件按钮为提示，未接 `API-006`，也没有统一的产品资格、价格快照和过期禁投。没有独立 `docs/task-notes/FE-008.md`，不能转“待审核”。

**未完成 / 阻塞**

- 工程内工作：真实目录适配器、分页/多条件筛选、数据时点、文件下载、资格判定、过期阻断、加载/错误状态和自动化测试。
- 外部：`PARTNER-004` 的真实产品、发行主体和披露文件。

### FE-009 Polymarket 列表、详情、报价与下单

**已有证据**

- `GET /api/polymarket/markets` 读取公开 Gamma 活跃市场并提供可控 Demo 回退。
- `GET /api/polymarket/market/:id` 读取单市场元数据及公开 CLOB 订单簿、中间价、点差和价格历史。
- `lib/polymarket-server.ts` 只返回配置就绪状态；`tradingEnabled` 明确为 `false`，密钥只从服务端环境变量读取，`.env*.local` 已被 `.gitignore` 忽略。
- 投资页的 `PredictionMarketPanel` 已展示公开行情来源、更新时间、概率、24 小时成交量和失败回退提示。

**验收判定：只读行情已开始，交易验收未通过。** 服务端公开数据形状成立，但 Relayer 配置存在不等于真实交易接入。不得把 Demo 订单预览或成功页称为 Polymarket 外部订单。任务要求的内外市场/订单映射、地区限制执行、部分成交、撤市、断线续处理、结算和对账尚无后端闭环。

**未完成 / 阻塞**

- 工程内工作：详情页实际消费单市场接口、订单簿/历史图、加载/降级/受限状态、订单预览与用户签名方案；`API-008/API-009/DB-006/QA-003`。
- 外部：`PARTNER-002`、`LEGAL-001`、`LEGAL-002`。在代销/分销、地区、用户归属和披露明确前必须保持 `tradingEnabled: false`。

### FE-010 订单全状态

**已有证据**

- `/orders/review` 与 `/orders/success` 存在。
- `OrderReviewScreen` 有金额、费用、总锁定额、余额校验、45 秒报价过期和刷新；过期时按钮禁用。
- `OrderSuccessScreen` 有订单编号、结算/执行说明和下一更新时间；支持中心有争议入口文案。

**验收判定：部分通过。** 只覆盖确认和单一成功结果。没有处理中、部分成交、失败、取消、详细收据、争议进度；按钮调用客户端路由，没有 `Idempotency-Key` 或持久订单，无法证明重复点击不会重复建单。

**未完成 / 阻塞**

- 工程内工作：完整状态机路由、服务器订单草稿、幂等键、恢复/轮询、失败恢复、部分成交拆分、收据和争议追踪。
- 依赖：`API-008`、`API-007`、`DB-004` 尚未完成。

### FE-012 钱包与资金操作

**已有证据**

- `/wallet`、`/wallet/deposit`、`/wallet/withdraw`、`/wallet/transfer`、`/wallet/confirmation`、`/wallet/usdt` 和 `/activity` 存在。
- 充值支持 TRON、Ethereum、Arbitrum 切换和地址复制；提现/转账有目标与金额输入；提现入口提及地址簿/白名单；确认页展示待链确认或安全审核文案。

**验收判定：部分通过。** 页面形状和 Demo 状态具备，但表单没有地址/网络/余额/费用的真实验证，提现没有完整网络和费用预览，地址簿与白名单只是提示，交易活动没有独立详情，资金状态没有 API/账本来源。

**未完成 / 阻塞**

- 工程内工作：`API-005/API-007/DB-003`、精确金额、地址校验、手续费、白名单冷静期、复验、链确认/失败/重试、交易详情和人工审核闭环。
- 外部：`PARTNER-003` 托管与网络路径、`PARTNER-001` 链风控。

### FE-014 个人中心与账户管理

**已有证据**

- 头像进入个人中心；菜单覆盖 KYC、安全、邀请、记录、支持、设置；退出选项已存在并清理 Demo sessionStorage。
- 安全页展示 Passkey、生物识别和设备提醒；通知、交易记录、客服/争议和偏好页均有可演示内容。

**验收判定：部分通过。** 信息架构成立，但安全和支持操作大多只触发 toast；没有设备/会话列表与注销、敏感操作重验流程、订阅管理、工单详情/进度、关闭账户和关闭后的数据/资金提示。

**未完成 / 阻塞**

- 工程内工作：接入 `API-003/API-012`，设备与会话管理、重验、通知偏好持久化、工单状态、订阅、账户关闭/撤销和失败状态。
- 依赖：`API-003` 尚未通过实库与浏览器 Passkey 验收；`API-012` 未开始。

### FE-015 全局非理想状态

**已有证据**

- `navigator.onLine` 驱动的全局离线提示。
- 投资目录空结果与重置；Polymarket loading/live/fallback；订单报价过期和金额错误。
- Polymarket API 对列表降级返回 Demo fallback，对单市场失败返回 502。

**验收判定：已有增量但远未全覆盖。** 建议从“待完成”改为“进行中/部分完成”。首页、资产详情、组合、钱包、KYC、订单、账户等 P0 页面仍缺统一 skeleton、空态、超时、维护、权限受限、数据过期和恢复动作。

**未完成 / 阻塞**

- 工程内工作：建立共享状态组件和逐路由状态矩阵，补 ARIA live/focus 恢复、缓存时点、重试与只读降级，并加入 E2E/视觉测试。
- 依赖：稳定错误契约依赖各领域 API；不是外部合作方才能完成的工作，可立即推进。

### DESIGN-001 前台核心原型

**已有证据**

- `assets/generated/原型图/` 已存在首页、投资、算力详情/订单、预测市场、组合和钱包六组长图（01 至 06）。
- 同目录 `README.md` 已记录用途、关键限制及实际前端素材路径。
- `docs/task-notes/DESIGN-001.md` 记录首页与项目详情增量、12 个演示项目和构建/路由验证。

**验收判定：资产集合基本齐全，但保持“进行中”。** `DESIGN-001.md` 仍写“需补正式概念长图与追溯”，与当前文件清单不一致，应先更新任务备注；同时没有逐页叠图/截图对照、390/430px 视觉回归、动效和 reduced-motion 验收证据。只有产品负责人审过六张图及对应实现后才能转“待审核”。

**未完成 / 阻塞**

- 工程内工作：更新任务备注、逐页实现对照、统一品牌骨架差异、响应式/动效/可访问性记录。
- 产品确认：概念图是否最终批准；不属于合作方外部阻塞。

### DESIGN-002 前台补充原型

**已有证据**

- `assets/generated/原型图/08-个人中心-安全与账户-v1.png`、`09-首次使用-登录与KYC资格-v1.png` 存在。
- `assets/generated/screens-v1/01-onboarding.png`、`02-sign-in.png`、`03-kyc.png` 是用户明确指定的认证视觉参考。
- 前端已有 AI、个人中心、认证/KYC、成功回执、通知和支持路由/组件。

**验收判定：进行中。** 图片和页面入口并不等于任务覆盖完成。当前资产清单没有独立记录 AI、订单全状态、通知/客服的完整长图；认证实现还需要对三张指定图做逐屏高保真比对，并验证毛玻璃、流动高光、长屏内容、键盘、焦点、窄屏和 reduced-motion。

**未完成 / 阻塞**

- 工程内工作：补足缺失页面组原型、认证逐屏对照、订单/KYC/通知/客服非理想状态、`docs/task-notes/DESIGN-002.md` 与视觉验收记录。
- 产品确认：参考图与 `DESIGN.md` 冲突时，以锁定应用骨架和产品负责人确认的取舍为准。

## 统一验收与外部边界

在下列条件满足前，不应将本轮称为“全部完成”或“可生产交易”：

1. 每个指定 FE/DESIGN 任务都有自己的 `docs/task-notes/<ID>.md`，记录已读 `DESIGN.md`、实现、验证与剩余依赖。
2. 生产构建、关键路由运行、390/430px 响应式、键盘/焦点、reduced-motion 和非理想状态矩阵有可重复证据。
3. `API-005` 至 `API-012`、`DB-003` 至 `DB-006` 和对应 QA 任务完成，资金/订单不能继续由客户端内存或 toast 代表。
4. `PARTNER-001` 至 `PARTNER-004`、`LEGAL-001/002` 未解除前，只能展示明确标记的 Demo 和公开只读数据。
5. Polymarket 真实订单提交必须继续关闭，直到用户签名、资格/地区、幂等、审计、结算和合作协议全部验收。

## 本次可重复验证

- 在仓库根目录执行 `npm run build`：**exit 0**。Next.js 16.2.6 生产构建成功，并列出动态路由 `/[[...rwa]]`、`/api/polymarket/market/[id]`、静态再验证路由 `/api/polymarket/markets` 和 `/manifest.webmanifest`。
- 已运行中的 `http://localhost:3019/api/polymarket/markets` 返回 `source=polymarket-gamma` 和 18 个公开市场，证明公开市场发现可用；该进程是在本轮构建前启动，新增单市场详情路由需重启预览进程后再做运行态验收。
- 本仓库没有覆盖上述 FE 任务的 E2E 或视觉回归测试；本次构建成功不能替代 390/430px、键盘/焦点、reduced-motion、离线/失败和真实 API 状态验收。

## 给主代理的状态建议

- **可保持：** `FE-008=原型完成`、`FE-010/FE-012/FE-014=部分完成`、`DESIGN-001/002=进行中`。
- **建议纠正：** `FE-006` 从“待完成”改为“进行中/部分完成”；`FE-007` 从“原型完成”改为“部分完成”；`FE-015` 从“待完成”改为“进行中/部分完成”。
- **FE-009：** 在只读详情 UI 与异常状态完成验收后可保持“原型完成”，但 `API-009` 和真实交易仍应分别保持“进行中/待完成”，不得混写。
- **进入待审核前：** 补齐 `FE-006/007/008/009/010/012/014/015` 与 `DESIGN-002` 的独立任务备注，并附本轮最终构建和视觉验收结果。
# 2026-07-12 final integration addendum

The following evidence supersedes any earlier pre-integration observations in this audit:

- `components/auth-experience.tsx` and its CSS Module now serve `/welcome`, `/login`, `/register`, `/verify-email`, `/recovery`, and `/profile/kyc` from `components/rwa-h5.tsx`.
- `components/polymarket-detail-panel.tsx` and its CSS Module are integrated into live prediction-market detail pages.
- The single-market API now returns Gamma metadata plus CLOB order book, midpoint, spread, and up to 96 historical price points.
- FE-006 is now **原型完成**; FE-015 is **部分完成**; API-009 is **进行中**. These statuses are reflected in `docs/Task-Board.md`.
- Final `npm run build` passed. Frontend-only TypeScript filtering found no errors under `components/`, `app/`, or `lib/`.
- Runtime verification returned HTTP 200 for all six authentication/KYC routes, `/home`, `/invest`, and `/profile`.
- Live adapter verification returned 18 Gamma markets, a CLOB order book, and 96 history points. Relayer configuration was detected; `tradingEnabled` remained `false` by design.
