# 预测市场最终结果同步与派彩

## 范围

站内 USDT 投注，保留既有份额、下注费、派彩费、作废退净本金、推荐返佣及复式账本规则。不向 Polymarket 下单，不进行链上转账。没有数据库迁移或新增公共接口。

## 最终结果的门槛

- 从有 `placed` 投注的已知 Gamma market ID 读取 `/markets/{id}`，包含已经关闭的市场。
- 必须同时 `closed=true`、`umaResolutionStatus=resolved`，且本地 market ID、condition ID、两个结果代币、序号和名称完全一致。
- 仅自动接受精确的 `[1,0]` / `[0,1]` 最终兑付向量，不以截止、临时封盘或接近 0/1 的价格推断。
- `proposed` / `disputed` 保留待定。50/50、其他多赢家、映射冲突和已有争议/撤销记录进入待人工核对，不自动按作废退款。
- 胜方单独设为 `resolved`，败方为 `inactive`。上游完整快照保存到既有不可变事件表与结算映射表。

数据字段参考：[官方 Gamma market by ID](https://docs.polymarket.com/api-reference/markets/get-market-by-id)、[官方最终结算说明](https://help.polymarket.com/en/articles/13364518-how-are-prediction-markets-resolved)。

## 两个独立配置

```dotenv
PREDICTION_SETTLEMENT_WORKER_ENABLED=true
PREDICTION_SETTLEMENT_WORKER_POLL_MS=300000
PREDICTION_RESOLUTION_SYNC_MODE=observe
```

`observe` 为缺省值，未知配置也按 observe 处理：读取上游、校验、记录日志，不写入新的赢家。**它只控制新结果同步，不关闭已有的结算器**；已在本地标记结果的市场仍走既有流程。

`apply` 会把明确的最终结果写入本地，然后由既有结算器入账。它包含历史积压，不只是新订单。任何一次从 observe 切至 apply 都须在发布确认里明确说明这一影响。

## 并发与失败恢复

- 下注、同步结果和结算共用 `prediction-settle:<market UUID>` 事务锁；下注拿锁后重新校验开放状态、截止时间和结算批次。
- 每次只处理有限批量，按 UUID 轮转，长期未开奖/异常市场不能挡住其余市场；单个上游失败下轮重试。
- 普通行情导入在市场行锁内执行，不覆盖已 resolved 或 suspended 的市场及已标记的结果。
- 结算在资金边界再次检查已有结果映射。争议、撤销、非全额赢家或映射冲突不付款。
- 结果、投注状态、账本、批次均使用现有事务/唯一约束。派彩失败回滚，后续重试仍受幂等键保护。

## 验证与发布

1. `node scripts/verify-prediction-settlement-isolated.mjs` 创建全新的本地 PostgreSQL 集群，用现有迁移准备测试库；不重置开发、共享或生产库；结束关闭本轮集群。
2. 通过隔离库测试最终结果同步、观察模式、赢家/输家、原费率、重复任务、争议/错配、并发下注、敞口、失败回滚重试、旧行情覆盖及账本守恒。
3. 发布前核对远端 main、当前线上 API 镜像、配置与待结算记录，保留其他 AI 的后续发布。
4. 首次发布维持 observe，核对只读结算预览。启用 apply 与历史补结算另行确认；没有新订单或“测试派彩”操作。
5. 回退前重新核对线上镜像。关闭新同步不会撤销已入账记录；不得回滚数据库来撤回派彩。
