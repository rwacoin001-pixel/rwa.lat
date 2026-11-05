export type BrandConfig = Readonly<{
  id: 'areit' | 'kimeng'; name: string; chineseName: string; origin: string;
  hosts: readonly string[]; assets: string; icon192: string; icon512: string;
  appleIcon: string; maskableIcon: string; desktopRedirect: string | null; noindex: boolean;
}>
export function resolveBrand(value?: string): BrandConfig
export function canonicalBrandUrl(brand: BrandConfig, input: string): string | null
export function brandUiCopy(text: string, brand: BrandConfig, locale?: string): string
export function buildManifest(brand: BrandConfig): import('next').MetadataRoute.Manifest
