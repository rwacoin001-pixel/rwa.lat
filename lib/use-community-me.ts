'use client'
import {useEffect,useState,useSyncExternalStore} from 'react'
import {request,readSession,SESSION_CHANGED} from './api/_http'
export type CommunityMe={id:string;handle:string;handleBase:string;city:string|null;countryCode:string|null;identityConfigured:boolean;avatarSeed:string;displayName:string;bio:string|null;avatarUrl:string|null;avatarPending:boolean}
const EVENT='rwa:community-me'
let cache:CommunityMe|null=null,owner:string|null=null,flight:Promise<CommunityMe|null>|null=null,version=0
const subscribe=(changed:()=>void)=>{window.addEventListener(EVENT,changed);window.addEventListener(SESSION_CHANGED,changed);return()=>{window.removeEventListener(EVENT,changed);window.removeEventListener(SESSION_CHANGED,changed)}}
const snapshot=()=>owner===(readSession()?.userId??null)?cache:null
export function useCommunityProfileSnapshot(){return useSyncExternalStore(subscribe,snapshot,()=>null)}
export function publishCommunityMe(value:CommunityMe|null,expectedUserId:string|null,invalidateReads=true){
  if(expectedUserId!==(readSession()?.userId??null))return false
  if(invalidateReads){version++;flight=null}
  owner=expectedUserId;cache=value;window.dispatchEvent(new CustomEvent(EVENT,{detail:value}));return true
}
export function useCommunityMe(guest:boolean):CommunityMe|null{
  const [me,setMe]=useState<CommunityMe|null>(null)
  useEffect(()=>{
    const current=readSession()?.userId??null
    if(owner!==current){version++;owner=current;cache=null;flight=null}
    if(guest||!current){setMe(null);return}
    let live=true
    const changed=(e:Event)=>{if(live)setMe((e as CustomEvent<CommunityMe|null>).detail)}
    const refresh=()=>{
      const requestVersion=version,user=readSession()?.userId
      flight??=request<CommunityMe>('/v1/community/me',{loading:'silent'}).then(r=>r.ok?r.data:null).finally(()=>{if(requestVersion===version)flight=null})
      void flight.then(value=>{if(live&&value&&requestVersion===version&&user===readSession()?.userId)publishCommunityMe(value,user??null,false)})
    }
    const session=()=>{version++;cache=null;flight=null;setMe(null);if(readSession())refresh()}
    window.addEventListener(EVENT,changed);window.addEventListener(SESSION_CHANGED,session)
    if(cache)setMe(cache);else refresh()
    // A cleared avatar can replace a pending upload without remounting the editor.
    const timer=cache?.avatarPending?window.setInterval(refresh,10000):null
    return()=>{live=false;window.removeEventListener(EVENT,changed);window.removeEventListener(SESSION_CHANGED,session);if(timer)window.clearInterval(timer)}
  },[guest,me?.avatarPending])
  return me
}
