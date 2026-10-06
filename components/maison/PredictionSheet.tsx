'use client'
import {type ReactNode} from 'react'
import {Sheet} from './Sheet'
import ui from './prediction-experience.module.css'

/** The shared sheet with the prediction flow's taller cap and optional compact header. */
export function PredictionSheet({open,onClose,title,children,busy=false,compact=false}:{open:boolean;onClose:()=>void;title:string;children:ReactNode;busy?:boolean;compact?:boolean}) {
  return <Sheet open={open} onClose={onClose} title={title} busy={busy} className={`${ui.sheet} ${compact?ui.compactSheet:''}`}>{children}</Sheet>
}
