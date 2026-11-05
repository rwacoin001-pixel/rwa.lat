import { BRAND } from '@/lib/brand/build-brand'
import { buildManifest } from '@/lib/brand/config.mjs'
export default function manifest() { return buildManifest(BRAND) }
