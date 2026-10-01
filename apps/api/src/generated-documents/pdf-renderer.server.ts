import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'

// Standalone entry point: no database, storage, wallet or application credentials.
const secret=process.env.DOCUMENT_PDF_SERVICE_SECRET
if (!secret || secret.length<32) throw new Error('PDF_SERVICE_SECRET_REQUIRED')
const expected=Buffer.from(`Bearer ${secret}`)
let busy=false
const server=createServer(async(request,response)=> {
  if(request.url==='/health' && request.method==='GET') { response.writeHead(200); response.end('ok'); return }
  const authorization=Buffer.from(request.headers.authorization??'')
  if(authorization.length!==expected.length || !timingSafeEqual(authorization,expected)) { response.writeHead(401); response.end(); return }
  if(request.url!=='/render' || request.method!=='POST' || !request.headers['content-type']?.startsWith('text/html')) { response.writeHead(400); response.end(); return }
  if(busy) { response.writeHead(503); response.end(); return }
  busy=true
  let directory: string|undefined
  let browser: Awaited<ReturnType<typeof puppeteer.launch>>|undefined
  try {
    let size=0
    const chunks: Buffer[]=[]
    for await(const chunk of request) {
      size+=chunk.length
      if(size>1024*1024) { response.writeHead(413); response.end(); return }
      chunks.push(Buffer.from(chunk))
    }
    directory=await mkdtemp(join(tmpdir(),'rwa-pdf-'))
    browser=await puppeteer.launch({executablePath:process.env.DOCUMENT_PDF_EXECUTABLE_PATH||'/usr/bin/chromium',
      headless:true,timeout:15000,userDataDir:join(directory,'profile'),
      env:{...process.env,HOME:directory,XDG_CONFIG_HOME:join(directory,'config'),XDG_CACHE_HOME:join(directory,'cache')},
      args:['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions']})
    const page=await browser.newPage()
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request',request=> { void request.abort() })
    await page.setContent(Buffer.concat(chunks).toString('utf8'),{waitUntil:'load',timeout:15000})
    const bytes=Buffer.from(await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,
      headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:8px;width:100%;text-align:center;color:#60717a"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',timeout:15000}))
    if(bytes.length>25*1024*1024 || bytes.subarray(0,5).toString()!=='%PDF-') throw new Error('PDF_OUTPUT_INVALID')
    response.writeHead(200,{'content-type':'application/pdf','content-length':bytes.length,'cache-control':'no-store'}); response.end(bytes)
  } catch { response.writeHead(503); response.end('PDF_RENDERER_UNAVAILABLE') }
  finally {
    try { await browser?.close() } catch { /* No private browser diagnostics are logged. */ }
    if(directory) await rm(directory,{recursive:true,force:true}).catch(()=>undefined)
    busy=false
  }
})
server.requestTimeout=60000
server.headersTimeout=10000
server.listen(3001,'0.0.0.0')
function stop() { server.close(()=>process.exit(0)); setTimeout(()=>process.exit(1),5000).unref() }
process.on('SIGTERM',stop)
process.on('SIGINT',stop)
