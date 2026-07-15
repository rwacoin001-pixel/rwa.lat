# RWA.LAT 开发任务表

## 2026-07-15 financial production hardening update

| ID | Status | Evidence |
|---|---|---|
| API-005 / DB-003 | Pending review | Encrypted withdrawal address book, cooldown, trusted-device age gate, transaction/24h limits, distinct dual-admin approval, leased async execution queue, idempotent broadcast contract, signed callbacks and a two-admin runtime funds switch are implemented. Real custody remains externally blocked. See `docs/task-notes/FINANCIAL-PRODUCTION-2026-07-15.md`. |
| API-007 / API-013 | Pending review | Controlled ledger adjustments and signed custody balance snapshots are implemented; reconciliation differences only open cases and never mutate balances. Real PostgreSQL concurrency rehearsal remains external. |
| INFRA-001 | In progress | Identity/Admin keyrings, SMTP delivery, Google/X authorization-code + PKCE adapters, S3 bucket mapping and compiled runtime capability gates are implemented. Secret Manager IAM, provider credentials and production rehearsal remain external. |
| INFRA-005 | In progress | Low-memory Core/Admin production images, hardened Compose, one-shot migration service and Locked/Live release script are implemented. This machine has no Docker/cloud CLI or authenticated GitHub deployment session, so remote release remains external. |

## 2026-07-15 delivery pipeline update

| ID | Status | Evidence |
|---|---|---|
| INFRA-005 | In progress | Remote CI definitions, low-memory test/build paths, migration contract and rollback rehearsal, dependency review/audit, CycloneDX SBOM, Demo-seed production isolation and rollback runbook are implemented. Local gates pass; first GitHub run, branch protection, PostgreSQL and hosting credentials remain external. See `docs/task-notes/INFRA-005.md`. |

## 2026-07-15 object-storage security update

| ID | Status | Evidence |
|---|---|---|
| INFRA-003 | Pending review | Migration/entity alignment, exact size/SHA-256 upload binding, bucket policies, signed scan results, quarantine/download gate, user-owned attachment routes and fail-closed production configuration are implemented. Storage tests 8/8; real PostgreSQL/S3/KMS/scanner rehearsal remains external. See `docs/task-notes/INFRA-003.md`. |

## 2026-07-15 Polymarket backend update

| ID | Status | Evidence |
|---|---|---|
| DB-006 | Pending review | Seven-table market/token/order/event/settlement/reconciliation schema and immutable event evidence are implemented. PostgreSQL migration tests are defined but await `TEST_DATABASE_URL`; see `docs/task-notes/DB-006.md`. |
| API-009 | In progress | Gamma keyset + public CLOB V2 read adapter, persisted sync/freshness and fail-closed trading gate are implemented. User-signed trading, production WebSocket credentials, partner settlement and reconciliation remain external/integration work; see `docs/task-notes/API-009.md`. |

## 2026-07-15 security remediation update

| ID | Status | Evidence |
|---|---|---|
| SEC-001 | Pending review | Server-side revocable admin sessions, mandatory production Admin MFA, method-level Core/Admin RBAC, server-verified callbacks, protected metrics, bounded ingress/timeouts and removal of browser-supplied trust assertions. Core: 24 suites / 139 tests; Admin: 2 suites / 8 tests; builds pass and audit has zero high/critical findings. See `docs/task-notes/SEC-001.md`. |
| ROUTE-001 | Pending review | Core/Admin prefix is fixed to `v1`, controller route metadata is checked, BFF upstream is `/v1`, and duplicate route smoke tests pass. See `docs/task-notes/ROUTE-001.md`. |
| AUTH-001 | Blocked | Browser token/subject exposure is removed and unconfigured auth fails closed. Final integration requires PostgreSQL plus approved Google/X and email-provider configuration; see `docs/task-notes/AUTH-001.md`. |

