# 文案与文档清理记录 · 2026-10-16

## 基线与边界

- 基线：9edf70e0702992ef13c567bcf9fe769db24b2095；独立分支 chore/areit-copy-docs-20261016。
- 仅修改平台自有展示文字和 Markdown 文档。保留图片、布局、交互、分类键、接口、账户与认证标识、包名、数据库、队列和云资源。
- 本批未合并、推送、部署或执行生产数据更新。当前源码含界面文案改动，因此未来发布时需要相应前端发布；不能把本批整体称作纯文档发布。

## 已修改内容

- 现行设计文档改为 A-REIT，保留已实现的折门 Logo、页面各自的深浅主题、字体、Home/Markets/Assets 导航和独立 AI 入口，不重绘页面。
- 当前部署文档区分 Git 主线、工作区与线上版本，移除过时 E 盘唯一入口指令，保留运行标识并标明未核实的服务现况。
- 文档索引区分当前入口、保留参考和历史记录。Android 与原型参考文档按当前源码改正说明。
- 下列 19 个文件仅调整展示标签、下载文件名、示例输入和后台介绍；其中 112 处旧术语按七语言更新。金额、单位和文本占位符不改。

- [lib/account-flow-copy.ts](../../lib/account-flow-copy.ts)
- [lib/maison-account-copy.ts](../../lib/maison-account-copy.ts)
- [lib/hero-card-copy.ts](../../lib/hero-card-copy.ts)
- [lib/screen-copy.ts](../../lib/screen-copy.ts)
- [lib/portfolio-detail-copy.ts](../../lib/portfolio-detail-copy.ts)
- [lib/rwa-h5-copy.ts](../../lib/rwa-h5-copy.ts)
- [lib/catalog-localization.ts](../../lib/catalog-localization.ts)
- [components/home/HomeForYou.tsx](../../components/home/HomeForYou.tsx)
- [components/secondary-screen.tsx](../../components/secondary-screen.tsx)
- [components/screens/P04-Home.tsx](../../components/screens/P04-Home.tsx)
- [lib/rwa-data.ts](../../lib/rwa-data.ts)
- [apps/admin-frontend/src/app/layout.tsx](../../apps/admin-frontend/src/app/layout.tsx)
- [apps/admin-frontend/src/app/assets/page.tsx](../../apps/admin-frontend/src/app/assets/page.tsx)
- [apps/admin-frontend/src/app/dashboard/page.tsx](../../apps/admin-frontend/src/app/dashboard/page.tsx)
- [apps/admin-frontend/src/app/providers/page.tsx](../../apps/admin-frontend/src/app/providers/page.tsx)
- [apps/admin-frontend/src/app/networks/page.tsx](../../apps/admin-frontend/src/app/networks/page.tsx)
- [apps/admin-frontend/src/app/pricing/page.tsx](../../apps/admin-frontend/src/app/pricing/page.tsx)
- [apps/admin-frontend/src/app/control/page.tsx](../../apps/admin-frontend/src/app/control/page.tsx)
- [apps/admin-frontend/src/app/basket/page.tsx](../../apps/admin-frontend/src/app/basket/page.tsx)

## 历史保留清单

以下 82 份资料只在顶部增加历史标记和当前入口链接。正文的名称、路径、日期、实施状态与验收结论原样保留；不将历史结果重写成当前已验证事实。文件未移动或删除。

