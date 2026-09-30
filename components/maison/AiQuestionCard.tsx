'use client'

import { useId, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, Pencil, ArrowUpRight } from 'lucide-react'
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

export default function AiQuestionCard({ questions, locale, disabled = false, onConfirm }: {
  questions: AiQuestion[]; locale: string; disabled?: boolean; onConfirm: (answer: string) => Promise<boolean>
}) {
  const uid = useId()
  const c = copy[locale] ?? copy.en
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string, Selection>>({})
  const [answered, setAnswered] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
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
    : { ...current, ids: [id], custom: false })
  const confirm = async () => {
    if (locked || !questions.every(valid)) return
    setPending(true)
    try {
      const answer = `${submitted ? `${c[10]}\n` : ''}${questions.map(question => `${question.title}\n${labels(question).join(' · ')}`).join('\n\n')}`
      if (await onConfirm(answer)) { setAnswered(true); setSubmitted(true) }
    } finally { setPending(false) }
  }

  return <section className={s.card} aria-label={c[0]} dir={locale === 'ar' ? 'rtl' : undefined} data-answered={answered || undefined}>
    {answered ? <div className={s.summary}>
      <span className={s.done}><Check size={15} aria-hidden="true" />{c[8]}</span>
      <div>{questions.map(question => <p key={question.id}><span>{question.title}</span><b>{labels(question).join(' · ')}</b></p>)}</div>
      <button type="button" className={s.edit} disabled={locked} onClick={() => setAnswered(false)}><Pencil size={13} aria-hidden="true" />{c[7]}</button>
    </div> : <>
      <header className={s.header}><span>{c[0]}</span><span className={s.steps}>{questions.map((question, i) => <i key={question.id} data-current={i === step || undefined} />)}<small>{step + 1}/{questions.length}</small></span></header>
      <fieldset className={s.question} disabled={locked}>
        <legend>{q.title}</legend><p className={s.hint}>{q.multiple ? c[1] : c[2]}</p>
        <div className={s.options}>{q.options.map((option, index) => {
          const selected = current.ids.includes(option.id)
          return <label key={option.id} className={s.option} data-selected={selected || undefined}>
            <input type={q.multiple ? 'checkbox' : 'radio'} name={`${uid}-${q.id}`} checked={selected} onChange={() => choose(option.id)} />
            <span className={s.number} aria-hidden="true">{index + 1}</span><span className={s.optionText}><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span><span className={s.indicator} data-multiple={q.multiple || undefined} aria-hidden="true">{selected && <Check size={12} strokeWidth={2.5} />}</span>
          </label>
        })}
          <label className={s.option} data-selected={current.custom || undefined}>
            <input type={q.multiple ? 'checkbox' : 'radio'} name={`${uid}-${q.id}`} checked={current.custom} onChange={() => update({ ...current, ids: q.multiple ? current.ids : [], custom: !current.custom })} />
            <span className={s.number} aria-hidden="true"><Pencil size={12} /></span><span className={s.optionText}><b>{c[3]}</b></span><span className={s.indicator} data-multiple={q.multiple || undefined} aria-hidden="true">{current.custom && <Check size={12} strokeWidth={2.5} />}</span>
          </label>
        </div>
        {current.custom && <textarea className={s.custom} aria-label={`${q.title} — ${c[3]}`} placeholder={c[4]} maxLength={600} rows={2} value={current.text} onChange={event => update({ ...current, text: event.target.value })} />}
      </fieldset>
      <footer className={s.footer}><button type="button" className={s.back} aria-label={c[9]} disabled={locked || step === 0} onClick={() => setStep(i => i - 1)}><ChevronLeft size={16} /></button>
        <button type="button" className={s.continue} disabled={locked || !valid(q) || (step === questions.length - 1 && !questions.every(valid))} onClick={() => step < questions.length - 1 ? setStep(i => i + 1) : void confirm()}>{pending ? '…' : step < questions.length - 1 ? c[5] : c[6]}{step < questions.length - 1 ? <ChevronRight size={15} aria-hidden="true" /> : <ArrowUpRight size={15} aria-hidden="true" />}</button>
      </footer>
    </>}
  </section>
}
