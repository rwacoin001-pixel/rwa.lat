# RWA.LAT 全功能跑通修改文档

版本：1.0  
日期：2026-07-14  
当前优先级：**先完成功能闭环，安全与正式认证后置**  
适用仓库：`rwa-lat`  
执行对象：后续 AI 助手、前端、后端和测试人员

---

## 1. 本阶段唯一目标

让 RWA.LAT 在本地形成一套**可以连续操作、数据真实联动、状态可追踪**的完整 Demo 系统：

- 用户可以完成 Guest 浏览、Demo 登录、KYC、充值、投资、订单、持仓、收益、提现、客服、争议和个人设置等操作；
- 管理员可以查看并处理用户、KYC、钱包、订单、产品、收益、提现、对账、客服、争议和运营配置；
- 用户端发起的操作会出现在管理后台；
- 管理后台处理后，用户端会看到相应状态和资产变化；
- 所有页面都使用同一套本地 API 和数据库，不再依赖各页面独立的硬编码假数据；
- 刷新页面、切换浏览器标签或重新启动前端后，操作结果仍然存在；
- 先使用 Demo 身份和模拟结算，不接真实资金，不要求本阶段完成正式 OAuth、MPC、KYC Provider 或安全加固。

系统跑通后，再执行：

- `docs/qa/Code-Remediation-Execution-Plan-2026-07-14.md`

后者已经改为第二阶段安全与生产整改清单，当前不要优先实施。

### 1.1 “跑通”的正式定义

本项目所说的“跑通”，不是页面能打开、按钮能点击或能够跳转成功页，而是**同一名新用户**能够连续完成下面这条不可拆分的业务链路：

`注册 → 退出 → 使用同一账号登录 → KYC → 获得充值地址 → 提交充值 → 后台确认到账 → USDT 余额增加 → 选择产品 → 提交投资订单 → 后台看到并处理订单 → 订单成交 → 生成持仓 → 后台创建并执行收益分配 → 用户收到收益 → Wallet、Portfolio、Home、Activity 和后台账本数据一致`

必须同时满足：

1. 用户注册后，后台 Users 页面立即可以查询到该用户；
2. 用户退出后可以使用同一账号重新登录，且恢复相同的 user ID；
3. 用户提交 KYC 后，后台 KYC 页面可以看到并处理；
4. 后台批准 KYC 后，用户端状态更新，并允许继续充值和投资；
5. 用户发起充值后，后台 Wallets、Collections 或 Ledger 页面可以看到同一笔充值；
6. 后台确认充值后，用户 USDT 可用余额真实增加，并产生对应账本分录；
7. 用户必须使用本次充值得到的 USDT 完成至少一笔投资，不能依赖页面预设余额；
8. 投资订单在后台 Orders 页面可以查询、处理并查看完整状态；
9. 订单成交后生成 Demo 持仓，同时扣减 USDT 并记录认购金额和费用；
10. 后台可以为该产品创建收益批次、预览分配结果并执行分配；
11. 收益分配后，用户可用 USDT、累计收益、持仓收益和流水同步更新；
12. 后台 Yields、Ledger、Reconciliation 页面可以追踪同一笔收益；
13. 刷新页面、退出重新登录、重启前端后，注册资料、KYC、余额、订单、持仓和收益记录仍然存在；
14. 同一业务 ID 能从用户页面追踪到后台记录、账本、持仓和收益分配记录。

只要其中任意一步没有服务端记录、后台不可见、后台处理后用户端不更新，或者刷新后数据丢失，就不能标记为“已经跑通”。

---

## 2. 本阶段明确不做

为了避免其他 AI 把时间耗在非当前目标，本阶段暂不处理：

- Google/X 正式 OAuth；
- 邮箱真实发信和找回；
- 正式管理员会话、MFA、RBAC 安全加固；
- MPC/托管钱包真实签名和链上广播；
- 真实 KYC/AML Provider；
- 真实 Polymarket、美股、RWA、算力供应商下单；
- 生产密钥、正式牌照核验、渗透测试；
- 高并发、灾备、生产监控和生产数据迁移。

允许保留简化 Demo 登录和 Demo 验证码，但必须做到：

