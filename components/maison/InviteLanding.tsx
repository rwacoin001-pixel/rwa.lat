'use client'

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n, type AppLocale } from '@/lib/i18n'
import type { RwaScreen } from '@/lib/rwa-routes'
import { useQuantProducts } from '@/lib/api/quant'
import { currentInvite, displayInviteCode, type InviteAttribution } from '@/lib/referral-invite'
import { MaisonPage, maison as s } from './primitives'
import styles from './invite-landing.module.css'

/**
 * /invite (2026-10-28): where an invitation link lands, instead of a bare sign-up form. A warm photo, who sent you
 * (the code this browser now carries, never the inviter's name or email), what A-REIT is in three text rows with real
 * figures, then sign up. docs/design-system.md §7.7.
 */
type Copy = {
  chip: string; title: string; kept: (code: string) => string; none: string
  quant: string; quantLine: (pct: string) => string; quantSoon: string; predict: string; predictLine: string; community: string; communityLine: string
  risk: string; register: string; login: string
}
const copy: Record<AppLocale, Copy> = {
  en: { chip: 'Invitation', title: 'A friend invited you to A-REIT', kept: (code) => `Invite code ${code} is saved. It links when you sign up — nothing to type.`, none: 'Sign up to start. You can add an invite code during sign-up.', quant: 'Koala Quant', quantLine: (pct) => `Settled daily · past 30 days ${pct}`, quantSoon: 'Settled daily', predict: 'Prediction markets', predictLine: 'Macro · crypto · commodities', community: 'Community', communityLine: 'Talk with other investors', risk: 'Past performance does not indicate future results. Investing carries risk.', register: 'Sign up', login: 'I have an account' },
  'zh-CN': { chip: '邀请', title: '朋友邀请你加入 A-REIT', kept: (code) => `邀请码 ${code} 已记下，注册后自动绑定，不用再输入。`, none: '注册就可以开始。注册时也可以填写邀请码。', quant: '考拉量化', quantLine: (pct) => `每日结算 · 过去 30 天 ${pct}`, quantSoon: '每日结算', predict: '预测市场', predictLine: '宏观 · 加密 · 大宗', community: '社区', communityLine: '和其他投资者交流', risk: '历史表现不代表未来收益，投资有风险。', register: '注册', login: '我已有账号' },
  hi: { chip: 'आमंत्रण', title: 'एक दोस्त ने आपको A-REIT पर बुलाया है', kept: (code) => `आमंत्रण कोड ${code} सहेजा गया। साइन अप पर अपने आप जुड़ जाएगा।`, none: 'शुरू करने के लिए साइन अप करें। साइन अप में कोड जोड़ सकते हैं।', quant: 'Koala Quant', quantLine: (pct) => `रोज़ निपटान · पिछले 30 दिन ${pct}`, quantSoon: 'रोज़ निपटान', predict: 'पूर्वानुमान बाज़ार', predictLine: 'मैक्रो · क्रिप्टो · कमोडिटी', community: 'समुदाय', communityLine: 'दूसरे निवेशकों से बात करें', risk: 'पिछला प्रदर्शन भविष्य के परिणाम नहीं बताता। निवेश में जोखिम है।', register: 'साइन अप', login: 'मेरा खाता है' },
  es: { chip: 'Invitación', title: 'Un amigo te invitó a A-REIT', kept: (code) => `El código ${code} está guardado. Se vincula al registrarte, sin escribir nada.`, none: 'Regístrate para empezar. Puedes añadir un código al registrarte.', quant: 'Koala Quant', quantLine: (pct) => `Liquidación diaria · últimos 30 días ${pct}`, quantSoon: 'Liquidación diaria', predict: 'Mercados de predicción', predictLine: 'Macro · cripto · materias primas', community: 'Comunidad', communityLine: 'Habla con otros inversores', risk: 'El rendimiento pasado no garantiza resultados futuros. Invertir conlleva riesgo.', register: 'Registrarme', login: 'Ya tengo cuenta' },
  ar: { chip: 'دعوة', title: 'دعاك صديق إلى A-REIT', kept: (code) => `تم حفظ رمز الدعوة ${code}. يُربط تلقائيًا عند التسجيل.`, none: 'سجّل للبدء. يمكنك إضافة رمز دعوة أثناء التسجيل.', quant: 'Koala Quant', quantLine: (pct) => `تسوية يومية · آخر 30 يومًا ${pct}`, quantSoon: 'تسوية يومية', predict: 'أسواق التنبؤ', predictLine: 'اقتصاد كلي · عملات رقمية · سلع', community: 'المجتمع', communityLine: 'تحدّث مع مستثمرين آخرين', risk: 'الأداء السابق لا يضمن النتائج المستقبلية. الاستثمار ينطوي على مخاطر.', register: 'إنشاء حساب', login: 'لدي حساب' },
  fr: { chip: 'Invitation', title: 'Un ami vous invite sur A-REIT', kept: (code) => `Le code ${code} est enregistré. Il sera lié à l’inscription, rien à saisir.`, none: 'Inscrivez-vous pour commencer. Vous pourrez saisir un code à l’inscription.', quant: 'Koala Quant', quantLine: (pct) => `Règlement quotidien · 30 derniers jours ${pct}`, quantSoon: 'Règlement quotidien', predict: 'Marchés de prédiction', predictLine: 'Macro · crypto · matières premières', community: 'Communauté', communityLine: 'Échangez avec d’autres investisseurs', risk: 'Les performances passées ne préjugent pas des résultats futurs. Investir comporte des risques.', register: 'S’inscrire', login: 'J’ai un compte' },
  pt: { chip: 'Convite', title: 'Um amigo convidou você para a A-REIT', kept: (code) => `O código ${code} foi salvo. Ele é vinculado no cadastro, sem digitar nada.`, none: 'Cadastre-se para começar. Você pode informar um código no cadastro.', quant: 'Koala Quant', quantLine: (pct) => `Liquidação diária · últimos 30 dias ${pct}`, quantSoon: 'Liquidação diária', predict: 'Mercados de previsão', predictLine: 'Macro · cripto · commodities', community: 'Comunidade', communityLine: 'Converse com outros investidores', risk: 'Desempenho passado não garante resultados futuros. Investir envolve risco.', register: 'Criar conta', login: 'Já tenho conta' },
}

