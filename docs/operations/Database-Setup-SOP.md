# RWA.LAT 数据库配置与演练教程

本文适用于 PostgreSQL 16+。真实密码和完整连接串只能进入 Secret Manager，不要粘贴到聊天、Git、截图或工单。

## 1. 先选托管数据库

选择支持 TLS、自动备份、PITR、审计日志、维护窗口和访问控制的托管 PostgreSQL。Neon、AWS RDS、Cloud SQL、Azure PostgreSQL 都可以；不要因为仓库里曾出现 Neon 草稿就直接创建收费资源。

确认这些参数后再创建：云厂商/套餐、区域、是否私网、允许访问的服务、备份天数、RPO/RTO、维护窗口和费用上限。

## 2. 必须准备的数据库

| 用途 | 名称要求 | 环境变量 |
|---|---|---|
| Core 隔离测试 | 以 `_test` 结尾，例如 `rwa_lat_core_test` | `TEST_DATABASE_URL` |
| Admin 隔离测试 | 以 `_test` 结尾，例如 `rwa_lat_admin_test` | `ADMIN_DATABASE_URL`（测试任务中） |
| 生产业务库 | 以 `_production` 结尾，例如 `rwa_lat_production` | `PRODUCTION_DATABASE_URL` |
| Admin 生产连接 | 指向 `_production` 库，使用独立角色 | `ADMIN_DATABASE_URL` |

Core 和 Admin 生产连接可以指向同一个业务库，但必须使用不同角色。迁移身份、运行身份也应分离：迁移身份可改 schema，运行身份只拥有应用实际需要的 DML 权限。

## 3. 创建时的最低安全设置

- 强制 TLS，连接串带 `sslmode=require` 或平台等价设置。
- 禁止 `0.0.0.0/0` 直接访问数据库；只允许部署服务、CI 测试网络和受控运维入口。
- 生产开启删除保护、自动备份和 PITR；备份加密且至少做一次恢复演练。
- 每个环境独立凭据，不复用生产密码到测试库。
- 应用角色使用 `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`。
- 数据库连接串写入 Secret Manager；Terraform state 若含密码，必须使用加密远程 state 和严格访问控制。

## 4. 生成连接串并本地临时注入

格式：

```text
postgresql://ROLE:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

只在当前 PowerShell 会话临时设置测试变量：

```powershell
$env:NODE_ENV = 'test'
$env:APP_ENV = 'test'
$env:TEST_DATABASE_URL = 'postgresql://.../rwa_lat_core_test?sslmode=require'
$env:ADMIN_DATABASE_URL = 'postgresql://.../rwa_lat_admin_test?sslmode=require'
```

完成后清除：

```powershell
Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
```

## 5. 测试库验收（必须按顺序）

在仓库根目录执行。脚本会拒绝非 `_test` 数据库，并采用低内存串行模式。

```powershell
pnpm --dir apps/api run verify:migration-rehearsal
pnpm --dir apps/api run test:database:low-memory
```

第一条执行全量迁移、回退最新迁移、再应用最新迁移；第二条串行执行 13 个数据库套件。任何跳过、超时或失败都不能用生产库继续尝试。

Admin 测试也要使用隔离测试连接：

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=1024'
pnpm --dir apps/admin run test
pnpm --dir apps/admin run build
```

## 6. 生产迁移步骤

1. 记录发布 commit、迁移 head、负责人和变更单号。
2. 创建可恢复的备份点，并把备份恢复到空的演练库验证。
3. 先在 staging 用同一构建产物执行迁移和冒烟测试。
4. 暂停资金写入；使用专用迁移身份执行一次性迁移。
5. 启动 Core/Admin，检查 readiness、health、迁移表和关键只读查询。
6. 发布后完成账本/队列/回调对账，再解除 Locked 模式下允许解除的流量限制。

生产库不执行 `run → revert → run`。该操作只属于可销毁测试库；生产失败优先停服/锁仓并评估向前修复，禁止未经评审直接回退破坏性迁移。

## 7. 需要交给 Codex 的信息

不要发送密码。只需告诉我：选用的数据库厂商、区域、是否私网、数据库/角色是否已创建，以及 Secret Manager 中变量名称是否已经就位。需要登录控制台时，我会在右侧浏览器打开登录页，由你自己完成密码和 MFA。
