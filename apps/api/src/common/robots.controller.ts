import { Controller, Get, Header } from '@nestjs/common'

@Controller()
export class RobotsController {
  @Get('robots.txt')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  getRobots(): string {
    return 'User-agent: *\nDisallow: /\n'
  }
}
