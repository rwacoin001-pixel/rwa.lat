# Community Radar（社区内容雷达）

内容自动化 v1：**采集公开讨论 → 改写为人设原创帖 → 审核队列 → 批准后发布**。

## 管线

1. **采集**：web_search / web_extract（搜索引擎索引线路，对 币安广场 hashtag 页 / OKX 内容 / X 讨论页有效）
2. **改写**：按 `personas.json` 的人设语气 + `posting_lang`（en / zh-Hans / zh-Hant / ja）写成原创观点帖；引用公开数据但**必须改写成自己的话**（永不搬运原文）
3. **入队**：`run_communityctl_live.sh enqueue --file <drafts.json>`（draft 状态进审核队列）
4. **发布**：批准（approve）→ `publish-due`（SOP：人工/双人批准后才对外）

## 已探测的源（2026-09-18）

| 源 | 状态 | 说明 |
|---|---|---|
| 币安广场（搜索索引线路）| ✅ 可用 | hashtag 页/帖子页可被搜索索引完整提取（含真人讨论原文）|
| 币安 /bapi 内部接口 | ⚠️ 暂缓 | 轻头可 200 但 data=null（需浏览器指纹头 bnc-uuid/device-info），网页 202 反爬 |
| OKX 公告 API | ✅ 可用 | `GET https://www.okx.com/api/v5/support/announcements?pageSize=N` 无需鉴权，直连可达 |
| OKX Learn / 新闻 | ✅ 可用 | 经搜索索引提取 |
| X | ⚠️ 间接 | 直连/镜像不可用（nitter 死、rsshub 404）；经搜索索引可达 |
| CoinTelegraph RSS | ✅ 可用 | 直连 200，兜底源 |

## 定时任务

Hermes cron「RWA社区内容雷达」：`every 8h` → 1-2 条草稿/轮，≤2 上限；草稿入队后由操作者批准发布。

## 文件

- `run_communityctl_live.sh` — 线上执行器（令牌从 DPAPI 金库取，不回显）
- `radar_drafts_*.json` — 每轮草稿存档
- `radar_ledger.json` — 去重台账（已用主题/来源）

## 规则（硬约束）

- 改写 ≠ 搬运；不承诺收益、不编造收益案例、不点名攻击个人
- 语言 = 人设的 posting_lang；话题从 lounge/market/rwa/newbie/security/ai-compute 选
- 发布必须经审核（draft → approve → publish）
