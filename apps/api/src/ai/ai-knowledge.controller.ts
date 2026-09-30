import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { CurrentAuth } from '../security/current-auth.decorator'
import { OptionalSessionAuthGuard } from '../security/optional-session-auth.guard'
import { AiKnowledgeService } from './ai-knowledge.service'
import { KnowledgeRevisionDto, RestoreKnowledgeDto, SaveKnowledgeDto, KnowledgePreviewDto } from './ai-knowledge.dto'
import { CatalogService } from '../catalog/catalog.service'

@Controller('admin/ai-knowledge')
@UseGuards(AdminSessionGuard)
export class AdminAiKnowledgeController {
  constructor(private readonly knowledge: AiKnowledgeService, private readonly rbac: AdminRbacService, private readonly catalog: CatalogService) {}
  @Get() async list(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.permission(admin); return this.knowledge.listAdmin() }
  @Get('products') async products(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.permission(admin); return this.catalog.listProducts() }
  @Get('coverage') async coverage(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.permission(admin); return this.knowledge.coverage() }
  @Post('preview') async preview(@CurrentAdmin() admin: AuthenticatedAdmin,@Body() input: KnowledgePreviewDto) { await this.permission(admin); return this.knowledge.retrieve(input.question,input.locale,input.authenticated) }
  @Post() async create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() input: SaveKnowledgeDto) { await this.permission(admin); return this.knowledge.save(null, input, admin.id) }
  @Put(':id') async save(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() input: SaveKnowledgeDto) { await this.permission(admin); return this.knowledge.save(id, input, admin.id) }
  @Get(':id/versions') async versions(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string) { await this.permission(admin); return this.knowledge.versions(id) }
  @Post(':id/publish') async publish(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() input: KnowledgeRevisionDto) { await this.permission(admin); return this.knowledge.publish(id, input.expectedRevision, admin.id) }
  @Post(':id/archive') async archive(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() input: KnowledgeRevisionDto) { await this.permission(admin); return this.knowledge.archive(id, input.expectedRevision, admin.id) }
  @Post(':id/restore') async restore(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', ParseUUIDPipe) id: string, @Body() input: RestoreKnowledgeDto) { await this.permission(admin); return this.knowledge.restore(id, input.sourceRevision, input.expectedRevision, admin.id) }
  private permission(admin: AuthenticatedAdmin) { return this.rbac.assertPermission(admin.id, 'platform.manage') }
}

@Controller('ai/knowledge')
export class AiKnowledgeController {
  constructor(private readonly knowledge: AiKnowledgeService) {}
  @Get(':id/versions/:revision') @UseGuards(OptionalSessionAuthGuard)
  source(@Param('id', ParseUUIDPipe) id: string, @Param('revision', ParseIntPipe) revision: number, @CurrentAuth() auth: { userId: string | null } | undefined) { return this.knowledge.publicVersion(id, revision, Boolean(auth?.userId)) }
}
