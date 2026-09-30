'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronLeft, Pencil, MessageCircleQuestionMark, Mic, X } from 'lucide-react'
import type { AiQuestion } from '@/lib/api/ai-customer'
import s from './ai-question-card.module.css'

const copy: Record<string, string[]> = {
  'zh-CN': ['需要你的选择', '可多选', '选择一项', '自行填写', '输入你的答案…', '继续', '确认并继续', '修改', '已回答', '上一题', '更新回答'],
  en: ['Your input', 'Select any that apply', 'Select one', 'Write your own', 'Your answer…', 'Next', 'Confirm and continue', 'Edit', 'Answered', 'Previous', 'Update answer'],
  es: ['Tu elección', 'Selecciona varias', 'Selecciona una', 'Escribir respuesta', 'Tu respuesta…', 'Siguiente', 'Confirmar y continuar', 'Editar', 'Respondido', 'Anterior', 'Actualizar respuesta'],
  fr: ['Votre choix', 'Plusieurs choix possibles', 'Choisissez une option', 'Écrire une réponse', 'Votre réponse…', 'Suivant', 'Confirmer et continuer', 'Modifier', 'Répondu', 'Précédent', 'Actualiser la réponse'],
  ar: ['اختيارك', 'اختر عدة خيارات', 'اختر خيارًا', 'اكتب إجابتك', 'إجابتك…', 'التالي', 'تأكيد ومتابعة', 'تعديل', 'تمت الإجابة', 'السابق', 'تحديث الإجابة'],
  hi: ['आपका चयन', 'एक से अधिक चुनें', 'एक चुनें', 'अपना उत्तर लिखें', 'आपका उत्तर…', 'अगला', 'पुष्टि करें और जारी रखें', 'बदलें', 'उत्तर दिया', 'पिछला', 'उत्तर अपडेट करें'],
  pt: ['Sua escolha', 'Selecione várias', 'Selecione uma', 'Escrever resposta', 'Sua resposta…', 'Próxima', 'Confirmar e continuar', 'Editar', 'Respondido', 'Anterior', 'Atualizar resposta'],
}

type Selection = { ids: string[]; custom: boolean; text: string }
const blank = (): Selection => ({ ids: [], custom: false, text: '' })
const panelCopy: Record<string, string[]> = {
  'zh-CN': ['问题', '或自行撰写回复', '跳过', '发送', '关闭', '语音输入', '语音输入暂不可用', '语音输入未完成，请重试或输入文字'],
  en: ['Question', 'Or write your own reply', 'Skip', 'Send', 'Close', 'Voice input', 'Voice input unavailable', 'Voice input failed. Retry or type your reply.'],
  es: ['Pregunta', 'O escribe tu respuesta', 'Omitir', 'Enviar', 'Cerrar', 'Entrada de voz', 'Voz no disponible', 'No se pudo transcribir. Escribe tu respuesta.'],
  fr: ['Question', 'Ou rédigez votre réponse', 'Ignorer', 'Envoyer', 'Fermer', 'Saisie vocale', 'Voix indisponible', 'Saisie vocale impossible. Saisissez votre réponse.'],
  ar: ['سؤال', 'أو اكتب ردك', 'تخطي', 'إرسال', 'إغلاق', 'إدخال صوتي', 'الصوت غير متاح', 'تعذر الإدخال الصوتي. اكتب ردك.'],
  hi: ['प्रश्न', 'या अपना उत्तर लिखें', 'छोड़ें', 'भेजें', 'बंद करें', 'वॉइस इनपुट', 'वॉइस उपलब्ध नहीं', 'वॉइस विफल। अपना उत्तर लिखें।'],
  pt: ['Pergunta', 'Ou escreva sua resposta', 'Pular', 'Enviar', 'Fechar', 'Entrada de voz', 'Voz indisponível', 'Falha na voz. Digite sua resposta.'],
}
type VoiceSession = { lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void }
type VoiceWindow = Window & { SpeechRecognition?: new () => VoiceSession; webkitSpeechRecognition?: new () => VoiceSession }

