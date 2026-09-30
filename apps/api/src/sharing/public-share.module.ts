import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { PublicShareController } from './public-share.controller'
import { PublicShareService } from './public-share.service'
@Module({imports:[SecurityModule],controllers:[PublicShareController],providers:[PublicShareService]})
export class PublicShareModule {}
