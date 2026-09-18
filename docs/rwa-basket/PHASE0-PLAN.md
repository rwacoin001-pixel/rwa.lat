# RWA 资产目录 + AI Basket —— Phase 0 实施计划

> 依据：《RWA.LAT RWA资产目录 + AI智能组合后端开发规格 v2.0》（2026-09-18）
> 状态：**已通过用户评审与决策（2026-09-18）**，正式开工
> 对照代码库：`D:\rwa-lat` @ `cfd8547`

---

## 一、已确认的决策（用户拍板 2026-09-18）

1. 执行者：Hermes（本人）
2. CMC API Key：由 Hermes 注册（Basic 免费档；账号 `rwacoin001@gmail.com`）
3. 执行边界：做到「调仓计划生成」为止；不接真实资金；申购/赎回挂现有 operational switch（默认关）
4. 法务：对外申购由用户侧负责，开发不受阻
5. AI 分析模型：DeepSeek（沿用已验证接入）
6. 优先级：RWA 目录公开 API 优先交付（供前端重构使用）
7. 管理台（Basket 运营页 + C1.5 内容审核台）：Hermes 负责
8. 密钥治理：新执行层密钥不与 Hermes 隔离；日常运维维持现状

---

## 二、现有架构分析（已逐项核实）

### 可复用（直接接线）
| 能力 | 现库位置 | 用途 |
|---|---|---|
| 复式账本 | `ledger` 模块：`ledger_accounts/entries/transactions/balances` + 调整审批（requested→approved→posted）+ available/locked 账户 + `ledgerTransaction()` 原语 | 申购/赎回/调仓资金分录 |
| 开关体系 | `operations.operational-capability.service.ts`（`OPERATIONAL_SWITCH_KEYS` + `app.operational_switches` + env 联动） | 新增 basket.* 键，遵守"不建第二总开关" |
| Job 队列 | `job-queue` 模块（enqueue/claim/lease/heartbeat/ack/nack/replay + 回调验签） | RWA 同步 / 调仓 长任务 |
| Worker 样板 | `wallet/withdrawal-execution.worker.ts`（in-process、env 门控、轮询 claim） | RWA Sync Worker 同模式 |
| 审计 | `audit_logs` + ledger 审计方法 | §69 审计全覆盖 |
| 对账 | `reconciliation_runs / reconciliation_cases` | §91 Basket Reconciliation 扩展 |
| 文件/图片 | `object-storage`（B2） | §82 URL/Reference |
| 价格表 | `catalog` 的 `price_quotes / price_snapshots` | PricingService 对齐命名，避免第三套 |
| 合规 | `compliance`（kyc_cases/risk_flags/screening_cases/eligibility_profiles）+ `disclosure_files`/`consents` | §70-72 披露对接 |
| Swagger | `/v1/docs`（OpenAPI 已导出交付） | §110 |
| 迁移工具 | `verify:migration-contract` / `verify:migration-rehearsal` | §108-109 每阶段验收 |

### 不复用（新建，已定）
- **Basket 申赎**：不塞进 `orders`（现订单=产品订单形态）→ 新表 `basket_subscriptions / basket_redemptions`，账务走 Ledger。
- 现有 `app.redemptions` + `portfolio` 模块 = **产品赎回视图**，与 Basket 赎回并存（文档须注明区分，避免与 "Portfolio Engine" 命名混淆）。

---

## 三、计划新增数据表（22 张，`app.` 前缀 + `gen_random_uuid()`）

目录 8：`rwa_assets / rwa_issuers / rwa_networks / rwa_asset_contracts / rwa_asset_sources / rwa_asset_metrics / rwa_asset_metric_history / rwa_sync_runs`
AI 2：`rwa_asset_scores / rwa_ai_analysis`
策略 3：`basket_strategies / basket_strategy_versions / basket_strategy_assets`
组合 2：`basket_portfolios / basket_holdings`
NAV 1：`basket_nav_snapshots`
申赎 2：`basket_subscriptions / basket_redemptions`
调仓 2：`basket_rebalance_runs / basket_rebalance_orders`
披露 2：`risk_disclosures / user_risk_acknowledgements`

**精度约定**：Basket 金融字段 `NUMERIC(36,18)`；凡落 Ledger 的金额换算为现有原子表示（`numeric(78,0)` + assert_decimals，BigInt），转换层必须有测试。

---

## 四、计划新增模块（同仓库，不拆服务）

```
apps/api/src/rwa-market/     providers(CoinMarketCap…) / normalizers / sync / dto / entities
apps/api/src/rwa-analysis/   scoring.service / ai-analysis.service
apps/api/src/basket/         strategy / nav / risk / rebalance / execution / reconciliation
```
Controller 只调用 Service；长任务全部经 job_queue（§80 可拆 Worker 就绪）。

