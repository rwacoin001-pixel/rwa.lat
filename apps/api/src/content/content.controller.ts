import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiOkResponse } from '@nestjs/swagger'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { ContentService } from './content.service'
import { ArticleDto, ArticleQueryDto, ArticleSummaryDto, PublishArticleDto, SaveArticleDto } from './content.dto'

@Controller('content/articles')
export class ContentController {
  constructor(private readonly content: ContentService) {}
  @Get() @ApiOkResponse({ type: ArticleSummaryDto, isArray: true })
  list(@Query() query: ArticleQueryDto) { return this.content.listPublished(query.locale) }
  @Get(':slug') @ApiOkResponse({ type: ArticleDto })
  article(@Param('slug') slug: string, @Query() query: ArticleQueryDto) { return this.content.article(slug, query.locale) }
}

@Controller('admin/content/articles')
@UseGuards(AdminSessionGuard)
export class AdminContentController {
  constructor(private readonly content: ContentService, private readonly rbac: AdminRbacService) {}
  @Get() async list(@CurrentAdmin() admin: AuthenticatedAdmin) { await this.rbac.assertPermission(admin.id, 'platform.manage'); return this.content.listAdmin() }
  @Post() async create(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() input: SaveArticleDto) { await this.rbac.assertPermission(admin.id, 'platform.manage'); return this.content.save(null, input, admin.id) }
  @Put(':id') async save(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: SaveArticleDto) { await this.rbac.assertPermission(admin.id, 'platform.manage'); return this.content.save(id, input, admin.id) }
  @Post(':id/publish') async publish(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: PublishArticleDto) { await this.rbac.assertPermission(admin.id, 'platform.manage'); return this.content.publish(id, input.expectedRevision, admin.id) }
  @Post(':id/archive') async archive(@CurrentAdmin() admin: AuthenticatedAdmin, @Param('id', new ParseUUIDPipe()) id: string, @Body() input: PublishArticleDto) { await this.rbac.assertPermission(admin.id, 'platform.manage'); return this.content.publish(id, input.expectedRevision, admin.id, true) }
}
