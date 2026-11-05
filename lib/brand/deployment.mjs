import {resolveBrand} from './config.mjs'
export function validateBrandDeployment(id,config,stamp,sourceCommit,workerHash,artifactHash) {
  const brand=resolveBrand(id), expectedName=id==='kimeng'?'kimeng-frontend':'rwa-lat'
  const routes=config.routes??[]
  if(config.name!==expectedName)throw new Error('Worker target does not match brand')
  if(config.main!=='workers/frontend/index.mjs'||config.workers_dev!==false)throw new Error('Unexpected Worker entry or public development URL')
  if(routes.length!==brand.hosts.length||routes.some(route=>route.custom_domain!==true||!brand.hosts.includes(route.pattern))||new Set(routes.map(route=>route.pattern)).size!==brand.hosts.length)throw new Error('Domain bindings do not match brand')
  if((config.vars?.SITE_BRAND??'areit')!==id||config.vars?.API_INTERNAL_URL!=='https://api.a-reit.com')throw new Error('Brand or shared API target mismatch')
  const mode=config.vars.KIMENG_RELEASE_MODE??'existing'
  if(id==='kimeng'&&(config.assets?.run_worker_first!==true||config.preview_urls!==false||!['closed','preview','public'].includes(mode)))throw new Error('Kimeng needs an explicit release mode and Worker-first routing')
  if(stamp.brandId!==id||stamp.mode!==mode||stamp.sourceCommit!==sourceCommit||!stamp.nextBuildId||stamp.apiOrigin!==config.vars.API_INTERNAL_URL||stamp.workerSha256!==workerHash||!stamp.artifactSha256||stamp.artifactSha256!==artifactHash)throw new Error('Build artifact does not match selected brand/source/release mode')
  return {brandId:id,worker:expectedName,domains:[...brand.hosts],sourceCommit,mode}
}
