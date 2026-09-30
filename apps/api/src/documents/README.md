# 用户正式文件模板 · 规范与接入说明

> 交付方：Hermes · 2026-09-27
> 用途：后台可编辑的正式文件模板（成交确认 / 结单 / 协议 / 税务文件）
> 默认主体：**RWA.LAT**（运营主体可在后台改成公司名）

---

## 一、文件清单

```
apps/api/src/documents/templates/
  ├─ trade-confirmation.html   成交确认书
  ├─ statement.html            账户结单
  ├─ agreement.html            投资服务协议
  └─ tax-document.html         年度投资收入税务文件

预览（示例数据渲染·可切换 4 类）：
  design-concepts/user-documents/index.html
```

**模板格式**：单文件 HTML（内嵌 CSS·A4 打印版式 `@page size:A4`），占位符 `{{key}}`。

---

## 二、占位符规范

**命名**：小写驼峰 / 下划线均可，必须与下表一致。未提供的字段原样保留占位符（便于发现漏填）。

### 公共字段（4 类都要填）

| 占位符 | 含义 | 默认值 / 来源 |
|---|---|---|
| `companyName` | 运营主体名称 | **默认 `RWA.LAT`**（后台可改） |
| `companyUrl` | 官网 | `rwa.lat` |
| `companyContact` | 客服邮箱 | `support@rwa.lat` |
| `brandMark` | 徽标字母/字符 | `R`（可换 logo 图片） |
| `companyRegistration` | 主体注册信息 | 后台配置 |
| `documentNo` | 文件编号 | 系统生成（前缀见下） |
| `generatedAt` | 生成时间 | 渲染时刻 |
| `pageNo` / `pageCount` | 页码 | 分页时填 |
| `accountHolder` | 账户持有人 | 用户资料 |
| `accountNo` | 账户编号 | 用户账户 |
| `settleCurrency` | 结算币种 | `USDT` |

**编号前缀约定**：成交确认 `TC-` · 结单 `ST-` · 协议 `AGR-` · 税务 `TAX-`

### 1) 成交确认 `trade-confirmation.html`

`orderNo` `tradeDate` `settlementDate` `statusLabel` `statusClass`(settled|pending)
`productName` `productCode` `direction` `quantity` `unitPrice` `grossAmount` `fees` `netAmount`
`settlementMethod` `voucherNo` `ledgerRef` `operatorName` `reviewerName` `disputeDays`

### 2) 结单 `statement.html`

`periodLabel` `periodStart` `periodEnd` `openingBalance` `closingBalance` `periodChange` `changeClass`(up|down)
`netIncome` `yieldCredited` `valuationBasis` `disputeDays`
**循环行**（渲染前预生成 HTML）：
- `holdingsRows` — 每行：`<tr><td>产品</td><td class="num mono">数量</td><td class="num mono">成本</td><td class="num mono">市值</td><td class="num mono up|down">盈亏</td></tr>`
- `activityRows` — 每行：日期 / 类型(`<span class="tag">`)/ 说明 / 金额 / 余额
以及合计：`holdingsCostTotal` `holdingsValueTotal` `holdingsPnlTotal` `holdingsPnlClass`

### 3) 协议 `agreement.html`

`agreementTitle` `agreementType`(英文副标题) `version` `partyIdentity` `preamble`
`signDateCompany` `signDateParty` `expiryDate`
**条款 HTML**：`clausesHtml` — 每条形如：
```html
<div class="clause"><div class="no"><i>第一条</i>定义</div><ul><li>…</li></ul></div>
```

### 4) 税务文件 `tax-document.html`

`taxYear` `jurisdiction` `taxpayerId` `taxpayerAddress` `taxResidency` `reportCurrency`
`grossTotal` `withheldTotal` `netTotal` `yearEndHoldingsValue` `purchasesTotal` `salesTotal` `realizedGainLoss`
`notesHtml`（说明段落·HTML）
**循环行**：`incomeRows` — 收入类型 / 发生金额 / 预扣税额 / 净额

---

## 三、后台可编辑（建议实现）

```
表 document_templates (
  id, kind (trade_confirmation|statement|agreement|tax_document),
  name, html_body, version, is_default, updated_by, updated_at
)
表 document_template_versions ( 保留历史版本·便于回滚与留痕 )

约定：
· 首次初始化：把 templates/*.html 作为 kind 的 v1 默认模板写入（is_default=true）
· 后台「文件模板」页：按 kind 列出模板 → 富文本/源码编辑器 → 保存为新版本
· 恢复默认：一键从仓库内置版本重置
· 渲染：读取该 kind 的当前模板 → {{key}} 字符串替换 → HTML → PDF
```

**主体名称可改**：后台配置项 `legalEntity.companyName` 默认 `RWA.LAT`；
渲染时注入 `companyName`，因此**换主体只需改一处**，无需改模板。

**PDF 生成建议**：`puppeteer`（HTML→PDF·A4·`printBackground:true`）或 `wkhtmltopdf`。
页眉页脚用模板自带 `.head/.foot` 实现，不依赖浏览器页眉。

---

## 四、接入任务清单（交给后台）

```
□ 1. 建 document_templates / document_template_versions 表（迁移）
□ 2. 初始化 4 类默认模板（读 templates/*.html 写入 v1）
□ 3. 模板 CRUD + 版本回滚接口（仅管理员）
□ 4. 后台「文件模板」编辑页（预览 + 保存 + 恢复默认）
□ 5. 渲染服务：renderDocument(kind, data) → HTML → PDF
□ 6. 生成入口：
     · 成交确认：订单结算成功后生成，挂到用户文档中心
     · 结单：按月任务生成（或用户手动申请）
     · 协议：用户签署时生成存档
     · 税务文件：按税年生成（用户申请或年度任务）
□ 7. 权限：文件仅对所属用户可见（管理员可查）
□ 8. 落库对象存储（本地/S3 兼容），记录文件哈希与模板版本号
□ 9. 文件扫描接入后（见下），新生成/上传文件统一走扫描再标记可用
```

---

## 五、与「文件扫描」的关系

模板生成的是**平台自己产出的文件**（可信），但**用户上传的文件**（凭证、证件）
必须扫描后才标记可用。扫描方案见：`docs/frontend-completion/文件扫描方案.md`。
