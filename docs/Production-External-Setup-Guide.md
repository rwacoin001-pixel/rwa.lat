# RWA.LAT 生产外部资源配置与验收教程

本文用于把 RWA.LAT 从“本地代码门禁通过”推进到“可部署、可联调、可回滚的生产基础设施”。它不代表真实金融业务已经获得法务、合规或合作方授权。

## 先说结论：当前并非整个项目全部完成

当前可以确认的是：本轮能在本机闭环的 P0 后端安全基线已经实现，并已用低内存串行方式通过类型检查、单元测试、构建、迁移契约检查和生产依赖审计。

| 范围 | 当前状态 | 还差什么 |
|---|---|---|
| Core/Admin 鉴权、RBAC、审计、限流、超时、Metrics 保护 | 代码完成，待生产演练 | 正式数据库、域名、代理和 Secret Manager |
| PostgreSQL 迁移与数据库集成测试 | 测试脚本完成 | 隔离测试库真实执行 |
| S3 预签名、SHA-256、扫描回调、隔离下载 | 代码完成，默认关闭 | 正式桶/KMS/IAM/扫描器和端到端演练 |
| Google/X、邮件 | 安全拒绝已实现 | 正式供应商选定后仍需实现生产适配器和前端 OAuth 回调 |
| KYC、制裁、托管、钱包广播 | 领域接口/桩和门禁已实现 | 合同、生产 API 后仍需实现并验收真实适配器 |
| Polymarket | 正式公开行情只读已实现 | 合作授权、地区/法务批准、用户签名、下单、结算和对账代码 |
| GitHub CI | 工作流已写入仓库 | 首次远程运行、分支保护、部署环境和发布演练 |
| 其他仓库任务 | 未全部完成 | Admin 页面、剩余 E2E/安全/真机测试、前端国际化等仍在任务板中 |

因此，在真实适配器和外部演练完成前：

- 保持 `PRODUCTION_FINANCIAL_FEATURES_ENABLED=false`。
- 保持 `WALLET_EXECUTION_ENABLED=false`。
- 保持 `POLYMARKET_TRADING_ENABLED=false`；当前生产启动会主动拒绝把它设为 `true`。
- S3/KMS/扫描器没有联调前保持 `OBJECT_STORAGE_ENABLED=false`。

## 1. 推荐的准备顺序

按以下顺序进行，可以避免前面的选择反复推翻后面的配置：

1. 确定生产/预发布域名和网络拓扑。
2. 创建两个隔离测试数据库并完成数据库验收。
3. 创建生产数据库、部署身份和 Secret Manager 条目，但暂不打开资金功能。
4. 配置邮件与 Google/X 的 Sandbox/测试应用。
5. 配置 S3、KMS 和恶意文件扫描测试环境。
6. 确定 KYC、制裁、托管、钱包和 Polymarket 合作方案。
7. 在 GitHub 首次跑通 CI，再部署 staging。
8. staging 完成失败注入、回滚和灾备演练后，才创建生产发布批准单。

## 2. PostgreSQL 测试库与 `run → revert → run`

### 2.1 低内存机器的推荐方案

优先使用托管 PostgreSQL 16+ 的测试实例，不在当前 Windows 电脑同时运行 Docker、PostgreSQL、Core Jest 和 Admin Jest。测试实例可以规格较小，但必须支持：

- 两个物理隔离的数据库；
- TLS；
- 创建 schema、表、索引和扩展；
- 测试结束后可以重建；
- 连接来源白名单只允许你的固定出口 IP 或 CI 网络。

数据库名必须使用代码认可的后缀：

| 用途 | 建议数据库名 | 变量 |
|---|---|---|
| Core 数据库测试 | `rwa_lat_core_test` | `TEST_DATABASE_URL` |
| Admin 集成测试 | `rwa_lat_admin_test` | `ADMIN_DATABASE_URL` |
| Core 正式库 | `rwa_lat_production` | `PRODUCTION_DATABASE_URL` |
| Admin 正式连接 | 同一生产库、独立最小权限角色 | `ADMIN_DATABASE_URL` |