const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`

export function InviteLanding({ go }: { go: (screen: RwaScreen) => void }) {
  const { locale } = useI18n()
  const c = copy[locale] ?? copy.en
  const [invite, setInvite] = useState<InviteAttribution | null | undefined>(undefined)
  useEffect(() => { let live = true; void currentInvite().then((value) => { if (live) setInvite(value) }); return () => { live = false } }, [])
  const pct = useQuantProducts().data?.[0]?.performance.last30d.pct ?? null
  const rows = [
    { key: 'quant', title: c.quant, line: pct === null ? c.quantSoon : c.quantLine(signed(pct)) },
    { key: 'predict', title: c.predict, line: c.predictLine },
    { key: 'community', title: c.community, line: c.communityLine },
  ]
  return <MaisonPage page="invite" cta>
    <div className={styles.root}>
      <div className={styles.photo}>
        <img src="/media/home/cards/invite-720.webp" alt="" width={720} height={450} decoding="async" />
        <span className={styles.chip}>{c.chip}</span>
      </div>
      <h1 className={styles.title}>{c.title}</h1>
      <p className={styles.lede} aria-live="polite">{invite === undefined ? ' ' : invite ? c.kept(displayInviteCode(invite.code)) : c.none}</p>
      <ul className={styles.rows}>
        {rows.map((row) => <li key={row.key}><b>{row.title}</b><span dir="auto">{row.line}</span></li>)}
      </ul>
      <p className={styles.risk}>{c.risk}</p>
    </div>
    <div className={`${s.stickyCta} ${styles.actions}`}>
      <button type="button" className={s.ghost} onClick={() => go('login')}>{c.login}</button>
      <button type="button" className={s.cta} onClick={() => go('register')}>
        <span>{c.register}</span><span className={s.ctaIcon}><ArrowRight size={17} aria-hidden="true" /></span>
      </button>
    </div>
  </MaisonPage>
}
