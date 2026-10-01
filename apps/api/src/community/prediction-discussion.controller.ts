import {BadRequestException,Body,Controller,Get,Headers,Param,Post,Query,UseGuards} from '@nestjs/common'
import {DataSource} from 'typeorm'
import {CommunityService} from './community.service'
import {CommunityMemberService} from './community-member.service'
import {CommunityCommentsQueryDto} from './dto/community.dto'
import {MemberCommentDto} from './community-member.dto'
import {SessionAuthGuard,type AuthenticatedRequest} from '../security/session-auth.guard'
import {CurrentAuth} from '../security/current-auth.decorator'
import {predictionThreadId} from './prediction-discussion'
@Controller('predictions/events')
export class PredictionDiscussionController {
  constructor(private readonly db:DataSource,private readonly community:CommunityService,private readonly member:CommunityMemberService){}
  @Get(':eventId/comments') async read(@Param('eventId') eventId:string,@Query() q:CommunityCommentsQueryDto) {
    let id:string
    try {id=predictionThreadId(eventId)} catch {throw new BadRequestException('Invalid event ID')}
    const [p]=await this.db.query('SELECT id FROM app.community_posts WHERE id=$1',[id])
    return {postId:id,...(p?await this.community.listComments(id,q):{items:[],nextBefore:null})}
  }
  @Post(':eventId/comments') @UseGuards(SessionAuthGuard)
  async reply(@Param('eventId') eventId:string,@CurrentAuth() a:AuthenticatedRequest['auth'],@Headers('idempotency-key') key:string,@Body() dto:MemberCommentDto) {
    const id=await this.member.ensurePredictionThread(a.userId,eventId)
    return this.member.comment(a.userId,key,id,dto)
  }
}
