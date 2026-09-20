import { Controller, Get, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { createReadStream, existsSync } from 'fs'
import { join } from 'path'
import type { Response } from 'express'

/**
 * 公开媒体端点（只读）：组合媒体图与产品披露 PDF。
 * 资产随 API 构建打包（src/assets → dist/assets），不依赖外部对象存储。
 */
const SCOPES: Record<string, { dir: string; pattern: RegExp; contentType: string }> = {
  basket: { dir: 'media', pattern: /^[a-z0-9-]+\.png$/, contentType: 'image/png' },
  disclosure: { dir: 'disclosures', pattern: /^[a-z0-9-]+\.pdf$/, contentType: 'application/pdf' },
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  @Get(':scope/:file')
  @ApiOperation({ summary: 'Public read-only media (basket images, product disclosure PDFs)' })
  serve(
    @Param('scope') scope: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const spec = SCOPES[scope]
    if (!spec || !spec.pattern.test(file)) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Unknown media scope or file name.' })
    }
    const filePath = join(__dirname, '..', 'assets', spec.dir, file)
    if (!existsSync(filePath)) {
      throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: 'Media file not found.' })
    }
    res.set({
      'Content-Type': spec.contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
    })
    return new StreamableFile(createReadStream(filePath))
  }
}