- 用户可以注册新的 Demo 账号、退出并重新登录；
- 可以保留固定 Demo 用户用于快速查看，但固定用户不能代替“新用户注册到收益到账”的正式验收；
- 管理端可以进入固定 Demo 管理员；
- 两端操作同一数据库；
- 界面明确标注 Demo，不产生真实资金或外部订单；
- 不因外部服务未配置而阻断本地功能演示。

---

## 3. 本阶段完成定义

只有完整通过“新用户注册到收益到账”的主链路，并满足下列条件，才算“系统跑通”：

1. 一条命令或一份明确脚本可以启动 H5、Core API、Admin API、Admin Frontend 和 PostgreSQL；
2. H5 地址、Admin 地址、API 地址稳定，不需要开发者临时猜端口；
3. 新用户可以真实创建 Demo 账户、退出并使用相同账号重新登录；
4. 用户可以从零余额开始，经后台确认充值后获得可投资 USDT；
5. 用户可以用该笔 USDT 投资产品、形成持仓并收到后台分配的收益；
6. 注册、KYC、充值、订单、持仓、收益和账本记录在后台均可查看和处理；
7. 用户端所有 45 个定义页面可以进入，无白屏、无死链、无无法返回；
8. 管理端现有 28 个页面均可进入，并至少完成页面的核心查看或处理动作；
9. 用户操作写入服务端数据库；
10. 管理端可以处理用户操作；
11. 管理结果会反馈到用户端；
12. 钱包余额、订单、持仓、收益和账本之间数据一致；
13. 页面刷新、退出重新登录和重启前端后数据不丢失；
14. 不再以“接口失败后显示页面内置 mock”伪装为成功；
15. “注册到收益到账”拥有自动化或一键验收脚本；
16. H5、API、Admin API、Admin Frontend 均能构建。

### 3.1 主链路验收数据

每次完整验收必须新建一个测试用户，禁止直接使用已经拥有余额和持仓的预置用户。

| 步骤 | 验收数据 | 预期结果 |
|---|---|---|
| 注册 | 新邮箱或新 Demo 账号 | 后台新增一条用户记录 |
| 退出并登录 | 使用刚注册的账号 | 恢复相同 user ID 和空资产账户 |
| KYC | 提交完整 Demo 资料 | 后台出现待审核记录 |
| KYC 审核 | 管理员批准 | 用户状态变为 approved |
| 充值 | 20,000 USDT，任选已启用网络 | 后台出现 pending 充值 |
| 充值确认 | 管理员确认到账 | 用户可用余额增加 20,000 USDT |
| 投资 | 选择一个 RWA 或 AI Compute 产品，投入 5,000 USDT | 后台出现订单并可处理 |
| 成交 | 管理员或 Demo 结算器完成订单 | 用户余额减少，生成持仓和账本 |
| 收益批次 | 为该产品分配 100 USDT | 后台显示用户分配明细 |
| 收益到账 | 管理员执行收益批次 | 用户余额和累计收益增加 100 USDT |
| 对账 | 运行 Demo 对账 | 余额、账本、订单、持仓、收益差异为 0 |

收益不允许只通过前端按 APY 计算并显示。收益必须由后台生成收益批次、产生收益分录、更新用户资产，并能同时在后台和用户流水中查询。

---

## 4. 推荐本地运行架构

| 服务 | 建议端口 | 用途 |
|---|---:|---|
| H5/PWA | 3030 | 用户端 |
| Admin Frontend | 3100 | 管理后台页面 |
| Core API | 4000 | 用户、钱包、订单、持仓、合规、通知等 |
| Admin API | 4100 | 管理后台操作 |
| PostgreSQL | 5432 | 用户端和管理员端共享数据库 |

### 路由约定

即使暂不做安全，也必须先修复路由前缀，否则前后台无法稳定联调：

- Core API 使用 `/v1/*`；
- Admin API 使用 `/v1/admin/*`；
- 禁止出现 `/v1/v1/*`；
- 禁止出现 `/admin/admin/*`；
- H5 与 Admin Frontend 的 API 基址只从一个配置文件或环境变量读取；
- Demo 环境提供合理默认值，启动后无需逐页修改地址。

### Demo 身份约定

本阶段可以使用：

- Demo User：`demo-user-001`；
- Demo Admin：`demo-admin-001`；
- Demo 登录接口或固定选择器；
- 服务端返回可持续使用的 Demo session。

