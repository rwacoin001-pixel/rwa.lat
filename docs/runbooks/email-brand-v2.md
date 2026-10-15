# A-REIT 邮件样式 v2

## 生产显示名

`EMAIL_FROM_NAME=A-REIT` 是正确配置。`EmailDeliveryClient` 对遗留 `RWA.LAT` / `rwa lat` / `rwa-lat` 显示名另有兼容转换，防止旧配置恢复旧品牌。它不改变 `EMAIL_FROM` 的地址或认证域；自定义非旧品牌显示名也保留。

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
