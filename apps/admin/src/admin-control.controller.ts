import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminRequest } from './admin-session.guard'
import { RequireAdminPermissions } from './admin-permission.guard'
import {
  AssetClassInputDto,
  CreateProductDto,
  DisclosureInputDto,
  PriceQuoteInputDto,
  ProductStateDto,
  SwitchInputDto,
  TreasuryAddressInputDto,
  UpdateProductDto,
} from './admin-control.dto'
import { AdminControlService } from './admin-control.service'

@ApiTags('admin-control-plane')
@ApiBearerAuth()
@Controller('admin/control')
@RequireAdminPermissions('catalog.manage')
export class AdminControlController {
  constructor(private readonly control: AdminControlService) {}

  @Get('asset-classes')
  @ApiOperation({ summary: 'List operator-managed asset classes' })
  assetClasses() {
    return this.control.listAssetClasses()
  }

  @Post('asset-classes')
  @ApiOperation({ summary: 'Create or restore an asset class' })
  saveAssetClass(@Body() dto: AssetClassInputDto, @Req() request: AdminRequest) {
    return this.control.upsertAssetClass(dto, this.adminId(request))
  }

  @Put('asset-classes/:id/deprecate')
  @ApiOperation({ summary: 'Deprecate an asset class' })
  deprecateAssetClass(@Param('id') id: string, @Req() request: AdminRequest) {
    return this.control.deprecateAssetClass(id, this.adminId(request))
  }

  @Get('products')
  @ApiOperation({ summary: 'List products with rich operator metadata' })
  products() {
    return this.control.listProducts()
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a draft product' })
  createProduct(@Body() dto: CreateProductDto, @Req() request: AdminRequest) {
    return this.control.createProduct(dto, this.adminId(request))
  }

  @Get('products/:id')
  product(@Param('id') id: string) {
    return this.control.getProduct(id)
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update product content, yield, risk and media metadata' })
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() request: AdminRequest) {
    return this.control.updateProduct(id, dto, this.adminId(request))
  }

  @Put('products/:id/state')
  @ApiOperation({ summary: 'Publish, suspend or retire a product' })
  setProductState(@Param('id') id: string, @Body() dto: ProductStateDto, @Req() request: AdminRequest) {
    return this.control.setProductState(id, dto, this.adminId(request))
  }

  @Get('products/:id/prices')
  prices(@Param('id') id: string) {
    return this.control.listQuotes(id)
  }

  @Post('products/:id/prices')
  @ApiOperation({ summary: 'Record a product price quote' })
  addPrice(@Param('id') id: string, @Body() dto: PriceQuoteInputDto, @Req() request: AdminRequest) {
    return this.control.addQuote(id, dto, this.adminId(request))
  }

  @Get('products/:id/disclosures')
  disclosures(@Param('id') id: string) {
    return this.control.listDisclosures(id)
  }

  @Post('products/:id/disclosures')
  @ApiOperation({ summary: 'Save a product prospectus, terms or risk disclosure reference' })
  addDisclosure(@Param('id') id: string, @Body() dto: DisclosureInputDto, @Req() request: AdminRequest) {
    return this.control.addDisclosure(id, dto, this.adminId(request))
  }

  @Get('switches')
  @ApiOperation({ summary: 'Read the effective operational switches and environment gates' })
  @RequireAdminPermissions('operations.switches.manage')
  switches() {
    return this.control.listSwitches()
  }

  @Put('switches/:key')
  @ApiOperation({ summary: 'Pause or request enablement of an operational capability' })
  @RequireAdminPermissions('operations.switches.manage')
  updateSwitch(@Param('key') key: string, @Body() dto: SwitchInputDto, @Req() request: AdminRequest) {
    return this.control.updateSwitch(key, dto, this.adminId(request))
  }

  @Get('storage/status')
  @ApiOperation({ summary: 'Read product media storage readiness' })
  storageStatus() {
    return this.control.storageStatus()
  }

  @Get('wallet/treasury-addresses')
  @ApiOperation({ summary: 'List configured public treasury wallet addresses' })
  @RequireAdminPermissions('wallet.addresses.manage')
  treasuryAddresses() {
    return this.control.listTreasuryAddresses()
  }

  @Post('wallet/treasury-addresses')
  @ApiOperation({ summary: 'Set a public treasury wallet address; private keys are rejected' })
  @RequireAdminPermissions('wallet.addresses.manage')
  saveTreasuryAddress(@Body() dto: TreasuryAddressInputDto, @Req() request: AdminRequest) {
    return this.control.upsertTreasuryAddress(dto, this.adminId(request))
  }

  @Delete('wallet/treasury-addresses/:id')
  @ApiOperation({ summary: 'Deactivate a treasury wallet address' })
  @RequireAdminPermissions('wallet.addresses.manage')
  deactivateTreasuryAddress(@Param('id') id: string, @Req() request: AdminRequest) {
    return this.control.deactivateTreasuryAddress(id, this.adminId(request))
  }

  private adminId(request: AdminRequest): string {
    if (!request.admin?.id) throw new Error('Authenticated administrator is missing')
    return request.admin.id
  }
}