Admin 集成测试启动时会执行 `DROP SCHEMA IF EXISTS app CASCADE`，所以 `rwa_lat_admin_test` 必须是专用可销毁数据库，绝不能指向开发、预发布或生产库。生产环境中 Admin API 需要读取 Core 的 `app` schema，默认方案是与 Core 指向同一生产数据库，但使用独立连接角色和最小权限，而不是复制一份会发生数据漂移的业务库。

### 2.2 创建角色和数据库

用托管数据库的管理账号连接到 `postgres` 后执行以下模板。不要把真实密码写进 SQL 文件；在交互式 `psql` 中用 `\password` 设置，或让云平台生成并直接存入 Secret Manager。

```sql
CREATE ROLE rwa_core_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE rwa_admin_test LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

CREATE DATABASE rwa_lat_core_test
  OWNER rwa_core_test
  TEMPLATE template0
  ENCODING 'UTF8';

CREATE DATABASE rwa_lat_admin_test
  OWNER rwa_admin_test
  TEMPLATE template0
  ENCODING 'UTF8';

\password rwa_core_test
\password rwa_admin_test
```

PostgreSQL 官方说明中，`NOSUPERUSER` 是默认且更安全的角色边界，`TEMPLATE template0` 可创建不带本地自定义对象的干净数据库：

