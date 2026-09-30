import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { DataSource } from 'typeorm'
import { PublishedLegalDocumentDto } from './legal.dto'

@ApiTags('legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly db: DataSource) {}
  @Get(':kind')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Read published legal text, optionally at an immutable version' })
  @ApiOkResponse({ type: PublishedLegalDocumentDto })
  @ApiQuery({ name: 'version', required: false, type: String })
  async get(@Param('kind') kind: string, @Query('version') version?: string): Promise<PublishedLegalDocumentDto> {
    if (!['terms','privacy'].includes(kind) || (version !== undefined && (typeof version !== 'string' || version.length > 80))) throw new NotFoundException()
    const [row] = await this.db.query(`SELECT v.revision,v.version,v.content,v.published_at AS "publishedAt"
      FROM app.legal_documents d JOIN app.legal_document_versions v ON v.kind=d.kind
      WHERE d.kind=$1 AND ${version ? 'v.version=$2' : 'v.revision=d.published_revision'}`,
    version ? [kind,version] : [kind])
    if (!row) throw new NotFoundException({ code: 'LEGAL_DOCUMENT_UNPUBLISHED', message: 'This document has not been published.' })
    return { kind: kind as 'terms' | 'privacy', revision: row.revision, version: row.version,
      title: row.content.title, effectiveDate: row.content.effectiveDate, sections: row.content.sections, publishedAt: row.publishedAt }
  }
}