---

## 五、实施顺序（A 段优先=规格 §98 闭环 + 用户优先级）

**A 段（先交付，前端可接）**
1. Phase 1 Schema（22 表 + entities + 迁移）
2. Phase 2 CMC Provider（`RwaDataProvider` 接口 + CoinMarketCapRwaProvider：map/info/assets/list/market-pairs/quotes/issuers——共 7 端点）
3. Phase 3 Normalize（RWA.LAT 自有 id，CMC id 只进 `rwa_asset_sources`）
4. Phase 4 Sync（worker + advisory lock + 频度：metadata 每日 / metrics 每小时 / daily snapshot）
5. Phase 5 公开 API（`/v1/rwa/*` 8 个端点）

**B 段**：6 评分 → 7 AI 分析（DeepSeek，结构化 JSON）→ 8 策略 Schema → 9 Holdings → 10 NAV Engine → 11 申赎 → 12 Risk Engine → 13 Rebalance Planner

**C 段（接口先行，不接真实资金）**：14 Execution Adapter（接口 + manual 模式；真实执行挂 operational switch）→ 15 Reconciliation

**每 Phase 验收**：`lint(build)` + 单测 + `verify:migration-rehearsal` + 相关集成测试；小步提交推送。

### 实施进度（2026-09-18 更新）

- ✅ **Phase 1** Schema（22 表 + 36 实体 + 迁移 1789720000000；测试 4/4）
- ✅ **Phase 2** CMC Provider（`feat 6909f70`；接口/客户端/归一化/错误分类；实弹冒烟通过）
- ✅ **Phase 3-5** Normalize + Sync Worker + 公开 API（`feat 543b851`）：
  迁移 1789721000000（索引 + basket.* 开关）、Sync（advisory lock + 分块 upsert + issuer 关联 via quotes/latest + 去重防线）、
  公开 `/v1/rwa/*` 9 端点（assets/detail/history/issuers/networks/categories/rankings/overview）、
  内部 `/v1/internal/rwa-market/*`（health/sync/sync-runs）、Worker（issuers/assets/snapshot 每日、metrics 每小时增量 + 每日全量）；
  测试 23/23（含真实 CMC 实弹：7942 资产目录全量可用，40 条实拉验证）
- ✅ **Phase 6-7** 评分引擎 + AI 分析（`feat 3548c43`）：确定性八维评分（权重/风控等级 v1）、
  DeepSeek 结构化 JSON 分析（复用 TRANSLATION_* 密钥通道）、Worker（score-batch 6h / ai-batch 每日）、
  内部 `/v1/internal/rwa-analysis/*`；测试 13/13
- ✅ **Phase 8-15** Basket 全链：策略/版本/目标配置（确定性权重+上限迭代）、组合/持仓、NAV 引擎、
  申赎（挂 basket.subscriptions / basket.redemptions 开关 + 披露确认 + 账本双录 + 幂等）、
  风控（组合/调仓提案两套确定性检查）、调仓计划（drift → run+orders+risk 入库）、
  执行适配器（manual/paper/disabled 三态；真实路由未实现）、成交回填（账本 invest/divest 腿）、
  对账（reconciliation_runs/cases 复用 + 当日窗口幂等）、basket-ops Worker（NAV 批刷 / drift 扫描）、
  用户端 `/v1/basket/*` + 内部 `/v1/internal/basket/*`；测试 8/8（含 20 步验收链）
- 迁移：1789722000000（ledger purpose/type 扩展 basket_* 值；down 用 NOT VALID 兼容 append-only 账本）

**关键设计（Basket ↔ Ledger）**：每组合两个 platform 账户——`basket_settlement`（现金）与 `basket:…:invested`（投资成本）；
订阅=用户可用→结算、赎回=结算→用户可用、成交=结算↔投资（幂等键绑定订阅/赎回/订单 id）；
所有金额落账本前显式换算 USDT 原子（6dp 四舍五入），保证对账零差异。

**部署状态**：待 Render 部署 + 生产迁移（1789721000000/1789722000000）+ Worker env 开启。

---

## 六、可能冲突与规避（评审结论）

1. `order` 不扩展（见上）｜2. cron→job_queue｜3. 精度双体系需转换层｜4. `app.` 前缀铁律｜5. CMC 实际 7 端点 + credit（1/250 assets；issuers 1 flat；Basic 免费含核心）｜6. Portfolio 命名区分｜7. `/v1/me` 新分组需文档注明｜8. §74 禁词注入全链路（含社区雷达/AI 客服）｜9. §61 密钥治理按用户决定（不隔离）。
