import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Res } from '@nestjs/common'
import type { Response } from 'express'
import { PlatformService } from './platform.service'

@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}
  @Get() profile() { return this.platform.publicProfile() }
  @Get('documents/:revision/:index')
  async document(@Param('revision', ParseIntPipe) revision: number, @Param('index', ParseIntPipe) index: number, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, await this.platform.publicDocument(revision, index))
  }
  @Get('products/:id/cover')
  async cover(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, await this.platform.productCover(id))
  }
  @Get('products/:id/disclosures/:disclosureId')
  async disclosure(@Param('id', ParseUUIDPipe) id: string, @Param('disclosureId', ParseUUIDPipe) disclosureId: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, await this.platform.productDisclosure(id, disclosureId))
  }
}