固定 Demo User 仅用于快速预览。正式跑通验收必须从注册一个全新用户开始。不要继续让不同页面各自生成不同 user ID，也不要用每页不同的 localStorage 数据源。

---

## 5. 数据联动的核心原则

### 5.1 单一事实来源

以下数据必须以 PostgreSQL/API 为准：

- 用户资料；
- KYC 状态；
- 钱包账户和余额；
- 充值、提现和转账；
- 产品目录；
- 订单；
- 持仓；
- 收益与分配；
- 账本流水；
- 推荐关系与奖励；
- 通知；
- 客服工单、争议和申诉；
- 营销授权；
- 地区与产品可用性配置；
- 管理员处理记录。

localStorage 只允许保存：

- 当前语言；
- 主题/动效偏好；
- 非关键 UI 展开状态；
- Demo session 标识。

### 5.2 页面不得自造成功

- 用户提交后，由 API 返回记录 ID 和初始状态；
- 管理端处理后，由 API 更新状态；
- 用户端重新查询或轮询状态；
- 不允许使用 `setTimeout` 把订单、提现、KYC 自动改成成功；
- 不允许接口失败时显示静态成功数据。

### 5.3 Demo 外部执行

真实 Provider 暂未接入时，由服务端 Demo adapter 完成状态模拟：

- 充值：管理员确认到账；
- 提现：管理员批准后模拟广播并结算；
- 投资：订单服务模拟成交；
- KYC：管理员人工批准/拒绝；
- 收益：管理员创建收益批次并分配；
- Polymarket：使用公共行情或本地市场快照，交易使用 Demo 订单；
- 美股：使用参考价格快照，买卖使用 Demo 结算；
- RWA/算力：使用产品配置和 Demo 收益计划。

---

# 6. 用户端完整流程

## FLOW-U01：Guest 浏览

### 页面

- `/welcome`
- `/home`
- `/invest`
- `/invest/rwa`
- `/invest/compute`
- `/invest/stocks`
- `/invest/prediction`
- `/trust`
- `/trust/access-and-regions`
- `/trust/product-disclosures`
- `/trust/legal`

### 必须完成

- Guest 无需登录即可查看首页、投资列表、四类产品详情和信任中心；
- 点击充值、下单、提现、AI 一键执行、查看私人资产时，弹出精美登录引导；
- 关闭登录引导后留在原页面；
- 登录完成后返回原先准备执行的动作；
- 页面切换不闪现 Guest Demo 条，不出现顶部栏布局跳动。

### 验收

- 从首页进入四类投资详情并返回；
- Guest 点击所有受限动作均不会白屏或丢失当前页面；
- 刷新后 Guest 状态稳定。

---

## FLOW-U02：Demo 登录、注册、验证和找回

### 页面

- `/login`
- `/register`
- `/verify-email`
- `/recovery`

### 本阶段实现

- 邮箱、Google、X、钱包入口均可点击并进入完整 Demo 状态；
- 邮箱注册创建 Demo 用户记录；
- 验证页可使用固定 Demo 验证码或“一键验证”；
- Google/X/钱包可以通过 Demo adapter 创建或关联账号；
- 找回流程可以完整展示提交、已发送、设置新凭据和成功页面；
- 注册/登录后建立统一 Demo session，用户资料、KYC、钱包和订单使用同一 user ID。

### 验收

- 四种入口均能完成流程；
- 同一个邮箱重复注册得到明确提示；
- 退出后重新登录仍能看到原有数据；
- 页面七语言切换不丢失表单状态。

---

## FLOW-U03：KYC 与地区准入

### 页面

- `/profile/kyc`
- `/trust/access-and-regions`

### 用户动作

- 选择国家/地区；
- 填写基本资料；
- 上传证件占位文件；
- 提交 KYC；
- 查看 `draft / submitted / under_review / approved / rejected / needs_more_info` 状态；
- 补充材料后再次提交；
- 查看产品级可用性结果。

### 管理联动

- 提交后出现在后台 KYC 列表；
- 管理员可批准、拒绝或要求补充材料；
- 用户端看到决定、原因和更新时间；
- 批准后解锁投资和提现 Demo 操作。

---

