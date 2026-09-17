# PARTNER-002 — Didit KYC 生产启用（2026-09-18）

## 完成内容
- 生产环境启用 Didit（工作流 **Free KYC** `e31ff861-0416-4956-b2b5-37c654d8b45c`）：
  Render `rwa-lat-api` 环境变量写入 `KYC_PROVIDER=didit` + `DIDIT_API_KEY` / `DIDIT_WORKFLOW_ID` / `DIDIT_WEBHOOK_SECRET` / `DIDIT_CALLBACK_URL`，并完成部署（autoDeploy 关闭，手动触发）。
- **Webhook 验签修复**（commit `e4add68`）：控制台 "测试 Webhook" 的载荷不含 `event_id`（真实事件含），严格字段检查会把签名有效的测试投递误判为 401。现在缺 `event_id` 时合成稳定 ID；签名与时间戳校验保持严格。新增真实验签单测 `test/compliance/didit-webhook-verify.spec.ts`（地面真值来自 webhook.site 抓包）。
- 制裁筛查按操作方决策切换为 `SANCTIONS_PROVIDER=disabled`（一律放行并在 ScreeningCase 如实记录 `screening_disabled_by_operator`，见 commit `be7463b`）。

## 验证证据
- 冒烟：`POST https://verification.didit.me/v3/session/` → HTTP 201（会话 98a81e5a-…）
- 全链路：Didit 控制台 "测试 Webhook" → **响应状态 200 成功**（目标 `https://api.rwa.lat/v1/compliance/kyc/webhooks/didit`）

## 凭证管理
- 全部在 DPAPI 密钥库（`DIDIT_*`），说明见 `Desktop\rwa\README-secrets.txt`
- 控制台 API 密钥：`rwa-lat-backend`（生产）；`rwa-lat-prod` 从未使用，可吊销
- 每个 Webhook 目标有**各自独立**的签名密钥

## 注意
- 测试事件 body 无 `event_id`；真实事件有（`X-Didit-Test-Webhook: true` 头标识测试）
- 相关运维技能：`didit-kyc-ops`（控制台/验签/抓包方法论）、`render-api-ops`（Render API 两个致命坑）
