import {NextResponse} from 'next/server'
import {predictionBookTokens,readPredictionPublicBooks} from '@/lib/prediction-public-books'
export const revalidate=20
export async function GET(request:Request) {
  const tokens=predictionBookTokens(new URL(request.url).searchParams.get('tokens'))
  if(!tokens)return NextResponse.json({error:'Invalid tokens'},{status:400})
  return NextResponse.json({books:await readPredictionPublicBooks(tokens)},{headers:{'Cache-Control':'private, no-store'}})
}
