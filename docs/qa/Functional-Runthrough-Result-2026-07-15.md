# Functional Run-through Result — 2026-07-15

## 结论

`Functional-Runthrough-Execution-Plan-2026-07-14.md` 中可在本机完成的 Demo 主链路已跑通；成功状态均来自 Core API 与 PostgreSQL，不由前端 toast 或内存 mock 伪造。

## 已验证主链路

1. 注册并重新登录后保持同一用户 ID。
2. KYC 提交与 Demo 审核通过后可下单。
3. 带规范 JSON HMAC 的 USDT 入金到账。
4. RWA、AI Compute、Global Stocks、Prediction 四类订单锁款并成交，形成服务端持仓与账本分录。
5. 收益批次预览、批准、执行；预测市场只结算一次。
6. 持仓赎回完成，随后完成内部转账与提现结算。
7. 客服争议工单、管理员回复时间线、推荐绑定/双方奖励、营销偏好、通知全读均刷新后可回显。

## 验证命令与结果

- `apps/api/scripts/verify-full-demo.mjs`：通过。
- `apps/api` Jest：29 suites / 146 tests 通过。
- Core API、Admin API、H5、Admin Frontend 构建：通过。
- 隔离 H5 生产实例（3031）路由冒烟：42 个页面、无效路由恢复页、只读 Polymarket 市场接口全部通过。

## 已修正的问题

- 赎回完成的时间戳约束互相矛盾，已用迁移 `1783785000000` 修正。
- PostgreSQL 赎回持仓更新的参数类型推断失败，已显式转换。
- 营销偏好动态渠道对象与通知查询用户 ID 被全局白名单错误拒绝，已修正 DTO 校验。
- Polymarket 市场接口的旧 ISR 空响应会掩盖本地降级数据，已改为动态响应。

## 不在本地 Demo 授权范围内的阻塞项

- 正式 KYC、托管/MPC、链监听、地址筛查、经纪/Polymarket 真实下单与回调、生产域名和密钥轮换。
- 法务、牌照、资产供应、地区准入和生产数据保留策略的外部确认。
- 生产 RBAC、双人审批、渗透测试、远程 CI/CD、灾备和真实设备矩阵。
