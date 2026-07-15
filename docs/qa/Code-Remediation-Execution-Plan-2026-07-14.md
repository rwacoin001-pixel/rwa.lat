# RWA.LAT 代码整改执行文档

> 2026-07-15 execution update: SEC-001 implementation is complete and pending review; evidence is in `docs/task-notes/SEC-001.md`. ROUTE-001 is the active next task. This repository remains Demo / Development and is not approved for production use.

> 2026-07-15 execution update: ROUTE-001 implementation is complete and pending review; evidence is in `docs/task-notes/ROUTE-001.md`. ADMIN-001 / ADMIN-DATA-001 is the next task area.

> **执行状态：第二阶段，暂缓。** 2026-07-14 决策：当前先完成本地 Demo 的全部用户操作、管理员操作和前后台数据联动，暂不实施安全加固与正式认证。当前唯一执行入口请使用：`docs/qa/Functional-Runthrough-Execution-Plan-2026-07-14.md`。本文件保留为系统跑通后的生产加固清单。

版本：1.0  
日期：2026-07-14  
适用仓库：`rwa-lat`  
用途：交由后续 AI 助手或开发人员逐项实施、测试和验收。  
文档性质：基于当前本地代码的整改计划，不代表生产上线批准。

---

## 1. 当前结论

当前版本可以继续用于 H5 页面演示和产品评审，但**不能按“已完成”或“可承载真实资金”验收**。

已确认：

- H5 TypeScript 检查和生产构建可通过；
- 指定 `http://localhost:3030` 后，41 条 H5 页面、Polymarket 公共市场只读接口和异常路由验证通过；
- Core API、Admin API 均可构建；
- Admin Frontend 类型检查通过，提高 Node 内存到 4 GB 后可构建，生成 32 条页面路由；
- 数据库迁移未启用 `synchronize`，现有 12 个迁移均包含 `down`；
- 当前主要问题集中在生产鉴权、接口路由、真实服务商适配、后台假数据、测试环境和工程质量门禁。

本次检查没有修改现有业务代码。后续实施必须保留用户或其他 AI 已经完成的 UI、文案和 Demo 交互，除非任务卡明确要求调整。

---

## 2. 强制执行原则

后续 AI 助手必须遵守以下规则：

1. 一次只处理一个任务编号，不得把多个 P0 问题混在一个大改动中。
2. 修改前先阅读目标文件及其测试，不覆盖无关的未提交改动。
3. 不得用“前端隐藏按钮”“增加一个 Demo 提示”代替服务端鉴权。
4. 不得把密钥放入任何 `NEXT_PUBLIC_*` 变量、前端包、localStorage 或可读 Cookie。
5. 不得相信浏览器提交的 `userId`、`adminId`、`approverId`、角色或 KYC 结果。
6. 资金、审批、KYC、制裁筛查、文件、队列等敏感操作必须采用“未配置即拒绝”。
7. Demo 数据可以保留，但必须由显式环境开关启用，且不能在生产环境静默回退。
8. 每个任务完成时必须同时提交代码、测试、环境变量说明和文档更新。
9. 不得因为构建工具配置了忽略错误就宣称通过；必须运行独立类型检查和测试。
10. P0 未全部关闭前，不得开启真实充值、提现、投资、交易或自动执行。

---

## 3. 优先级定义

| 级别 | 含义 | 发布要求 |
|---|---|---|
| P0 | 可导致未授权访问、身份伪造、资金或合规操作被绕过 | 上线前必须全部修复 |
| P1 | 影响真实业务闭环、数据可信度、可维护性和回归质量 | 公测前必须修复 |
| P2 | 影响国际化、可访问性、性能、运营和长期质量 | 正式发布前完成 |

推荐执行顺序：

`SEC-001 → ROUTE-001 → ADMIN-001 → AUTH-001 → COMPLIANCE-001 → API-ACCESS-001 → ADMIN-DATA-001 → TEST-001 → TOOLING-001 → I18N-001 → RELEASE-001`

---

# 4. P0：阻断上线的整改任务

## SEC-001：重建后台登录、会话与管理员身份来源

### 现状

