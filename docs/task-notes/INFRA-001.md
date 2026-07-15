# INFRA-001 生产环境与密钥门禁备注

**状态：** 部分完成  
**日期：** 2026-07-12

本轮新增 `validateEnvironment`：

- 非生产环境保持原有独立数据库命名和测试库隔离规则。
- 生产环境必须提供 `PRODUCTION_DATABASE_URL`、HTTPS API/Passkey 地址、精确 CORS Origin 和两个不同的非占位身份密钥。
- 金融生产总开关启用时，KYC、制裁和托管适配器不得为 `stub/demo`，服务地区不得为 `ALL`，钱包执行与 Webhook 密钥必须同时就绪。
- 新增单元测试覆盖缺失配置、本地 Origin、零值密钥、安全只读生产和桩供应商拒绝。
- 所需业务与供应商输入汇总在 `docs/Production-Readiness-Inputs.md`。

未完成：部署平台 Secret Manager 接入、按环境 IAM、密钥版本/轮换、紧急吊销、备份恢复和生产演练。
