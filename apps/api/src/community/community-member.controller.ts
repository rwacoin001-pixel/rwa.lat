import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { SessionAuthGuard, AuthenticatedRequest } from '../security/session-auth.guard'
import { CurrentAuth } from '../security/current-auth.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { CommunityMemberService } from './community-member.service'
import { MemberAvatarDto, MemberCommentDto, MemberMediaQueryDto, MemberPostDto, MemberProfileDto, ModerateMemberContentDto } from './community-member.dto'
import { ObjectStorageService, COMMUNITY_IMAGE_MAX_BYTES } from '../object-storage/object-storage.service'

type UploadedImage = { buffer: Buffer; mimetype?: string; size: number }

@Controller('community/me') @UseGuards(SessionAuthGuard)
export class CommunityMemberController {
  constructor(private readonly member: CommunityMemberService) {}
  @Get() profile(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.member.profile(a.userId) }
  @Put() update(@CurrentAuth() a: AuthenticatedRequest['auth'], @Body() dto: MemberProfileDto) { return this.member.updateProfile(a.userId, dto) }
  /** Multipart `file`: JPEG/PNG/WebP/GIF, sniffed server-side. Stored pending; served only after the malware scan clears it. */
  @Post('media') @UseInterceptors(FileInterceptor('file', { limits: { fileSize: COMMUNITY_IMAGE_MAX_BYTES.post, files: 1, fields: 4 } }))
  upload(@CurrentAuth() a: AuthenticatedRequest['auth'], @Query() q: MemberMediaQueryDto, @UploadedFile() file?: UploadedImage) { return this.member.uploadImage(a.userId, q.purpose ?? 'post', file) }
  @Put('avatar') setAvatar(@CurrentAuth() a: AuthenticatedRequest['auth'], @Body() dto: MemberAvatarDto) { return this.member.setAvatar(a.userId, dto.objectId) }
  @Delete('avatar') clearAvatar(@CurrentAuth() a: AuthenticatedRequest['auth']) { return this.member.setAvatar(a.userId, null) }
  @Get('state') state(@CurrentAuth() a: AuthenticatedRequest['auth'], @Query('postId', new ParseUUIDPipe({ optional: true })) postId?: string, @Query('handle') handle?: string) { return this.member.state(a.userId, postId, handle) }
  @Post('posts') post(@CurrentAuth() a: AuthenticatedRequest['auth'], @Headers('idempotency-key') key: string, @Body() dto: MemberPostDto) { return this.member.post(a.userId, key, dto) }
  @Post('posts/:id/comments') comment(@CurrentAuth() a: AuthenticatedRequest['auth'], @Headers('idempotency-key') key: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: MemberCommentDto) { return this.member.comment(a.userId, key, id, dto) }
  @Put('posts/:id/like') like(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.member.like(a.userId, id, true) }
  @Delete('posts/:id/like') unlike(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('id', ParseUUIDPipe) id: string) { return this.member.like(a.userId, id, false) }
  @Put('profiles/:handle/follow') follow(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('handle') handle: string) { return this.member.follow(a.userId, handle, true) }
  @Delete('profiles/:handle/follow') unfollow(@CurrentAuth() a: AuthenticatedRequest['auth'], @Param('handle') handle: string) { return this.member.follow(a.userId, handle, false) }
}
/** Public read of cleared community media: a short-lived signed redirect, never the raw object. */
@Controller('community/media')
export class CommunityMediaController {
  constructor(private readonly storage: ObjectStorageService) {}
  @Get(':objectId') async media(@Param('objectId', ParseUUIDPipe) objectId: string, @Res() res: Response) {
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(302, await this.storage.createCommunityImageUrl(objectId))
  }
}
@Controller('admin/community/publications') @UseGuards(AdminSessionGuard)
export class AdminCommunityMemberController {
  constructor(private readonly member: CommunityMemberService, private readonly rbac: AdminRbacService) {}
  @Get() async list(@CurrentAdmin() a: AuthenticatedAdmin) { await this.rbac.assertPermission(a.id, 'community.content.review'); return this.member.publications() }
  @Post('moderate') async moderate(@CurrentAdmin() a: AuthenticatedAdmin, @Body() dto: ModerateMemberContentDto) { await this.rbac.assertPermission(a.id, 'community.content.review'); return this.member.moderate(dto, a.id) }
}
