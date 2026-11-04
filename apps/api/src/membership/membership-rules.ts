export interface MemberComponents {
  deposits:string; purchases:string; team:{l1:string;l2:string;l3:string}
  members:{direct:number;team:number;directActive:number;teamActive:number}; tasks:string; firstDeposit:boolean
}
export interface MemberLevel {
  index:number; key:string; threshold:string
  requires:{firstDeposit?:boolean;directActive?:number;teamActive?:number}
  perks:{draws:number;predictionFeeDiscountPct:number;quantFeeDiscountPct:number;honors:string[]}
}
export interface MemberConfig {
  levels:MemberLevel[]
  coefficients:{ownDeposits:number;ownPurchases:number;teamL1Purchases:number;teamL2Purchases:number;teamL3Purchases:number;activeTeamMembers:number;taskPoints:number}
  windows:{purchaseDays:number;activeDays:number;maxDepth:number}
}
export const DEFAULT_MEMBER_CONFIG:MemberConfig={
  windows:{purchaseDays:365,activeDays:90,maxDepth:3},
  coefficients:{ownDeposits:0.5,ownPurchases:1,teamL1Purchases:0.3,teamL2Purchases:0.15,teamL3Purchases:0.05,activeTeamMembers:100,taskPoints:1},
  levels:['stardust','planet','star','cluster','nebula','galaxy','milkyway'].map((key,i)=>({
    index:i+1,key,threshold:['0','1000','10000','50000','200000','1000000','5000000'][i],
    requires:[{},{firstDeposit:true},{},{directActive:3},{directActive:5},{teamActive:20},{teamActive:50}][i],
    perks:{draws:[0,1,1,2,2,3,3][i],predictionFeeDiscountPct:[0,0,10,20,30,40,50][i],quantFeeDiscountPct:[0,0,0,10,15,20,30][i],
      honors:i===0?[]:i<3?['badge']:i<5?['badge','frame']:['badge','frame','priority_support']},
  })),
}
const SCALE=1000000n
export function micro(value:string|number):bigint {
  const text=String(value)
  if(!/^-?\d+(\.\d+)?$/.test(text)) throw new Error('Invalid membership numeric value')
  const negative=text.startsWith('-'),[whole,fraction='']=(negative?text.slice(1):text).split('.')
  return (negative?-1n:1n)*(BigInt(whole)*SCALE+BigInt((fraction+'000000').slice(0,6)))
}
export function decimal(value:bigint,places=6):string {
  const negative=value<0n,abs=negative?-value:value,divisor=10n**BigInt(6-places)
  const rounded=(abs+divisor/2n)/divisor,unit=10n**BigInt(places)
  return `${negative?'-':''}${rounded/unit}.${(rounded%unit).toString().padStart(places,'0')}`
}
export const money=(value:string)=>decimal(micro(value),2)
export const teamDepth=(config:MemberConfig)=>Math.max(1,Math.min(3,Math.trunc(config.windows.maxDepth)))
export function memberScore(c:MemberComponents,config:MemberConfig):string {
  const k=config.coefficients
  const terms:[string|number,number][]=[[c.deposits,k.ownDeposits],[c.purchases,k.ownPurchases],[c.team.l1,k.teamL1Purchases],
    [c.team.l2,k.teamL2Purchases],[c.team.l3,k.teamL3Purchases],[c.members.teamActive,k.activeTeamMembers],[c.tasks,k.taskPoints]]
  const total=terms.reduce((sum,[value,weight])=>sum+micro(value)*micro(weight),0n)
  return decimal((total+(total<0n?-SCALE/2n:SCALE/2n))/SCALE)
}
export function selectLevel(score:string,c:MemberComponents,config:MemberConfig):MemberLevel {
  return [...config.levels].sort((a,b)=>b.index-a.index).find(l=>micro(score)>=micro(l.threshold)
    && (!l.requires.firstDeposit||c.firstDeposit) && c.members.directActive>=(l.requires.directActive??0)
    && c.members.teamActive>=(l.requires.teamActive??0))??config.levels[0]
}
export function shanghaiDate(now:Date):string { return new Date(now.getTime()+8*3600000).toISOString().slice(0,10) }
export function applyGrace(computed:number,stored:{level:number;graceUntil:string|null}|undefined,now:Date) {
  if(!stored||computed>=stored.level) return {level:computed,graceUntil:null}
  if(stored.graceUntil&&shanghaiDate(now)>stored.graceUntil) return {level:computed,graceUntil:null}
  const local=new Date(`${shanghaiDate(now)}T00:00:00Z`)
  const end=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+2,0)).toISOString().slice(0,10)
  return {level:stored.level,graceUntil:stored.graceUntil??end}
}
export function periodStart(period:'week'|'month',now:Date):string {
  const date=new Date(`${shanghaiDate(now)}T00:00:00Z`)
  if(period==='month') date.setUTCDate(1)
  else date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7)
  return date.toISOString().slice(0,10)
}
export function moneyBand(value:string):string {
  const thresholds=['1000','5000','10000','50000','100000','500000','1000000']
  return ['0-1k','1k-5k','5k-10k','10k-50k','50k-100k','100k-500k','500k-1m','1m+'][thresholds.filter(n=>micro(value)>=micro(n)).length]
}
