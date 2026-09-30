import { Body, Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { AgreementConsentDto, CompanyDto, RevisionDto, StatementDocumentDto, TaxRecordDto, TemplateDto } from './document.dto'
import { GeneratedDocumentsService } from './generated-documents.service'
import { DocumentKind } from './document-model'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

const kinds={trade_confirmation:'trade_confirmation',statement:'statement',agreement:'agreement',tax_document:'tax_document'}
class RestoreDto extends RevisionDto { @ApiProperty({minimum:1}) @IsInt() @Min(1) sourceRevision!:number }
class DocumentUserQuery { @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() userId?:string }

@Controller('documents')
@UseGuards(SessionAuthGuard)
export class GeneratedDocumentsController {
  constructor(private readonly docs:GeneratedDocumentsService) {}
  @Get() list(@CurrentAuth() user:SecurityActor){return this.docs.list(user.userId)}
  @Post('trade-confirmations') trades(@CurrentAuth() user:SecurityActor){return this.docs.backfillTrades(user.userId)}
  @Post('statements') statement(@CurrentAuth() user:SecurityActor,@Body() input:StatementDocumentDto){return this.docs.statement(user.userId,input.month)}
  @Get('agreement') agreement(){return this.docs.agreement()}
  @Post('agreement/consent') consent(@CurrentAuth() user:SecurityActor,@Body() input:AgreementConsentDto){return this.docs.consent(user.userId,input)}
  @Post(':id/download') download(@CurrentAuth() user:SecurityActor,@Param('id',new ParseUUIDPipe()) id:string){return this.docs.download(user.userId,id)}
  @Post(':id/retry') retry(@CurrentAuth() user:SecurityActor,@Param('id',new ParseUUIDPipe()) id:string){return this.docs.retry(user.userId,id)}
}

@Controller('admin/document-templates')
@UseGuards(AdminSessionGuard)
export class AdminDocumentTemplatesController {
  constructor(private readonly docs:GeneratedDocumentsService,private readonly rbac:AdminRbacService){}
  private allow(admin:AuthenticatedAdmin){return this.rbac.assertPermission(admin.id,'platform.manage')}
  @Get() async configuration(@CurrentAdmin() admin:AuthenticatedAdmin){await this.allow(admin);return this.docs.configuration()}
  @Post('company') async company(@CurrentAdmin() admin:AuthenticatedAdmin,@Body() input:CompanyDto){await this.allow(admin);return this.docs.saveCompany(input,admin.id)}
  @Get('issued') async issued(@CurrentAdmin() admin:AuthenticatedAdmin,@Query() query:DocumentUserQuery){await this.allow(admin);return this.docs.listAdmin(query.userId)}
  @Post('tax-records') async tax(@CurrentAdmin() admin:AuthenticatedAdmin,@Body() input:TaxRecordDto){await this.allow(admin);return this.docs.tax(input,admin.id)}
  @Get(':kind/versions') async versions(@CurrentAdmin() admin:AuthenticatedAdmin,@Param('kind',new ParseEnumPipe(kinds)) kind:DocumentKind){await this.allow(admin);return this.docs.versions(kind)}
  @Post(':kind/save') async save(@CurrentAdmin() admin:AuthenticatedAdmin,@Param('kind',new ParseEnumPipe(kinds)) kind:DocumentKind,@Body() input:TemplateDto){await this.allow(admin);return this.docs.saveTemplate(kind,input,admin.id)}
  @Post(':kind/reset') async reset(@CurrentAdmin() admin:AuthenticatedAdmin,@Param('kind',new ParseEnumPipe(kinds)) kind:DocumentKind,@Body() input:RevisionDto){await this.allow(admin);return this.docs.reset(kind,input.expectedRevision,admin.id)}
  @Post(':kind/restore') async restore(@CurrentAdmin() admin:AuthenticatedAdmin,@Param('kind',new ParseEnumPipe(kinds)) kind:DocumentKind,@Body() input:RestoreDto){await this.allow(admin);return this.docs.restore(kind,input.sourceRevision,input.expectedRevision,admin.id)}
}