- `apps/admin-frontend/src/app/api/auth/login/route.ts` 存在硬编码账号 `admin@rwa.lat`、密码 `admin123` 和固定 Cookie `mock-jwt-token`；
- 实际登录页没有调用上述内部路由，而是请求 `POST /v1/admin/auth/login`；当前后端没有对应登录接口；
- `apps/admin-frontend/src/lib/admin-api.ts` 使用 `NEXT_PUBLIC_ADMIN_API_KEY`，并回退到 `test-admin-key-123`；
- 多个页面把固定管理员 UUID 写入 localStorage，并作为 `x-admin-id` 发送；
- `apps/api/src/admin-rbac/admin-rbac.controller.ts` 使用 `x-admin-id` 和请求体中的 `approverId` 决定操作人；
- Admin Frontend 未发现统一的服务端路由保护中间件。

### 修改目标

建立真正的后台身份闭环：浏览器只持有 HttpOnly、Secure、SameSite Cookie；服务端从已验证会话中解析管理员身份、角色和权限，任何业务请求不得由浏览器自报管理员 ID。

### 建议架构

1. Admin Frontend 作为 BFF：
   - 登录表单请求同源 `/api/auth/login`；
   - BFF 再请求 Admin API；
   - BFF 设置 HttpOnly 会话 Cookie；
   - 所有后台数据请求优先走同源 `/api/admin/*`。
2. Admin API 提供：
   - `POST /v1/admin/auth/login`；
   - `POST /v1/admin/auth/logout`；
   - `POST /v1/admin/auth/refresh`；
   - `GET /v1/admin/auth/me`。
3. 登录至少支持：密码哈希校验、失败次数限制、MFA 扩展位、会话撤销、最后登录记录。
4. 管理接口通过 Guard 注入 `request.admin`，审批人取 `request.admin.id`。
5. 删除客户端 `x-admin-api-key`、`x-admin-id`、默认 UUID 和 `approverId` 身份断言。

### 重点文件

- `apps/admin-frontend/src/app/api/auth/login/route.ts`
- `apps/admin-frontend/src/app/(auth)/login/page.tsx`
- `apps/admin-frontend/src/lib/admin-api.ts`
- `apps/admin-frontend/src/components/layout/AdminLayout.tsx`
- `apps/admin-frontend/src/middleware.ts`（建议新增）
- `apps/admin/src/admin.controller.ts`
- `apps/api/src/admin-rbac/admin-rbac.controller.ts`
- `apps/api/src/admin-rbac/admin-rbac.dto.ts`

### 验收标准

- 全仓搜索不到 `admin123`、`mock-jwt-token`、`test-admin-key-123`；
- 全仓业务代码中不存在 `NEXT_PUBLIC_ADMIN_API_KEY`；
- 未登录访问 `/dashboard` 及任意后台页面时跳转登录页；
- 修改 `x-admin-id` 或请求体 `approverId` 不能改变操作人；
- Cookie 无法通过前端 JavaScript 读取；
- 用户 A 发起的审批不能由同一管理员 A 自批；
- 管理操作审计日志记录服务端会话中的真实管理员、IP、User-Agent、request ID 和时间；
- 包含登录成功、密码错误、账户锁定、MFA 待验证、会话过期、越权访问和注销测试。

---

## ROUTE-001：统一 API 路由前缀，消除 `/v1/v1/*` 和 `/admin/admin/*`

### 现状

- Core API 在 `apps/api/src/main.ts` 设置全局前缀 `v1`；
- wallet、compliance、catalog、portfolio、notification、storage、job queue 等控制器又声明 `@Controller('v1/...')`；
- 实际路由因此可能变成 `/v1/v1/...`；
- Admin API 在 `apps/admin/src/main.ts` 默认设置 `admin` 前缀，控制器又声明 `@Controller('admin')`；
- 实际路由可能成为 `/admin/admin/*`，而 Admin Frontend 请求 `/v1/admin/*`。

### 统一规则

采用以下单一规则：

- Core API：全局前缀固定为 `v1`，控制器内不得再写 `v1/`；
- Admin API：全局前缀固定为 `v1`，控制器使用 `admin`；
- Admin Frontend：统一请求 Admin API 的 `/v1/admin/*`；
- Core API 中如保留 RBAC 服务，应使用清晰的内部命名，例如 `/v1/admin-rbac/*`，避免与独立 Admin API 重叠；
- `/health` 是否绕过版本前缀必须显式决定并写进 README，不允许环境之间漂移。

