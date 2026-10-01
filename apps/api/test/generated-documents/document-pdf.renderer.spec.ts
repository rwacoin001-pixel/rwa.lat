import { ConfigService } from '@nestjs/config'
import { DocumentPdfRenderer } from '../../src/generated-documents/document-pdf.renderer'
import { DocumentSnapshot } from '../../src/generated-documents/document-model'

describe('Isolated PDF renderer transport',()=> {
  const secret='a'.repeat(32)
  const renderer=new DocumentPdfRenderer(new ConfigService({DOCUMENT_PDF_SERVICE_URL:'http://pdf_renderer:3001',DOCUMENT_PDF_SERVICE_SECRET:secret}))
  const snapshot={company:{companyName:'rwa.lat',registration:'',contact:'',website:'https://rwa.lat'},companyRevision:0,template:{title:'Fixture',introduction:'',terms:[],enabled:true},templateRevision:0,documentNo:'TEST',userId:'FIXTURE',generatedAt:new Date().toISOString(),fields:[],notes:[],kind:'statement'} as DocumentSnapshot
  const original=global.fetch
  const request=jest.fn()
  beforeEach(()=> {global.fetch=request; request.mockReset()})
  afterAll(()=> {global.fetch=original})
  it('enables the worker without a local executable and renders using authenticated internal transport',async()=> {
    expect(renderer.available).toBe(true)
    request.mockResolvedValue({ok:true,headers:new Headers({'content-type':'application/pdf'}),arrayBuffer:async()=>Buffer.from('%PDF-fixture')})
    expect(await renderer.render(snapshot)).toEqual(Buffer.from('%PDF-fixture'))
    expect(request).toHaveBeenCalledWith(new URL('http://pdf_renderer:3001/render'),expect.objectContaining({method:'POST',redirect:'error',headers:expect.objectContaining({authorization:`Bearer ${secret}`})}))
  })
  it('rejects an unauthenticated service configuration',async()=> {
    const unavailable=new DocumentPdfRenderer(new ConfigService({APP_ENV:'production',DOCUMENT_PDF_SERVICE_URL:'http://pdf_renderer:3001'}))
    expect(unavailable.available).toBe(false)
    await expect(unavailable.render(snapshot)).rejects.toThrow('PDF_RENDERER_UNAVAILABLE')
    expect(request).not.toHaveBeenCalled()
  })
  it('rejects service errors and invalid PDF bodies without accepting partial output',async()=> {
    request.mockResolvedValueOnce({ok:false,headers:new Headers()})
    await expect(renderer.render(snapshot)).rejects.toThrow('PDF_RENDERER_UNAVAILABLE')
    request.mockResolvedValueOnce({ok:true,headers:new Headers({'content-type':'application/pdf'}),arrayBuffer:async()=>Buffer.from('not a pdf')})
    await expect(renderer.render(snapshot)).rejects.toThrow('PDF_OUTPUT_INVALID')
  })
})
