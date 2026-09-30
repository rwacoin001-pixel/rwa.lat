'use client'

import { useState } from 'react'
import { getPreferences, putPreferences } from '@/lib/api/account'
import { request } from '@/lib/api/_http'
import { useQuery } from '@/lib/api/_query'
import { useI18n } from '@/lib/i18n'
import { Skeleton, StateBlock, maison as s } from './primitives'

const channelsLoader = () => request<Record<string, boolean>>('/v1/notifications/channels')
const COPY = {
  'zh-CN': ['站内通知', '电子邮件', '沟通与产品更新授权', '保存偏好', '偏好已保存', '暂未接通', '必要的安全与交易通知仍会送达。', '重试'],
  en: ['In-app notifications', 'Email', 'Consent to communication and product updates', 'Save preferences', 'Preferences saved', 'Not connected', 'Essential security and transaction notices will still be delivered.', 'Retry'],
  es: ['Notificaciones en la app', 'Correo', 'Consentimiento para comunicaciones y novedades', 'Guardar preferencias', 'Preferencias guardadas', 'No conectado', 'Los avisos esenciales de seguridad y transacciones seguirán llegando.', 'Reintentar'],
  ar: ['إشعارات داخل التطبيق', 'البريد الإلكتروني', 'الموافقة على الاتصالات وتحديثات المنتجات', 'حفظ التفضيلات', 'تم الحفظ', 'غير متصل', 'ستستمر إشعارات الأمان والمعاملات الضرورية.', 'إعادة المحاولة'],
  fr: ['Notifications dans l’app', 'E-mail', 'Consentement aux communications et nouveautés', 'Enregistrer', 'Préférences enregistrées', 'Non connecté', 'Les avis essentiels de sécurité et de transaction restent actifs.', 'Réessayer'],
  pt: ['Notificações no app', 'E-mail', 'Consentimento para comunicações e novidades', 'Salvar preferências', 'Preferências salvas', 'Não conectado', 'Avisos essenciais de segurança e transações continuam ativos.', 'Tentar novamente'],
  hi: ['ऐप सूचनाएँ', 'ईमेल', 'संचार और उत्पाद अपडेट की सहमति', 'प्राथमिकताएँ सहेजें', 'सहेजा गया', 'कनेक्ट नहीं है', 'ज़रूरी सुरक्षा और लेनदेन सूचनाएँ आती रहेंगी।', 'फिर प्रयास करें'],
}

export function NotificationPreferences() {
  const { locale } = useI18n()
  const c = COPY[locale]
  const preferences = useQuery('account:preferences', getPreferences)
  const available = useQuery('notifications:channels', channelsLoader)
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null)
  const [consent, setConsent] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const data = preferences.data
  const values = draft ?? data?.channels ?? {}
  async function save() {
    if (busy || !data) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = await putPreferences({ channels: { ...data.channels, ...values }, communication_consent: consent ?? data.communicationConsent })
      if (!result.ok) { setError(result.error.message); return }
      await preferences.refetch(); setDraft(null); setConsent(null); setMessage(c[4])
    } finally { setBusy(false) }
  }
  if (preferences.error || available.error) return <StateBlock tone="error" title={preferences.error?.message ?? available.error!.message} retry={async () => { await Promise.all([preferences.refetch(), available.refetch()]) }} retryLabel={c[7]} />
  if (!data || !available.data) return <Skeleton rows={3} />
  return <div>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, display: 'grid', gap: 16 }}>
      {(['in_app', 'email'] as const).map((key, index) => <label key={key} style={{ display: 'flex', gap: 10 }}>
        <input type="checkbox" checked={values[key] ?? false} disabled={!available.data?.[key] && !values[key]} onChange={event => { setDraft({ ...values, [key]: event.target.checked }); setMessage('') }} />
        <span>{c[index]}{!available.data?.[key] && ` · ${c[5]}`}</span>
      </label>)}
      <label style={{ display: 'flex', gap: 10 }}><input type="checkbox" checked={consent ?? data.communicationConsent} onChange={event => { setConsent(event.target.checked); setMessage('') }} />{c[2]}</label>
      <button type="button" className={s.ghost} disabled={draft === null && consent === null} onClick={() => void save()}>{c[3]}</button>
    </fieldset>
    <p className={s.foot}>{c[6]}</p>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </div>
}
