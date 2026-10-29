import 'reflect-metadata'
import { Reflector } from '@nestjs/core'
import { AdminAiKnowledgeController } from '../src/admin-ai-knowledge.controller'
import { AdminPermissionGuard } from '../src/admin-permission.guard'

describe('Admin negative AI feedback proxy',()=>{
  it('uses the authenticated admin identity and requires platform.manage',async()=>{
    const core = {get:jest.fn(async(..._args:any[])=>[])},controller = new AdminAiKnowledgeController(core as any)
    const context = (permissions:string[])=>({getHandler:()=>controller.feedback,getClass:()=>AdminAiKnowledgeController,switchToHttp:()=>({getRequest:()=>({admin:{id:'session-admin',permissions}})})})
    const guard = new AdminPermissionGuard(new Reflector())
    expect(()=>guard.canActivate(context([]) as any)).toThrow()
    expect(guard.canActivate(context(['platform.manage']) as any)).toBe(true)
    await controller.feedback({admin:{id:'session-admin'},body:{userId:'untrusted'}} as any)
    expect(core.get).toHaveBeenCalledWith('session-admin','/ai-knowledge/feedback')
  })
})
