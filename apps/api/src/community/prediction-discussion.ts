import {createHash} from 'node:crypto'
export function predictionThreadId(eventId:string):string {
  if(!/^\d{1,20}$/.test(eventId))throw new Error('Invalid Polymarket event')
  const h=createHash('sha256').update(`rwa.lat:polymarket:event:${eventId}`).digest('hex')
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`
}
