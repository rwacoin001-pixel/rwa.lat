import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminRequest } from './admin-session.guard'
import { RequireAdminPermissions } from './admin-permission.guard'
import { CompleteStorageUploadDto, CreateStorageUploadDto, StorageObjectQueryDto } from './admin-storage.dto'
import { AdminStorageService } from './admin-storage.service'

@ApiTags('admin-storage')
@ApiBearerAuth()
@Controller('admin/storage')
@RequireAdminPermissions('storage.manage')
export class AdminStorageController {
  constructor(private readonly storage: AdminStorageService) {}

  @Get('status')
  @ApiOperation({ summary: 'Object storage readiness, buckets, and scan mode' })
  status() {
    return this.storage.status()
  }

  @Post('presign-upload')
  @ApiOperation({ summary: 'Create a presigned upload URL for an admin-managed object' })
  presignUpload(@Body() dto: CreateStorageUploadDto, @Req() request: AdminRequest) {
    return this.storage.createUpload(dto, this.adminId(request))
  }

  @Post('complete')
  @ApiOperation({ summary: 'Finalize an upload: verify size, type and checksum, then scan' })
  complete(@Body() dto: CompleteStorageUploadDto, @Req() request: AdminRequest) {
    return this.storage.completeUpload(dto, this.adminId(request))
  }

  @Get('objects')
  @ApiOperation({ summary: 'List stored objects with scan status' })
  objects(@Query() query: StorageObjectQueryDto) {
    return this.storage.listObjects(query)
  }

  @Post('objects/:id/download')
  @ApiOperation({ summary: 'Create a short-lived download/preview URL for a clean object' })
  download(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: { disposition?: 'inline' | 'attachment' }, @Req() request: AdminRequest) {
    return this.storage.createDownload(id, this.adminId(request), body?.disposition === 'attachment' ? 'attachment' : 'inline')
  }

  @Post('objects/:id/scan')
  @ApiOperation({ summary: 'Re-run the basic integrity scan (internal-basic mode)' })
  scan(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AdminRequest) {
    return this.storage.runBasicScan(id, this.adminId(request))
  }

  @Delete('objects/:id')
  @ApiOperation({ summary: 'Delete an object from storage and the registry' })
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AdminRequest) {
    return this.storage.deleteObject(id, this.adminId(request))
  }

  private adminId(request: AdminRequest): string {
    if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
    return request.admin.id
  }
}