## FLOW-U04：USDT 充值

### 页面

- `/wallet`
- `/wallet/deposit`
- `/wallet/confirmation`
- `/activity`

### 用户动作

- 选择 TRON、Ethereum 或 Arbitrum；
- 获取对应 Demo 充值地址和二维码；
- 输入/粘贴 Demo Tx Hash 或点击“模拟已转账”；
- 创建充值记录并进入 pending；
- 查看确认数、网络、金额、Tx Hash 和状态时间线。

### 管理联动

- 后台 Wallet/Ledger/Collections 可看到充值；
- 管理员确认后：
  - 充值变为 confirmed；
  - USDT 可用余额增加；
  - 账本产生一条入账；
  - 用户收到通知；
  - 首页总资产和 Recent Activity 更新。

### 约束

- 三个网络的地址格式、网络费展示和状态独立；
- 同一 Tx Hash 重复提交不得重复增加余额；
- Demo 模式不进行真实链上广播。

---

## FLOW-U05：内部 USDT 转账

### 页面

- `/wallet/transfer`
- `/wallet/confirmation`
- `/activity`

### 用户动作

- 输入收款用户、金额和备注；
- 预览转账；
- 确认提交；
- 查看成功或失败结果。

### 数据联动

- 付款方余额减少，收款方余额增加；
- 双方生成方向相反的账本流水；
- 双方收到通知；
- 余额不足时不能提交成功。

---

## FLOW-U06：USDT 提现

### 页面

- `/wallet/withdraw`
- `/wallet/confirmation`
- `/activity`

### 用户动作

- 选择网络；
- 输入地址和金额；
- 查看手续费、预计到账和总扣款；
- 提交提现申请；
- 查看 `pending_review / approved / processing / completed / rejected`。

### 管理联动

- 后台 Withdrawals 出现申请；
- 管理员批准或拒绝；
- 批准后使用 Demo adapter 生成 Tx Hash；
- completed 后余额和账本一致；
- 拒绝后预占金额释放。

---

## FLOW-U07：四类投资产品完整下单

### 页面

- `/invest`
- `/invest/rwa`
- `/invest/compute`
- `/invest/stocks`
- `/invest/prediction`
- `/orders/review`
- `/orders/processing`
- `/orders/success`
- `/orders/partial`
- `/orders/failed`
- `/orders/receipt`

### 通用下单步骤

1. 浏览并筛选产品；
2. 进入产品详情；
3. 查看发行/供应主体、收益来源、费用、期限、退出和风险；
4. 输入金额或份额；
5. 进入订单确认；
6. 查看 USDT 支付、费用和预计结果；
7. 勾选 Demo 风险确认；
8. 提交订单；
9. 服务端生成订单记录；
10. Demo adapter 将订单推进为 success、partial 或 failed；
11. 成交后生成持仓、账本和通知；
12. 订单收据可再次打开。

### RWA

- 支持最低认购额、预计收益、期限、风险级别和赎回规则；
- 成交后生成 RWA 持仓；
- 管理后台可配置项目、开放/暂停认购、募集额度和收益计划。

### AI Compute

- 支持 GPU 型号、价格、算力份额、预计 APY、可用率和期限；
- 成交后生成算力份额；
- 页面展示每日收益和累计收益；
- 管理后台可配置设备/产品状态和收益分配。

### Global Stocks

- 支持参考价格、买入、卖出、持有和 AI 分析；
- 使用 Demo 美股持仓与 USDT 结算；
- 买卖后更新持仓、现金和盈亏；
- 市场关闭时显示排队状态，而不是直接失败。

### Prediction

- 支持 YES/NO 价格、概率、成交量和市场结束时间；
- 用户可买入 YES 或 NO；
- 管理后台可将市场结算为 YES、NO、void；
- 结算后自动更新用户余额、持仓、订单和流水。

### 通用验收

- 四类产品都能完成至少一笔成功订单；
- 可以人工触发 partial 和 failed 状态；
- 余额不足、低于最低认购额、产品暂停均有正确提示；
- 订单成功后 Portfolio、Wallet、Home、Activity 同步更新。

---

## FLOW-U08：Portfolio、收益和赎回

### 页面

- `/portfolio`
- `/portfolio/positions`
- `/activity`

