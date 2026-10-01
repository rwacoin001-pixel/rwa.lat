'use client'
import {useEffect,useRef,useState} from 'react'
import {useContentTranslation} from '@/lib/use-content-translation'
import {maison as s} from './primitives'
type Decoder=(data:Uint8ClampedArray,width:number,height:number,options?:unknown)=>{data:string}|null
let decoderJob:Promise<Decoder>|null=null
function decoder():Promise<Decoder>{
 if(decoderJob)return decoderJob
 decoderJob=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/jsqr/jsQR.js';script.onload=()=>{const fn=(window as unknown as {jsQR?:Decoder}).jsQR;if(fn)resolve(fn);else reject(new Error('decoder'))};script.onerror=()=>{decoderJob=null;script.remove();reject(new Error('decoder'))};document.head.appendChild(script)})
 return decoderJob
}
export function TransferScanner({onCode,onClose}:{onCode:(text:string)=>boolean;onClose:()=>void}){
 const video=useRef<HTMLVideoElement>(null),stream=useRef<MediaStream|null>(null),callback=useRef(onCode),close=useRef(onClose),alive=useRef(true)
 callback.current=onCode;close.current=onClose
 const [error,setError]=useState(''),[uploading,setUploading]=useState(false)
 const tr=useContentTranslation(['Scan receive code','Close','Choose QR image','Camera unavailable. Choose a QR image instead.','No valid platform receive code found.','Recognizing…'])
 useEffect(()=>{alive.current=true;let active=true,busy=false,timer:ReturnType<typeof setInterval>|undefined
   const stop=()=>{stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;if(timer)clearInterval(timer)}
   const hidden=()=>{if(document.hidden){stop();close.current()}}
   document.addEventListener('visibilitychange',hidden)
   void(async()=>{try{const qr=await decoder();if(!active)return;const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});if(!active){media.getTracks().forEach(t=>t.stop());return}stream.current=media;const v=video.current;if(!v){stop();return}v.srcObject=media;await v.play();if(!active)return;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});timer=setInterval(()=>{if(busy||!active||!v.videoWidth||!ctx)return;busy=true;try{const scale=Math.min(1,720/v.videoWidth);canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);ctx.drawImage(v,0,0,canvas.width,canvas.height);const result=qr(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);if(result){if(callback.current(result.data)){stop();close.current()}else setError('No valid platform receive code found.')}}finally{busy=false}},250)}catch{if(active)setError('Camera unavailable. Choose a QR image instead.')}})()
   return()=>{active=false;alive.current=false;stop();document.removeEventListener('visibilitychange',hidden)}
 },[])
 const upload=async(file:File)=>{setUploading(true);setError('');let bitmap:ImageBitmap|undefined;try{if(file.size>15000000)throw new Error();bitmap=await createImageBitmap(file);const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw new Error();ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const qr=await decoder(),result=qr(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);if(!alive.current)return;if(!result||!callback.current(result.data))throw new Error();onClose()}catch{if(alive.current)setError('No valid platform receive code found.')}finally{bitmap?.close();if(alive.current)setUploading(false)}}
 return <div role="dialog" aria-modal="true" aria-label={tr('Scan receive code')} style={{position:'fixed',inset:0,zIndex:200,background:'var(--maison-bg,#eee8db)',padding:'max(24px,env(safe-area-inset-top)) 24px',overflowY:'auto'}} onKeyDown={e=>{if(e.key==='Escape')onClose()}}>
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><h2>{tr('Scan receive code')}</h2><button autoFocus className={s.ghost} onClick={onClose}>{tr('Close')}</button></div>
  <video ref={video} muted playsInline style={{width:'100%',maxHeight:'60vh',borderRadius:20,background:'#16130f'}}/>
  {error&&<p className={s.fieldError} role="status">{tr(error)}</p>}
  <label className={s.ghost} style={{display:'block',marginTop:20}}>{uploading?tr('Recognizing…'):tr('Choose QR image')}<input type="file" accept="image/*" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f)}}/></label>
 </div>
}
