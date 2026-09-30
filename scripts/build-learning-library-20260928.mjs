import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const folder = resolve(root, 'docs/content-library/20260928')
const names = ['01-foundations.json','02-transactions.json','03-access-and-risk.json','04-tools-and-records.json']
const locales = ['zh-CN','en','hi','es','ar','fr','pt']
const metadata = JSON.parse(readFileSync(resolve(folder,'sources.json'),'utf8'))
const labels = {
  'zh-CN': { author:'rwa.lat 学习中心', reference:'延伸阅读（第三方产品规则不适用于本平台）', note:'阅读说明：本文为教育资料，不构成投资、法律或税务建议。实际权利、资格、费用、结算与功能开放情况，以适用的正式文件和当前服务为准。' },
  en: { author:'rwa.lat Learning', reference:'Further reading (third-party product rules do not apply to this platform)', note:'Reading note: Educational material, not investment, legal or tax advice. Actual rights, eligibility, costs, settlement and feature availability follow the applicable formal documents and current services.' },
  hi: { author:'rwa.lat अध्ययन केंद्र', reference:'आगे पढ़ें (अन्य उत्पादों के नियम इस प्लेटफ़ॉर्म पर लागू नहीं होते)', note:'पठन सूचना: शैक्षिक सामग्री; निवेश, कानूनी या कर सलाह नहीं। वास्तविक अधिकार, पात्रता, लागत, निपटान और उपलब्ध सुविधाएँ लागू औपचारिक दस्तावेज़ों और वर्तमान सेवाओं से तय होती हैं।' },
  es: { author:'rwa.lat Centro de aprendizaje', reference:'Lecturas adicionales (las reglas de otros productos no se aplican a esta plataforma)', note:'Nota de lectura: Material educativo, no asesoramiento de inversión, jurídico o fiscal. Derechos, elegibilidad, costes, liquidación y funciones disponibles se rigen por los documentos formales y servicios actuales.' },
  ar: { author:'rwa.lat مركز التعلم', reference:'قراءات إضافية (قواعد منتجات الجهات الأخرى لا تنطبق على هذه المنصة)', note:'ملاحظة قراءة: مادة تعليمية، وليست مشورة استثمارية أو قانونية أو ضريبية. تحدد الوثائق الرسمية المطبقة والخدمات الحالية الحقوق والأهلية والتكاليف والتسوية والوظائف المتاحة.' },
  fr: { author:'rwa.lat Centre d’apprentissage', reference:'Pour approfondir (les règles des produits tiers ne s’appliquent pas à cette plateforme)', note:'Note de lecture : contenu pédagogique, sans conseil en investissement, juridique ou fiscal. Droits, éligibilité, frais, règlement et fonctions disponibles suivent les documents formels applicables et les services actuels.' },
  pt: { author:'rwa.lat Centro de aprendizagem', reference:'Leitura adicional (regras de produtos de terceiros não se aplicam a esta plataforma)', note:'Nota de leitura: Material educativo, sem aconselhamento de investimento, jurídico ou tributário. Direitos, elegibilidade, custos, liquidação e funções disponíveis seguem os documentos formais aplicáveis e os serviços atuais.' }
}
const topics = names.flatMap(name=>JSON.parse(readFileSync(resolve(folder,name),'utf8')))
const articles = [], keys = new Set()
for (const topic of topics) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(topic.slug) || topic.slug.length>100) throw Error('Invalid article slug')
  if (JSON.stringify(Object.keys(topic.translations).sort())!==JSON.stringify([...locales].sort())) throw Error(`Language coverage mismatch: ${topic.slug}`)
  for (const id of topic.sources) if (!metadata.sources[id]) throw Error(`Unknown reference ${id}`)
  for (const locale of locales) {
    const copy=topic.translations[locale], key=`${topic.slug}:${locale}`
    if (keys.has(key)) throw Error(`Duplicate article ${key}`)
    keys.add(key)
    if (!copy.title?.trim() || !copy.summary?.trim() || copy.paragraphs.length!==3 || copy.paragraphs.some(p=>!p.includes('\n') || p.trim().length<35)) throw Error(`Incomplete article ${key}`)
    const text=[copy.title,copy.summary,...copy.paragraphs].join('\n')
    if (locale!=='zh-CN' && /[\u3400-\u9fff]/u.test(text)) throw Error(`Unexpected Chinese text: ${key}`)
    if (locale==='hi' && !/[\u0900-\u097f]/u.test(text) || locale==='ar' && !/[\u0600-\u06ff]/u.test(text)) throw Error(`Missing language script: ${key}`)
    if (/\uFFFD|DISPLAY TEST|\[TODO\]|Lorem ipsum|<script/i.test(text)) throw Error(`Invalid draft marker: ${key}`)
    const reading=topic.sources.length ? `\n\n${labels[locale].reference}\n${topic.sources.map(id=>`${metadata.sources[id].name}\n${metadata.sources[id].url}`).join('\n\n')}` : ''
    const body=`${copy.paragraphs.join('\n\n')}\n\n${labels[locale].note}${reading}`
    const payload={slug:topic.slug,locale,title:copy.title,summary:copy.summary,author:labels[locale].author,body}
    for (const [field,max] of Object.entries({slug:100,title:200,summary:600,author:120,body:50000})) if(typeof payload[field]!=='string' || payload[field].length>max || !payload[field].trim()) throw Error(`Invalid ${field}: ${key}`)
    articles.push(payload)
  }
}
if(topics.length!==12 || articles.length!==84) throw Error('Expected twelve topics and eighty-four drafts')
writeFileSync(resolve(folder,'articles.import.json'),JSON.stringify(articles,null,2)+'\n','utf8')
mkdirSync(resolve(folder,'review'),{recursive:true})
for (const locale of locales) {
  const localized=articles.filter(a=>a.locale===locale)
  const body=localized.map((a,i)=>`## ${String(i+1).padStart(2,'0')}. ${a.title}\n\n${a.summary}\n\n${a.body}\n\n---\n`).join('\n')
  writeFileSync(resolve(folder,`review/${locale}.md`),`# rwa.lat · ${locale}\n\n2026-09-28 · 12 educational drafts · not published\n\n${body}`,'utf8')
}
const manifest={version:1,preparedOn:'2026-09-28',state:'draft',topicCount:topics.length,articleCount:articles.length,locales,bodyFormat:'plain-text',sha256:createHash('sha256').update(JSON.stringify(articles)).digest('hex'),topics:topics.map(t=>({slug:t.slug,title:t.translations['zh-CN'].title,sources:t.sources})),review:{structuralValidation:'passed',editorialSelfReview:'completed',independentNativeLanguageReview:'not completed',legalReview:'not completed',publication:'not performed',regionAllowlist:'not created or changed'}}
writeFileSync(resolve(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8')
console.log(JSON.stringify({topicCount:topics.length,articleCount:articles.length,locales,valid:true,published:false,output:'docs/content-library/20260928/articles.import.json'}))