- [docs/AI-Agent-Collaboration-Plan.md](../AI-Agent-Collaboration-Plan.md)
- [docs/Backend-Completion-Roadmap.md](../Backend-Completion-Roadmap.md)
- [docs/Cloudflare-Deploy-Guide.md](../Cloudflare-Deploy-Guide.md)
- [docs/Implementation-Status-2026-07-13.md](../Implementation-Status-2026-07-13.md)
- [docs/Production-External-Setup-Guide.md](../Production-External-Setup-Guide.md)
- [docs/RWA-LAT-Product-and-Development-Spec.md](../RWA-LAT-Product-and-Development-Spec.md)
- [docs/Task-Board.md](../Task-Board.md)
- [docs/admin-user-management-20261008.md](../admin-user-management-20261008.md)
- [docs/ai-input-acceptance.md](../ai-input-acceptance.md)
- [docs/capture-acceptance.md](../capture-acceptance.md)
- [docs/design-contract.md](../design-contract.md)
- [docs/design/Apple-HIG-Review-2026-07-13.md](../design/Apple-HIG-Review-2026-07-13.md)
- [docs/handoff-2026-07-14.md](../handoff-2026-07-14.md)
- [docs/implementation-handoff.md](../implementation-handoff.md)
- [docs/mobile-polish-acceptance-20261004.md](../mobile-polish-acceptance-20261004.md)
- [docs/operations/A-Reit-Brand-Migration-20261011.md](A-Reit-Brand-Migration-20261011.md)
- [docs/operations/A-Reit-Domain-Migration-20261010.md](A-Reit-Domain-Migration-20261010.md)
- [docs/operations/A-Reit-Only-Domain-20261011.md](A-Reit-Only-Domain-20261011.md)
- [docs/operations/Financial-Production-Deployment.md](Financial-Production-Deployment.md)
- [docs/opportunity-video-handoff.md](../opportunity-video-handoff.md)
- [docs/plans/2026-10-04-android-ai-polish.md](../plans/2026-10-04-android-ai-polish.md)
- [docs/qa/Code-Remediation-Execution-Plan-2026-07-14.md](../qa/Code-Remediation-Execution-Plan-2026-07-14.md)
- [docs/qa/Functional-Runthrough-Execution-Plan-2026-07-14.md](../qa/Functional-Runthrough-Execution-Plan-2026-07-14.md)
- [docs/qa/Functional-Runthrough-Result-2026-07-15.md](../qa/Functional-Runthrough-Result-2026-07-15.md)
- [docs/qa/H5-Readiness-and-Acceptance-Checklist.md](../qa/H5-Readiness-and-Acceptance-Checklist.md)
- [docs/qa/Local-Code-Review-2026-07-13.md](../qa/Local-Code-Review-2026-07-13.md)
- [docs/releases/2026-10-02-prediction-ui.md](../releases/2026-10-02-prediction-ui.md)
- [docs/releases/email-suite-20261006.md](../releases/email-suite-20261006.md)
- [docs/runbooks/render-preview-deployment.md](../runbooks/render-preview-deployment.md)
- [docs/superpowers/plans/2026-10-02-prediction-events.md](../superpowers/plans/2026-10-02-prediction-events.md)
- [docs/superpowers/plans/2026-10-05-home-asset-card.md](../superpowers/plans/2026-10-05-home-asset-card.md)
- [docs/superpowers/plans/2026-10-11-crawler-protection.md](../superpowers/plans/2026-10-11-crawler-protection.md)
- [docs/task-notes/API-001.md](../task-notes/API-001.md)
- [docs/task-notes/API-002.md](../task-notes/API-002.md)
- [docs/task-notes/API-003-FACTOR-MANAGEMENT.md](../task-notes/API-003-FACTOR-MANAGEMENT.md)
- [docs/task-notes/API-003.md](../task-notes/API-003.md)
- [docs/task-notes/API-004.md](../task-notes/API-004.md)
- [docs/task-notes/API-005.md](../task-notes/API-005.md)
- [docs/task-notes/API-006.md](../task-notes/API-006.md)
- [docs/task-notes/API-007.md](../task-notes/API-007.md)
- [docs/task-notes/API-008.md](../task-notes/API-008.md)
- [docs/task-notes/API-009.md](../task-notes/API-009.md)
- [docs/task-notes/API-010.md](../task-notes/API-010.md)
- [docs/task-notes/API-011.md](../task-notes/API-011.md)
- [docs/task-notes/API-012.md](../task-notes/API-012.md)
- [docs/task-notes/API-013.md](../task-notes/API-013.md)
- [docs/task-notes/AUTH-001.md](../task-notes/AUTH-001.md)
- [docs/task-notes/DB-001.md](../task-notes/DB-001.md)
- [docs/task-notes/DB-002.md](../task-notes/DB-002.md)
- [docs/task-notes/DB-003.md](../task-notes/DB-003.md)
- [docs/task-notes/DB-004.md](../task-notes/DB-004.md)
- [docs/task-notes/DB-005.md](../task-notes/DB-005.md)
- [docs/task-notes/DB-006.md](../task-notes/DB-006.md)
- [docs/task-notes/DB-007.md](../task-notes/DB-007.md)
- [docs/task-notes/DESIGN-001.md](../task-notes/DESIGN-001.md)
- [docs/task-notes/FE-002.md](../task-notes/FE-002.md)
- [docs/task-notes/FE-004.md](../task-notes/FE-004.md)
- [docs/task-notes/FE-005.md](../task-notes/FE-005.md)
- [docs/task-notes/FE-006-VISUAL-FIX-2026-07-12.md](../task-notes/FE-006-VISUAL-FIX-2026-07-12.md)
- [docs/task-notes/FE-006.md](../task-notes/FE-006.md)
- [docs/task-notes/FE-010.md](../task-notes/FE-010.md)
- [docs/task-notes/FE-012.md](../task-notes/FE-012.md)
- [docs/task-notes/FE-014.md](../task-notes/FE-014.md)
- [docs/task-notes/FE-015.md](../task-notes/FE-015.md)
- [docs/task-notes/FINANCIAL-PRODUCTION-2026-07-15.md](../task-notes/FINANCIAL-PRODUCTION-2026-07-15.md)
- [docs/task-notes/FRONTEND-DEMO-COMPLETION-2026-07-12.md](../task-notes/FRONTEND-DEMO-COMPLETION-2026-07-12.md)
- [docs/task-notes/INFRA-001.md](../task-notes/INFRA-001.md)
- [docs/task-notes/INFRA-002.md](../task-notes/INFRA-002.md)
- [docs/task-notes/INFRA-003.md](../task-notes/INFRA-003.md)
- [docs/task-notes/INFRA-004.md](../task-notes/INFRA-004.md)
- [docs/task-notes/INFRA-005.md](../task-notes/INFRA-005.md)
- [docs/task-notes/MANUAL-CUSTODY-2026-09-18.md](../task-notes/MANUAL-CUSTODY-2026-09-18.md)
- [docs/task-notes/PARTNER-002.md](../task-notes/PARTNER-002.md)
- [docs/task-notes/QA-001.md](../task-notes/QA-001.md)
- [docs/task-notes/QA-002.md](../task-notes/QA-002.md)
- [docs/task-notes/QA-003.md](../task-notes/QA-003.md)
- [docs/task-notes/QA-004.md](../task-notes/QA-004.md)
- [docs/task-notes/QA-005.md](../task-notes/QA-005.md)
- [docs/task-notes/QA-006.md](../task-notes/QA-006.md)
- [docs/task-notes/ROUTE-001.md](../task-notes/ROUTE-001.md)
- [docs/task-notes/SEC-001.md](../task-notes/SEC-001.md)

