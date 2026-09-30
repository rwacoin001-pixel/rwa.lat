import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { existsSync } from 'node:fs'
import type { PuppeteerNode } from 'puppeteer-core'
import { documentHtml, DocumentSnapshot } from './document-model'

@Injectable()
export class DocumentPdfRenderer {
  constructor(private readonly config: ConfigService) {}
  get executablePath(): string | undefined {
    const configured = this.config.get<string>('DOCUMENT_PDF_EXECUTABLE_PATH')?.trim()
    if (configured) return existsSync(configured) ? configured : undefined
    if (this.config.get<string>('APP_ENV') === 'production') return undefined
    return ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/chromium'].find(existsSync)
  }
  async render(snapshot: DocumentSnapshot): Promise<Buffer> {
    if (!this.executablePath) throw new ServiceUnavailableException('PDF_RENDERER_UNAVAILABLE')
    const puppeteer = (require('puppeteer-core') as {default:PuppeteerNode}).default
    const browser = await puppeteer.launch({ executablePath: this.executablePath, headless: true, timeout: 15_000,
      args: ['--disable-dev-shm-usage', ...(this.config.get<string>('DOCUMENT_PDF_DISABLE_SANDBOX') === 'true' ? ['--no-sandbox'] : [])] })
    try {
      const page = await browser.newPage()
      // No URLs, uploaded HTML, scripts or remote resources enter this renderer.
      await page.setJavaScriptEnabled(false)
      await page.setRequestInterception(true)
      page.on('request', request => { void request.abort() })
      await page.setContent(documentHtml(snapshot), { waitUntil: 'load', timeout: 15_000 })
      const bytes = Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true,
        displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#60717a"><span class="pageNumber"></span> / <span class="totalPages"></span></div>', timeout: 15_000 }))
      if (bytes.length > 25 * 1024 * 1024 || bytes.subarray(0,5).toString() !== '%PDF-') throw new Error('PDF_OUTPUT_INVALID')
      return bytes
    } finally { await browser.close() }
  }
}
