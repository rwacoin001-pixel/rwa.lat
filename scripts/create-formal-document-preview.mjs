import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const require=createRequire(resolve(root,'apps/api/package.json'))
const {ConfigService}=require('@nestjs/config')
const buildFolder=process.env.LOCAL_OPS_ISOLATED_BUILD==='true'?'.local-runtime':'dist'
const {DocumentPdfRenderer}=require(resolve(root,`apps/api/${buildFolder}/generated-documents/document-pdf.renderer.js`))
const {DEFAULT_COMPANY,DEFAULT_TEMPLATES,DOCUMENT_KINDS}=require(resolve(root,`apps/api/${buildFolder}/generated-documents/document-model.js`))
const renderer=new DocumentPdfRenderer(new ConfigService({APP_ENV:'development'}))
const dir=resolve(root,'tmp/pdfs/formal-document-preview')
await mkdir(dir,{recursive:true})
const fields={
  trade_confirmation:[['产品名称','生成时取真实产品名称'],['实际成交金额及份额','取实际成交凭证，不以报价推算'],['申请 / 凭证 / 账本流水编号','生成时取真实编号'],['复核状态','取生成时的真实复核状态']],
  statement:[['结单期间与时区','已结束的 UTC 自然月'],['期初 / 期末现金余额','完整现金账本精确计算'],['现金变化与明细','每条真实流水及其编号；不混入持仓市值']],
  agreement:[['主体与协议版本','用户阅读时显示的版本'],['用户确认时间','仅在本人明确同意后记录'],['电子同意记录编号','由系统生成；不模拟手写签名或盖章']],
  tax_document:[['账户持有人 / 税号 / 税务居民地区','商务核实录入'],['税年 / 税务辖区 / 收入统计口径','商务核实录入'],['报告币种 / 金额小数位','商务按原始报告填写，不自动换汇'],['收入总额 / 实际预扣税额 / 净额','按报告精度保留核实金额，不推断税率'],['依据凭证与哈希','真实资料经上传与扫描后填写']],
}
for(const kind of DOCUMENT_KINDS){
  const template={...DEFAULT_TEMPLATES[kind],title:`${DEFAULT_TEMPLATES[kind].title} - 排版预览`,introduction:'排版预览，非正式文件。下列文字说明字段来源，不代表已经发生交易、签署或税务申报。',terms:['标题、说明和条款均可在后台编辑。公司名称默认 A-REIT，修改一处即可用于后续文件。','已发放文件保留生成时的模板、主体资料和业务快照。']}
  const bytes=await renderer.render({company:DEFAULT_COMPANY,companyRevision:1,template,templateRevision:1,kind,documentNo:'PREVIEW - NOT AN ISSUED DOCUMENT',userId:'真实账户生成时填充',generatedAt:new Date().toISOString(),fields:fields[kind],notes:['此文件只展示首版字段和排版，不是任何用户的正式成交、签署或税务记录。']})
  await writeFile(resolve(dir,`${kind}.pdf`),bytes)
  console.log(JSON.stringify({kind,bytes:bytes.length,pdfHeader:bytes.subarray(0,5).toString()==='%PDF-'}))
}
