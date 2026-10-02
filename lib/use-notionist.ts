'use client'
import { useEffect, useState } from 'react'
const avatars = new Map<string,string>()
const flights = new Map<string,Promise<string>>()
let kit: Promise<(seed:string)=>string> | null = null
function generate(seed:string) {
  kit ??= Promise.all([import('@dicebear/core'),import('@dicebear/collection/async').then(s=>s.notionists())])
    .then(([core,style])=>(seed:string)=>core.createAvatar(style,{seed,scale:112,translateY:4}).toDataUri())
    .catch(error=>{kit=null;throw error})
  if (!flights.has(seed)) flights.set(seed,kit.then(make=>{const uri=make(seed);avatars.set(seed,uri);if(avatars.size>300)avatars.delete(avatars.keys().next().value!);return uri}).finally(()=>flights.delete(seed)))
  return flights.get(seed)!
}
export function useNotionist(seed:string|null) {
  const [made,setMade]=useState<{seed:string;uri:string}|null>(null)
  useEffect(()=>{if(!seed||avatars.has(seed))return;let live=true;void generate(seed).then(uri=>{if(live)setMade({seed,uri})}).catch(()=>undefined);return()=>{live=false}},[seed])
  return seed ? avatars.get(seed) ?? (made?.seed===seed?made.uri:null) : null
}