### 必须完成

- 展示总资产、今日盈亏、累计收益和资产分布；
- 按 RWA、Compute、Stocks、Prediction 分类；
- 持仓详情展示本金、当前价值、收益、期限和退出规则；
- 支持发起可用产品的赎回/卖出/退出；
- 赎回进入管理后台；
- 管理员处理后，持仓、余额和账本同步；
- 管理员创建收益批次后，用户收益和可用余额更新。

---

## FLOW-U09：AI 投资助手

### 页面/弹层

- `/ai`
- `/ai/plan`
- 全局 AI 对话弹层

### 必须完成

- AI 对话框以弹层展示；
- 点击遮罩、关闭按钮或 Escape 可收回；
- 支持预设问题和自由输入；
- 返回结构化 Demo 建议：配置比例、风险、理由和注意事项；
- “帮我配置 10,000 USDT”生成可编辑方案；
- 用户确认后一键生成多笔 Demo 订单；
- 订单仍需经过统一 order review 和服务端创建流程；
- 计划、确认和执行结果可在记录页查看。

---

## FLOW-U10：通知、资料、推荐、营销和设置

### 页面

- `/notifications`
- `/profile`
- `/profile/security`
- `/profile/referral`
- `/profile/records`
- `/profile/settings`
- `/profile/marketing`
- `/profile/close-account`

### 必须完成

- 个人资料以弹层展示，点击遮罩可关闭；
- 二级页面始终有返回上一页和返回首页能力；
- 通知支持已读/未读、全部已读和类型筛选；
- 推荐页可生成邀请码、复制链接、查看邀请列表和奖励记录；
- 营销授权按邮件、推送、社群分别开关并持久化；
- 记录页展示 AI 确认、登录记录、投资确认和授权历史；
- 设置页支持七语言切换；
- 注销账户完成 Demo 申请、冷静期和取消申请状态。

---

## FLOW-U11：客服、争议与反诈骗

### 页面

- `/profile/support`
- `/security/official-channels`
- `/security/report-scam`

### 必须完成

- 用户可以创建客服工单并获得引用号；
- 可以从订单详情发起投资争议；
- 可以追加文字和附件占位；
- 可以查看工单/争议状态时间线；
- 管理员回复后用户可见；
- 用户可核验官方账号；
- 用户可提交诈骗举报并跟踪状态；
- 所有记录保存在服务端，刷新不丢失。

---

# 7. 管理端所有页面的核心动作

## ADMIN-01：Dashboard

- 展示真实 Demo 数据汇总：用户、KYC、充值、提现、订单、AUM、收益、待处理事项；
- 点击指标进入对应列表；
- 统计来自数据库，不使用固定数字；
- 提供“重置 Demo 数据”和“生成样例流程”入口，但必须二次确认。

## ADMIN-02：Users

- 列表、搜索、筛选、详情；
- 查看用户 KYC、钱包、订单、持仓、工单和推荐关系；
- Demo 状态下支持启用、暂停、备注和标签；
- 操作后用户端状态同步。

## ADMIN-03：KYC

- 查看 submitted/under_review；
- 批准、拒绝、要求补件；
- 输入原因和备注；
- 用户端实时显示决定。

## ADMIN-04：Eligibility / Regions

- 配置国家/地区状态；
- 配置产品级地区限制；
- 查看某用户对四类产品的准入结果；
- 改动后 H5 详情页和下单按钮同步。

## ADMIN-05：Assets / Listings / Providers / Pricing

- 新建、编辑、暂停、上架产品；
- 配置产品类型、最低金额、费率、期限、风险、收益来源和退出规则；
- 配置 Demo 发行方/供应商；
- 配置价格、APY、募集额度、可售份额和市场状态；
- 改动后 Invest 列表和详情页同步。

## ADMIN-06：Orders

- 查看所有订单；
- 按用户、产品、类型、状态筛选；
- 查看订单详情和状态时间线；
- Demo 模式下推进 success、partial、failed；
- 推进后余额、持仓、账本和通知同步。

## ADMIN-07：Wallets / Withdrawals / Collections

- 查看用户余额和地址；
- 确认 Demo 充值；
- 审批/拒绝提现；
- 推进提现 processing/completed；
- 查看地址、网络、Tx Hash、金额和费用；
- 不允许只改状态而不生成对应账本流水。

