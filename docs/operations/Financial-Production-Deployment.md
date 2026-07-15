# 资金生产模式部署手册

## 1. 两种发布模式

`Locked` 是当前允许的首次生产发布：生产域名、数据库、Admin MFA、监控等按生产方式运行，但资金写入、提现广播和 Polymarket 交易全部关闭。

`Live` 只用于真实 KYC/制裁/托管适配器已安装、生产参数齐全、测试库和预发布演练全部通过之后。发布脚本要求显式 `-ApproveLiveFunds` 和非秘密的变更单号，避免误操作。

## 2. 当前机器的客观限制

2026-07-15 检查结果：当前机器没有 Docker、Kubernetes CLI 或云厂商 CLI，GitHub CLI 没有可用登录态，仓库也没有绑定具体托管平台。因此本机已完成部署产物和发布流程，但不能执行远程上线。

需要在有 Docker Compose v2 和部署权限的主机上执行以下步骤。

## 3. 准备配置

1. 复制 `deploy/production.env.example` 为 `deploy/production.env`。
2. 真实密钥从 Secret Manager 注入，不要写入 Git、工单或聊天。
3. 首次发布保持：

```dotenv
PRODUCTION_FINANCIAL_FEATURES_ENABLED=false
WALLET_EXECUTION_ENABLED=false
WALLET_EXECUTION_WORKER_ENABLED=false
POLYMARKET_TRADING_ENABLED=false
OBJECT_STORAGE_ENABLED=false
```

4. 填写生产数据库、域名、CORS、Passkey、代理跳数、Metrics Token、Admin MFA 和正式 SMTP；Google/X OAuth 可保持显式关闭，取得凭据后再分别开启。
5. `ADMIN_DATABASE_URL` 可以指向同一业务数据库，但应使用独立的最小权限数据库角色。

## 4. 上线前数据库门禁

在隔离的 `_test` 数据库执行：

```powershell
$env:TEST_DATABASE_URL = 'postgresql://.../rwa_lat_test'
pnpm --dir apps/api verify:migration-rehearsal
pnpm --dir apps/api test:database:low-memory
```

确认测试通过后，创建生产备份点，记录恢复负责人和变更单号。生产迁移只通过 `migrate` 一次性容器执行，不允许每个 API 副本在启动时自动跑迁移。

## 5. 生产锁仓发布

```powershell
.\deploy\release-production.ps1 `
  -EnvFile .\deploy\production.env `
  -Mode Locked
```

脚本按顺序执行：Compose 配置检查、API 镜像构建、Admin 镜像构建、Core/Admin 生产环境校验、编译进镜像的真实适配器能力校验、数据库迁移、服务启动、Core readiness 和 Admin health 检查。能力校验在迁移前执行，不能通过把环境变量写成 `live` 冒充真实实现。`COMPOSE_PARALLEL_LIMIT=1`，不会并行构建两个大镜像。

运行时容器采用非 root 用户、只读根文件系统、删除 Linux capabilities、`no-new-privileges`、临时 `/tmp` 和内存上限。

## 6. 开启真实资金前的额外条件

必须同时满足：

- Core 实际注入的 `CustodyAdapter.mode` 是 `live`；只写一个类似 live 的环境变量不够，stub 会让进程拒绝启动。
- KYC、制裁和托管适配器均有真实代码、生产凭据、超时/重试/熔断和签名回调测试。
- `S3_BUCKET_MAP_JSON` 为三个逻辑桶映射三个不同的正式物理桶。
- 提现冷静期和新设备限制均至少 86400 秒。
- 单笔限额、24 小时限额和至少两名管理员审批已由合规负责人批准。
- 审核角色已授予 `wallet.withdrawals.manage`，独立执行角色使用 `wallet.withdrawals.execute`；急停角色使用 `operations.funds.pause`，恢复审批角色使用 `operations.funds.switch.manage`；至少两名不同管理员已完成 MFA。
- `WALLET_EXECUTION_WORKER_ENABLED=true`，队列租约不短于提现广播租约；已演练 Worker 崩溃、租约回收、重试和死信告警。
- 托管供应商书面保证 `withdrawalId` 是广播幂等键。
- 预发布完成地址筛查、双审批、广播超时重试、确认、失败退款和对账演练。
- `POLYMARKET_TRADING_ENABLED=false` 继续保持不变。

## 7. 真实资金发布

完成上节全部条件后，在 Secret Manager/部署平台中设置资金变量，并执行：

```powershell
.\deploy\release-production.ps1 `
  -EnvFile .\deploy\production.env `
  -Mode Live `
  -ApproveLiveFunds
```

配置中还必须提供 `FINANCIAL_RELEASE_CHANGE_ID`。它只保存审批/变更单编号，不保存密钥。

发布完成后，数据库资金开关仍保持暂停。管理员 A 使用同一变更单调用 `POST /v1/admin/operations/funds/withdrawal-execution/resume-requests`，管理员 B 再调用对应的 `PUT .../:id/approve`。请求人与批准人相同会被数据库和服务同时拒绝；批准前 Worker 不领取提现任务。

## 8. 事故停机

发现重复广播、账本不平、回调签名异常或供应商状态不明时：

1. 具有 `operations.funds.pause` 权限的管理员立即调用 `POST /v1/admin/operations/funds/withdrawal-execution/pause`；该操作不需要等待第二人，Worker 随即停止领取任务。
2. 随后将 `WALLET_EXECUTION_WORKER_ENABLED=false`、`WALLET_EXECUTION_ENABLED=false` 和 `PRODUCTION_FINANCIAL_FEATURES_ENABLED=false` 写入部署平台并发布 Locked 模式，形成环境级第二道锁。
3. 保持 API 只读和审计查询可用，不删除提现、账本或回调记录。
4. 禁止用数据库手工 UPDATE “修余额”；必须走受控退款/调整凭证。
5. 导出审计、任务租约、提现执行租约、供应商引用哈希和链交易证据。
6. 完成签名余额快照对账和根因确认后，使用新的变更单及两人审批恢复。