**更新时间：** 2026-07-12
**执行原则：** 前端原型完成不等于生产完成；任何资金、订单、身份或权限能力均须以前后端、数据库、审计与测试同时完成为准。  
**当前代码基线：** Next.js PWA 高保真原型与 NestJS API 已在正式仓库；PostgreSQL 迁移、身份/账户数据模型、SMTP 邮件发送及 Google/X 服务器端授权码 + PKCE 适配代码已实现，真实供应商凭据仍待注入和联调。Polymarket Gamma/CLOB 只读行情适配已接入并完成真实数据验证；真实合作方、资金、订单、KYC 提交与 Polymarket 交易执行仍未形成生产闭环，不得按生产能力宣称。

## 状态说明

| 状态 | 含义 |
|---|---|
| 完成 | 已进入仓库，且本阶段验收条件已满足 |
| 原型完成 | 有可演示界面或静态交互，但没有生产后端闭环 |
| 进行中 | 已开始实现，尚未验收 |
| 待审核 | 已完成本轮代码与验证，等待产品负责人确认后才可改为“完成” |
| 待完成 | 尚未开始 |
| 外部阻塞 | 依赖合作协议、法务或业务负责人决策 |

## 强制交付规则

1. 每个任务开工前必须阅读 `DESIGN.md`，并在任务备注中记录已阅读；没有该记录不得进入待审核。
2. 页面按正式 App 标准交付：覆盖用户完整任务、详情、确认、历史/回执、权限和异常状态；不得只完成首屏或静态理想状态。
3. 内容宁可完整而有用，不能空泛或偷省：使用真实业务字段、风险/费用/时间/状态信息和可操作控件；禁止占位文案、死按钮、空标签页和无意义卡片。
4. 新页面或重要流程必须产出或复用已批准的概念图；概念图与实现都必须遵守锁定的 Logo、顶部栏和导航规则。
5. 需要外部数据、合作方或 API 时，主动建立适配器接口和高保真模拟数据；不能因未接入真实 API 而省略状态、流程或页面。
6. 完成后写入 `docs/task-notes/<任务编号>.md`，状态改为“待审核”；只有产品负责人明确确认，才可改为“完成”。

## 0. 项目基线与协作

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| GOV-001 | 将产品规格、协作计划迁入正式仓库 `docs/` | 完成 | Codex | 无 | 产品规格与协作计划已可随代码评审 |
| GOV-002 | 锁定左上角 Logo、顶部操作区和底部导航规则 | 完成 | Codex | GOV-001 | `DESIGN.md` 与原型生成规范已明确唯一组件与使用范围 |
| GOV-003 | 建立任务编号、任务交接模板和完成定义 | 完成 | Codex | GOV-001 | 见 `AI-Agent-Collaboration-Plan.md` |
| GOV-004 | 清理/归档旧 `ui/` 原型与外层非正式素材 | 待完成 | Codex | 产品负责人确认 | 不影响正式仓库；保留必要品牌和视频资产 |
| GOV-005 | 建立迭代节奏：每日集成、每周验收、风险清单 | 完成 | Codex | GOV-003 | 每个任务有负责人、验收记录和明确状态 |

