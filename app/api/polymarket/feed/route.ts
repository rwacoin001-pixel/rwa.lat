import {proxyPublicPrediction} from '@/lib/prediction-public-proxy'
export const dynamic='force-dynamic'
export async function GET(request:Request) {
  return proxyPublicPrediction(request,'feed')
}
