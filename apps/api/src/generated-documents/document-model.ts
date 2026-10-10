export const DOCUMENT_KINDS = ['trade_confirmation', 'statement', 'agreement', 'tax_document'] as const
export type DocumentKind = typeof DOCUMENT_KINDS[number]
export type Company = { companyName: string; registration: string; contact: string; website: string }
export type Template = { title: string; introduction: string; terms: string[]; enabled: boolean }
export type DocumentSnapshot = {
  company: Company; companyRevision: number; template: Template; templateRevision: number;
  kind: DocumentKind; documentNo: string; userId: string; generatedAt: string;
  fields: Array<[string, string]>; columns?: string[]; rows?: string[][]; notes: string[];
}
export const DEFAULT_COMPANY: Company = { companyName: 'A-REIT', registration: '', contact: '', website: 'https://a-reit.com' }
export const DEFAULT_TEMPLATES: Record<DocumentKind, Template> = {
  trade_confirmation: { title: '成交确认书', introduction: '依据实际成交凭证与平台入账记录生成。', terms: ['本文件供对账与存档使用，不构成投资建议或收益承诺。', '本文件不是用户签署记录；管理员事后复核状态以生成时点为准。'], enabled: true },
  statement: { title: '账户结单', introduction: '按所选自然月 UTC 时区汇总 USDT 现金账本。', terms: ['结单包括可用及锁定现金；不将持仓估值计入现金余额。', '本文件反映生成时点可见的账务记录，后续更正应联系平台核实。'], enabled: true },
  agreement: { title: '投资服务协议', introduction: '', terms: [], enabled: false },
  tax_document: { title: '年度投资收入税务文件', introduction: '依据商务人员核实录入的税务资料与金额生成。', terms: ['本文件用于投资收入与预扣税额记录，不替代税务机关出具的完税凭证，不构成税务建议。'], enabled: true },
}
export function atomic(value: string, decimals = 6): string {
  const n = BigInt(value); const sign = n < 0n ? '-' : ''; const a = n < 0n ? -n : n
  const base = 10n ** BigInt(decimals)
  return sign + (a / base).toString() + (decimals ? '.' + (a % base).toString().padStart(decimals, '0') : '')
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
/** Fixed markup only. Editable fields are plain text, never executable HTML. */
export function documentHtml(s: DocumentSnapshot): string {
  const e = escapeHtml
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'none'"><title>${e(s.template.title)}</title><style>
    @page{size:A4;margin:18mm 16mm 20mm}*{box-sizing:border-box}body{margin:0;color:#202a33;font:11px/1.7 'Microsoft YaHei','Noto Sans CJK SC',Arial,sans-serif}header{display:flex;justify-content:space-between;border-bottom:2px solid #273d43;padding-bottom:14px}.brand{font-size:21px;font-weight:700}.muted{color:#60717a;font-size:9px;overflow-wrap:anywhere}h1{font-size:27px;margin:24px 0 8px}h2{font-size:13px;border-bottom:1px solid #d9e1e3;padding-bottom:7px;margin:22px 0 10px}.intro{white-space:pre-wrap;color:#52646a}dl{display:grid;grid-template-columns:116px 1fr;margin:0}dt,dd{margin:0;padding:7px 9px;border-bottom:1px solid #e6ebed}dt{color:#60717a;background:#f3f6f6}dd{overflow-wrap:anywhere;white-space:pre-wrap}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}thead{display:table-header-group}th{background:#e9eff0;color:#344b52}td,th{border-bottom:1px solid #dce4e6;padding:7px 5px;text-align:left;overflow-wrap:anywhere}tr{break-inside:avoid}section,p,li{overflow-wrap:anywhere}li{margin:8px 0;white-space:pre-wrap}footer{margin-top:24px;border-top:1px solid #aebec3;padding-top:12px;color:#60717a;font-size:9px}.identity{margin:12px 0;font-size:9px;color:#60717a;overflow-wrap:anywhere}
    </style></head><body><header><div><div class="brand">${e(s.company.companyName)}</div><div class="muted">${e(s.company.registration || '主体注册信息未配置')}</div></div><div class="muted">文件编号 ${e(s.documentNo)}<br>模板 v${s.templateRevision} / 主体 v${s.companyRevision}<br>${e(s.generatedAt)} UTC</div></header>
    <h1>${e(s.template.title)}</h1><p class="intro">${e(s.template.introduction)}</p><p class="identity">账户编号 ${e(s.userId)} · 资料取自真实记录，不推断未经核实的姓名或证件信息</p><h2>记录摘要</h2><dl>${s.fields.map(([k,v]) => `<dt>${e(k)}</dt><dd>${e(v)}</dd>`).join('')}</dl>
    ${s.columns ? `<h2>明细</h2><table><thead><tr>${s.columns.map(v=>`<th>${e(v)}</th>`).join('')}</tr></thead><tbody>${(s.rows ?? []).map(row=>`<tr>${row.map(v=>`<td>${e(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}
    ${s.notes.length ? `<h2>来源与状态</h2><ul>${s.notes.map(v=>`<li>${e(v)}</li>`).join('')}</ul>` : ''}
    ${s.template.terms.length ? `<h2>条款与说明</h2><ol>${s.template.terms.map(v=>`<li>${e(v)}</li>`).join('')}</ol>` : ''}
    <footer>${e(s.company.companyName)} · ${e(s.company.website)}${s.company.contact ? ` · ${e(s.company.contact)}` : ''}<br>本文件保留生成时的模板、主体配置和记录快照；后续模板修改不覆盖已存档文件。无手写签名或印章被自动生成。</footer></body></html>`
}
