# 资金生产模式后端交付说明

状态：待审核（代码与无数据库测试已完成；真实供应商、生产数据库和远程部署仍是外部前置）  
日期：2026-07-15

## DESIGN.md 阅读记录

本阶段开工前已完整阅读根目录 `DESIGN.md`。本次仅修改后端资金状态机、数据库迁移、密钥轮换与部署基础设施，没有新增或改变前端视觉规则。

## 本阶段已独立完成

- 新增提现地址簿：地址加密保存、稳定 HMAC 去重、实时地址风险筛查、撤销状态和冷静期。
- 资金生产模式强制使用地址簿；不再接受临时粘贴地址直接出金。
- 新设备限制：资金模式下，设备必须已受信任，并且首次出现时间早于配置的冷静期（生产门禁要求至少 24 小时）。
- 提现单笔和滚动 24 小时限额在同一个数据库事务内检查；以用户级 PostgreSQL advisory lock 防止并发绕过。
- 资金模式下所有提现进入 `risk_review`，由至少两名不同管理员分别批准后才进入 `approved`。
- 管理员决定不可覆盖；同一管理员不能对同一提现重复决定。
- 管理员拒绝会通过不可变双式账本把锁定资金退回可用余额。
- 广播采用数据库执行租约；供应商必须以 `withdrawalId` 实现幂等，超时重试不能产生第二笔链上转账。
- 新增签名提现回调，覆盖广播、确认、完成和失败退款；重复完成回调保持幂等。
- `StubKycProvider`、`StubSanctionsProvider` 和 `StubCustodyAdapter` 均禁止资金生产；资金模式启动时如果实际注入的实现仍是 stub，进程直接拒绝启动。
- 生产配置禁止在 `PRODUCTION_FINANCIAL_FEATURES_ENABLED=false` 时单独打开 `WALLET_EXECUTION_ENABLED`。
- 对象存储新增逻辑桶到物理桶映射 `S3_BUCKET_MAP_JSON`，数据库和业务 API 继续使用稳定逻辑桶名。
- Identity AES-GCM 支持多版本密钥环：新密文使用活动版本，旧版本密文继续可读。
- Admin MFA 支持带密钥版本的 `v2` 密文，并兼容现有单密钥 `v1` 密文。
- 新增 Core/Admin 生产 Dockerfile、只读降权 Compose、独立迁移服务和低内存串行发布脚本。
- 补齐账本调整管理闭环：申请、不同管理员审批/拒绝、独立过账权限、平衡双分录、幂等凭证和审计；任何路径都不直接修改余额投影。
- 开放受 RBAC 保护的托管余额对账写入和查询接口；差异只创建对账案件，不自动修改余额。
- 双人审批完成时在同一数据库事务中写入提现执行任务；队列具有 Worker 所有权、执行租约、崩溃回收、指数退避和死信状态。
- 提现审批权限与执行权限分离；参与审批的管理员不能手工执行同一提现。
- 新增数据库级资金急停开关：单管理员可立即暂停，恢复必须由另一名管理员审批；暂停时 Worker 不领取任务。
- 正式 SMTP 发件适配已实现，验证码/恢复令牌只进入一次性 HTTPS 链接，不记录到日志。
- Google/X OAuth 已实现服务器端授权码、S256 PKCE、数据库一次性哈希 state、精确 redirect URI 和供应商用户资料校验；真实客户端凭据待外部注入。
- 新增签名托管余额快照回调；同一来源对账幂等，差异只开案和审计，不自动调整账本。
- 发布镜像包含不可由环境变量伪造的能力清单；当前清单仍为 Stub，`Live` 在迁移前即失败。

## 新增或扩展的接口