### 需要修改的控制器

- `apps/api/src/wallet/wallet.controller.ts`
- `apps/api/src/ledger/ledger.controller.ts`
- `apps/api/src/job-queue/job-queue.controller.ts`
- `apps/api/src/object-storage/object-storage.controller.ts`
- `apps/api/src/catalog/catalog.controller.ts`
- `apps/api/src/portfolio/portfolio.controller.ts`
- `apps/api/src/admin-rbac/admin-rbac.controller.ts`
- `apps/api/src/observability/alerting/alerting.controller.ts`
- `apps/api/src/compliance/compliance.controller.ts`
- `apps/api/src/data-governance/data-governance.controller.ts`
- `apps/api/src/notification/notification.controller.ts`
- `apps/api/src/notification/user-ops.controller.ts`
- `apps/admin/src/main.ts`
- `apps/admin/src/admin.controller.ts`
- `apps/admin/.env.example`

### 验收标准

- 启动日志打印的路由与 OpenAPI 文档一致；
- 不存在 `/v1/v1/*` 或 `/admin/admin/*`；
- Admin Frontend 登录和所有数据请求只使用一个配置化基址；
- H5、Admin Frontend、自动化测试和 README 共用同一份路由契约；
- 增加路由烟雾测试，至少覆盖 health、auth、wallet、compliance、portfolio、admin login 和 admin users。

---

## AUTH-001：修复 Google/X OAuth 和邮箱身份闭环

### 现状

- `apps/api/src/identity/identity.controller.ts` 接受浏览器提交的 `provider + subject` 并直接调用 `oauthLogin`；
- 未验证 Google/X 授权码、ID Token、issuer、audience、state、nonce 和 PKCE；
- 邮箱注册接口直接返回 `verificationToken`；
- 找回接口返回 `recoveryToken` 和 `delivered`，可暴露账号是否存在；
- 邮箱验证后没有完整会话签发流程，未形成可用的邮箱登录闭环。

### 修改目标

1. Google/X 使用 Authorization Code + PKCE；浏览器只能提交授权码和 state。
2. 服务端验证 provider 响应，不接受任意 subject。
3. OAuth state 与 nonce 单次消费、短期有效，并绑定当前浏览器会话。
4. 邮箱验证与找回 token 只通过邮件发送，数据库只保存哈希。
5. 找回接口始终返回相同文案和状态，避免账号枚举。
6. 验证成功后签发受控会话，并支持刷新、注销、撤销和多设备策略。
7. Demo 模式必须由 `AUTH_ADAPTER=demo` 显式开启；生产环境禁止 Demo adapter。

### 重点文件

- `apps/api/src/identity/identity.controller.ts`
- `apps/api/src/identity/identity.service.ts`
- `apps/api/src/identity/dto/oauth-callback.dto.ts`
- `apps/api/src/identity/identity-crypto.service.ts`
- `apps/api/src/config/production-environment.ts`
- H5 登录、回调、邮箱验证、找回页面及其 API client

### 验收标准

- 提交伪造 subject 无法创建或登录账号；
- OAuth state 重放、code 重放、nonce 不匹配、audience 不匹配均失败；
- 注册和找回响应中不出现原始 token；
- 不论邮箱是否存在，找回响应完全一致；
- token 过期、已使用、被撤销时均不可再次使用；
- 会话可按设备查看和撤销；
- 七语言下登录错误不泄露内部 provider 信息。

---

## COMPLIANCE-001：保护 KYC、AML、准入和风险操作，并接入可替换真实 Provider

### 现状

- `apps/api/src/compliance/compliance.controller.ts` 未见用户或管理员鉴权 Guard；
- 多个接口硬编码 `demo-user`；
- KYC 审核结果、制裁筛查、准入判断、风险标记创建与解除可从公开接口触发；
- `apps/api/src/compliance/compliance.module.ts` 始终绑定 `StubKycProvider` 和 `StubSanctionsProvider`；
- 环境校验虽然要求非 Stub provider，但运行时模块并没有根据配置切换实现。