## ADMIN-08：Ledger / Reconciliation

- 查看所有借贷分录；
- 按用户、业务类型、订单和时间筛选；
- 每笔业务可追溯到来源记录；
- 运行 Demo 对账；
- 显示差异并支持标记已处理；
- 用户余额应由账本或受控余额服务计算，不能页面各算各的。

## ADMIN-09：Settlements / Yields

- 创建收益批次；
- 选择产品、周期、分配总额和日期；
- 预览用户分配明细；
- 执行后更新用户收益、余额、账本和通知；
- 支持失败重试和批次状态查看。

## ADMIN-10：Polymarket

- 查看/同步市场；
- 创建 Demo 市场快照；
- 暂停交易；
- 将市场结算为 YES、NO 或 void；
- 结算后更新所有相关用户持仓与余额。

## ADMIN-11：Risk

- 查看 Demo 风险标记；
- 新建、更新和关闭标记；
- 对用户或订单添加处理备注；
- 风险状态在相应用户/订单详情可见。

## ADMIN-12：Support / Disputes / Appeals

- 查看用户工单、投资争议和申诉；
- 分配处理人；
- 回复、要求补充资料、解决或关闭；
- 用户端显示相同时间线；
- 订单争议可关联订单、流水和证据。

## ADMIN-13：Audit

- 当前阶段至少记录所有 Demo 管理操作；
- 展示操作者、动作、对象、前后状态、时间和 request ID；
- 支持筛选和导出 Demo CSV。

## ADMIN-14：Files

- 上传 Demo 文件；
- 查看元数据；
- 关联 KYC、产品、工单或争议；
- 下载和删除；
- 文件不存在或已删除时显示明确状态。

## ADMIN-15：Networks

- 配置 TRON、Ethereum、Arbitrum 是否启用；
- 配置确认数、Demo 手续费和最小充值/提现额；
- 修改后 H5 Wallet 页面同步。

## ADMIN-16：AI Ops

- 查看 AI 任务列表；
- 创建 Demo 分析任务；
- 查看 running/completed/failed；
- 查看模型、token、成本和结果摘要；
- 失败任务可重试。

---

# 8. 后端最小功能模块

后续 AI 不必一次重建全部架构，但至少要提供以下可用服务：

| 服务 | 最小能力 |
|---|---|
| Demo Session | 创建/恢复 Demo 用户与管理员身份 |
| Catalog | 产品、费率、网络、地区配置 CRUD |
| Compliance | KYC 提交、处理、状态、产品准入 |
| Wallet | 账户、地址、余额、充值、提现、转账 |
| Ledger | 借贷分录、业务引用、余额一致性 |
| Order | 创建、校验、状态推进、收据 |
| Portfolio | 持仓、估值、盈亏、赎回 |
| Yield | 收益批次、预览、分配、失败重试 |
| Prediction | 市场、用户份额、结算 |
| Notification | 创建、查询、标记已读 |
| Referral | 邀请码、绑定、奖励记录 |
| Support | 工单、争议、申诉、回复、附件 |
| Marketing | 授权偏好与变更记录 |
| AI Demo | 对话、组合方案、确认、创建订单 |
| Admin | 聚合查询和上述模块的管理操作 |

---

# 9. 建议数据状态机

## KYC

`draft → submitted → under_review → approved`

分支：

- `under_review → needs_more_info → submitted`
- `under_review → rejected`

## Deposit

`created → detecting → confirming → confirmed → credited`

分支：`created/confirming → failed`

## Withdrawal

`submitted → pending_review → approved → processing → completed`

分支：

- `pending_review → rejected`
- `processing → failed → processing`

## Order

`created → reviewing → submitted → processing → filled`

分支：

- `processing → partially_filled → filled`
- `submitted/processing → failed`
- `created/reviewing → cancelled`

## Redemption

`requested → under_review → approved → settling → completed`

分支：`under_review → rejected`

## Support/Dispute

`open → assigned → waiting_user / investigating → resolved → closed`

## Yield Batch

`draft → previewed → approved → processing → completed`

分支：`processing → partially_failed → retrying → completed`

所有状态变化必须由服务端校验，并保存时间线；即使当前是 Demo，也不要在页面本地随意跳状态。

