# A-REIT 文档中心

更新于 2026-10-16。先区分当前入口、保留参考与历史证据，再开始实施。含旧品牌的文件名、包名或服务标识不代表该文件已废弃，也不构成改名授权。

## 当前入口

- [当前项目与部署说明](deployment-current.md)：仓库、工作区核对、公开域名、发布边界与本次观察到的版本。每次发布仍须重新核查。
- [设计语言 Paper & Glass](design-system.md)：唯一现行设计规范。
- [身份与账本术语](../CONTEXT.md)：账户、登录身份、法律身份、账本与余额的区别。
- [原型参考规则](Prototype-Generation-Guide.md)：仅在任务确实要求设计样稿时使用。
- [Android 客户端源码参考](android-client-trial.md)：安装身份、签名、UA 和现有原生交互的兼容边界。

## 保留的规范、模板与参考

以下文档按用途保留。Demo、模板、待确认字段和旧能力说明不等于当前生产事实、真实机构关系或法律批准；本轮只更新必要的品牌和域名，不重新批准业务规则。

- [迭代与验收节奏](Iteration-Rhythm.md)
- [生产接入输入清单](Production-Readiness-Inputs.md)
- [生产适配器参考](developer-guide/adapter-interfaces.md)
- [身份信息加密设计决定](adr/0001-encrypted-identity-lookups.md)
- [当前单人审批策略](single-admin-approvals-20261009.md)
- [交易密码实施参考](operations/Transaction-Password-20261009.md)
- [产品控制与合规决定表](governance/Product-Compliance-Decision-Register.md)
- [准入与产品限制政策](governance/Access-Eligibility-and-Product-Restriction-Policy.md)
- [推荐、营销与归因记录](governance/AI-Referral-Marketing-and-Attribution-Records.md)
- [国际化与区域化规范](product/Internationalization-and-Regionalization-Spec.md)
- [页面与内容清单参考](product/H5-Page-and-Content-Inventory.md)
- [产品披露与生命周期规范](product/Product-Disclosure-and-Life-Cycle-Standard.md)
- [Demo 资产条款目录](product/Demo-Asset-Terms-Catalog.md)
- [企业与监管信息模板](legal/Corporate-and-Regulatory-Profile.md)
- [法律与披露模板包](legal/Demo-Legal-and-Disclosure-Pack.md)
- [隐私通知模板](legal/Privacy-Notice-Template.md)
- [用户条款模板](legal/Terms-of-Use-Template.md)
- [官方渠道与反诈骗](security/Official-Channels-and-Anti-Scam-Policy.md)
- [登录与注册接入要求](security/Authentication-Integration-Requirements.md)
- [客服、争议与反诈骗手册](operations/Trust-Support-Dispute-and-Anti-Scam-Playbook.md)
- [营销授权、审核与归因 SOP](operations/Marketing-Consent-Content-Review-and-Attribution-SOP.md)
- [客服与投资争议 SOP](operations/Customer-Support-and-Dispute-SOP.md)
- [上线缺口检查参考](operations/Pre-Launch-Gap-Checklist.md)
- [发布与回退参考](operations/Release-and-Rollback-Runbook.md)：执行前核对当前部署，历史记录中的具体版本不可直接重放。

## 历史资料

这些材料保留原始内容，供追溯当时的决定、实现与验收；不代表当前线上状态，也不是新任务的实施指令。文件原名和链接保留，避免破坏历史引用。

- [2026-07-13 实施快照](Implementation-Status-2026-07-13.md)、[旧任务表](Task-Board.md)、[旧产品与开发规格](RWA-LAT-Product-and-Development-Spec.md)
- [旧协作规范](AI-Agent-Collaboration-Plan.md)、[旧实现交接](implementation-handoff.md)、[2026-07-14 交接](handoff-2026-07-14.md)
- [旧 Cloudflare 部署教程](Cloudflare-Deploy-Guide.md)、[旧外部资源教程](Production-External-Setup-Guide.md)、[旧后端路线图](Backend-Completion-Roadmap.md)
- [历史任务记录](task-notes/)、[历史 QA 结果与检查表](qa/)、[历史发布记录](releases/)
- [历史实施计划](plans/)、[历史 Superpowers 计划](superpowers/plans/)
- [品牌迁移记录](operations/A-Reit-Brand-Migration-20261011.md)、[域名迁移记录](operations/A-Reit-Domain-Migration-20261010.md)、[单域名切换记录](operations/A-Reit-Only-Domain-20261011.md)

## 本批清理与使用边界

- [文案与文档清理清单](operations/Brand-Copy-Cleanup-20261016.md)：修改范围、历史保留清单及未验证事项。
- 实际产品、价格、费率、收益、地区可用性和交易状态以经过核实的现行业务数据与服务端规则为准，不从旧 Demo 文档推断。
- 不因清理品牌而改写历史交易、已执行迁移、签署文件、审计记录、用户内容、第三方正式名称或运行标识。
- 新批次区分已实现、已验证、已合并、已推送、已部署和真机验收；每批合并、推送及部署仍需单独确认。
