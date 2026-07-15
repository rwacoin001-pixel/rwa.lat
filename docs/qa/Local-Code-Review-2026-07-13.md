# RWA.LAT 本地代码审查报告

日期：2026-07-13  
范围：H5/PWA、API、Admin、Admin Frontend、共享 contracts、文档与本地演示数据。  
结论：**当前版本可以继续本地 Demo 与页面评审；不能据此认定已具备生产资金、身份或后台安全条件。**

## 1. 本轮已验证

| 检查 | 结果 |
|---|---|
| H5 独立 TypeScript | 通过 |
| H5 production build | 通过 |
| 页面路由 | 41 条页面全部 HTTP 200 |
| Polymarket | 公共市场只读 API 可用，外部交易保持关闭；断网时回退 Demo |
| 404/异常路由 | 自定义恢复页通过 |
| 移动端宽度 | 430 × 932 下无横向溢出 |
| 首页间距 | AI 评分与视频约 12px；市场概览与今日事项约 24px |
| Invest 产品卡 | 抽查前四张卡，收益标签均未越界或遮挡 |
| 固定 CTA | 产品详情按钮固定在底部安全区上方；内容区预留 164px |
| PWA | manifest、180px iOS 图标、Service Worker 语法通过；最近页面与同源静态资源可缓存 |
| ESLint | 跳过：仓库未安装 ESLint 可执行依赖 |

## 2. 可保留的 Demo 行为

- 邮箱、Google、X、钱包签名、KYC、下单、客服、推荐、营销与准入页面继续提供可交互效果；
- Demo 可使用本地状态或模拟响应，便于查看 loading、success、error、offline 与恢复状态；
- 每个资金或外部交易页面必须继续显示 `Demo` / “未产生真实外部订单”的执行状态；
- Demo 与生产数据命名空间、凭据和构建环境必须分离，不能把 Demo 身份或订单记录迁移为生产事实。

## 3. 生产阻断项

### P0 — OAuth 身份断言由浏览器提供

API 当前可根据客户端提交的 `provider + subject` 建立身份。该方式仅可作为本地 Demo 适配器；生产必须改为 Google/X Authorization Code + PKCE，由服务端校验 issuer、audience、state、nonce 与授权码。

### P0 — Admin 密钥暴露在客户端

Admin Frontend 多个页面读取 `NEXT_PUBLIC_ADMIN_API_KEY`，并存在 `test-admin-key-123` 回退值。`NEXT_PUBLIC_*` 会进入浏览器包，不能作为管理权限凭据。生产应由服务端 BFF/会话代理注入后台凭据，浏览器只持有 HttpOnly 管理会话。

### P0 — 管理员身份可由请求头或表单伪造

部分管理接口使用 `x-admin-id`、`approver` 或 `decidedBy` 作为操作人。生产操作人必须来自已验证会话与 RBAC 上下文，审批记录不得相信客户端自报身份。

### P1 — 邮箱验证与找回仍是开发闭环

开发接口可返回 verification/recovery token，找回流程也可能暴露账号是否存在。生产邮件由服务端发送；响应统一；token 只保存哈希并单次消费。

### P1 — 七语言尚未验收完成

语言状态、持久化、RTL、全局/详情/认证页语言入口已经接入；核心导航、主页、信任中心及部分合规文案已有七语。产品详情、订单状态、KYC、Polymarket、客服表单和项目长文案仍有英语回退，因此不能标记为“七语完成”。

### P1 — 数据库集成测试缺少环境

上轮 API 测试有 17 个 suites 通过，9 个因缺少 `TEST_DATABASE_URL` / PostgreSQL 失败，Admin 测试缺少 `ADMIN_DATABASE_URL`。这些属于环境缺口，不能等同于测试通过。

## 4. 工程质量问题

- `next.config.mjs` 开启 `typescript.ignoreBuildErrors`；虽然本轮独立 `tsc --noEmit` 通过，但生产流水线不应跳过类型失败；
- 根 `tsconfig` 未覆盖全部 `apps/` 与 `packages/`，各子项目需要独立 typecheck/build gate；
- 根脚本声明 `eslint .`，但没有安装 ESLint；应补齐版本、配置与 CI；
- `apps/api/nul` 疑似 Windows 命令误生成文件，应由原作者确认后清理；
- Admin 页面大量超长单文件与重复 fetch/header 逻辑，应统一到服务端 API client；
- 多个 Demo 记录保存在 localStorage，生产需迁移到服务端审计记录并支持版本、撤回和导出。

## 5. 本轮已修复

- 首页 AI 组合评分不再被视频遮挡；
- 首页市场概览与今日事项增加模块间距；
- Invest 产品卡由固定高度改为最小高度，预计收益率完整显示；
- Compute 头部卡将 APY 标签约束在安全文本列；
- 详情页与认证页增加七语言切换；
- 增加 Trust、准入地区、产品披露、法律中心四个 Guest 可见页面；
- 法律中心展示暂定新加坡主体、UEN、地址、MAS 状态与官方核验链接，并明确待公司确认；
- PWA 使用 PNG Apple 图标、在线成功即缓存、断网读取最近页面，离线页支持七语；
- Demo/生产隔离要求写入登录与准入规范，保留 Demo 交互，不关闭演示接口。

## 6. 下一轮顺序

1. 完成所有页面七语言 key，增加“缺 key 即构建失败”脚本；
2. 为 Demo API 响应统一加入 `executionMode: demo`、request ID 与状态时间线；
3. 接入正式 OAuth、邮件、钱包签名与 MPC 适配层；
4. 重构 Admin BFF 与 RBAC actor 来源；
5. 配置 PostgreSQL 后补跑数据库测试；
6. 安装 ESLint，并执行 iOS PWA、Android、RTL、200% 文本缩放与辅助功能回归。