- [docs/rwa-basket/PHASE0-PLAN.md](../rwa-basket/PHASE0-PLAN.md)

## 保留参考文档的品牌更新

以下 19 份参考文档仅改必要的品牌和公开域名，并标明本轮未复核其流程、法律状态或供应商配置；原有业务、安全与审批要求没有被重新批准或放宽。

- [docs/Iteration-Rhythm.md](../Iteration-Rhythm.md)
- [docs/Production-Readiness-Inputs.md](../Production-Readiness-Inputs.md)
- [docs/adr/0001-encrypted-identity-lookups.md](../adr/0001-encrypted-identity-lookups.md)
- [docs/developer-guide/adapter-interfaces.md](../developer-guide/adapter-interfaces.md)
- [docs/governance/Product-Compliance-Decision-Register.md](../governance/Product-Compliance-Decision-Register.md)
- [docs/legal/Corporate-and-Regulatory-Profile.md](../legal/Corporate-and-Regulatory-Profile.md)
- [docs/legal/Demo-Legal-and-Disclosure-Pack.md](../legal/Demo-Legal-and-Disclosure-Pack.md)
- [docs/legal/Privacy-Notice-Template.md](../legal/Privacy-Notice-Template.md)
- [docs/legal/Terms-of-Use-Template.md](../legal/Terms-of-Use-Template.md)
- [docs/operations/Agent-Suite-and-Community-Plan.md](Agent-Suite-and-Community-Plan.md)
- [docs/operations/Database-Setup-SOP.md](Database-Setup-SOP.md)
- [docs/operations/Go-To-Market-and-Organic-Growth-Plan.md](Go-To-Market-and-Organic-Growth-Plan.md)
- [docs/operations/Pre-Launch-Gap-Checklist.md](Pre-Launch-Gap-Checklist.md)
- [docs/operations/Trust-Support-Dispute-and-Anti-Scam-Playbook.md](Trust-Support-Dispute-and-Anti-Scam-Playbook.md)
- [docs/product/Demo-Asset-Terms-Catalog.md](../product/Demo-Asset-Terms-Catalog.md)
- [docs/product/Internationalization-and-Regionalization-Spec.md](../product/Internationalization-and-Regionalization-Spec.md)
- [docs/runbooks/email-brand-v2.md](../runbooks/email-brand-v2.md)
- [docs/security/Authentication-Integration-Requirements.md](../security/Authentication-Integration-Requirements.md)
- [docs/security/Official-Channels-and-Anti-Scam-Policy.md](../security/Official-Channels-and-Anti-Scam-Policy.md)

