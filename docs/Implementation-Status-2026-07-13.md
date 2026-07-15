# RWA.LAT 实施状态快照

时间：2026-07-13  
性质：本地 Demo / 开发状态，不代表生产批准。

## 已完成并通过构建

- H5/PWA：Next.js 16 生产构建通过；41 条页面路由、Polymarket 只读 API 与 404 恢复均通过本地 HTTP 复验。
- API：NestJS 生产构建通过。
- Admin Frontend：Next.js 14 生产构建通过，共 32 个页面路由。
- Admin API：NestJS 生产构建通过。
- Guest：会话持久化、Guest 标识和受保护动作拦截已接入。
- 国际化框架：`en`、`zh-CN`、`hi`、`es`、`ar`、`fr`、`pt` 语言状态、持久化和 RTL 已接入；当前仅核心导航与部分页面完成，详情、订单、KYC、Polymarket 和长文案仍在补齐，尚不能标记为七语言验收通过。
- AI：配置执行前展示免责声明，并在 Demo 本地保存版本化确认记录。
- 营销：按邮件、推送、社群独立授权，可全部退订，并保存版本与时间。
- 归因：保存首触点、末触点、UTM 与邀请码，不在 URL 中加入敏感身份信息。
- 客服/安全：客服与订单争议入口、官方渠道验证、诈骗举报及 Demo 引用号已接入。
- 信任中心：Guest 可浏览准入与地区、产品披露、法律文件、官方渠道和争议入口；详情页与认证页均提供语言切换入口。
- 文档：产品决策、资产条款、法律披露、隐私、用户条款、运营、营销审核、客服争议、反诈骗、国际化和 QA 清单已建立。

## 仍需生产接入

- 已按公开资料暂定映射 WAVEMAKER PACIFIC PARTNERS PTE. LTD.（UEN 201402949K）及 MAS VCFM 记录；仍需公司确认其为 RWA.LAT 运营主体，并提供 ACRA 原件、公开页未显示的牌照编号及与本产品范围相关的法律意见。
- 替换所有 Demo 合作方、发行主体、官方账号、邮箱、费率、规模和收益数据。
- 将 Guest、营销、AI 确认、归因、工单和诈骗举报从 localStorage 接入服务端与审计日志。
- 由母语与法务共同复核七语言的长篇产品、订单、KYC、风险和法律文案；当前未覆盖 key 会回退英语。
- 配置 PostgreSQL 测试库、对象存储、邮件、托管、KYC/AML、市场数据和监控环境。
- 完成浏览器点击、移动端尺寸、iOS PWA、Android、RTL 和可访问性回归。

## 验证结果

| 检查 | 结果 |
|---|---|
| H5 TypeScript | 通过 |
| H5 production build | 通过 |
| H5 route verification | 通过（41 条页面 + Polymarket 只读 API + 404 恢复） |
| API build | 通过 |
| Admin Frontend build | 通过 |
| Admin API build | 通过 |
| API tests | 17 suites 通过；9 suites 因缺少 `TEST_DATABASE_URL`/PostgreSQL 失败；3 suites 跳过 |
| Admin API tests | 因缺少 `ADMIN_DATABASE_URL`/PostgreSQL 失败 |
| 浏览器自动化 | 未执行：本机未安装 `agent-browser` |

## 当前运行地址

H5 本地服务：`http://localhost:3030`。
