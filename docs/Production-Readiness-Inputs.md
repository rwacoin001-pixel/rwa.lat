# RWA.LAT 生产接入输入清单

生产密钥不得写入本文档、Git、聊天记录或客户端环境变量。请将实际值配置到部署平台的 Secret Manager；仓库只记录变量名、负责人和验收证据。

逐项操作步骤、低内存数据库验收命令、域名/代理判定、S3/KMS/扫描器、OAuth/供应商与 GitHub 上线流程见 `docs/Production-External-Setup-Guide.md`。

## 1. 平台与域名

- `PUBLIC_API_URL`：生产 API HTTPS 地址。
- `CORS_ORIGINS`：允许访问 API 的精确 HTTPS Origin 列表，不使用通配符。
- `PASSKEY_RP_ID`、`PASSKEY_ORIGIN`：与正式 PWA 域名一致。
- 生产、预发布、Demo 是否使用独立域名、账户、数据库和供应方项目。

## 2. 数据与基础设施

- `PRODUCTION_DATABASE_URL`：PostgreSQL 16+，独立生产库、TLS、备份和恢复负责人。
- Redis/任务队列连接、死信策略、最大重试次数和报警接收人。
- KYC、产品文件及工单附件使用的对象存储桶、区域、KMS Key、病毒扫描与保留规则。
- 日志、指标、链路追踪、报警、事故通知和只读维护开关的平台选择。

## 3. 身份与通信

- `IDENTITY_HMAC_KEY`、`IDENTITY_ENC_KEY`：两个不同的 32 字节生产密钥及轮换/恢复流程。
- Google/X OAuth 正式 Client ID、Secret、回调地址和应用审核状态。
- 邮件供应商、发件域名、DKIM/SPF/DMARC、模板语言和退信处理。
- Android/PWA 推送供应商、应用 ID、签名证书和关键通知策略。

## 4. 合规与地区

- 正式 KYC、制裁/PEP、不良媒体和链上地址风险供应商及生产项目。
- 明确的 `ALLOWED_REGIONS`，不能在真实金融生产中使用 `ALL`。
- KYC 前是否允许提现、单笔/日/月限额、人工审核阈值和拒绝原因披露规则。
- 数据保留、用户删除、可疑交易报告、证据导出和监管访问要求。

## 5. 托管、资金与资产

- MPC/托管供应商、正式 API 地址、认证方式、Webhook HMAC、公钥/IP 白名单。
- TRON、Ethereum、Arbitrum 的正式 token 合约、确认数、最低金额、费用、归集和链重组策略。
- 提现地址白名单冷静期、新设备限制、四眼审批金额和财资值班人。
- 资产供应方、执行/托管方、结算账户、对账文件格式和日终截止时间。
- Polymarket 或其他交易合作方的正式协议、账户权限、地区范围、订单/结算责任和生产凭证。

## 6. 法务与发布批准

- 服务条款、隐私政策、风险披露、投诉/争议和产品文件的正式版本号与生效时间。
- 每类资产允许销售的地区、投资者资格、费用、流动性和风险披露。
- `PRODUCTION_FINANCIAL_FEATURES_ENABLED=true` 的最终批准人及批准记录。

## 当前代码门禁

- `APP_ENV=production` 时，核心域名、数据库、CORS、Passkey 和身份密钥缺失会直接阻止启动。
- `PRODUCTION_FINANCIAL_FEATURES_ENABLED=true` 时，KYC、制裁和托管适配器不得为 `stub/demo`，地区不得为 `ALL`，钱包执行和 Webhook 密钥必须就绪。
- 目前仓库仍只有桩 KYC/制裁/托管适配器，因此只能部署为生产基础设施上的只读/非资金状态，不能开启真实金融功能。
- 生产 API 还必须提供至少 32 字符的 `METRICS_BEARER_TOKEN`，并把 `TRUST_PROXY_HOPS` 设置为与真实反向代理路径完全一致的 0-10 整数。
- 多副本部署必须在 API 网关或共享 Redis 限流层实现一致的用户/IP 配额；应用内存限流只作为单实例后备。

## 合作方回调密钥

- 通过 Secret Manager 提供 `PARTNER_CALLBACK_SECRETS_JSON`，格式为合作方标识到独立密钥的 JSON 对象；每个密钥至少 32 个字符。
- 与每个合作方确认 `apps/api/README.md` 中的带时间戳 HMAC-SHA256 协议，包括事件 ID 唯一性、重试、五分钟时钟偏差、密钥轮换与事故吊销流程。
- 在签名夹具、重放行为、时钟同步和生产网络/IP 控制联合验收前，不启用该合作方回调。

## Admin API 生产边界

- 提供 `ADMIN_DATABASE_URL`（数据库名以 `_production` 结尾；默认与 Core 指向同一生产业务库但使用独立最小权限角色）、`ADMIN_CORS_ORIGINS`（仅后台前端精确 HTTPS Origin）和 `PUBLIC_ADMIN_API_URL`。Admin 集成测试必须使用独立可销毁的 `_test` 数据库。
- 将 `TRUST_PROXY_HOPS` 设置为真实反向代理路径长度；代理必须覆盖客户端传入的 `X-Forwarded-*` 请求头。
- 配置 `ADMIN_MFA_REQUIRED=true`，并通过 Secret Manager 提供随机的 32 字节 base64 `ADMIN_MFA_ENCRYPTION_KEY`。
- 上线前为每个管理员完成受控 TOTP 注册/恢复演练；生产环境中未启用 MFA 的管理员无法登录。
- 为生产角色逐项审批并配置 `users.read`、`redemptions.read`、`support.tickets.manage`、`storage.manage` 等最小权限；不得直接复制 Demo 角色权限集合。
- 多副本 Admin API 还需在共享网关/Redis 层实施登录与全局限流；应用内计数只作为最后一道单实例防线。

## 受控对象存储

- 明确是否设置 `OBJECT_STORAGE_ENABLED=true`；未完成下列输入前保持 `false`，API 会以 503 安全关闭存储操作。
- 提供 `S3_REGION`、可选的 HTTPS `S3_ENDPOINT`、`S3_AUTH_MODE=workload|static`；优先工作负载身份，静态模式才提供 `S3_ACCESS_KEY`/`S3_SECRET_KEY`。
- 提供专用 `S3_KMS_KEY_ID`，并为 API、扫描器和运维角色定义最小权限、桶策略、15 分钟 `s3:signatureAge` 上限与网络访问策略。
- 确认正式 `OBJECT_STORAGE_SCAN_PROVIDER`，通过 Secret Manager 提供至少 32 字符的 `OBJECT_STORAGE_SCAN_CALLBACK_SECRET`，完成 clean/infected/error、重复、过期和 checksum 不一致联调。
- 提供真实 PostgreSQL 与对象存储环境，执行迁移 `run → revert → run`、预签名 PUT/HEAD/GET、KMS 解密权限、隔离区和保留/删除演练。
