import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {join,resolve,dirname} from 'node:path'
const root=resolve(import.meta.dirname,'../..')
const require=createRequire(join(root,'package.json'))
const sharp=require(require.resolve('sharp',{paths:[dirname(require.resolve('next/package.json'))]}))
const assets=join(root,'apps/api/src/assets/email-v2')
await mkdir(assets,{recursive:true})
// Deterministic rasterization of the approved wordmark, never an AI-generated logo.
await sharp(join(root,'public/brand/a-reit/logo-dark.svg')).resize(488,100,{fit:'contain'}).png().toFile(join(assets,'logo-lockup.png'))
if(process.argv[2]) await sharp(resolve(process.argv[2])).resize({width:1120,withoutEnlargement:true}).jpeg({quality:80,mozjpeg:true}).toFile(join(assets,'architecture.jpg'))
const resource=join(root,'apps/api/src/assets/email-templates')
const contracts=JSON.parse(await readFile(join(resource,'data-contract.json'),'utf8'))
const copy=JSON.parse(await readFile(join(root,'scripts/email/content.json'),'utf8'))
const common={
  'zh-CN':{help:'帮助与支持',security:'检查账户安全',minutes:'分钟内有效',expires:'链接有效期',codeWarning:'验证码仅用于你发起的操作，请勿向任何人透露。非本人操作，可忽略此邮件。',securityWarning:'如非本人操作，请立即检查账户安全。',notice:'请以账户内的最新记录为准。',unsubscribe:'取消订阅产品更新',image:'建筑材质与海平线的概念图',account:'账户通知'},
  en:{help:'Help & support',security:'Review account security',minutes:'minutes remaining',expires:'Link validity',codeWarning:'Use this code only for the action you requested. Never share it. If you did not request this, ignore this email.',securityWarning:'If this was not you, review your account security immediately.',notice:'Refer to your account for the latest records.',unsubscribe:'Unsubscribe from product updates',image:'An architectural study of stone and the sea horizon',account:'Account notice'},
  hi:{help:'सहायता और समर्थन',security:'खाते की सुरक्षा जाँचें',minutes:'मिनट तक मान्य',expires:'लिंक की वैधता',codeWarning:'यह कोड केवल आपके अनुरोध के लिए है। इसे किसी से साझा न करें। अनुरोध आपका नहीं है तो इस ईमेल को अनदेखा करें।',securityWarning:'यदि यह आपने नहीं किया है, तो तुरंत खाते की सुरक्षा जाँचें।',notice:'नवीनतम रिकॉर्ड अपने खाते में देखें।',unsubscribe:'उत्पाद अपडेट की सदस्यता रद्द करें',image:'पत्थर और समुद्री क्षितिज का वास्तुकला अध्ययन',account:'खाता सूचना'},
  es:{help:'Ayuda y soporte',security:'Revisar la seguridad',minutes:'minutos de validez',expires:'Validez del enlace',codeWarning:'Usa este código solo para la acción que solicitaste. No lo compartas. Si no lo solicitaste, ignora este correo.',securityWarning:'Si no fuiste tú, revisa de inmediato la seguridad de tu cuenta.',notice:'Consulta tu cuenta para ver los registros más recientes.',unsubscribe:'Cancelar novedades del producto',image:'Estudio arquitectónico de piedra y horizonte marino',account:'Aviso de cuenta'},
  ar:{help:'المساعدة والدعم',security:'مراجعة أمان الحساب',minutes:'دقيقة متبقية',expires:'صلاحية الرابط',codeWarning:'استخدم هذا الرمز للإجراء الذي طلبته فقط. لا تشاركه مع أحد. إذا لم تطلبه، فتجاهل هذه الرسالة.',securityWarning:'إذا لم تكن أنت، فراجع أمان حسابك فورًا.',notice:'راجع حسابك للاطلاع على أحدث السجلات.',unsubscribe:'إلغاء الاشتراك في تحديثات المنتج',image:'دراسة معمارية للحجر وأفق البحر',account:'إشعار الحساب'},
  fr:{help:'Aide et assistance',security:'Vérifier la sécurité du compte',minutes:'minutes de validité',expires:'Validité du lien',codeWarning:'Ce code est réservé à votre demande. Ne le partagez jamais. Si vous n’êtes pas à l’origine de la demande, ignorez cet e-mail.',securityWarning:'Si ce n’était pas vous, vérifiez immédiatement la sécurité de votre compte.',notice:'Consultez votre compte pour les dernières informations.',unsubscribe:'Se désabonner des actualités produit',image:'Étude architecturale de pierre et d’horizon marin',account:'Notification de compte'},
  pt:{help:'Ajuda e suporte',security:'Revisar a segurança da conta',minutes:'minutos de validade',expires:'Validade do link',codeWarning:'Use este código apenas para a ação solicitada. Nunca o compartilhe. Se não fez a solicitação, ignore este e-mail.',securityWarning:'Se não foi você, revise imediatamente a segurança da conta.',notice:'Consulte sua conta para ver os registros mais recentes.',unsubscribe:'Cancelar atualizações do produto',image:'Estudo arquitetônico de pedra e horizonte marinho',account:'Aviso de conta'},
}
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const placeholder=f=>`{{${f}}}`
for(const contract of contracts){
 const {id,locale,fields}=contract
 const message=copy[locale]?.messages[id], c=common[locale]
 if(!message||!c) throw new Error(`Missing email copy: ${locale}/${id}`)
 const rtl=locale==='ar', align=rtl?'right':'left'
 const code=fields.includes('code'), money=fields.includes('amount')
 const photo=id==='welcome'||id==='product-update'
 const details=fields.filter(f=>!['assetBaseUrl','supportUrl','year','actionUrl','securityUrl','unsubscribeUrl','code','expiryMinutes','expiryText','amount','currency'].includes(f))
 const row=f=>`<tr><td class="muted rule" style="padding:13px 0;border-bottom:1px solid #e9e9e7;color:#747779;font-size:13px;vertical-align:top;width:34%">${esc(copy[locale].labels[f]??f)}</td><td class="ink rule" dir="auto" style="padding:13px 0;border-bottom:1px solid #e9e9e7;color:#161a1d;font-size:14px;font-weight:500;text-align:${rtl?'left':'right'};vertical-align:top;word-break:break-word;overflow-wrap:anywhere">${placeholder(f)}</td></tr>`
 const codePanel=code?`<tr><td style="padding:8px 0 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="code-panel" bgcolor="#f5f3ef" style="padding:26px 12px;border:1px solid #e5ddce;border-radius:8px;text-align:center"><div dir="ltr" class="ink" style="color:#161a1d;font-family:Consolas,'Courier New',monospace;font-size:38px;line-height:1.25;letter-spacing:8px;font-weight:600;white-space:nowrap">{{code}}</div><div class="muted" style="padding-top:12px;color:#747779;font-size:12px"><span dir="ltr">{{expiryMinutes}}</span> ${esc(c.minutes)}</div></td></tr></table></td></tr>`:''
 const amount=money?`<tr><td style="padding:2px 0 25px"><div dir="ltr" class="ink" style="color:#161a1d;font-size:38px;line-height:1.2;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-1px">{{amount}} {{currency}}</div>${message.status?`<div class="muted" style="padding-top:9px;color:#747779;font-size:12px">${esc(message.status)}</div>`:''}</td></tr>`:''
 const body=details.length?`<tr><td style="padding-bottom:27px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details.map(row).join('')}</table></td></tr>`:''
 const action=fields.includes('actionUrl')?`<tr><td style="padding:0 0 24px;text-align:center"><!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{actionUrl}}" style="height:52px;v-text-anchor:middle;width:528px" arcsize="12%" stroke="f" fillcolor="#e3bb7a"><w:anchorlock/><center style="color:#1b1c1c;font-family:Arial,sans-serif;font-size:14px;font-weight:bold">${esc(message.action??message.title)}</center></v:roundrect><![endif]--><!--[if !mso]><!--><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#e3bb7a" style="border-radius:7px;text-align:center"><a href="{{actionUrl}}" style="display:block;padding:16px 20px;color:#1b1c1c;font-size:14px;font-weight:600;text-decoration:none;line-height:1.4">${esc(message.action??message.title)}</a></td></tr></table><!--<![endif]--></td></tr>`:''
 const expiry=fields.includes('expiryText')?`<tr><td class="muted" style="padding:0 0 23px;color:#747779;font-size:12px">${esc(c.expires)}: <span dir="auto">{{expiryText}}</span></td></tr>`:''
 const safety=code?c.codeWarning:fields.includes('securityUrl')?c.securityWarning:c.notice
 const security=fields.includes('securityUrl')?`<br><a class="mail-link" href="{{securityUrl}}" style="color:#92703f;text-decoration:underline">${esc(c.security)}</a>`:''
 const unsubscribe=fields.includes('unsubscribeUrl')?`<br><a class="mail-link" href="{{unsubscribeUrl}}" style="color:#747779;text-decoration:underline">${esc(c.unsubscribe)}</a>`:''
 const html=`<!doctype html>
<html lang="${locale}" dir="${rtl?'rtl':'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(message.title)}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}img{border:0;outline:none;text-decoration:none}a{color:#92703f}.mail-bg{background:#f3f4f4}.surface{background:#fff}.ink{color:#161a1d}.muted{color:#747779}@media(max-width:620px){.outer-pad{padding:16px 10px!important}.body-pad{padding:30px 24px 28px!important}.mail-title{font-size:27px!important}.brand-pad{padding:23px 24px!important}}@media(prefers-color-scheme:dark){.mail-bg{background:#0e1115!important}.surface{background:#191e24!important}.ink{color:#f4f4f2!important}.muted{color:#a6aaae!important}.rule{border-color:#343b42!important}.code-panel{background:#20262d!important;border-color:#5e503a!important}.shell{border-color:#343b42!important}}[data-ogsc] .mail-bg{background:#0e1115!important}[data-ogsc] .surface{background:#191e24!important}[data-ogsc] .ink{color:#f4f4f2!important}[data-ogsc] .muted{color:#a6aaae!important}</style>
<!--[if mso]><style>body,table,td,a{font-family:Arial,sans-serif!important}</style><![endif]--></head>
<body class="mail-bg" bgcolor="#f3f4f4" style="margin:0;padding:0;width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.6">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(message.intro)}</div>
<table role="presentation" class="mail-bg" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f3f4f4"><tr><td class="outer-pad" align="center" style="padding:38px 16px">
<!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" class="surface shell" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #e4e5e5">
<tr><td class="brand-pad" bgcolor="#11151b" style="padding:25px 36px;border-bottom:2px solid #d5b27c"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="${align}"><img alt="A-REIT" src="{{assetBaseUrl}}/logo-lockup.png" width="122" height="25" style="display:block;width:122px;height:25px;color:#ffffff;font-weight:600"></td><td style="text-align:${rtl?'left':'right'};color:#aeb0b3;font-size:10px;letter-spacing:.8px">${esc(c.account)}</td></tr></table></td></tr>
${photo?`<tr><td><img src="{{assetBaseUrl}}/architecture.jpg" alt="${esc(c.image)}" width="600" height="200" style="display:block;width:100%;height:auto"></td></tr>`:''}
<tr><td class="body-pad" align="${align}" style="padding:34px 36px 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="mail-title ink" style="padding:0 0 15px;color:#161a1d;font-size:30px;font-weight:600;line-height:1.3;letter-spacing:-.5px">${esc(message.title)}</td></tr><tr><td class="muted" style="padding:0 0 26px;color:#747779;font-size:15px;line-height:1.7">${esc(message.intro)}</td></tr>
${codePanel}${amount}${body}${action}${expiry}
<tr><td class="muted rule" style="padding-top:21px;border-top:1px solid #e9e9e7;color:#747779;font-size:12px;line-height:1.7">${esc(safety)}${security}</td></tr></table></td></tr>
<tr><td class="muted rule" style="padding:20px 24px;border-top:1px solid #e9e9e7;text-align:center;font-size:11px;line-height:1.9;color:#747779"><a href="{{supportUrl}}" style="color:#92703f;text-decoration:underline">${esc(c.help)}</a>${unsubscribe}<br>© {{year}} A-REIT</td></tr></table>
<!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>
`
 const text=[message.title,'',message.intro,'',...(code?['{{code}}',`{{expiryMinutes}} ${c.minutes}`,'']:[]),...(money?['{{amount}} {{currency}}',...(message.status?[message.status]:[]),'']:[]),
  ...details.map(f=>`${copy[locale].labels[f]??f}: ${placeholder(f)}`),...(fields.includes('actionUrl')?['',`${message.action??message.title}: {{actionUrl}}`]:[]),
  ...(fields.includes('expiryText')?[`${c.expires}: {{expiryText}}`]:[]),'',safety,...(fields.includes('securityUrl')?[`${c.security}: {{securityUrl}}`]:[]),'',
  `${c.help}: {{supportUrl}}`,...(fields.includes('unsubscribeUrl')?[`${c.unsubscribe}: {{unsubscribeUrl}}`]:[]),'© {{year}} A-REIT',''].join('\n')
 // Keep adjacent CSS closing braces distinct from the renderer's template delimiter.
 const accessible=html.replace('<a href="{{supportUrl}}"','<a class="mail-link" href="{{supportUrl}}"')
   .replace('</style>','@media(prefers-color-scheme:dark){.mail-link{color:#e3bb7a!important}}[data-ogsc] .mail-link{color:#e3bb7a!important}</style>')
 await writeFile(join(resource,'templates',locale,`${id}.html`),accessible.replaceAll('!important}}','!important} }'))
 await writeFile(join(resource,'templates',locale,`${id}.txt`),text)
 contract.subject=message.title.includes('A-REIT')?message.title:`${message.title} · A-REIT`
}
await writeFile(join(resource,'data-contract.json'),JSON.stringify(contracts,null,2)+'\n')
console.log(`Built ${contracts.length} HTML + plain-text emails with unchanged data contracts.`)