- [CREATE ROLE](https://www.postgresql.org/docs/current/sql-createrole.html)
- [CREATE DATABASE](https://www.postgresql.org/docs/current/sql-createdatabase.html)

连接 URL 示例只展示结构，不能照抄密码：

```text
postgresql://rwa_core_test:<URL编码后的密码>@<host>:5432/rwa_lat_core_test?sslmode=require
postgresql://rwa_admin_test:<URL编码后的密码>@<host>:5432/rwa_lat_admin_test?sslmode=require
```

如果密码含有 `@`、`:`、`/`、`?`、`#` 等字符，必须先进行 URL 编码。

### 2.3 Core 低内存数据库验收

在新的 PowerShell 窗口中串行执行，不要与 Admin 测试并行：

```powershell
Set-Location 'D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat'
$env:NODE_ENV = 'test'
$env:APP_ENV = 'test'
$env:TEST_DATABASE_URL = '<从 Secret Manager 临时注入的 Core 测试库 URL>'
$env:DATABASE_POOL_MAX = '4'

pnpm --dir apps/api run verify:migration-rehearsal
pnpm --dir apps/api run test:database:low-memory

Remove-Item Env:TEST_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
Remove-Item Env:APP_ENV -ErrorAction SilentlyContinue
```

验收标准：

- `verify:migration-rehearsal` 最终输出 `run -> revert -> run` 通过；
- 13 个数据库套件逐个串行通过；
- 数据库名不是 `_test` 时脚本必须拒绝运行；
- 测试库不得与 `DATABASE_URL` 指向同一目标。

### 2.4 Admin 低内存数据库验收

使用第二个隔离数据库，仍然串行：

```powershell
Set-Location 'D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat'
$env:NODE_ENV = 'test'
$env:APP_ENV = 'test'
$env:ADMIN_DATABASE_URL = '<从 Secret Manager 临时注入的 Admin 测试库 URL>'
$env:PG_SSL = 'true'
$env:NODE_OPTIONS = '--max-old-space-size=768'

pnpm --dir apps/admin run test

Remove-Item Env:ADMIN_DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:PG_SSL -ErrorAction SilentlyContinue
Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
```

验收标准：Admin 数据库集成测试通过，并且测试结束后没有触碰 Core 测试库。

### 2.5 生产迁移和恢复演练

生产环境只执行 `show → backup → run → smoke`，不在生产库做 `revert` 演练。回滚必须先在 staging/测试库验证。

1. 用 `pg_dump -Fc` 创建加密存储的自定义格式备份。
2. 在空的恢复数据库中用 `pg_restore` 恢复。
3. 比较迁移表、关键表行数和只读查询。
4. 保存恢复耗时、RPO、RTO 和负责人证据。

参考：[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)、[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)、[PostgreSQL TLS](https://www.postgresql.org/docs/current/libpq-ssl.html)。

## 3. 正式域名、CORS、Passkey 与代理跳数

### 3.1 推荐域名拓扑

如果没有既定域名，可采用以下清晰分离的结构：

| 服务 | 示例 |
|---|---|
| 用户 PWA | `https://app.rwa.lat` |
| Core API | `https://api.rwa.lat` |
| Admin 前端 | `https://admin.rwa.lat` |
| Admin API | `https://admin-api.rwa.lat` |

对应配置示例：

```text
PUBLIC_API_URL=https://api.rwa.lat
CORS_ORIGINS=https://app.rwa.lat
PUBLIC_ADMIN_API_URL=https://admin-api.rwa.lat
ADMIN_CORS_ORIGINS=https://admin.rwa.lat
PASSKEY_RP_ID=app.rwa.lat
PASSKEY_ORIGIN=https://app.rwa.lat
```

规则：

- Origin 只包含协议、主机和非默认端口；不要带路径、查询参数或结尾 `/`。
- 生产全部使用 HTTPS；CORS 不使用 `*`。
- `PASSKEY_ORIGIN` 是用户实际进行 Passkey 注册/登录的前端 Origin，不是 API 地址。
- `PASSKEY_RP_ID=app.rwa.lat` 权限范围最小；只有明确需要跨子域共享 Passkey 时才考虑 `rwa.lat`。
- 正式 RP ID 变更会影响已注册凭据，域名确认后不要随意改动。

SimpleWebAuthn 要求在验证时明确校验 expected Origin 和 RP ID，并建议 Origin 不带结尾斜杠：[SimpleWebAuthn Server](https://simplewebauthn.dev/docs/packages/server/)。

### 3.2 DNS、TLS 和 CORS 验收

1. 在 DNS 平台创建上述记录，先指向 staging 网关。
2. 为每个域名签发受信任 TLS 证书，启用自动续期。
3. staging 中确认 `PUBLIC_*` 地址与浏览器访问地址完全一致。
4. 从允许的 Origin 发预检请求，应返回精确的 `Access-Control-Allow-Origin`。
5. 从未允许的 Origin 发请求，应被拒绝。
6. 用 Chrome/Android/安全钥匙各注册并验证一次 Passkey，再验证撤销。

### 3.3 如何确定 `TRUST_PROXY_HOPS`

从 Node 应用进程向客户端反向计数，每经过一个可信反向代理算一跳：

| 网络路径 | 典型值 |
|---|---|
| 客户端直接到 Node | `0` |
| 客户端 → 单个负载均衡器 → Node | `1` |
| 客户端 → CDN/WAF → 负载均衡器 → Node | `2` |

不要仅凭示例填写。必须满足：

- 每条到达应用的路径长度一致；
- 最靠外的受信代理覆盖而不是追加用户传入的 `X-Forwarded-For/Proto/Host`；
- 应用不能被公网绕过代理直接访问；
- staging 记录 `req.ip` 与已知测试出口 IP 比对；
- Core 和 Admin 如果网络路径不同，分别配置真实值。

Express 官方特别要求 `trust proxy` 与真实拓扑一致，否则客户端可能伪造转发头：[Express behind proxies](https://expressjs.com/en/guide/behind-proxies.html)。

你可以把以下非敏感信息发给我：

```text
用户 PWA Origin:
Core API URL:
Admin 前端 Origin:
Admin API URL:
Core 路径（例如 CDN -> LB -> Core）:
Admin 路径:
是否允许绕过 CDN/LB 直连应用: 否
Passkey 是否需要跨子域共享: 是/否
```

## 4. Secret Manager 与密钥生成

### 4.1 Secret 分组

如果使用 AWS，可在 Secrets Manager 中按环境和服务拆分：

```text
/rwa-lat/test/database-core
/rwa-lat/test/database-admin
/rwa-lat/production/core
/rwa-lat/production/admin
/rwa-lat/production/storage
/rwa-lat/production/partners/<provider>
```

应用运行身份只读取自己需要的 Secret；CI 身份不能读取生产 Secret；运维人员默认只能看元数据，紧急解密需要审批和审计。AWS 官方建议用 KMS 加密、最小权限、轮换、监控和私网访问：[Secrets Manager 最佳实践](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)。

### 4.2 密钥格式

| 变量 | 格式 | 生成要求 |
|---|---|---|
| `IDENTITY_HMAC_KEY` | 64 个十六进制字符 | 随机 32 字节 |
| `IDENTITY_ENC_KEY` | 64 个十六进制字符 | 另一个独立随机 32 字节 |
| `METRICS_BEARER_TOKEN` | 至少 32 字符 | 建议随机 48 字节后 base64 |
| `ADMIN_MFA_ENCRYPTION_KEY` | 32 字节的 base64 | 随机 32 字节 |
| `WALLET_WEBHOOK_SECRET` | 至少 32 字符 | 每个环境独立 |
| `OBJECT_STORAGE_SCAN_CALLBACK_SECRET` | 至少 32 字符 | 每个环境独立 |
| `PARTNER_CALLBACK_SECRETS_JSON` | partner → 独立 Secret 的 JSON | 不同合作方不可共用 |

在受控 Windows 管理机上可以生成到剪贴板，不在终端打印值。下面的写法兼容 Windows PowerShell 5.1 和 PowerShell 7。每次只运行一个生成块，立即粘贴到 Secret Manager，然后清空剪贴板；不同 Secret 必须重新生成，不能复用同一批随机字节。

生成 32-byte hex：

```powershell
[byte[]]$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
(([BitConverter]::ToString($bytes)) -replace '-', '').ToLowerInvariant() | Set-Clipboard
[Array]::Clear($bytes, 0, $bytes.Length)
```

生成 32-byte base64：

```powershell
[byte[]]$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes) | Set-Clipboard
[Array]::Clear($bytes, 0, $bytes.Length)
```

生成 48-byte base64 Metrics/callback token：

```powershell
[byte[]]$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
[Convert]::ToBase64String($bytes) | Set-Clipboard
[Array]::Clear($bytes, 0, $bytes.Length)
```

粘贴到 Secret Manager 并保存后清空剪贴板：

```powershell
Set-Clipboard -Value ''
```

不要把真实值放入 `.env.example`、GitHub Issue、任务文档、聊天、截图或日志。部署平台应在进程启动时注入环境变量。

### 4.3 轮换注意事项

当前身份、Admin MFA 加密仍是单个活动密钥。直接替换 `IDENTITY_ENC_KEY` 或 `ADMIN_MFA_ENCRYPTION_KEY` 会使旧密文无法解密；直接替换 HMAC key 也会影响旧校验值。因此正式轮换前还需要：

1. 增加 key version/key ring 支持；
2. 新密钥写入、旧密钥只读；
3. 后台批量重加密；
4. 验证后再删除旧密钥；
5. 演练失败回滚。

这是一项仍需完成的后端/运维工作，不能把“Secret 已创建”误当成“轮换已完成”。

## 5. S3、KMS、工作负载身份和恶意文件扫描

### 5.1 创建资源

后端当前使用三个逻辑桶：

- `rwa-kyc`：KYC 文件，单对象上限 20 MiB；
- `rwa-assets`：资产披露文件，单对象上限 100 MiB；
- `rwa-attachments`：工单附件，单对象上限 25 MiB。

AWS S3 桶名全局唯一。如果这些名称不可用，必须先把代码改为“逻辑桶 → 物理桶名”的环境映射，再创建带账户/环境后缀的物理桶，例如 `rwa-lat-production-<account>-attachments`。不要临时修改公开 API 的逻辑桶名来绕过。

每个物理桶至少配置：

1. Block Public Access 全部开启；
2. Object Ownership 使用 bucket owner enforced；
3. 默认 SSE-KMS，使用专用客户管理 KMS Key；
4. 拒绝非 TLS 请求；
5. 按前缀设置保留、隔离和删除生命周期；
6. CloudTrail Data Events 或等效对象访问审计；
7. 预签名签名年龄上限与应用 900 秒上限一致；
8. API、扫描器、运维角色分别使用最小权限。

应用建议使用 ECS/EKS/EC2/部署平台工作负载身份：

```text
S3_AUTH_MODE=workload
S3_REGION=<实际区域>
S3_ENDPOINT=<AWS 原生 S3 时通常留空；兼容服务填 HTTPS endpoint>
S3_KMS_KEY_ID=<KMS Key ARN 或供应商要求的 ID>
```

只有部署平台不支持工作负载身份时才使用 `S3_AUTH_MODE=static`，并把 `S3_ACCESS_KEY`/`S3_SECRET_KEY` 放进 Secret Manager。

AWS 说明预签名 URL 本质上是 bearer token，可用 `s3:signatureAge` 和网络路径条件限制；SigV4 支持 SHA-256 校验：[预签名 URL](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)、[对象完整性](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity-upload.html)、[SSE-KMS](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingKMSEncryption.html)。

### 5.2 扫描供应商

如果选 AWS GuardDuty Malware Protection for S3：

1. 为三个桶或指定上传前缀启用 Malware Protection；
2. 开启扫描结果对象标签；
3. EventBridge 接收结果；
4. 用一个最小权限 Lambda/服务把结果转换成 RWA 回调格式；
5. 使用 `OBJECT_STORAGE_SCAN_CALLBACK_SECRET` 对回调做 HMAC-SHA256；
6. 发送到 `POST https://api.rwa.lat/v1/storage/callbacks/scan`；
7. 同一事件重复投递必须返回幂等结果。

状态映射建议：

| GuardDuty | RWA 状态 |
|---|---|
| `NO_THREATS_FOUND` | `clean` |
| `THREATS_FOUND` | `infected` |
| `UNSUPPORTED` / `ACCESS_DENIED` / `FAILED` | `error` |

GuardDuty 使用至少一次投递，可能重复发送结果，因此桥接器必须保留稳定事件 ID；官方也建议启用扫描标签并用标签控制对象访问：[GuardDuty S3 工作原理](https://docs.aws.amazon.com/guardduty/latest/ug/how-malware-protection-for-s3-gdu-works.html)。

### 5.3 S3 验收矩阵

在 staging 逐项执行：

- 正常 PDF/PNG/TXT：上传成功，扫描前不可下载，`clean` 后可下载；
- EICAR 或供应商测试恶意样本：状态为 infected，永远不可下载；
- 错误 MIME、扩展名、大小：预签名阶段拒绝；
- 实际大小与申报不一致：完成阶段隔离；
- SHA-256 不一致：隔离；
- 扫描回调过期、签名错误、provider 不一致：拒绝；
- 相同事件重复：不重复改变状态；
- 预签名过期：PUT/GET 失败；
- KMS 解密权限移除：下载失败并告警；
- 删除/保留策略：与法务确认的保留期一致。

全部通过后才设置：

```text
OBJECT_STORAGE_ENABLED=true
OBJECT_STORAGE_SCAN_PROVIDER=<正式适配器名称>
```

## 6. 邮件、Google/X OAuth

### 6.1 邮件

以 Amazon SES 为例：

1. 选择与生产部署一致的 Region。
2. 验证发件域名，例如 `mail.rwa.lat`。
3. 在 DNS 添加 SES 提供的 DKIM 记录。
4. 配置 SPF；再为根域/发件子域配置 DMARC，初期可先观察再收紧策略。
5. 申请移出 SES Sandbox。
6. 配置退信、投诉和送达事件到 SNS/EventBridge 或等效 Webhook。
7. 创建 `verify_email`、`account_recovery`、`security_alert` 模板，并记录模板版本和语言。
8. 将 SMTP/API 凭据放入 Secret Manager；应用角色只允许发送指定 From 域。

官方步骤：[SES 验证身份](https://docs.aws.amazon.com/ses/latest/dg/creating-identities.html)、[申请生产访问](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html)。

当前 `IdentityDeliveryService` 在非 Demo 模式会返回 `IDENTITY_DELIVERY_NOT_CONFIGURED`。选定 SES、Postmark、SendGrid 等供应商后，我仍需实现真实发送适配器、退信处理、模板渲染和测试；仅提供 SMTP 密钥不会自动启用邮件。

你可以提供以下非敏感字段：

```text
邮件供应商:
Region/API Base URL:
发件域名:
From 地址:
Reply-To:
已完成 SPF/DKIM/DMARC: 是/否
退信/投诉 Webhook 文档链接:
模板语言:
Secret Manager 条目名（不是值）:
```

### 6.2 Google OAuth

1. 在 Google Cloud 建立独立 production project。
2. 配置 OAuth consent screen、应用名称、支持邮箱、主页、隐私政策和服务条款。
3. 验证你拥有的正式域名。
4. 创建 Web application OAuth Client。
5. 只登记精确 HTTPS redirect URI；路径应在正式前端实现后锁定，例如 `https://app.rwa.lat/auth/callback/google`。
6. 只请求登录必需的最小 scopes：`openid email profile`。
7. Client Secret 存入 Secret Manager；Client ID 可作为非敏感配置。
8. 验证 state、nonce、PKCE、issuer、audience、过期时间和邮箱验证状态。
9. 完成 Google 要求的应用验证后再切 production。

Google 要求 redirect URI 精确匹配，且生产 Web 应用使用你拥有的 HTTPS 域名：[Web Server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server)、[OAuth Policies](https://developers.google.com/identity/protocols/oauth2/policies)。

### 6.3 X OAuth

1. 在 X Developer Portal 创建 production Project/App。
2. 应用类型选择可以安全保管 Secret 的 Web App/Confidential Client。
3. 启用 OAuth 2.0 Authorization Code with PKCE。
4. 登记精确 callback URI，例如 `https://app.rwa.lat/auth/callback/x`。
5. 登录只申请最小 scopes，通常为 `users.read`；只有确有业务需要时才申请 `users.email`/`offline.access`。
6. Client Secret 存入 Secret Manager。
7. 服务端校验 state 和 PKCE，并处理拒绝、过期、撤销和重试。

X 同样要求 callback 精确匹配，并规定 Authorization Code + PKCE 流程：[X OAuth 2.0](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)。

当前后端 `POST /v1/auth/oauth/google|x` 会安全返回未配置，且前端正式 callback route 尚未闭环。域名和供应商应用确定后，我还需要继续实现并测试 provider adapter。

## 7. KYC、制裁、托管和钱包 Webhook

这些能力不能只靠“拿一个 API Key”完成。先由产品、法务和合规选择供应商与业务模式，再实现适配器。

### 7.1 供应商选择表

每个候选供应商都要求书面确认：

| 项目 | 必须确认 |
|---|---|
| 法律实体/数据角色 | Controller/Processor、分包商、跨境传输、DPA |
| 覆盖地区 | 国家、证件、语言、年龄、PEP/制裁/不良媒体 |
| 数据保留 | 原始证件是否落到我方 S3、删除 SLA、证据导出 |
| API | Sandbox/Production Base URL、认证、限流、版本和弃用策略 |
| Webhook | 签名算法、公钥/JWKS、事件 ID、重试、乱序和重放 |
| 决策模型 | 自动通过/拒绝/人工复核、原因码、申诉和补件 |
| SLA/事故 | 可用性、状态页、升级联系人、密钥吊销和灾备 |
| 费用 | 按验证/筛查/地址/交易计费，最低承诺和超额费用 |

### 7.2 KYC/制裁 Sandbox 步骤

1. 创建与 production 完全隔离的 Sandbox 项目和凭据。
2. 配置验证 level/workflow，保存其非敏感 ID。
3. 配置回调到 staging HTTPS 地址。
4. 使用供应商官方测试人测试：通过、拒绝、补件、重复回调、回调乱序、超时。
5. 将供应商原因码映射为内部稳定原因码；未知新字段不能导致整个解析失败。
6. 制裁/PEP 命中必须进入人工审核，不能由前端解除。
7. 保存 provider case ID 的加密值和不可变审计证据。
8. 通过供应商 production review 后创建全新 production key，不复用 Sandbox key。

以 Sumsub 为例，其官方提供独立 Sandbox/Production 模式并要求通过 Webhook 获取审核结果；Sandbox 可模拟 GREEN/RED 结果：[Sumsub API](https://docs.sumsub.com/reference/about-sumsub-api)、[Sandbox 测试](https://docs.sumsub.com/docs/test-in-sandbox)。这只是示例，不代表已替你选定供应商。

### 7.3 托管/钱包步骤

1. 先决定用户控制钱包、开发者控制 MPC 还是第三方全托管；明确谁有签名权。
2. 为 TRON、Ethereum、Arbitrum 分别确认 token 合约、确认数、重组策略、最低金额和费用。
3. Sandbox 创建 Vault/Wallet、充值地址、提现策略和审批人。
4. 提现执行至少经过 step-up、地址白名单冷静期、制裁/链风险筛查和四眼审批。
5. Webhook 必须验证供应商原生签名；如果供应商签名格式与当前 HMAC 不同，写一个正式 adapter，不要把签名校验关掉。
6. 事件按 provider event ID 幂等，处理 submitted/confirmed/failed/reorg/chargeback 等状态。
7. 每日获取余额/交易/费用对账文件，与双式账本自动核对。
8. 做小额主网 canary，再逐级提高限额。

例如 Fireblocks 已提供基于 JWKS 的 Detached JWS Webhook 验证，新接入应优先使用自动轮换的 JWKS，而不是旧静态公钥：[Fireblocks Webhook 验证](https://developers.fireblocks.com/reference/validating-webhooks)。这意味着如果选择 Fireblocks，需要为其原生签名新增适配器，不能假装它等于现有 `WALLET_WEBHOOK_SECRET` HMAC。

你可以把以下非敏感供应商资料发给我：

```text
KYC 供应商/产品:
制裁/PEP 供应商/产品:
托管/MPC 供应商/钱包模式:
Sandbox API 文档:
Production API 文档:
Webhook 签名文档:
Sandbox/Production Base URL:
Workflow/Level ID:
允许网络与 token 合约:
确认数/重组策略:
Secret Manager 条目名（不是值）:
```

## 8. 地区白名单与 Polymarket

### 8.1 地区白名单

`ALLOWED_REGIONS` 必须由法务/合规给出 ISO 3166-1 alpha-2 白名单，例如：

```text
ALLOWED_REGIONS=BR,MX,CL
```

上例仅演示格式，不是法律建议，也不能直接用于生产。至少形成以下矩阵：

| 地区 | 注册 | KYC | 浏览行情 | 入金 | 下单 | 提现 | 需要的投资者资格 |
|---|---:|---:|---:|---:|---:|---:|---|

地区判断需要同时考虑居住地、证件签发地、税务居民地、实时物理位置、制裁和产品销售规则，不能只信浏览器上报的国家。

### 8.2 Polymarket 上线门槛

在以下文件全部获得批准前保持交易关闭：

1. Polymarket builder/分销/合作协议；
2. 允许服务的法律实体和地区；
3. 用户资金、钱包、订单签名和争议责任；
4. KYC/KYB、制裁和地理封锁责任；
5. 费用、返佣、品牌、数据许可和 SLA；
6. L1/L2 凭据和用户私钥/签名的托管模型；
7. 结算、撤市、取消、部分成交和对账文件。

正式技术实现还必须包括：

- 每次下单前做实时 geoblock，不靠静态列表；
- 用户订单 payload 的 EIP-712 签名，后端不能代替用户无授权签名；
- L2 API key/secret/passphrase 只在服务端安全存储；
- 外部订单 ID 唯一映射、回调/轮询幂等、成交/取消/结算对账；
- 断网、503、订单未知状态、重试和人工处置；
- 限额、冷静期、审计和应急全局停机开关。

Polymarket 当前文档说明：公开 Gamma/Data/订单簿读取无需认证，交易需要 L1 私钥/EIP-712 与 L2 API 凭据，且创建订单仍需要用户签名：[认证](https://docs.polymarket.com/api-reference/authentication)。其地理限制接口应在下单前检查：[Geographic Restrictions](https://docs.polymarket.com/api-reference/geoblock)。

注意：当前仓库故意不接受 `POLYMARKET_TRADING_ENABLED=true`。即使你拿到凭据，也要先完成上述代码、法务和真实对账验收，不能直接打开开关。

## 9. GitHub、首次 CI、分支保护和部署权限

### 9.1 你需要准备的权限

建议创建 GitHub Organization，而不是用个人长期 PAT。需要：

- Repository Admin：首次配置 Actions、Rulesets/Branch protection、Environments；
- Cloud Deploy Role：只允许 GitHub OIDC 在指定仓库、分支和 Environment 获取短期凭据；
- Database Migrator Role：只用于发布迁移，不给应用运行时长期 DDL 权限；
- Production Approver：至少一名不能批准自己发起的发布的人；
- Secret Manager Admin 与 Secret Reader 分离。

GitHub 官方推荐 OIDC，让 Actions 换取云平台短期凭据，避免保存长期云密钥：[GitHub OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers)。

### 9.2 首次远程 CI

仓库已有：

- `.github/workflows/ci.yml`
- `.github/workflows/dependency-review.yml`

首次推送 feature branch 并创建 PR 后，应看到这些检查：

1. `Core API static and unit gates`
2. `PostgreSQL migration and integration gates`
3. `H5 and Admin frontend production builds`
4. `Dependency audit and SBOM`
5. `dependency-review`

数据库 job 自带临时 PostgreSQL 16 service，不需要把真实测试数据库 Secret 暴露给普通 PR。远程 CI 与你本机内存相互独立。

### 9.3 分支保护

在首次检查名称出现后，为 `main` 建规则：

- Require a pull request before merging；
- 至少 1–2 名审批；
- Require conversation resolution；
- Require status checks，上述检查全部必需；
- Require branches to be up to date；
- 禁止 force push 和删除；
- 管理员也不得随意绕过；
- CODEOWNERS 覆盖 migrations、workflows、auth、wallet、ledger、compliance；
- 启用 secret scanning/push protection（取决于 GitHub 套餐）。

GitHub 分支保护可要求检查成功后才能合并：[Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。Push protection 可在提交阶段拦截多类密钥：[Push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)。

### 9.4 staging/production Environments

创建 `staging` 和 `production`：

- staging：仅 `main`，可以自动部署；
- production：仅受保护分支/发布 tag，需要 required reviewer，禁止 self-review；
- production Secret 只绑定 production Environment；
- 使用 concurrency 确保同一环境同一时刻只有一次发布；
- 发布先备份、迁移、健康检查，再逐步切流；失败自动停止并执行已演练的回滚方案。

GitHub Environment 的审批通过前，job 不能访问其 environment secrets：[Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)。

当前 Actions 仍使用版本 tag 引用第三方 Action。更严格的供应链策略应在首轮 CI 后把 Action 固定到已核验的完整 commit SHA；GitHub 说明完整 SHA 是不可变引用方式：[Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)。

## 10. 最终生产演练顺序

每一步单独执行并保存证据，不要并行压垮本机：

1. 本地低内存 lint/unit/build。
2. 远程 CI 的临时 PostgreSQL 迁移和数据库测试。
3. 隔离托管测试库 `run → revert → run`。
4. staging 数据库备份和恢复。
5. staging 域名/CORS/Passkey/代理 IP 验收。
6. staging S3/KMS/扫描/隔离/删除验收。
7. 邮件/OAuth/KYC/制裁/托管 Sandbox 回调验收。
8. 资金功能仍关闭时部署 production 基础设施，验证只读健康检查和 Metrics。
9. 法务/合规/合作方书面批准后，执行小额 canary。
10. 对账、告警、回滚和争议全通过后，再申请打开资金功能。

最低健康检查：

```text
GET https://api.rwa.lat/v1/health
GET https://api.rwa.lat/v1/health/ready
GET https://api.rwa.lat/v1/metrics  （必须带 Metrics Bearer Token）
GET https://admin-api.rwa.lat/v1/admin/health
```

## 11. 你现在可以安全发给我的内容

可以直接在聊天中提供这些非敏感信息：

```text
1. Core TEST_DATABASE_URL 已在部署/本机 Secret 中配置: 是/否
2. Admin 测试数据库已配置: 是/否
3. 数据库 host、port、database name、是否 TLS（不要密码）:
4. PWA/Core API/Admin/Admin API 正式域名:
5. Core 和 Admin 的代理路径:
6. 选择的 Secret Manager/部署平台:
7. S3 Region、是否 AWS 原生、计划的物理桶名:
8. KMS Key ARN/ID 的非敏感标识:
9. 扫描供应商名称和文档链接:
10. 邮件/Google/X/KYC/制裁/托管供应商名称和官方文档链接:
11. ALLOWED_REGIONS 法务批准记录编号和 ISO 国家代码:
12. Polymarket 合作/交易授权状态（不要凭据）:
13. GitHub owner/repository、默认分支、部署平台名称:
14. 各 Secret Manager 条目名（不要 Secret 值）:
```

不要发送：数据库密码、OAuth Client Secret、API Key、钱包私钥/助记词、KMS key material、HMAC Secret、MFA Secret、生产 Session Token。