### 修改目标

1. 用户接口从已验证会话读取 `userId`；
2. KYC 决策、风险解除、准入配置等操作只允许具备权限的管理员；
3. 用户只能查看自己的 KYC、筛查和准入状态；
4. KYC/AML provider 通过配置工厂加载；
5. 生产环境未配置 provider 时应用启动失败或敏感请求明确拒绝；
6. Provider webhook 必须验签、幂等、防重放，并保存原始事件摘要；
7. 所有决定记录 provider、规则版本、输入摘要、决定原因、人工复核人和时间。

### 建议接口分层

- 用户：`POST /v1/compliance/kyc/start`、`GET /v1/compliance/kyc/status`；
- Provider webhook：`POST /v1/compliance/providers/:provider/webhook`；
- 管理员：`POST /v1/admin/kyc/:caseId/decision`、风险和准入配置接口；
- 禁止用户接口直接提交“approved/rejected”结果。

### 验收标准

- 未登录请求返回 401；
- 普通用户不能读取或修改其他用户的合规记录；
- 普通用户不能审批 KYC 或解除风险标记；
- `NODE_ENV=production` 且 provider 未配置时启动失败；
- Stub provider 仅能在显式 Demo/Test 环境加载；
- webhook 重放只处理一次；
- 集成测试覆盖用户、管理员、provider 三种身份和主要越权路径。

---

## API-ACCESS-001：为敏感控制器补齐认证、授权、所有权和审计

### 高风险控制器

| 模块 | 当前风险 | 最低权限要求 |
|---|---|---|
| `job-queue` | 可列出、消费、ACK/NACK、重放任务 | 仅内部服务身份或受限运维管理员 |
| `object-storage` | 可签发上传/下载 URL、完成上传、读元数据、删除对象 | 用户仅操作本人对象；删除和合规文件需管理员权限 |
| `portfolio` | 接受任意 `user_id` 查询持仓、历史和赎回 | 普通用户只允许当前会话用户；后台查询走独立管理接口 |
| `notification` | 可为任意 recipient 创建和查询通知 | 创建仅内部服务；用户只读本人通知 |
| `user-ops` | 可用任意 user ID 创建工单、邀请、订阅偏好 | 从会话读取用户；后台处理走管理员接口 |
| `alerting` | 可触发、确认告警并读取规则 | 仅内部监控或运维权限 |

### 通用实施要求

1. 建立 `UserAuthGuard`、`AdminAuthGuard`、`ServiceAuthGuard`，不要在每个控制器重复解析头部。
2. 建立资源所有权策略，例如 `ownerId === request.user.id`。
3. 内部服务身份使用短期签名凭证或 mTLS，不使用固定公开 API key。
4. 写操作必须生成审计事件和 request ID。
5. 列表接口增加分页、上限、过滤字段白名单和返回字段最小化。
6. 对上传、通知、队列、告警操作增加频率限制。

### 重点文件

- `apps/api/src/job-queue/job-queue.controller.ts`
- `apps/api/src/object-storage/object-storage.controller.ts`
- `apps/api/src/portfolio/portfolio.controller.ts`
- `apps/api/src/notification/notification.controller.ts`
- `apps/api/src/notification/user-ops.controller.ts`
- `apps/api/src/observability/alerting/alerting.controller.ts`

### 验收标准

- 所有未授权请求返回 401，越权请求返回 403；
- 修改查询参数或请求头不能读取其他用户数据；
- 队列消费、对象删除、手工告警只能由明确角色或服务身份执行；
- 每个控制器具有至少一组 401、403、正常授权和资源越权测试；
- OpenAPI 明确标注每个端点所需身份与权限。

---

# 5. P1：真实业务与工程闭环

## ADMIN-DATA-001：移除后台“失败即显示假数据”并补全真实 API

### 现状

- Admin Frontend 多个页面在请求失败后直接展示内置 mock 数据；
- 检查到约 19 个页面包含 fallback mock，约 9 处保留 `TODO: API call`；
- 页面调用的后台资源远多于现有 Admin API 实际实现；
- 当前这种行为会把接口故障伪装成正常业务数据。