export default function AiQuestionCard({ questions, locale, disabled = false, onConfirm }: {
  questions: AiQuestion[]; locale: string; disabled?: boolean; onConfirm: (answer: string) => Promise<boolean>
}) {
  const uid = useId()
  const reduceMotion = useReducedMotion()
  const c = copy[locale] ?? copy.en
  const p = panelCopy[locale] ?? panelCopy.en
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, Selection>>({})
  const [answered, setAnswered] = useState(false)
  const [pending, setPending] = useState(false)
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const voice = useRef<VoiceSession | null>(null)
  useEffect(() => { const w = window as VoiceWindow; setVoiceAvailable(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition)); return () => { const active = voice.current; if (active) { active.onresult = active.onerror = active.onend = null; active.abort() } } }, [])
  const q = questions[step]
  if (!q) return null
  const current = values[q.id] ?? blank()
  const locked = disabled || pending
  const labels = (question: AiQuestion) => {
    const value = values[question.id] ?? blank()
    return [...question.options.filter(o => value.ids.includes(o.id)).map(o => o.label), ...(value.custom && value.text.trim() ? [value.text.trim()] : [])]
  }
  const valid = (question: AiQuestion) => {
    const value = values[question.id] ?? blank()
    return (!value.custom || !!value.text.trim()) && labels(question).length > 0
  }
  const update = (value: Selection) => setValues(previous => ({ ...previous, [q.id]: value }))
  const choose = (id: string) => update(q.multiple
    ? { ...current, ids: current.ids.includes(id) ? current.ids.filter(v => v !== id) : [...current.ids, id] }
    : { ids: [id], custom: false, text: '' })
  const write = (text: string) => update({ ids: q.multiple ? current.ids : [], custom: !!text.trim(), text })
  const dismiss = () => { voice.current?.abort(); setAnswered(true) }
  const dictate = () => {
    if (listening) { voice.current?.stop(); return }
    const w = window as VoiceWindow, Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Constructor) return
    const recognition = new Constructor(); voice.current = recognition; recognition.lang = locale; setVoiceError('')
    recognition.onresult = event => { const text = Array.from(event.results).map(result => result[0]?.transcript ?? '').join(' '); write([current.text, text].filter(Boolean).join(' ')) }
    recognition.onerror = () => { setListening(false); setVoiceError(p[7]) }
    recognition.onend = () => { setListening(false); voice.current = null }
    try { recognition.start(); setListening(true) } catch { setListening(false); setVoiceError(p[7]) }
  }
  const confirm = async () => {
    if (locked || !questions.every(valid)) return
    setPending(true)
    try {
      const answer = questions.map(question => `${question.title}\n${labels(question).join(' · ')}`).join('\n\n')
      if (await onConfirm(answer)) dismiss()
    } finally { setPending(false) }
  }

  return <AnimatePresence>{!answered && <motion.section className={s.card} aria-label={p[0]} dir={locale === 'ar' ? 'rtl' : undefined}
    initial={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: reduceMotion ? 0 : 6, scale: reduceMotion ? 1 : .98 }} transition={{ duration: reduceMotion ? 0 : .2, ease: [.22, 1, .36, 1] }}>
      <header className={s.header}><span><MessageCircleQuestionMark size={20} strokeWidth={1.7} aria-hidden="true"/>{p[0]}</span><div>{questions.length > 1 && <small>{step + 1}/{questions.length}</small>}<button type="button" className={s.icon} aria-label={p[4]} disabled={locked} onClick={dismiss}><X size={18} strokeWidth={1.7}/></button></div></header>
      <AnimatePresence mode="wait" initial={false}><motion.fieldset key={q.id} className={s.question} disabled={locked}
        initial={{ opacity: 0, x: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduceMotion ? 0 : -6 }} transition={{ duration: reduceMotion ? 0 : .12 }}>
        <legend className={s.srOnly}>{q.title}</legend><h3 className={s.title}>{q.title}</h3>
        <div className={s.options}>{q.options.map((option, index) => {
          const selected = current.ids.includes(option.id)
          return <label key={option.id} className={s.option} data-selected={selected || undefined}>
            <input type={q.multiple ? 'checkbox' : 'radio'} name={`${uid}-${q.id}`} checked={selected} onChange={() => choose(option.id)} />
            <span className={s.number} aria-hidden="true">{index + 1}</span><span className={s.optionText}><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span><span className={s.indicator} data-multiple={q.multiple || undefined} aria-hidden="true">{selected && <Check size={12} strokeWidth={2.5} />}</span>
          </label>
        })}
        </div>
        <label className={s.customRow}><Pencil size={20} strokeWidth={1.6} aria-hidden="true"/><textarea className={s.custom} aria-label={`${q.title} — ${p[1]}`} placeholder={p[1]} maxLength={600} rows={1} value={current.text} onChange={event => write(event.target.value)} /></label>
        {voiceError && <p className={s.voiceError} role="status">{voiceError}</p>}
      </motion.fieldset></AnimatePresence>
      <footer className={s.footer}>{step > 0 && <button type="button" className={s.icon} aria-label={c[9]} disabled={locked || listening} onClick={() => setStep(i => i - 1)}><ChevronLeft size={18}/></button>}
        <span className={s.spacer}/><button type="button" className={s.icon} aria-label={voiceAvailable ? p[5] : p[6]} title={voiceAvailable ? p[5] : p[6]} disabled={locked || !voiceAvailable} aria-pressed={listening} onClick={dictate}><Mic size={20} strokeWidth={1.8}/></button>
        <button type="button" className={s.skip} disabled={locked} onClick={dismiss}>{p[2]}</button>
        <button type="button" className={s.continue} disabled={locked || listening || !valid(q) || (step === questions.length - 1 && !questions.every(valid))} onClick={() => step < questions.length - 1 ? setStep(i => i + 1) : void confirm()}>{pending ? '…' : step < questions.length - 1 ? c[5] : p[3]}</button>
      </footer>
  </motion.section>}</AnimatePresence>
}