- `GET /v1/wallet/withdrawal-addresses`
- `POST /v1/wallet/withdrawal-addresses`
- `PUT /v1/wallet/withdrawal-addresses/:id/revoke`
- `POST /v1/wallet/callbacks/custody/withdrawals`
- `GET /v1/admin/wallet/withdrawals/reviews`
- `PUT /v1/admin/wallet/withdrawals/:id/approve`
- `PUT /v1/admin/wallet/withdrawals/:id/reject`
- `POST /v1/admin/wallet/withdrawals/:id/execute`
- `GET /v1/admin/ledger/adjustments`
- `POST /v1/admin/ledger/adjustments`
- `PUT /v1/admin/ledger/adjustments/:id/approve`
- `PUT /v1/admin/ledger/adjustments/:id/reject`
- `POST /v1/admin/ledger/adjustments/:id/post`
- `GET /v1/admin/ledger/reconciliations`
- `POST /v1/admin/ledger/reconciliations/custody`
- `POST /v1/ledger/callbacks/custody/reconciliations`
- `POST /v1/auth/oauth/:provider/start`
- `GET /v1/admin/operations/funds/withdrawal-execution`
- `POST /v1/admin/operations/funds/withdrawal-execution/pause`
- `POST /v1/admin/operations/funds/withdrawal-execution/resume-requests`
- `PUT /v1/admin/operations/funds/withdrawal-execution/resume-requests/:id/approve`
- `PUT /v1/admin/operations/funds/withdrawal-execution/resume-requests/:id/reject`

Core 管理接口要求可撤销 Admin session。提现审核使用 `wallet.withdrawals.manage`，手工执行另需 `wallet.withdrawals.execute`；急停使用 `operations.funds.pause`，恢复申请/审批使用 `operations.funds.switch.manage`；账本调整申请/审批使用 `ledger.adjustments.manage`，实际过账另需 `ledger.adjustments.post`；对账使用 `ledger.reconciliation.manage`。生产角色必须单独审批后授予这些权限，不能复制 Demo 角色。

## 数据库

新增迁移：

- `1783793000000-add-financial-withdrawal-controls.ts`
- `1783794000000-harden-job-queue-leases.ts`
- `1783795000000-add-oauth-authorization-flows.ts`
- `1783796000000-add-funds-operational-switch.ts`

迁移新增：

- `withdrawal_address_book`
- `withdrawal_approval_decisions`
- 提现的地址簿引用、策略快照、批准时间、执行租约和尝试次数
- 执行队列、用户 24 小时限额查询所需索引
- 队列 Worker 租约、过期回收索引和尝试次数约束
- OAuth 一次性哈希 state 与加密 PKCE verifier
- 资金运行开关和四眼恢复申请

迁移合约已通过：29 个迁移时间戳严格递增，并同时实现 `up/down`。真实 `run -> revert -> run` 仍必须在隔离的 `_test` PostgreSQL 执行。

## 已执行验证

- Core TypeScript：通过。
- Admin TypeScript：通过。
- 钱包、租约 Worker 与资金急停：22/22 通过。
- 对象存储安全：9/9 通过。
- Identity 密钥轮换：6/6 通过。
- Core 生产环境与镜像能力门禁：12/12 通过。
- Admin 边界与 MFA 密钥版本：7/7 通过。
- 账本核心、调整状态机与签名对账回调：8/8 通过。
- 正式邮件与 Google/X OAuth 适配：7/7 通过。
- PostgreSQL 队列租约核心：3/3 通过。
- 迁移合约：29 个迁移通过。
- Core 全量低内存单测：32 个套件、179/179 通过。
- Admin 全量低内存单测：2 个套件、9/9 通过。
- Core 生产构建（1024MB）与 Admin 生产构建（768MB）：通过。

因本机内存紧张，测试均为单文件、`--runInBand` 串行执行；密码学/Jest 转译使用 768MB 堆，其余优先使用 512MB。

## 仍不可由代码独立完成

- 正式 KYC、制裁、链上风险和 MPC/托管适配器及其凭据。
- 正式 SMTP、Google/X OAuth 的供应商账号、回调注册和经 Secret Manager 注入的凭据。
- 正式数据库、Secret Manager、S3/KMS/扫描器和真实回调联调。
- 隔离的 `TEST_DATABASE_URL` 与 Admin 测试库，用于真实执行迁移 `run -> revert -> run` 和数据库集成测试。
- 两名或以上真实管理员、最小权限角色和受控 MFA 注册/恢复演练。
- 供应商 `withdrawalId` 幂等保证、链重组策略、归集和日终对账文件演练。
- GitHub/部署平台授权、首次远程 CI、分支保护和远程发布。
- Polymarket 法律/合作授权与用户签名交易；代码继续强制关闭真实交易。

因此，当前可以部署“生产锁仓模式”；在以上输入完成前，不得部署或声明“真实资金已开启”。