### 修改目标

1. 建立后台页面—接口矩阵，逐页确认真实 endpoint、DTO、权限、分页和错误码。
2. 生产环境请求失败必须展示错误态、重试、request ID 和时间，不得显示假数据。
3. Demo 数据统一放在受控 fixture 层，只有 `NEXT_PUBLIC_APP_MODE=demo` 才可启用。
4. 页面明显标注 Demo 状态，但不要用 Demo 数据覆盖真实接口错误。
5. 把重复 fetch/header/pagination 逻辑集中到 typed API client。

### 首批接口范围

- users、KYC、eligibility、regions；
- assets、listings、providers、pricing；
- orders、settlements、withdrawals、wallets；
- ledger、reconciliation、collections、yields；
- disputes、support、appeals；
- audit、files、networks、risk、AI ops、Polymarket。

### 验收标准

- 生产构建中不包含 fallback 业务数据；
- 断开 Admin API 后，页面显示统一错误态而不是虚假记录；
- 每个页面有 loading、empty、error、permission denied 和 success 状态；
- 页面调用的所有接口都能在 OpenAPI 或共享 contracts 中找到；
- 管理端关键写操作支持二次确认、幂等键和审计日志。

---

## PROVIDER-001：完成钱包、KYC/AML、邮件、市场数据和资产合作方适配层

### 现状

- KYC/AML 始终使用 Stub；
- 钱包模块仍以 Stub custody adapter 为主；
- Polymarket 当前适合公共市场只读演示，真实交易仍关闭；
- 邮件、对象存储、交易、RWA、算力、美股等真实适配尚未形成统一生产闭环。

### 统一适配要求

每类 provider 必须有：

- 稳定的内部 interface；
- Demo/Test adapter；
- Production adapter；
- 配置工厂和启动时校验；
- 超时、重试、熔断、幂等；
- webhook 验签与重放保护；
- provider request ID 和内部 request ID 映射；
- 对账和人工补偿流程；
- 降级时明确拒绝资金操作，不静默返回成功。

### 验收标准

- `APP_MODE=production` 时任何 Stub adapter 都不能被实例化；
- provider 未配置时，对应真实操作明确不可用；
- 健康检查可区分服务正常、降级和不可用；
- 每个真实 provider 均通过 sandbox/UAT 测试并有回调验签用例；
- 资金操作具备端到端幂等、账本记录和每日对账。

---

## TEST-001：建立可重复的 PostgreSQL 集成测试并修复现有失败

### 当前结果

Core API 测试：

- 17 个 suites 通过；
- 9 个 suites 失败；
- 3 个 suites 跳过；
- 86 个 tests 通过，35 个失败，16 个跳过；
- 多数失败与缺少 `TEST_DATABASE_URL`/PostgreSQL 有关；
- 另有测试代码本身的 TypeScript 错误和 teardown 防护问题。

Admin API 测试：

- 5 个测试均因缺少 `ADMIN_DATABASE_URL` 或 `DATABASE_URL` 失败。

### 已确认的测试缺陷

1. `apps/api/test/portfolio/portfolio.integration.spec.ts`：
   - `opts.entities` 是 TypeORM `MixedList`，不保证可直接展开；
   - 当前 `entities: [...(opts.entities ?? []), ...]` 无法编译。
2. 多个测试在初始化失败后无条件执行 `ds.destroy()`，导致二次异常：
   - `apps/api/test/admin-rbac/admin-rbac.service.spec.ts`；
   - `apps/api/test/admin-rbac/admin-rbac.integration.spec.ts`；
   - `apps/api/test/job-queue/job-queue.service.spec.ts`；
   - 其他同类文件一并检索。
3. Jest 在数据库重试后存在 open handles，不能正常退出。

### 修改要求

1. 提供 Docker Compose 或 Testcontainers PostgreSQL 测试环境。
2. 测试开始前自动建库/迁移，结束后可靠清理。
3. 初始化失败时 teardown 必须安全：`if (ds?.isInitialized) await ds.destroy()`。
4. 处理 TypeORM `MixedList`，不要假设 `entities` 一定为数组。
5. 禁止把集成测试失败改成 `skip` 作为完成方案。
6. CI 中分别运行 unit、integration、migration 和 e2e。
7. 更新 `docs/Task-Board.md` 中与实际测试结果不一致的“已完成”描述。

