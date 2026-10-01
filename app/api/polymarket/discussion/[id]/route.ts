import {NextResponse} from 'next/server'
export const revalidate=30
export async function GET(request:Request,context:{params:Promise<{id:string}>}) {
  const {id}=await context.params, offset=Number(new URL(request.url).searchParams.get('offset')??0)
  if(!/^\d+$/.test(id)||!Number.isInteger(offset)||offset<0||offset>10000) return NextResponse.json({error:'Invalid discussion parameters'},{status:400})
  try {
    const r=await fetch(`https://gamma-api.polymarket.com/comments?parent_entity_type=Event&parent_entity_id=${id}&limit=20&offset=${offset}&order=createdAt&ascending=false`,{headers:{accept:'application/json','user-agent':'RWA.LAT/0.1 market-data'},next:{revalidate},signal:AbortSignal.timeout(8000)})
    if(!r.ok)throw new Error('Unavailable')
    const rows=await r.json() as Array<{id:string;body?:string;createdAt?:string;parentCommentID?:string;reactionCount?:number;profile?:{name?:string;pseudonym?:string};userAddress?:string}>
    if(!Array.isArray(rows))throw new Error('Invalid response')
    return NextResponse.json({items:rows.map(x=>({id:x.id,body:x.body??'',createdAt:x.createdAt??null,parentId:x.parentCommentID??null,likeCount:x.reactionCount??0,author:{displayName:x.profile?.name||x.profile?.pseudonym||x.userAddress?.slice(0,10)||'Polymarket'}})),nextOffset:rows.length===20?offset+20:null})
  }catch{return NextResponse.json({error:'Polymarket discussion unavailable'},{status:502})}
}