## 1. 前端与设计系统

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| FE-001 | H5/PWA 应用外壳、深色视觉系统、3D 场景 | 原型完成 | Codex | 无 | 现有首页、投资、钱包、详情等可交互原型可运行 |
| FE-002 | 正式路由拆分：`/home`、`/invest`、`/portfolio`、`/wallet`、`/ai`、`/profile` | 完成 | Codex | GOV-003 | 已建立集中路由映射和动态路由；生产构建通过。详见 `docs/task-notes/FE-002.md` |
| FE-003 | 可复用应用骨架组件：`Brand`、`TopBar`、`BottomDock`、`DetailHeader` | 原型完成 | Codex | FE-002 | 路由拆分后仍只使用一套固定 Logo 和导航组件 |
| FE-004 | 设计 token、字体、响应式断点与可访问性基础 | 完成 | Codex | FE-002 | Token 导出、跳过链接、焦点与触控基础已补齐；构建与响应式验证通过。详见 `docs/task-notes/FE-004.md` |
| FE-005 | 国际化与 RTL：7 种语言、金额/日期/时区 | 部分完成 | Codex | FE-002 | 已实现 7 种语言偏好、持久化和 Arabic RTL 文档方向；业务词典、统一格式化、翻译审核与 RTL 真机回归仍待完成。详见 `docs/task-notes/FE-005.md` |
| FE-006 | 登录、注册、会话、访客浏览、账户恢复页面 | 原型完成 | Codex | API-002、API-003 | 高保真 welcome/login/register/OTP/recovery 与访客流程已接入；Welcome 按钮对比度、玻璃球、Logo 与真实底座已按浏览器反馈修正；生产会话与权限回跳仍依赖 API |
| FE-007 | KYC、资格、补件、审核中、拒绝与受限页面 | 原型完成 | Codex | API-004 | 所有状态由服务端驱动；可返回原订单草稿 |
| FE-008 | 首页、投资列表、筛选、资产详情 | 原型完成 | Codex | API-006 | 搜索、筛选、详情、数据时点、文件、风险与资格限制真实接入 |
| FE-009 | Polymarket 市场列表、详情、报价、下单和异常状态 | 原型完成 | Codex | API-009、PARTNER-002 | 已接入实时 Gamma/CLOB 列表、详情、走势图、比例、盘口与只读订单预览；真实下单明确关闭 |
| FE-010 | 订单确认、处理中、成功、部分成交、失败、收据和争议 | 原型完成 | Codex | API-008 | 已补齐报价倒计时、风险确认、处理中时间线、成功、部分状态、失败恢复、详细 Demo 收据和支持入口；全部明确不执行真实资金或外部订单。生产状态机仍依赖 API-008。详见 `docs/task-notes/FE-010.md` |
| FE-011 | 投资组合、持仓、收益、结算、赎回、历史表现 | 原型完成 | Codex | API-010 | 所有金额可回溯到账本、订单和价格快照 |
| FE-012 | 钱包、充值、提现、转账、地址簿、白名单和交易详情 | 部分完成 | Codex | API-005、API-007 | 已补齐三网络选择、地址/金额前端预检、手续费预估、白名单确认与 Demo 回执；真实余额、链上广播、地址筛查、账本和人工审核仍依赖 API-005/API-007。详见 `docs/task-notes/FE-012.md` |
| FE-013 | AI 顾问、方案编辑、证据、来源、授权与预填订单 | 原型完成 | Codex | API-011 | AI 无直接资金权限；每笔交易独立确认 |
| FE-014 | 个人中心、安全、设备、通知、订阅、客服与关闭账户 | 部分完成 | Codex | API-003、API-004、API-012 | 已提供个人中心、退出、账户关闭、安全设备会话 Demo，以及通知筛选/标记已读/跳转；真实会话撤销、设备管理、工单、订阅及账户删除仍依赖后端。详见 `docs/task-notes/FE-014.md` |
| FE-015 | 全局加载、空、离线、过期、受限、错误和维护状态 | 部分完成 | Codex | API-001 | 已覆盖认证、Polymarket 与目录加载/空/离线/错误/降级/受限状态，并新增全局加载、运行时错误恢复、独立 404 错误页；其余 P0 页面仍需补齐。详见 `docs/task-notes/FE-015.md` |