### 验收标准

- 新机器只需一条命令即可启动测试依赖并执行；
- Core API 和 Admin API 测试全部通过且 Jest 正常退出；
- 不存在跳过的资金、权限、KYC、账本、赎回关键测试；
- CI 保存测试报告和失败日志；
- 数据库迁移可在空库执行，也可完整回滚测试迁移。

---

## TOOLING-001：修复 lint、构建门禁、Demo 验证端口和 Windows 特殊文件

### 现状

- 根 `package.json` 声明 `eslint .`，但仓库没有可执行 ESLint 依赖，`npm run lint` 失败；
- `scripts/verify-demo.mjs` 默认端口为 3019，而本地 H5 使用 3030；
- `next.config.mjs` 开启 `typescript.ignoreBuildErrors: true`；
- `apps/api/nul` 是 0 字节 Windows 保留名文件，会导致 `git add -A` 失败；
- Admin Frontend 在本机默认堆内存下构建曾发生 OOM，提高到 4 GB 后通过。

### 修改要求

1. 安装并锁定 ESLint 版本，建立与 Next.js/TypeScript 匹配的配置。
2. 将类型检查独立成 CI 必过任务；关闭 `ignoreBuildErrors`。
3. Demo 验证脚本默认端口与 README/启动脚本统一，推荐 3030；也可统一要求环境变量，但不能默认错误。
4. 安全删除 `apps/api/nul`，删除前确认其绝对路径位于本仓库；删除后验证 `git add -n -A`。
5. 为各 workspace 定义明确的 `lint`、`type-check`、`test`、`build` 脚本。
6. 对 Admin Frontend 分析内存占用；CI 可暂设 4 GB，但应避免将超长 mock 数据打包到页面。

### 验收标准

- 根目录和各应用的 lint/type-check/build 均返回 0；
- TypeScript 错误会阻止生产构建；
- `npm run verify:demo` 无需额外变量即可验证标准本地端口；
- `git add -n -A` 不再因 `nul` 失败；
- CI 在全新环境可复现全部命令。

---

## DATA-001：用户数据、确认记录和运营记录迁移到服务端

### 范围

目前 Guest、营销授权、AI 免责声明确认、UTM/邀请码归因、客服/争议、诈骗举报等部分数据仍依赖前端 localStorage 或 Demo 状态。真实运营必须迁移到服务端。

### 修改要求

- Guest 可浏览公开页面，但任何投资、充值、提现、交易、KYC 提交必须登录；
- AI 建议确认记录保存用户、建议版本、模型版本、免责声明版本、输入摘要、时间和执行结果；
- 营销授权按邮件、推送、社群分别保存，并允许全局退订；
- 推荐关系不可由客户端反复覆盖，需有首次绑定和反作弊规则；
- UTM 保存首触点和末触点，但不得在 URL 中携带敏感身份；
- 工单、投资争议和诈骗举报生成不可变引用号和状态时间线；
- 记录应支持用户导出、撤回、更正和法定保留期。

### 验收标准

- 清空浏览器存储或换设备后，已登录用户仍可看到自己的记录；
- 用户无法篡改推荐人、确认版本、审批状态或争议处理结果；
- 关键记录进入审计日志并可由后台按权限查询；
- 数据删除、保留、导出遵循现有隐私与治理文档。

---

# 6. P2：体验、国际化与发布质量

## I18N-001：完成七语言全页面覆盖和 RTL 验收

### 目标语言

- English `en`
- 简体中文 `zh-CN`
- हिन्दी `hi`
- Español `es`
- العربية `ar`
- Français `fr`
- Português `pt`

### 修改要求

