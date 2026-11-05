import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DataSource } from 'typeorm'
import { ObjectStorageService } from '../object-storage/object-storage.service'

type PublicDocument = { title: string; storageRef: string; public: boolean; kind?: string; reportDate?: string; asOfDate?: string; issuer?: string }
type BrandProfile = { brandId: 'kimeng'; status: 'draft' | 'ready'; legalName: string; registrationNumber: string; jurisdiction: string; address: string; supportEmail: string; description: string }
type PlatformContent = { legalName: string; registrationNumber: string; jurisdiction: string; address: string; supportEmail: string; description: string; allowedRegions: string[]; investorTypes: string[]; documents: PublicDocument[]; brandProfiles?: BrandProfile[] }

@Injectable()
export class PlatformService {
  constructor(private readonly db: DataSource, private readonly storage: ObjectStorageService, private readonly config: ConfigService) {}

  private async published() {
    const rows = await this.db.query(`SELECT published, published_revision AS revision, published_at AS "publishedAt" FROM app.platform_configuration WHERE id = true`)
    return rows[0] as { published: PlatformContent | null; revision: number | null; publishedAt: string | null } | undefined
  }

  async publicProfile() {
    const row = await this.published()
    if (!row?.published) throw new NotFoundException({ code: 'PLATFORM_PROFILE_UNPUBLISHED', message: 'Platform information has not been published.' })
    const { documents, brandProfiles: _brandProfiles, ...content } = row.published
    return { ...content, revision: row.revision, publishedAt: row.publishedAt,
      documents: documents.flatMap((doc, index) => doc.public ? [{ title: doc.title, kind: doc.kind ?? 'general', reportDate: doc.reportDate ?? null, asOfDate: doc.asOfDate ?? null, issuer: doc.issuer ?? null, url: this.url(`/v1/platform/documents/${row.revision}/${index}`) }] : []) }
  }

  async publicBrandProfile(brandId: string) {
    if (brandId !== 'kimeng') throw new NotFoundException()
    const row = await this.published()
    const profile = row?.published?.brandProfiles?.find(value => value.brandId === brandId && value.status === 'ready')
    if (!profile || !profile.legalName?.trim() || !profile.registrationNumber?.trim() || !profile.jurisdiction?.trim() || !profile.address?.trim() || !profile.supportEmail?.trim()) {
      throw new NotFoundException({ code: 'BRAND_PROFILE_UNPUBLISHED', message: 'Brand information has not been published.' })
    }
    return { ...await this.publicProfile(), brandId, name: 'KIMENG', chineseName: '金英', origin: 'https://kimengresearch.com', sharedAccounts: true,
      legalName: profile.legalName, registrationNumber: profile.registrationNumber, jurisdiction: profile.jurisdiction,
      address: profile.address, supportEmail: profile.supportEmail, description: profile.description,
      revision: row!.revision, publishedAt: row!.publishedAt }
  }

  async publicDocument(revision: number, index: number) {
    const row = await this.published()
    const doc = row?.published?.documents[index]
    if (row?.revision !== revision || !doc?.public) throw new NotFoundException()
    return this.storage.createPublishedAssetUrl(doc.storageRef)
  }

  async productCover(productId: string) {
    const [row] = await this.db.query(`SELECT cover_storage_ref AS ref FROM app.products WHERE id = $1 AND state = 'published'`, [productId])
    if (!row?.ref) throw new NotFoundException()
    return this.storage.createPublishedAssetUrl(row.ref, true)
  }

  async productDisclosure(productId: string, disclosureId: string) {
    const [row] = await this.db.query(`SELECT d.storage_ref AS ref FROM app.disclosure_files d JOIN app.products p ON p.id = d.product_id WHERE p.id = $1 AND d.id = $2 AND p.state = 'published' AND d.state = 'active'`, [productId, disclosureId])
    if (!row?.ref) throw new NotFoundException()
    return this.storage.createPublishedAssetUrl(row.ref)
  }

  async evaluateAccess(userId: string): Promise<{ allowed: boolean; reason: string | null; region: string | null; revision: number | null }> {
    const row = await this.published()
    if (!row?.published) return { allowed: this.config.get('APP_ENV') !== 'production', reason: 'platform_policy_unpublished', region: null, revision: null }
    const [verified] = await this.db.query(`SELECT region, investor_type FROM app.user_verified_access WHERE user_id = $1`, [userId])
    // Verified access is retained as evidence; only an admin investment block denies access.
    return { allowed: true, reason: null, region: verified?.region ?? null, revision: row.revision }
  }

  private url(path: string) { return `${(this.config.get<string>('PUBLIC_API_URL') ?? '').replace(/\/$/, '')}${path}` }
}
