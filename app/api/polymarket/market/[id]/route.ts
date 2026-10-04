import {proxyPublicPrediction} from '@/lib/prediction-public-proxy'
export const dynamic='force-dynamic'
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params
  return proxyPublicPrediction(request,'market/'+id)
}