## 2. 后端与 API

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| API-001 | 创建 `apps/api`、NestJS 模块骨架、OpenAPI、统一错误格式 | 完成 | Codex | GOV-001 | Nest API、版本化健康检查、OpenAPI、请求 ID、验证与统一错误格式已可运行。详见 `docs/task-notes/API-001.md` |
| API-002 | 身份与账户：用户、邮箱、OAuth、钱包签名挑战 | 完成 | Hermes | API-001、DB-001 | nonce、会话、绑定冲突与恢复均有测试 |
| API-003 | 会话、双重验证、Passkey、设备与安全事件 | 进行中 | Codex | API-002 | 已补安全因子列表、TOTP/Passkey step-up 撤销、恢复码清理与审计；类型检查、38 项测试和构建通过。真实 PostgreSQL 与正式域名 WebAuthn 验收仍待完成，详见 `docs/task-notes/API-003-FACTOR-MANAGEMENT.md` |
| API-004 | KYC、资格、地域、制裁与风险规则服务 | 完成 | Hermes | API-002、DB-002、PARTNER-001 | 用户、资产和订单均由同一资格服务判定；KYC/制裁/地域/风险规则与统一资格评估已实现，单元验证通过。详见 `docs/task-notes/API-004.md` |
| API-005 | 钱包适配、地址、余额、充值、提现、转账 | 部分完成 | Codex | API-002、DB-003、PARTNER-003 | 本地 Demo 已实库验收充值、内部转账和提现完成，余额/锁定余额/账本同步；真实托管、广播、白名单/筛查、异步执行仍待伙伴与生产环境。详见 `docs/task-notes/API-005.md` |
| API-006 | 资产目录、披露文件、价格和数据新鲜度 | 待审核 | Claude Code | DB-004 | 四类资产统一读取模型；数据过期不能下单 |
| API-007 | 总账与对账服务 | 部分完成 | Codex | DB-003、API-005 | 精确余额、不可变凭证、提现结算/退款、签名托管余额快照及差异案件已可用；真实供应商日终文件格式和联调仍待伙伴输入。 |
| API-008 | 报价、余额锁定、订单、执行、结算和争议状态机 | 待审核 | Codex | API-004、API-005、API-006、API-007 | 已完成本地四类订单的幂等锁款、成交、持仓、收益、预测结算、赎回及客服争议时间线；全链路验收与 146 项测试通过。详见 `docs/task-notes/API-008.md` |
| API-009 | Polymarket Adapter：市场同步、内外订单映射、状态回传、结算与对账 | 进行中 | Codex + Claude Code | API-006、API-008、PARTNER-002 | Gamma/CLOB 只读市场、订单簿与价格历史已接入；真实订单映射、状态回传、结算与对账未启用 |
| API-010 | 持仓、收益、价格快照、历史表现和赎回 | 待审核 | Hermes | API-007、API-008 | 已接入服务端订单持仓、收益分配与 Demo 赎回完成；持仓/钱包/账本在全链路验收中一致。真实链上退出与生产审批仍待完成。详见 `docs/task-notes/API-010.md` |
| API-011 | AI 编排：结构化建议、证据、来源、数据时点、安全拒绝与成本记录 | 待审核 | Claude Code | API-004、API-006、API-010 | AI 只能提出建议，无权执行资金操作 |
| API-012 | 通知、工单、邀请、订阅与偏好设置 | 待审核 | Codex | API-002、DB-005 | 已实现会话归属的工单/争议时间线、正式后台工单 RBAC、扫描后附件 UUID 引用、推荐奖励、营销偏好和通知全读；真实 S3/KMS/扫描器联调待外部环境。详见 `docs/task-notes/API-012.md`。 |
| API-013 | 后台 RBAC、审批、审计导出与管理 API | 待审核 | Hermes | API-003、API-004、API-007、API-008 | Core 管理写接口与独立 Admin 读取接口均使用可撤销会话和方法级最小权限；审批保持四眼约束，权限不足返回 403。真实 PostgreSQL 权限撤销/审计联调待测试库。详见 `docs/task-notes/API-013.md`。 |

