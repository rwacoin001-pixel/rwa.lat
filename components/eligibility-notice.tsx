'use client'
import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { KYC_REQUIRED } from '@/lib/kyc-policy'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

const copy = {
  en: ['Verification required', 'Complete identity verification before making a new investment.', 'Continue verification'],
  'zh-CN': ['需要身份认证', '完成身份认证后，即可继续申请新的投资。', '前往认证'],
  hi: ['सत्यापन आवश्यक', 'नया निवेश करने से पहले पहचान सत्यापन पूरा करें।', 'सत्यापन जारी रखें'],
  es: ['Verificación necesaria', 'Completa la verificación de identidad antes de realizar una nueva inversión.', 'Continuar verificación'],
  ar: ['التحقق مطلوب', 'أكمل التحقق من الهوية قبل استثمار جديد.', 'متابعة التحقق'],
  fr: ['Vérification requise', 'Vérifiez votre identité avant un nouvel investissement.', 'Continuer la vérification'],
  pt: ['Verificação necessária', 'Verifique sua identidade antes de um novo investimento.', 'Continuar verificação'],
}
export function EligibilityNotice() {
  const { locale } = useI18n()
  const [open, setOpen] = useState(false)
  useEffect(() => { const show = () => setOpen(true); window.addEventListener('rwa:kyc-required', show); return () => window.removeEventListener('rwa:kyc-required', show) }, [])
  const text = copy[locale]
  if (!KYC_REQUIRED) return null
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogTitle>{text[0]}</DialogTitle><DialogDescription>{text[1]}</DialogDescription><a href="/profile/verification">{text[2]}</a></DialogContent></Dialog>
}
