import {resolveBrand, brandUiCopy} from '../lib/brand/config.mjs'
export function testBrandContext(id='areit') {
  const BRAND=resolveBrand(id)
  return {BRAND, IS_BRAND_PREVIEW:id==='kimeng', getBuildBrand:()=>BRAND, brandText:(text,locale)=>brandUiCopy(text,BRAND,locale)}
}
