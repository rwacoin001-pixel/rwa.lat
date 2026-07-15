import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentAdmin } from '../admin-rbac/current-admin.decorator'
import { AdminSessionGuard } from '../admin-rbac/admin-session.guard'
import type { AuthenticatedAdmin } from '../admin-rbac/admin-session-auth.service'
import { AdminRbacService } from '../admin-rbac/admin-rbac.service'
import { ObjectStorageService } from './object-storage.service'
import { CreateUploadPresignedDto, CreateDownloadPresignedDto, CompleteUploadDto, ObjectReferenceDto, ObjectScanResultDto } from './object-storage.dto'
import { ObjectScanCallbackVerifier } from './object-scan-callback.verifier'
import { CurrentAuth } from '../security/current-auth.decorator'
import type { SecurityActor } from '../security/security.service'
import { SessionAuthGuard } from '../security/session-auth.guard'
import { CreateUserAttachmentUploadDto, UserObjectReferenceDto } from './object-storage.dto'

@Controller('storage/callbacks')
export class ObjectStorageCallbackController {
  constructor(
    private readonly svc: ObjectStorageService,
    private readonly verifier: ObjectScanCallbackVerifier,
  ) {}

  @Post('scan')
  recordScanResult(
    @Headers('x-rwa-event-id') eventId: string,
    @Headers('x-rwa-timestamp') timestamp: string,
    @Headers('x-rwa-signature') signature: string,
    @Body() dto: ObjectScanResultDto,
  ) {
    this.verifier.verify({ eventId, timestamp, signature, payload: dto as unknown as Record<string, unknown> })
    return this.svc.recordScanResult({ ...dto, eventId })
  }
}

@Controller('user-storage/attachments')
@UseGuards(SessionAuthGuard)
export class UserObjectStorageController {
  constructor(private readonly svc: ObjectStorageService) {}

  @Post('presigned/upload')
  createUpload(@CurrentAuth() actor: SecurityActor, @Body() dto: CreateUserAttachmentUploadDto) {
    return this.svc.createUserAttachmentUpload({ ...dto, userId: actor.userId })
  }

  @Post('presigned/complete')
  completeUpload(@CurrentAuth() actor: SecurityActor, @Body() dto: CompleteUploadDto) {
    return this.svc.completeUpload(dto.presignedId, dto.sizeBytes, dto.md5, actor.userId)
  }

  @Post('presigned/download')
  createDownload(@CurrentAuth() actor: SecurityActor, @Body() dto: UserObjectReferenceDto) {
    return this.svc.createUserAttachmentDownload(actor.userId, dto.objectId)
  }

  @Get(':objectId/status')
  getStatus(@CurrentAuth() actor: SecurityActor, @Param('objectId', new ParseUUIDPipe()) objectId: string) {
    return this.svc.getUserAttachmentStatus(actor.userId, objectId)
  }
}

@Controller('storage')
@UseGuards(AdminSessionGuard)
export class ObjectStorageController {
  constructor(
    private readonly svc: ObjectStorageService,
    private readonly rbac: AdminRbacService,
  ) {}

  @Post('presigned/upload')
  async createUploadPresigned(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateUploadPresignedDto) {
    await this.assertStoragePermission(admin)
    return this.svc.createUploadPresignedUrl({ ...dto, createdBy: admin.id })
  }

  @Post('presigned/download')
  async createDownloadPresigned(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CreateDownloadPresignedDto) {
    await this.assertStoragePermission(admin)
    return this.svc.createDownloadPresignedUrl({ ...dto, createdBy: admin.id })
  }

  @Post('presigned/complete')
  async completeUpload(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: CompleteUploadDto) {
    await this.assertStoragePermission(admin)
    return this.svc.completeUpload(dto.presignedId, dto.sizeBytes, dto.md5)
  }

  @Get('objects/meta')
  async getObject(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() dto: ObjectReferenceDto) {
    await this.assertStoragePermission(admin)
    return this.svc.getObjectMeta(dto.bucket, dto.key)
  }

  @Get('objects/id/:objectId')
  async getObjectById(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('objectId', new ParseUUIDPipe()) objectId: string,
  ) {
    await this.assertStoragePermission(admin)
    return this.svc.getObjectMetaById(objectId)
  }

  @Delete('objects')
  async deleteObject(@CurrentAdmin() admin: AuthenticatedAdmin, @Body() dto: ObjectReferenceDto) {
    await this.assertStoragePermission(admin)
    return this.svc.deleteObject(dto.bucket, dto.key)
  }

  private assertStoragePermission(admin: AuthenticatedAdmin) {
    return this.rbac.assertPermission(admin.id, 'storage.manage')
  }
}
