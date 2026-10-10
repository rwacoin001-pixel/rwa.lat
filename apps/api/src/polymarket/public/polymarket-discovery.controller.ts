import {Controller,Get,Req,Res} from '@nestjs/common'
import type {Request as ExpressRequest,Response as ExpressResponse} from 'express'
import {GET as feed} from './feed'
import {GET as event} from './event'
import {GET as market} from './market'

type PublicHandler = () => Promise<Response>

@Controller('polymarket/public')
export class PolymarketDiscoveryController {
  private readonly cache = new Map<string,{text:string;expires:number}>()
  private readonly pending = new Map<string,Promise<Response>>()

  @Get('feed')
  feed(@Req() req:ExpressRequest,@Res() res:ExpressResponse) {
    const request = this.request(req)
    return this.reply(request,res,10,()=>feed(request))
  }
  @Get('event/:id')
  event(@Req() req:ExpressRequest,@Res() res:ExpressResponse) {
    const request = this.request(req)
    return this.reply(request,res,30,()=>event(request,{params:Promise.resolve({id:String(req.params.id)})}))
  }
  @Get('market/:id')
  market(@Req() req:ExpressRequest,@Res() res:ExpressResponse) {
    const request = this.request(req)
    return this.reply(request,res,0,()=>market(request,{params:Promise.resolve({id:String(req.params.id)})}))
  }
  private request(req:ExpressRequest) {return new Request(new URL(req.originalUrl,'https://api.a-reit.com'))}

  private async reply(request:Request,res:ExpressResponse,ttl:number,handler:PublicHandler) {
    const key=request.url,hit=this.cache.get(key)
    res.type('application/json').setHeader('Cache-Control',ttl?`public,max-age=${ttl}`:'no-store')
    if(ttl&&hit&&hit.expires>Date.now()){res.send(hit.text);return}
    if(hit)this.cache.delete(key)
    let work=ttl?this.pending.get(key):undefined
    if(!work){
      if(this.pending.size>=8){res.status(503).setHeader('Cache-Control','no-store');res.send({error:'Public data busy'});return}
      work=handler()
      if(ttl)this.pending.set(key,work)
    }
    try {
      const response=await work,text=await response.clone().text()
      if(response.ok&&ttl&&text.length<=1024*1024){
        if(this.cache.size>=40)this.cache.delete(this.cache.keys().next().value!)
        this.cache.set(key,{text,expires:Date.now()+ttl*1000})
      }
      if(!response.ok)res.setHeader('Cache-Control','no-store')
      res.status(response.status).send(text)
    } catch {res.status(502).setHeader('Cache-Control','no-store');res.send({error:'Market data unavailable'})}
    finally {if(this.pending.get(key)===work)this.pending.delete(key)}
  }
}