## 未验证与待办

- 数据库中的产品/组合名称、运营介绍、客服知识、邮件配置、已发布法律文本等不能由仓库字符串判断；本轮未访问或改写这些生产数据。发现旧品牌需另开只读盘点和版本化更新任务。
- 保留第三方正式产品名、用户内容、历史交易和历史文档中的旧词，不以全文零命中作为验收目标。
- 本轮不核实牌照、合作关系、产品法律性质或金融业务批准，不通过改文案生成这些事实。
- 当前云资源实际镜像、数据库连接、存储桶及队列未逐项复查；Worker 版本仅记录本轮只读观察，发布前须再核对。
- 浏览器模拟不代替 Android/iPhone 真机、辅助技术、完整登录或真实资金验收；本轮不执行真实资金操作。
- 验证结果以随交付提供的静态检查、类型检查、lint 和浏览器证据为准；本文件不预先宣称所有页面或设备通过。

## 本轮实际验证

- 前台与管理后台 TypeScript 类型检查通过；19 个修改的 TS/TSX 文件 lint 通过，零错误、零警告。
- 静态差异核查覆盖代码结构、112 处文案占位符/数字、七语言及历史文档正文保留；文档当前入口与新增提示中的本地链接已核对。
- 现有首页卡片开发预览在 375／390／430px 下切换七语言，21 个组合均未发现整页横向溢出；阿拉伯语正确使用 RTL。该预览使用示例数据，仅作为现有布局的兼容参考，不代表所有新增标签所在页面均已视觉验收。
- 实际市场页能加载；账户页、资产详情及管理后台的全部新增长文本，尚未完成登录态逐页浏览或真机验证。此项为发布前检查项。
- 本批没有运行生产构建、合并、推送或部署；不声称已上线。
