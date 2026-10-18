> **保留的参考文档，2026-10-16 仅更新品牌与公开域名。** 本轮未重新验证文中的能力、流程、法律状态或供应商配置；当前部署事实见[当前项目说明](../deployment-current.md)。

# A-REIT 邮件样式 v2

## 生产显示名

`EMAIL_FROM_NAME=A-REIT` 是正确配置。`EmailDeliveryClient` 对遗留 `RWA.LAT` / `rwa lat` / `rwa-lat` 显示名另有兼容转换，防止旧配置恢复旧品牌。它不改变 `EMAIL_FROM` 的地址或认证域；自定义非旧品牌显示名也保留。

现行发件地址为 `no-reply@a-reit.com`，核心 API 与管理 API 均需配置。邮件、图片及公开链接使用 a-reit.com 及其 api/admin 子域。历史仓库和服务内部标识不属于公开发信域，不应因此改名。2026-10-15 已单独修正生产发件配置，保留原镜像、其他配置及配置备份；该配置变更不代表后续源码补丁已经部署。

## 模板与资源

- 35 个场景 × 7 种语言：245 对 HTML/纯文本模板。只更新静态文案、主题与样式，字段、connection 和业务事件保持不变。
- `scripts/email/content.json` 是文案源；`node scripts/email/build.mjs` 可重新生成模板和由现行 SVG 确定性渲染的 PNG 字标。
- 配图是虚构建筑材质概念，不代表任何具体持有物业，仅用于欢迎与产品更新。验证码邮件不使用大幅装饰图；验证码和金额保留可复制文字。
- `email-v2/logo-lockup.png`、`email-v2/architecture.jpg` 随 API 构建打包，通过现有只读媒体路由提供。v1 原文件与路由保留，让以前发出的邮件仍能加载图片。
- 新 URL 避免复用旧图缓存。JPEG 小于 100 KB；实际 HTML 小于 8 KB，远低于 Gmail 常见截断量级。

## 邮件兼容

表格布局、内联关键样式、真实图片尺寸、图片替代文字、浅深主题声明、Outlook VML 按钮。阿拉伯语整体 RTL，数字验证码与金额仍为 LTR；图片禁用时业务内容仍是文字。

深色模式支持受邮件客户端影响。浏览器模拟、源码检查不等于 Gmail / Outlook / Apple Mail 真机验收。

## 检查与发布

在 `apps/api` 运行相关 Jest：`test/common/email-template.spec.ts`、`test/common/email-assets.spec.ts`、`test/identity/branded-email-delivery.spec.ts`、`test/identity/email-flow-delivery.spec.ts`，然后执行 Nest 构建。所有变量、URL 白名单、有效期、验证码、发件地址及 RTL 仍应通过。

这批只更新邮件。不要发布用户前端，也不要改变已上线的预测派彩配置。先核对最新 main 和生产 API 镜像，再按用户逐批确认的要求发布。真实测试邮件另按用户授权发送，不伪造资金事件测试。

## 后续通知与管理员恢复接入

普通通知队列新增七语 HTML/纯文本外观。显式语言优先，其次通知偏好与账户语言；语言随通知保存，旧队列在投递时解析。业务类型及完整字段契约匹配才选择对应场景，字段不全则保留原通知标题和正文，不推算金额、状态或链接。模板文件损坏和运行错误仍进入原重试流程。

营销与产品更新继续受现有同意控制，链接到真实邮件偏好页；不宣称实现一键退订。此接入不自动新增业务事件。管理员验证器恢复邮件支持七语，浏览器提交语言，原验证码、有效期、限流及恢复规则保持不变。

发布此后续批次时分别构建核心 API、管理 API、管理前端；安装引导语言补丁另外构建用户 Worker。核对每个服务当前镜像与配置，保留并发 AI 的更新。没有数据库迁移，不改变自动派彩开关。

补充验证：`test/notification/branded-notification-delivery.spec.ts`、`test/notification/notification.service.spec.ts`；管理服务 `test/admin-recovery-email.spec.ts`。用户安装指引语言测试为根目录 `scripts/install-locale.test.mjs`、`scripts/locale-detection.test.mjs`。预览和模拟视口验收不能代替七语真实收件或真机验收。
