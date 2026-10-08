import {proxyPredictionImage} from '@/lib/prediction-image-delivery'

export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  return proxyPredictionImage(request)
}
