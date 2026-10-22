import { Injectable,Logger,OnApplicationBootstrap,OnApplicationShutdown } from '@nestjs/common'
import { ReferralTeamService } from './referral-team.service'
@Injectable()
export class ReferralTeamRunner implements OnApplicationBootstrap,OnApplicationShutdown {
  private readonly logger=new Logger(ReferralTeamRunner.name)
  private timer?:ReturnType<typeof setInterval>
  private running=false
  constructor(private readonly team:ReferralTeamService){}
  onApplicationBootstrap(){if(process.env.NODE_ENV==='test')return;this.timer=setInterval(()=>void this.tick(),3600000);this.timer.unref();void this.tick()}
  onApplicationShutdown(){if(this.timer)clearInterval(this.timer)}
  private async tick(){if(this.running)return;this.running=true;try{await this.team.generateClosedMonths()}catch(e){this.logger.error(`Team month generation failed: ${e instanceof Error?e.message:String(e)}`)}finally{this.running=false}}
}