## 3. 数据库与数据治理

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| DB-001 | PostgreSQL、迁移框架、连接池、开发/测试数据库 | 完成 | Codex | API-001 | PostgreSQL 16 实库已完成 `run → revert → run`、幂等复跑与开发/测试双库隔离验收；见 `docs/task-notes/DB-001.md` |
| DB-002 | 用户、身份、会话、设备、KYC、资格、风险和审计模型 | 完成 | Codex | DB-001 | 11 个核心表、约束/索引、不可变审计、共享状态词典与密文/HMAC 策略已通过 PostgreSQL 集成测试；见 `docs/task-notes/DB-002.md` |
| DB-003 | 钱包、链交易、充值、提现、转账、账本账户、分录与余额快照 | 进行中 | Codex | DB-001 | 已建立最小单位整数金额、双式分录延迟校验、并发防透支余额投影、不可变快照和资金状态表；类型检查、38 项测试与构建通过。真实 PostgreSQL 迁移/回滚及 5 项实库不变量测试待具备测试库后执行，详见 `docs/task-notes/DB-003.md` |
| DB-004 | 资产、产品、文件、报价、订单、执行、持仓、收益与结算模型 | 待审核 | Claude Code | DB-001 | 四类资产可共用核心状态模型；产品配置可版本化 |
| DB-005 | 通知、工单、邀请、订阅、费用、奖励和偏好模型 | 待审核 | Claude Code | DB-001 | 具备归因、版本、撤销和审计字段 |
| DB-006 | Polymarket 市场映射、外部订单映射、同步水位、回调事件、对账案件 | 待审核 | Codex | DB-004、PARTNER-002 | 七表迁移、唯一映射、同步水位、事件去重、结算与对账证据已实现；真实 PostgreSQL 迁移测试等待 `TEST_DATABASE_URL`。详见 `docs/task-notes/DB-006.md` |
| DB-007 | 数据保留、加密、脱敏、备份、恢复演练与删除流程 | 待审核 | Hermes | DB-001 | 加密复用 IdentityCrypto AES-256-GCM；脱敏纯函数 8/8 + 删除请求状态机/备份演练 5/5 全绿；新建 backup_drills+data_deletion_requests 两表。详见 docs/task-notes/DB-007.md |

## 4. 后台运营端

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| ADMIN-001 | 后台应用骨架、登录、RBAC 和工作台 | 待完成 | Codex + Claude Code | API-013 | 桌面操作台、权限边界和待办队列可用 |
| ADMIN-002 | 用户、KYC、资格、风险、申诉和地域策略页面 | 待完成 | Codex + Claude Code | API-004、API-013 | 受控证件访问、原因码、补件与审计可用 |
| ADMIN-003 | 钱包、提现、归集、网络状态、账本和对账页面 | 待完成 | Codex + Claude Code | API-005、API-007、API-013 | 高风险操作双人审批；差异可闭环 |
| ADMIN-004 | 资产、供应方、文件、上架、价格与 Polymarket 市场管理 | 待完成 | Codex + Claude Code | API-006、API-009、API-013 | 配置可版本化、审批、回滚且不破坏已有持仓 |
| ADMIN-005 | 订单、结算、收益、争议、客服、AI 运营和审计导出 | 待完成 | Codex + Claude Code | API-008 至 API-013 | 人工操作幂等、留痕、可按角色分工 |
| ADMIN-006 | 后台桌面原型图：工作台、KYC 审核、财资/对账 | 进行中 | Codex | GOV-002 | 输出到 `assets/generated/原型图/` 并与前台风格统一 |

