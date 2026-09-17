# MANUAL-CUSTODY-2026-09-18 — 钱包手动托管模式（自持密钥）

> 目标：脱离演示/桩模式，用「操作员自持密钥 + 公开链 API」实现真实的 USDT(TRC-20)
> 收付全链路：入金地址池 → 链上监听入账 → 白名单自动打款 / 其余双人审批 → 热钱包签名广播。
> 不使用 MPC、不接托管商、不接第三方链上数据订阅（免费轮询）。

## 交付内容（后端）

### 1. 入金地址池
- 表 `app.deposit_pool_addresses`（迁移 `1783798000000-create-manual-custody.ts`）：
  地址/私钥均以身份密钥环 AES-256-GCM 加密；`key_held=false` 表示仅收币导入地址。
- `DepositPoolService`：批量生成（1–100/次）、导入（可选带私钥，自动校验私钥↔地址匹配）、
  停用（仅未分配）、按用户原子分配（advisory lock + `FOR UPDATE SKIP LOCKED`，每用户每网络一址）。
- 用户调用 `POST /v1/wallet/deposit-addresses/tron` 时先从池中分配；池空返回
  `WALLET_ADDRESS_POOL_EXHAUSTED`（503，不伪造地址）。

### 2. 链上监听（`ChainWatcherService`，默认关闭）
每轮回合三件事（免费 TronGrid 轮询，默认 120s）：
1. **入金检测**：对已分配地址按游标增量拉取 TRC-20 转入 → 走既有
   `recordDepositObservation` 管道落 `chain_transactions`/`deposits`。
2. **入金确认**：`gettransactioninfobyid` 计算确认数，达到 20 确认（solid）且
   「充值入账」开关开启时经账本桥入账；回执非 SUCCESS 标记 `rejected`。
3. **提现确认**：跟踪已广播提现至确认/结算；链上失败自动退款（锁定资金回可用余额）。

### 3. 热钱包签名器（`ManualCustodyAdapter`，mode=`manual`）
- 私钥经 `TRON_HOT_WALLET_PRIVATE_KEY` 注入；`triggersmartcontract` 构建交易 →
  本地 secp256k1 签名（r‖s‖recid，链上实证一致）→ `broadcasttransaction`。
- 签名前校验 `sha256(raw_data_hex) == txID`（防篡改/损坏响应）。
- **幂等救援**：执行重试（attempt>1）时先检索热钱包近期向同地址同金额的转出，
  仅采纳「链上 SUCCESS/状态未定 且 未在本库登记」的候选，防止响应丢失导致二次发币。
- `DUP_TRANSACTION_ERROR` 视为成功（同一已签名交易重播）。

### 4. 提现白名单与路由
- 表 `app.withdrawal_whitelist_entries`；`WithdrawalWhitelistService.isActive()`。
- 资金模式下：白名单用户 + 筛查 clear → 直接 `approved` 并**同事务**入队执行；
  其余走双人审批（复核人不得执行）；`policy_snapshot.autoApprovedByWhitelist=true`
  使执行期自动跳过人工审批计数检查。
- 「资金执行开关」（双管理员 resume 流程）与「充值入账开关」保持不变，仍为最终闸门。

### 5. 服务间管理通道
- 核心 API `/v1/internal/wallet/*`（`InternalServiceGuard`：共享令牌 `ADMIN_SERVICE_TOKEN`
  + `x-actor-admin-id`，全程审计管理员身份）：地址池 CRUD、白名单 CRUD、入金/提现列表、
  提现审批/驳回/执行、资金开关。
- 管理台后端（apps/admin）以 `AdminWalletOpsService` 转发，权限沿用
  `wallet.addresses.manage` / `wallet.withdrawals.manage|execute` / `operations.funds.*`
  （迁移已向 super_admin 补种后四项）。
- 管理台前端 `/wallets`（地址池：生成/复制/停用/状态统计）与 `/withdrawals`
  （真实列表 + 批准/拒绝/执行 + 资金开关面板）已接真数据。

## 验证证据（2026-09-18）
- **链上实证**：用主网真实交易反推签名者 == owner；`sha256(raw_data_hex)==txID`；
  ABI 地址字（22 个 0 + 41 前缀）/金额字与链上原始数据逐字节一致；USDT 合约与
  发送地址 base58 向量双向一致（`test/wallet/tron-address.spec.ts`、`tron-signer.spec.ts`）。
- **迁移彩排**：Neon `rwa_lat_test` 库从零跑完全部迁移 → revert → 重跑通过
  （`verify-migration-rehearsal.mjs`）。
- **测试**：wallet/config 单元套件全绿；适配器救援/广播/DUP 用例覆盖。

## 启用顺序（默认全部关闭，逐级开启）
1. 生成热钱包（离线）→ `TRON_HOT_WALLET_PRIVATE_KEY` 入 Render（sync:false）+ DPAPI 库备份。
2. 部署（adapter=manual，无资金开关）。
3. 管理台生成入金地址池（≥ 首批用户数），可用 1 USDT 自测充值（需开监听）。
4. `WALLET_CHAIN_WATCHER_ENABLED=true` 部署 → 充值开始「检测+确认」。
5. 资金大开关：`PRODUCTION_FINANCIAL_FEATURES_ENABLED=true` + `WALLET_EXECUTION_ENABLED=true`
   + `WALLET_EXECUTION_WORKER_ENABLED=true` + 限额/地区显式配置 → 部署。
6. 管理台「资金开关」双管理员 resume → 提现可自动/审批后打款。
7. 白名单按需添加（`withdrawal_whitelist_entries`）。

## 运营须知
- 热钱包需持有 TRX 支付手续费（无质押 energy 时单笔约 13–27 TRX；`fee_limit` 默认 100 TRX 上限）。
- 入金地址余额归集（sweep）未包含在本切片（池私钥已加密托管，后续可加管理端归集动作）。
- 提现「救援窗口」默认 120 分钟（`TRON_BROADCAST_RESCUE_WINDOW_MINUTES`）。
- 旧 `WALLET_WEBHOOK_SECRET` 通道保留兼容（手动模式不依赖回调）。
