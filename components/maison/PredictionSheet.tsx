'use client'
import {Dialog} from '@base-ui/react/dialog'
import {X} from 'lucide-react'
import {useEffect,useRef,useState,type ReactNode} from 'react'
import {useI18n} from '@/lib/i18n'
import {maison as s} from './primitives'
import ui from './prediction-experience.module.css'

/** Portal stays inside Maison so every theme token and font is inherited. */
export function PredictionSheet({open,onClose,title,children,busy=false,compact=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;busy?:boolean;compact?:boolean}) {
  const {locale}=useI18n()
  const anchor=useRef<HTMLSpanElement>(null),[container,setContainer]=useState<HTMLElement|null>(null)
  const start=useRef<number|null>(null)
  useEffect(()=>setContainer(anchor.current?.closest<HTMLElement>('[data-maison-page]')??null),[])
  return <><span ref={anchor} hidden/><Dialog.Root open={open} onOpenChange={next=>{if(!next&&!busy)onClose()}}>
    <Dialog.Portal container={container}>
      <Dialog.Backdrop className={s.sheetBackdrop}/>
      <Dialog.Popup className={`${s.sheet} ${ui.sheet} ${compact?ui.compactSheet:''}`} data-sheet="" aria-busy={busy}>
        <div className={ui.gripArea} onTouchStart={e=>{start.current=e.touches[0].clientY}} onTouchEnd={e=>{if(start.current!==null&&e.changedTouches[0].clientY-start.current>65&&!busy)onClose();start.current=null}}><i className={s.sheetGrip} aria-hidden="true"/></div>
        <div className={ui.sheetHead}><Dialog.Title className={s.sheetTitle}>{title}</Dialog.Title><Dialog.Close className={ui.close} disabled={busy} aria-label={locale.startsWith('zh')?'关闭':'Close'}><X size={20}/></Dialog.Close></div>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root></>
}
