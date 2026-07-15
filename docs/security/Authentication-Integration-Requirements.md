# RWA.LAT 登录与注册接入要求

版本：1.0  
结论：当前 H5 为 Demo 交互；后端已有身份、设备和会话数据模型，但四类登录尚未形成生产闭环。

## 1. 邮箱登录/注册

目标流程：邮箱提交 → 一次性验证码或 Magic Link → 服务端验证 → 设备识别 → 会话签发。首版建议不使用密码，以减少密码泄露和找回风险。

需要公司提供：

- 发送域名，例如 `auth.rwa.lat`；
- 邮件服务商账号（Amazon SES、Postmark 或 SendGrid 三选一）；
- SMTP/API 凭据，仅保存于服务端密钥库；
- 发件人名称、发件地址、退信地址；
- SPF、DKIM、DMARC DNS 记录；
- 七语言验证码、登录提醒和找回邮件的法务批准版本；
- 验证码有效期、尝试次数和风控阈值。

禁止把验证 token 返回给浏览器；找回接口无论邮箱是否存在都返回相同结果。

## 2. Google 登录

实现方式：Google OAuth 2.0 / OpenID Connect Authorization Code + PKCE。服务端必须验证 `issuer`、`audience`、`nonce`、`state`、过期时间和授权码，不能信任浏览器提交的 Google `subject`。

需要公司提供：

- Google Cloud 项目；
- OAuth Client ID 与 Client Secret；
- 已批准的品牌名称、Logo、隐私政策和用户条款 URL；
- JavaScript origin：`https://rwa.lat` 及预发布域名；
- Redirect URI，例如 `https://api.rwa.lat/v1/auth/oauth/google/callback`；
- 联系邮箱及 OAuth consent screen 审核资料。

## 3. X 登录

实现方式：X OAuth 2.0 Authorization Code + PKCE。仅请求身份所需的最小 scope，不把 X access token 暴露给 H5。

需要公司提供：

- X Developer Project 与 App；
- OAuth 2.0 Client ID 与 Client Secret；
- Callback URI，例如 `https://api.rwa.lat/v1/auth/oauth/x/callback`；
- Website、Terms、Privacy、Organisation 信息；
- 允许的 scope，建议首版仅 `users.read offline.access`（是否需要离线授权由安全评审决定）。

## 4. 钱包签名登录

Ethereum/Arbitrum 使用 EIP-4361 Sign-In with Ethereum；TRON 使用独立 TronLink/TronWeb 签名适配器。挑战必须保存于数据库，包含域名、URI、chain ID、nonce、签发时间、过期时间和 request ID，并单次消费。

需要公司提供：

- Reown/WalletConnect Project ID（如采用 WalletConnect）；
- 正式域名和允许的 chain ID：Ethereum 1、Arbitrum One 42161、TRON 主网；
- 钱包连接品牌资料与 Deep Link 回跳域名；
- 是否支持 MetaMask、WalletConnect、TronLink 的产品决定；
- 钱包地址与平台账户的绑定/解绑、重复绑定和账户恢复政策。

钱包登录不等于 MPC 托管钱包。外部签名钱包只证明控制权；平台托管钱包仍由可替换 MPC 服务层创建。

## 5. 会话与安全基线

- Access token 10–15 分钟；旋转 refresh token 30 天；服务端仅保存哈希；
- Web 优先使用 `Secure`、`HttpOnly`、`SameSite=Lax/Strict` Cookie；
- 同时允许最多 3 个可信设备；新设备登录发送安全通知；
- 投资、提现、地址白名单、关闭账户触发 Passkey/TOTP 二次确认；
- OAuth 账号与邮箱/钱包合并必须二次验证，禁止仅凭相同邮箱自动合并；
- 所有挑战、失败、绑定、解绑、会话撤销和风控结果写入审计记录。

## 6. 当前代码状态

| 能力 | 当前状态 | 上线差距 |
|---|---|---|
| 邮箱注册 | 后端可创建 pending identity | 尚未发送邮件，也没有完整登录流程 |
| Google/X | Demo 适配器可按 provider subject 展示完整登录效果 | 本地演示可保留；生产域名必须改为正式 code exchange，且不得把 Demo 适配器暴露到公网 |
| 钱包签名 | 已有 EIP-191 验签原型 | nonce 在内存；缺 SIWE 文本、数据库持久化、TRON 和前端钱包连接 |
| 会话 | 已有哈希 token、设备和撤销模型 | H5 尚未接 API；需 Cookie/刷新、限速和风控 |

## 7. Demo 与生产隔离约定

- 本地 Demo 保留邮箱、Google、X、钱包签名、KYC 与会话的可交互效果，支持离线展示；
- Demo 请求必须返回明确的 `executionMode: demo`，不得生成真实访问令牌、真实托管地址或外部订单；
- Demo 数据使用独立命名空间、独立数据库或本地存储，生产凭据绝不进入 `NEXT_PUBLIC_*`；
- 生产构建由环境变量选择正式适配器，并在发布流水线中校验 OAuth、邮件、钱包挑战与审计配置；
- 界面展示“Demo”状态，但不禁用流程，以便完整评审加载、错误、成功、恢复和离线体验。