1. 覆盖所有页面，不限于导航：产品详情、订单、KYC、钱包、提现、Polymarket、AI 建议、客服、争议、法律、风险和长文案。
2. 建立 key 完整性检查；任何语言缺 key 时 CI 失败，不允许静默回退后宣称完成。
3. 后端错误码与展示文案分离，前端根据错误码翻译。
4. 货币统一显示 USDT，并按需求显示 USD 参考值；数字、时间、百分比使用 locale 格式。
5. 阿拉伯语验证 RTL：顶部栏、返回按钮、弹窗、表格、图标方向和数字混排。
6. 法律、风险和投资长文案必须经母语与法务复核；AI 初译不能直接作为生产终稿。
7. 所有页面提供统一、精美的 Apple 风格语言切换入口，不遮挡标题和操作。

### 验收标准

- 自动脚本报告七种语言 key 100% 对齐；
- 关键用户旅程七语截图和人工验收完成；
- 320px 宽度、200% 文本缩放和 RTL 无截断、重叠或水平滚动；
- 法律和资金相关译文具有复核人、版本和日期。

---

## UX-001：统一生产状态、错误状态和危险操作体验

### 修改要求

- 所有真实操作显示 processing、confirmed、failed、reversed 等服务端状态，不用前端定时器伪造成功；
- 金额页面明确本金、费用、预计到账、网络、地址、汇率和风险；
- 固定底部 CTA 不遮挡可滚动内容和 iOS 安全区；
- 个人资料与 AI 对话弹层点击遮罩可关闭，键盘 Escape 可关闭，焦点受控并返回触发按钮；
- 固定顶部栏在页面切换时不闪现 Guest Demo 条；
- 空状态、离线状态、权限不足和服务不可用必须区别表达；
- `prefers-reduced-motion` 下关闭非必要 3D、视差和强光动画；
- 所有图标拥有可访问名称，触控区域至少 44×44 CSS px。

### 验收标准

- iOS PWA、Android Chrome、桌面 Chrome/Safari/Edge 完成核心路径回归；
- 页面切换无闪条、布局跳动、CTA 遮挡和无法返回；
- 键盘、读屏、200% 放大和 reduced motion 基本可用；
- 所有失败状态都提供可理解原因、重试或客服入口。

---

## RELEASE-001：建立上线门禁和生产开关

### 必备环境开关

- `APP_MODE=demo|staging|production`
- `FINANCIAL_EXECUTION_ENABLED=false` 默认关闭
- `POLYMARKET_TRADING_ENABLED=false` 默认关闭
- 各 provider 名称和凭据必须由服务端私密环境变量提供
- 生产环境不得加载 Demo fixture、Stub adapter 或测试密钥

### 上线门禁

1. P0 全部关闭并复验；
2. 所有测试、lint、type-check、build 通过；
3. 真实 provider sandbox/UAT 通过；
4. 账本、提现、投资和收益分配完成对账演练；
5. KYC/AML、地区准入和产品限制有可审计配置；
6. 法律主体、发行方、收益来源、费用、期限、赎回和争议规则由责任人确认；
7. 监控、告警、备份、恢复、密钥轮换和事故响应演练完成；
8. 生产开关启用需要双人审批并写入审计日志。

---

# 7. 页面—后端联调清单

| 用户页面/功能 | 必须依赖的真实能力 | 未接入时行为 |
|---|---|---|
| 注册/登录 | OAuth、邮箱、钱包签名、会话 | 明确显示不可用，不伪造登录成功 |
| Guest 浏览 | 公共 catalog、公共市场数据 | 可浏览，敏感操作引导登录 |
| KYC | KYC provider、AML、地区准入 | 未配置即拒绝投资 |
| Wallet | MPC/托管、链上监听、账本、对账 | 可展示 Demo，但不得生成真实成功状态 |
| Deposit | 地址分配、链上确认、入账 | 显示网络和确认数 |
| Withdraw | 地址校验、白名单、风控、审批、广播 | 未配置 provider 时禁止提交 |
| AI Compute | 产品条款、供应商、订单、收益 | 显示真实发行/供应主体和费用 |
| RWA | 发行方、认购、份额、收益、赎回 | 缺少准入或披露时不可认购 |
| US Stocks | 券商/代币化合作方、适当性 | 未确定法律形态时不可交易 |
| Prediction | 市场数据、交易合作方、地区限制、结算 | 首期只读时明确标注交易关闭 |
| AI Advisor | 模型、风险规则、免责声明确认 | 不得承诺收益或绕过适当性 |
| Portfolio | 真实持仓、估值、收益和流水 | 不接受任意 user ID 查询 |
| Referral | 邀请码绑定、奖励账本、反作弊 | 规则未配置时不发奖励 |
| Support/Dispute | 工单、证据、SLA、状态时间线 | 生成真实引用号，不只存本地 |

