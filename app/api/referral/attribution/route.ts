import { NextRequest, NextResponse } from 'next/server'
export function GET(req:NextRequest) {
  return NextResponse.json({token:req.cookies.get('rwa_referral')?.value??null},{headers:{'Cache-Control':'no-store'}})
}