---

# 10. 数据一致性验收规则

以下公式必须成立：

### 钱包

`可用余额 + 冻结余额 = 钱包总余额`

### 订单

成功买入：

`USDT 减少 = 认购本金 + 手续费`

同时：

`持仓增加 = 实际成交份额`

### 提现

提交后金额进入冻结；拒绝后解除冻结；完成后从冻结扣除并产生手续费分录。

### 收益

`收益批次分配总额 = 所有用户收益分录之和 + 明确记录的舍入差额`

### 预测市场结算

同一市场结算只能执行一次；重复调用不能重复入账。

### 首页/Portfolio/Wallet

三个页面使用同一资产数据源，不得出现首页 12,540 USDT、钱包 10,000 USDT、Portfolio 又是另一个数值。

---

# 11. 必须清理的“假跑通”行为

后续 AI 在功能联调过程中需要逐项清理：

1. 页面请求失败后自动显示 hardcoded mock 列表；
2. 点击按钮只弹 Toast，但没有创建服务端记录；
3. 使用 `setTimeout` 自动跳成功页；
4. 用户端和管理端各用一套互不关联的数据；
5. 刷新后订单、KYC、工单或余额恢复默认值；
6. 管理员改变状态，但用户端不更新；
7. 只更新订单状态，不更新余额、持仓和账本；
8. 每页使用不同 API URL、不同 user ID 或不同 Demo 数据；
9. 下拉筛选、分页、搜索只有视觉效果，没有改变结果；
10. 按钮可点击但无 loading、disabled、成功、失败和重试状态。

Demo 数据应由数据库 seed 或 Demo adapter 统一生成，而不是分散写在页面组件中。

---

# 12. 推荐实施批次

## 批次 1：启动与路由

- 统一端口和环境变量；
- 修复 `/v1/v1`、`/admin/admin`；
- 提供 PostgreSQL；
- 提供一键启动说明；
- H5 与 Admin 均能请求 health。

完成标志：四个应用和数据库同时运行，页面能访问真实本地 API。

## 批次 2：统一 Demo 数据层

- Demo session；
- 用户、产品、网络 seed；
- typed API client；
- 删除页面内散落的数据源；
- 页面刷新后数据保留。

完成标志：用户端与管理员端能看到相同用户、产品和配置。

## 批次 3：KYC + Wallet + Ledger

- KYC 提交/后台处理；
- 充值/后台确认；
- 内部转账；
- 提现/后台审批；
- 账本与余额联动。

完成标志：用户从零余额经充值获得可用 USDT，并能转账和提现。

## 批次 4：Catalog + Orders + Portfolio

- 四类产品；
- 下单状态机；
- 持仓；
- 赎回/卖出；
- 首页、Wallet、Portfolio 联动。

完成标志：四类产品至少各完成一笔订单，余额和持仓正确。

## 批次 5：Yield + Prediction Settlement

- 收益批次；
- 分配；
- 预测市场结算；
- 对账和失败重试。

完成标志：管理员结算后，用户收益、持仓、余额和流水正确。

## 批次 6：Support + Referral + Marketing + Notifications

- 工单、争议、申诉；
- 推荐绑定和奖励；
- 营销授权；
- 通知和已读状态；
- 管理后台同步。

完成标志：所有非资金运营流程可完整创建、处理和回显。

## 批次 7：所有页面收尾

- 修复死链、返回、弹层和固定栏；
- 完成筛选、排序、分页和空状态；
- 完成七语言页面覆盖；
- 统一 loading/error/success；
- 验证 PWA 和移动端。

完成标志：页面清单逐项签字，核心流程一键验收通过。

## 批次 8：再开始安全与正式认证

系统功能跑通后，执行：

- `docs/qa/Code-Remediation-Execution-Plan-2026-07-14.md`

---

# 13. 给其他 AI 的直接执行提示词

## 当前推荐：批次 1

> 阅读 `docs/qa/Functional-Runthrough-Execution-Plan-2026-07-14.md`。当前只执行“批次 1：启动与路由”，不要做正式认证和安全加固，也不要改变现有视觉风格。统一 H5 3030、Admin Frontend 3100、Core API 4000、Admin API 4100、PostgreSQL 5432；修复重复 API 前缀，补充本地环境模板和一键启动说明。完成后实际启动全部服务，验证 health、H5、Admin 页面，并记录命令、地址、修改文件和未完成项。