## 5. 基础设施、安全与可观测性

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| INFRA-001 | 环境变量、密钥管理、开发/测试/生产环境隔离 | 部分完成 | Codex | API-001 | 已增加生产启动门禁：核心域名/CORS/数据库/Passkey/身份密钥缺失即失败，金融总开关要求正式供应商、地区白名单与 Webhook 密钥；真实 Secret Manager、权限分离和轮换演练仍待完成，详见 `docs/task-notes/INFRA-001.md` |
| INFRA-002 | Redis、任务队列、死信队列和回调消费 | 待审核 | Hermes | API-001 | 基于 PG 实现任务队列（SKIP LOCKED 领取、幂等入队、指数退避重试、死信标记、回调去重消费）；无新依赖；单元 8/8 全绿。详见 docs/task-notes/INFRA-002.md |
| INFRA-003 | 对象存储：KYC/产品文件/工单附件 | 待审核 | Codex | API-004、API-012 | 已实现 S3 预签名、大小/MIME/SHA-256 绑定、KMS 门禁、签名扫描回调、隔离下载和用户附件归属；真实 S3/KMS/扫描器演练待外部环境。详见 `docs/task-notes/INFRA-003.md` |
| INFRA-004 | 日志、指标、链路追踪、报警和事故开关 | 待审核 | Hermes | API-001 | Winston JSON 日志 + Prometheus 指标（HTTP/DB/业务）+ OpenTelemetry 追踪（Jaeger/OTLP）+ 阈值告警邮件；nest build 通过。详见 docs/task-notes/INFRA-004.md |
| INFRA-005 | CI/CD、类型检查、迁移、部署、回滚与 SBOM | 进行中 | Codex | API-001、FE-002 | GitHub CI、低内存门禁、迁移回滚脚本、依赖审查和 CycloneDX SBOM 已实现；首次远程运行、分支保护、托管数据库与发布演练待外部权限。详见 `docs/task-notes/INFRA-005.md` |
| INFRA-006 | PWA 更新、离线、深链接、推送和 Flutter 端计划 | 部分完成 | Codex | FE-002、API-012 | 当前有 manifest/service worker；正式更新策略与移动端尚未实现 |

## 6. 测试与质量

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| QA-001 | 单元、集成、端到端和视觉回归测试基线 | 部分完成 | Codex + Reasonix | FE-002、API-001 | 已新增关键页面、只读 Polymarket 与无效路由的自动化冒烟验证；组件、端到端操作与视觉回归仍待补齐。详见 `docs/task-notes/QA-001.md` |
| QA-002 | 登录、KYC、资格、资金和订单状态机测试 | 待审核 | Codex | API-002 至 API-008 | 全链路脚本已覆盖注册、KYC、入金、四类订单、收益、结算、赎回、转账和提现；Core Jest 29 suites / 146 tests 通过。生产失败注入与伙伴回调演练仍待完成。 |
| QA-003 | Polymarket 同步、订单、结算、撤市与 API 中断演练 | 待完成 | Reasonix | API-009 | 内外订单不重复扣款；只读降级正确 |
| QA-004 | 账本不变量、对账、费用、精度和收益计算测试 | 待完成 | Reasonix | API-007、API-010 | 余额、分录和外部凭证一致 |
| QA-005 | 多语言、RTL、可访问性、性能与真机测试 | 待完成 | Reasonix | FE-004、FE-005 | Android 12-15 与主流屏幕通过关键路径验收 |
| QA-006 | 安全测试：鉴权、权限、输入、回调、速率、敏感数据 | 待完成 | Reasonix | API-001 至 API-013 | 高风险缺陷关闭后才能上线 |

## 7. 设计原型与内容

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| DESIGN-001 | 前台核心原型：首页、投资、详情、预测市场、组合、钱包 | 进行中 | Codex | GOV-002 | 输出高保真长图，固定品牌与导航一致 |
| DESIGN-002 | 前台补充原型：AI、个人中心、登录/KYC、订单状态、通知/客服 | 进行中 | Codex | GOV-002 | 覆盖主要用户故事与非理想状态 |
| DESIGN-003 | 后台原型：工作台、KYC、财资/订单/对账、资产/Polymarket 管理 | 进行中 | Codex | GOV-002 | 桌面密度、角色操作与审批逻辑清楚 |
| DESIGN-004 | 清理重复/临时生成素材，并为每张原型写备注 | 进行中 | Codex | DESIGN-001 至 DESIGN-003 | 最终图全部在 `assets/generated/原型图/README.md` 可追溯 |

