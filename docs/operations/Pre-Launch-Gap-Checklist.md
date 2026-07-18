# RWA.LAT 上线缺口清单

更新时间：2026-07-19。基准提交 `8ac2a70` 的 GitHub Actions 运行 `29545804295` 四组门禁全部通过。本清单只记录有证据的状态，不把“已有接口/示例配置”写成“外部服务已就绪”。

## 当前可以发布的模式

只允许 Locked（锁仓生产）模式：生产认证、数据库、监控可以启用，但充值记账以外的资金执行、提现广播、投资下单和 Polymarket 交易保持关闭。

```dotenv
PRODUCTION_FINANCIAL_FEATURES_ENABLED=false
WALLET_EXECUTION_ENABLED=false
WALLET_EXECUTION_WORKER_ENABLED=false
POLYMARKET_TRADING_ENABLED=false
OBJECT_STORAGE_ENABLED=false
```

当前代码已经安装真实 Didit KYC 适配器，但制裁筛查和托管适配器仍是 stub；编译进程序的能力门禁会拒绝真实资金模式。

## 已完成且有证据

| 项目 | 状态 | 证据 |
|---|---|---|
| 主分支 CI | 完成 | Actions `29545804295`：Core、PostgreSQL、前端、依赖/SBOM 均通过 |
| 数据库迁移彩排脚本 | 完成 | `verify:migration-rehearsal` 强制 `_test` 库并执行 run → revert → run |
| 低内存数据库测试编排 | 完成 | `test:database:low-memory` 串行执行 13 个套件 |
| 生产环境启动校验 | 完成 | 域名、CORS、身份密钥、SMTP、OAuth、对象存储、资金开关均有 fail-closed 校验 |
| H5 临时部署 | 完成 | `https://rwa-lat.rwacoin001.workers.dev`；这不等于正式域名已绑定 |
| Didit 代码适配 | 完成 | 官方 API 域名、`x-api-key`、托管会话、V2 回调验签、时间窗、状态机及单测 |
| Polymarket 交易保护 | 完成 | 生产配置明确拒绝 `POLYMARKET_TRADING_ENABLED=true` |

## 仍需要账号、合同或真实参数

| 优先级 | 缺口 | 需要的输入/权限 | 完成标准 |
|---|---|---|---|
| P0 | Core/Admin 运行服务器 | 部署平台账号、区域、网络拓扑 | Core readiness、Admin health 均为 200，服务不可绕过反代直连 |
| P0 | PostgreSQL 生产库 | 托管数据库账号；生产和隔离测试连接串 | TLS、备份/PITR、`_production`/`_test` 命名、迁移与恢复演练通过 |
| P0 | 正式域名 | Cloudflare DNS/TLS 权限 | `rwa.lat`、`api.rwa.lat`、`admin.rwa.lat`、`admin-api.rwa.lat` 精确绑定 |
| P0 | Secret Manager | 部署平台密钥管理权限 | 身份 HMAC/加密、Metrics、Admin MFA 等独立密钥注入且不出现在日志/Git |
| P0 | 正式邮件 | SMTP/SES/SendGrid 等参数及域名验证 | SPF、DKIM、DMARC 和注册/找回送达测试通过 |
| P0 | Google OAuth | Client Secret、正式发布状态和回调配置 | `https://rwa.lat/auth/callback/google` 完整登录回归通过 |
| P0 | GitHub 发布策略 | 仓库管理员权限 | main 分支保护、必需检查、环境审批和回滚权限已设置 |
| P1 | Didit 控制台 | API Key、Workflow ID、Webhook Destination Secret | Sandbox 会话和 Try Webhook 通过后再切 live application |
| P1 | S3/KMS/扫描器 | 区域、桶、IAM/KMS、扫描供应商与回调密钥 | 三桶隔离、恶意文件隔离和删除/保留策略演练通过 |
| P1 | 制裁/PEP/钱包风险 | 合同、API 参数、处置流程 | 真实适配器、误报复核和回调/降级演练通过 |
| P1 | 托管钱包 | 合同、网络、幂等规则和回调参数 | 充值、提现、确认、失败退款、对账和双人审批全链路通过 |
| P1 | 地区与法律 | 地区白名单、条款、隐私、风险披露及书面审批 | 法务/合规/风控签署并版本化归档 |
| P1 | X OAuth | 解除账号冻结并获开发者应用批准 | 在此之前 `X_OAUTH_ENABLED=false` |
| P2 | Polymarket 交易 | 正式合作、地区许可、交易授权 | 在此之前交易功能继续硬关闭 |

## 已确认不能据此宣称完成的项目

- CI 目前有依赖审计和 SBOM，但没有证据证明 CodeQL、Semgrep、TruffleHog 或第三方渗透测试已完成。
- Cloudflare Workers 临时地址可访问，不代表 Core API、Admin API、正式域名或生产数据库已经部署。
- Google Client ID 已创建，不代表 Client Secret 已安全注入，也不代表 OAuth 同意屏幕已发布。
- Didit 适配代码完成，不代表 Didit 账号、工作流、额度、Webhook destination 或生产合同已完成。
- 仓库内没有可安全直接 apply 的 Neon 生产 Terraform；数据库供应商和网络方案确认前不自动创建收费资源。

## 放行顺序

1. 完成 Locked 环境的服务器、域名、数据库、Secret Manager、SMTP 和 Google 登录。
2. 在隔离 `_test` 库执行迁移与数据库门禁，在 staging 做登录/KYC/回调演练。
3. 配置监控、告警、备份恢复和回滚值班。
4. Locked 模式上线，只开放浏览、账户和 KYC；所有资金执行保持关闭。
5. 制裁、托管、地区、法律和双人审批全部签署并演练后，另开真实资金变更单。

详细发布命令见 `docs/operations/Financial-Production-Deployment.md`，数据库步骤见 `docs/operations/Database-Setup-SOP.md`。
