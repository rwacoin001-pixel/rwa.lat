# 生产适配器实现说明

本文描述仓库中的真实代码边界，不提供与代码不一致的“伪实现”。

## KYC：Didit 已安装

实现位置：

- `apps/api/src/compliance/kyc-provider.interface.ts`
- `apps/api/src/compliance/kyc/providers/real-didit-kyc.provider.ts`
- `apps/api/src/compliance/compliance.service.ts`
- `apps/api/src/compliance/compliance.controller.ts`

服务端通过 `POST /v1/compliance/kyc/session` 创建托管认证会话。浏览器只收到 `verificationUrl`，不会接触 Didit API Key。Didit 回调地址为：

```text
https://api.rwa.lat/v1/compliance/kyc/webhooks/didit
```

回调只接受 `X-Signature-V2`，验证 5 分钟时间窗并使用 HMAC-SHA256 对递归排序、紧凑、保留 Unicode 的 JSON 做常量时间比较。Didit Console 的测试回调会验签但不会修改生产状态。应用仅保存 provider reference 的哈希和密文，不保存 Didit 返回的原始证件/人脸数据。

需要的变量：

```dotenv
KYC_PROVIDER=didit
DIDIT_API_BASE_URL=https://verification.didit.me
DIDIT_API_KEY=<Secret Manager>
DIDIT_WORKFLOW_ID=<published workflow UUID>
DIDIT_WEBHOOK_SECRET=<destination secret_shared_key>
DIDIT_CALLBACK_URL=https://rwa.lat/profile/kyc?status=complete
DIDIT_API_TIMEOUT_MS=10000
DIDIT_API_MAX_RETRIES=2
DIDIT_API_RETRY_BASE_DELAY_MS=500
```

不要设置 `DIDIT_API_SECRET`：当前 Didit Sessions API 使用 `x-api-key`，Webhook 使用 destination 的 `secret_shared_key`，二者职责不同。

## 制裁筛查：仍为 stub

接口位于 `apps/api/src/compliance/sanctions-provider.interface.ts`，当前注入 `StubSanctionsProvider`。真实实现至少需要：

- sanctions、PEP、adverse media 和钱包风险的明确覆盖范围；
- 超时、有限重试、供应商降级和人工复核状态；
- 只保存脱敏引用，不把完整 PII 写入日志；
- 命中、误报、名单更新和复核回归测试；
- 供应商合同、DPA、数据地区和 SLA 书面确认。

未安装真实实现前，运行能力清单保持 `sanctions: 'stub'`。

## 托管钱包：仍为 stub

钱包/账本已经包含签名回调、幂等键、提现双人审批、执行租约和急停，但没有经审核的真实托管广播适配器。接入时必须证明：

- 创建地址和广播请求使用稳定幂等键；
- 回调签名、时间窗、事件去重和确认数映射正确；
- 广播超时不会造成重复转账；
- 失败退款只能通过账本凭证，不能直接改余额；
- TRON/Ethereum/Arbitrum 的正式合约地址、确认数和费用策略经过审批。

未安装真实实现前，运行能力清单保持 `custody: 'stub'`。

## 资金总门禁

环境变量写成 `live` 不能冒充真实实现。`validateApplicationEnvironment` 会同时校验配置和编译进镜像的能力清单。当前只有 KYC 标记为 live，因此：

```dotenv
PRODUCTION_FINANCIAL_FEATURES_ENABLED=false
WALLET_EXECUTION_ENABLED=false
WALLET_EXECUTION_WORKER_ENABLED=false
POLYMARKET_TRADING_ENABLED=false
```

必须保持以上值，直到制裁、托管、地区白名单、法律审批和真实资金演练全部完成。