## 8. 合作方、法务与上线门槛

| ID | 工作项 | 状态 | 负责人 | 依赖 | 验收结果 |
|---|---|---|---|---|---|
| PARTNER-001 | KYC/AML、MPC、链风险、RPC/indexer 合作方确定 | 外部阻塞 | 产品负责人 | 无 | 合同、地区、SLA、回调和事故流程确认 |
| PARTNER-002 | Polymarket 代销/分销协议、接口权限、账户结构、费用分成与品牌规范 | 外部阻塞 | 产品负责人 | 无 | 可安全接入生产；地区、用户归属、争议与 API SLA 明确 |
| PARTNER-003 | TRON/Ethereum/Arbitrum 托管和资金操作路径 | 外部阻塞 | 产品负责人 | PARTNER-001 | 地址、充值、提现、归集与对账演练通过 |
| PARTNER-004 | AI 算力、RWA、股票产品合作与真实披露文件 | 外部阻塞 | 产品负责人 | 无 | 每个产品有资产/执行主体、费用、结算 SLA 和争议流程 |
| LEGAL-001 | 首发地域、制裁/高风险地区、产品资格和推广口径 | 外部阻塞 | 产品负责人 + 法务 | 无 | Eligibility Service 可执行的规则矩阵 |
| LEGAL-002 | 用户协议、风险披露、隐私、AI 条款、预测市场代销披露 | 外部阻塞 | 产品负责人 + 法务 | 可在下单前版本化展示并留存同意记录 |
| RELEASE-001 | 全链路生产彩排：KYC→充值→下单→结算→提现→对账→争议 | 待完成 | Codex + Claude Code + Reasonix | 全部 P0 | 资金、订单、审计、客服和合作方回报闭环 |

## 本轮建议启动顺序

1. `API-003`：完成会话、二次验证、Passkey、设备与不可变安全事件；它是登录后安全能力的唯一缺口。
2. `FE-006`、`FE-007`、`API-004`：完成访客→登录→KYC→资格受限的第一个端到端闭环。
3. `QA-001`：同步建立身份与安全闭环的自动化测试矩阵，先覆盖权限、会话撤销和复验失败。
4. `DB-003`、`API-005`、`API-007`、`FE-012`：完成钱包与账本闭环。
5. `API-006`、`API-008`、`API-009`、`FE-008` 至 `FE-010`：完成资产、订单与 Polymarket 代销闭环。
6. `PARTNER-*` 和 `LEGAL-*` 与研发并行推进；真实生产资金或预测市场交易不得在协议、地区与责任边界明确前开放。

## 2026-07-12 文档核验结论

### 2026-07-12 Polymarket adapter status update

- **API-009: 进行中。** 已接入公开 Gamma 市场发现数据，并建立 Relayer 服务端环境变量与安全状态输出；真实下单、撤单、资金操作和外部订单映射仍未启用。详见 `docs/task-notes/API-009.md`。

- **已完成（产品负责人确认）：** `GOV-001` 至 `GOV-003`、`GOV-005`、`FE-002`、`FE-004`、`API-001`、`API-002`、`API-004`、`DB-001`、`DB-002`。它们均有对应任务备注和代码/测试证据，满足完成定义（代码入库、验收记录、DESIGN.md 阅读记录），于 2026-07-12 由产品负责人复核改为"完成"。
- **正在实现：** `API-003`。本轮负责补齐会话鉴权、设备、TOTP、Passkey、敏感操作复验与安全审计。
- **尚未开始的关键链路：** 钱包与双式账本、资产目录、订单状态机、Polymarket 代销适配器、后台运营端、质量体系与基础设施。
- **外部前置未消失：** 首发地区、KYC/托管/链风控合作方、Polymarket 代销协议及法务披露仍为生产发布门槛。
