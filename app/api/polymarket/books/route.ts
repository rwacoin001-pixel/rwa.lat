import {NextResponse} from 'next/server'
import {predictionBookTokens,readPredictionPublicBooks} from '@/lib/prediction-public-books'
export const revalidate=20
export async function GET(request:Request) {
  const tokens=predictionBookTokens(new URL(request.url).searchParams.get('tokens'))
  if(!tokens)return NextResponse.json({error:'Invalid tokens'},{status:400})
  const books=await readPredictionPublicBooks(tokens)
  // serverTime lets the client judge freshness on its own clock (lib/prediction-clock.ts).
  return NextResponse.json({books,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}})
}