---

# 8. 建议交给其他 AI 的分批指令

## 批次 A：只处理 SEC-001

> 阅读 `docs/qa/Code-Remediation-Execution-Plan-2026-07-14.md` 的 SEC-001。只重建 Admin 登录、HttpOnly 会话、路由保护和管理员 actor 来源。不得修改 H5 UI，不得保留 `NEXT_PUBLIC_ADMIN_API_KEY`、`x-admin-id`、固定管理员 UUID、硬编码账号密码或 mock token。先补测试，再实现；完成后运行 Admin Frontend 类型检查/构建和 Admin API 测试，并提交变更文件、测试结果和剩余风险。

## 批次 B：只处理 ROUTE-001

> 统一 Core API 与 Admin API 路由前缀。Core API 只在 main.ts 设置 `v1`；控制器删除重复 `v1/`。Admin API 最终对外路径统一为 `/v1/admin/*`。同步 OpenAPI、README、前端 client 和烟雾测试。不要顺手重构业务逻辑。

## 批次 C：处理 AUTH-001 与 COMPLIANCE-001

> 将 OAuth 改成服务端 Authorization Code + PKCE 验证；邮箱验证/找回 token 不得返回浏览器。为 KYC/AML/准入补齐用户、管理员和 provider 三类鉴权，移除 `demo-user`，使用配置工厂加载 provider，生产环境 Stub 必须拒绝启动。必须提供越权、重放和 provider 未配置测试。

## 批次 D：处理 API-ACCESS-001

> 对 job queue、object storage、portfolio、notification、user ops 和 alerting 逐个补认证、权限、资源所有权、审计与限流。每个控制器至少提交 401、403、正常授权、跨用户越权四类测试。不得仅在前端隐藏入口。

## 批次 E：处理 ADMIN-DATA-001 与 TEST-001

> 删除生产环境失败即展示 mock 数据的逻辑，建立 typed Admin API client 和真实 endpoint 矩阵；显式 Demo 模式可使用 fixture。配置可重复 PostgreSQL 测试环境，修复 MixedList、teardown 和 open handles，确保 Core API 与 Admin API 测试全部通过。

---

# 9. 每个任务的完成报告模板

```md
## 任务编号

- 任务：SEC-001
- 实施人/AI：
- 日期：

### 修改文件

- path/to/file

### 行为变化

- 修改前：
- 修改后：

### 安全与数据影响

- 鉴权：
- 审计：
- 数据迁移：
- 回滚方式：

### 验证结果

- lint：通过/失败
- type-check：通过/失败
- unit tests：通过数/失败数
- integration tests：通过数/失败数
- build：通过/失败
- 手工路径：

### 未完成与风险

- 不允许写“无”而不解释。
```

---

# 10. 全部完成的最终 Definition of Done

只有同时满足以下条件，才能把项目标记为“可进入受控生产验收”：

- P0 任务全部关闭，且由非实施者复核；
- 浏览器包中不存在后台密钥、固定 token、默认管理员或可伪造 actor；
- 所有敏感接口具备认证、授权、所有权、幂等和审计；
- OAuth、邮箱、钱包签名、KYC/AML 和 MPC 使用真实或 sandbox provider 完成端到端测试；
- 路由契约统一，OpenAPI 与实际运行一致；
- Admin 页面不再用假数据掩盖接口故障；
- Core API、Admin API、H5 和 Admin Frontend 的 lint、类型、测试和构建全部通过；
- 七语言 key 对齐，关键长文案经母语和法务复核；
- 资金账本、提现、认购、收益、赎回和对账完成演练；
- Demo、staging、production 环境和数据严格隔离；
- 生产资金开关保持默认关闭，启用过程需双人审批和审计；
- 法律、合规、安全、运维和产品责任人完成书面签字。

在达到以上条件前，系统应继续标记为 **Demo / Development**，不得以构建通过或页面可点击替代生产验收。