## 批次 2

> 只执行“批次 2：统一 Demo 数据层”。实现新用户注册、退出后重新登录、固定 Demo 管理员、共享 PostgreSQL seed 和统一 typed API client。固定 Demo 用户仅用于快速预览，不能代替正式验收。用户端与管理员端必须读取同一数据库，新注册用户必须立即出现在后台 Users 页面。禁止页面请求失败后用 hardcoded mock 冒充成功。保留显式 Demo adapter，页面刷新和重新登录后数据必须存在。不要做正式 OAuth、MPC 或 KYC Provider。

## 批次 3

> 只完成 KYC、充值、内部转账、提现、账本和余额的端到端 Demo 闭环。用户提交必须出现在管理后台；管理员处理后用户端必须回显；任何余额变化都要有对应账本。使用 Demo adapter，不连接真实链。完成后从零余额用户开始实际走一遍完整流程并记录每一步的数据库状态。

## 批次 4

> 完成 RWA、AI Compute、Stocks、Prediction 四类产品的目录、详情、下单、订单状态、持仓、赎回/卖出和收据。四类产品至少各完成一笔成功订单，并验证 Home、Wallet、Portfolio、Activity 和 Admin Orders 数据一致。不要用前端定时器伪造成功，状态由服务端 Demo adapter 推进。

---

# 14. 每批次完成报告模板

```md
## 批次

- 批次编号：
- 日期：
- 实施人/AI：

### 实际完成

- 功能：
- 页面：
- API：
- 数据表/迁移：

### 实际走通路径

1. 用户操作：
2. 服务端记录：
3. 管理员处理：
4. 用户端反馈：
5. 余额/持仓/账本结果：

### 验证

- H5 build：
- Core API build：
- Admin API build：
- Admin Frontend build：
- 自动化测试：
- 手工流程：

### 尚未完成

- 必须如实列出，不得把 mock 页面写成已联调。
```

---

# 15. 最终验收脚本应覆盖的场景

1. 重置 Demo 数据；
2. 以 Guest 身份浏览首页和产品；
3. 使用一个全新邮箱或 Demo 账号完成注册；
4. 管理后台 Users 页面查到刚注册的用户；
5. 用户退出登录；
6. 使用刚注册的账号重新登录，并恢复相同 user ID；
7. 用户提交 KYC；
8. 管理后台 KYC 页面查到该申请；
9. 管理员批准 KYC；
10. 用户端 KYC 更新为 approved；
11. 用户创建 20,000 USDT Demo 充值；
12. 管理后台查到该笔 pending 充值；
13. 管理员确认充值；
14. 用户余额增加 20,000 USDT，后台账本出现入账分录；
15. 用户使用本次充值资金购买 5,000 USDT RWA；
16. 管理后台查到并完成该订单；
17. 用户余额减少、生成 RWA 持仓和订单收据；
18. 管理员为该 RWA 产品创建 100 USDT 收益批次；
19. 管理后台预览该用户的收益分配明细；
20. 管理员执行收益批次；
21. 用户可用余额和累计收益增加 100 USDT；
22. 用户 Activity 出现收益到账记录；
23. 管理后台 Yields、Ledger 和 Reconciliation 可追踪该笔收益；
24. 用户继续完成 AI Compute、Stocks 和 Prediction 各一笔 Demo 订单；
25. 管理员结算 Prediction 市场；
26. 用户查看更新后的余额、四类持仓、收益和流水；
27. 用户发起一笔赎回，管理员完成赎回；
28. 用户发起一笔提现，管理员批准并完成提现；
29. 用户创建客服工单和订单争议，管理员回复并关闭；
30. 用户查看通知和完整记录；
31. 运行对账，差异为 0；
32. 刷新 H5 和 Admin，数据仍一致；
33. 用户退出后重新登录，数据仍一致；
34. 重新启动前端后，数据仍一致。

其中第 3–23 步是不可跳过的最小主链路。第 1–34 步全部通过，才表示“全功能 Demo 已跑通”。随后再进入安全、正式认证和真实 Provider 接入阶段。
