import type { AppLocale } from './i18n'
import type { LevelKey, RankBoard } from './api/membership'

/** Galaxy level names (2026-11-04): small to large, the way a member grows — dust, planet, star, cluster, nebula,
 * galaxy, Milky Way. Every locale has its own names; the rest of the copy is zh-CN and en (others fall back to en). */
/** 2026-11-05 (user: names felt wrong; agreed with Codex): one story, smallest to largest — 星火 · 新星 · 恒星 · 星座
 * (the team starts here) · 星团 · 星系 · 星穹 — always shown with L1–L7. Keys are internal and keep their old names. */
export const LEVEL_NAMES: Record<AppLocale, Record<LevelKey, string>> = {
  'zh-CN': { stardust: '星火', planet: '新星', star: '恒星', cluster: '星座', nebula: '星团', galaxy: '星系', milkyway: '星穹' },
  en: { stardust: 'Spark', planet: 'Nova', star: 'Star', cluster: 'Constellation', nebula: 'Cluster', galaxy: 'Galaxy', milkyway: 'Cosmos' },
  hi: { stardust: 'चिंगारी', planet: 'नवतारा', star: 'तारा', cluster: 'नक्षत्र', nebula: 'तारा-समूह', galaxy: 'आकाशगंगा', milkyway: 'ब्रह्मांड' },
  es: { stardust: 'Chispa', planet: 'Nova', star: 'Estrella', cluster: 'Constelación', nebula: 'Cúmulo', galaxy: 'Galaxia', milkyway: 'Cosmos' },
  ar: { stardust: 'شرارة', planet: 'مستعر', star: 'نجم', cluster: 'كوكبة', nebula: 'عنقود', galaxy: 'مجرة', milkyway: 'الكون' },
  fr: { stardust: 'Étincelle', planet: 'Nova', star: 'Étoile', cluster: 'Constellation', nebula: 'Amas', galaxy: 'Galaxie', milkyway: 'Cosmos' },
  pt: { stardust: 'Centelha', planet: 'Nova', star: 'Estrela', cluster: 'Constelação', nebula: 'Aglomerado', galaxy: 'Galáxia', milkyway: 'Cosmos' },
}

export type MembershipCopy = {
  title: string; kicker: string; score: string; scoreNote: string; toNext: (name: string) => string; top: string
  parts: { deposits: string; purchases: string; team: string; tasks: string }; teamLevels: (a: string, b: string, c: string) => string
  members: (direct: number, team: number) => string; needs: string; needScore: (v: string) => string; needDirect: (n: number) => string; needTeam: (n: number) => string; needDeposit: string
  grace: (date: string) => string; perks: string; perksNext: (name: string) => string; ladder: string; now: string
  perk: { draws: (n: number) => string; prediction: (n: number) => string; quant: (n: number) => string; badge: string; frame: string; priority_support: string }
  how: string; howBody: string; rank: string; loadFailed: string; retry: string; updated: (t: string) => string
  boards: Record<RankBoard, string>; week: string; month: string; mine: string; notRanked: string; hidden: string; hide: string; show: string
  hideNote: string; empty: string; bandUnit: string; invites: (n: string) => string; rankTitle: string; rankKicker: string; soon: string; from: string
  reqTitle: (name: string) => string; reqScore: (v: string) => string; reqDirect: (n: number) => string; reqTeam: (n: number) => string; reqDeposit: string
  perkCol: string; thisLevel: string; soonNote: string; members2: (d: number, t: number, a: number) => string; toGo: (name: string, v: string) => string
  perkNames: { draws: string; prediction: string; quant: string }
  rules: string; member: string; live: string; soonPill: string; gifts: string; levelStart: (v: string) => string; levelNeed: (name: string, v: string) => string
  gate: string; gateFree: string; giftsOf: (name: string) => string; noGifts: string; reached: string
}

const zh: MembershipCopy = {
  title: '会员等级', kicker: '会员等级', score: '星能值', scoreNote: '近 12 个月 · 每天更新', toNext: (n) => `距离「${n}」`, top: '已是最高等级',
  parts: { deposits: '充值', purchases: '买入', team: '团队买入', tasks: '任务' }, teamLevels: (a, b, c) => `一级 ${a} · 二级 ${b} · 三级 ${c}`,
  members: (d, t) => `直属 ${d} 人 · 团队 ${t} 人`, needs: '升级还需要', needScore: (v) => `再获得 ${v} 星能值`, needDirect: (n) => `再有 ${n} 位直属好友活跃`, needTeam: (n) => `团队再有 ${n} 人活跃`, needDeposit: '完成第一次充值',
  grace: (d) => `保级期到 ${d}，期间等级不变`, perks: '本级权益', perksNext: (n) => `升到「${n}」可得`, ladder: '全部等级', now: '当前',
  perk: { draws: (n) => `每天多抽 ${n} 次`, prediction: (n) => `预测下注费 ${10 - n / 10} 折`, quant: (n) => `考拉量化管理费减 ${n}%`, badge: '等级徽章', frame: '专属头像外框', priority_support: '专属客服' },
  how: '星能值怎么算', howBody: '充值和买入会累积星能值；你邀请的好友（最多三级）买入，也会按比例计入；活跃的团队成员和完成的任务也会加分。只算近 12 个月。',
  rank: '排行榜', loadFailed: '没有读取成功。', retry: '重试', updated: (t) => `更新于 ${t}`,
  boards: { score: '星能榜', invest: '投资榜', team: '团队榜', invite: '邀请榜' }, week: '本周', month: '本月', mine: '我的名次', notRanked: '暂未上榜', hidden: '你已设为不上榜',
  hide: '不上排行榜', show: '重新上榜', hideNote: '榜上只显示昵称、头像、等级和金额区间，不显示具体金额。', empty: '这一期还没有人上榜。', bandUnit: 'U', invites: (n) => `${n} 人`,
  rankTitle: '排行榜', rankKicker: '每小时更新', soon: '即将开放', from: '星能值来自',
  reqTitle: (n) => `升级到 ${n}`, reqScore: (v) => `星能值达到 ${v}`, reqDirect: (n) => `直属好友中 ${n} 人活跃`, reqTeam: (n) => `团队中 ${n} 人活跃`, reqDeposit: '完成第一次链上充值',
  perkCol: '权益', thisLevel: '本级', soonNote: '除等级徽章外，其他权益即将开放，开放前不会生效。', members2: (d, t, a) => `直属 ${d} 人 · 团队 ${t} 人 · 近 90 天活跃 ${a} 人`, toGo: (n, v) => `距 ${n} 还差 ${v}`,
  perkNames: { draws: '每天额外抽奖', prediction: '预测下注费减免', quant: '考拉量化管理费减免' },
  rules: '规则', member: 'A-REIT 会员', live: '已启用', soonPill: '待开放', gifts: '会员礼遇', levelStart: (v) => `本级起点 ${v}`, levelNeed: (n, v) => `升级至 ${n} 需 ${v}`,
  gate: '升级条件', gateFree: '注册即可获得', giftsOf: (n) => `${n} 礼遇`, noGifts: '等级徽章', reached: '已达成',
}
const en: MembershipCopy = {
  title: 'Membership', kicker: 'Membership', score: 'Star power', scoreNote: 'Last 12 months · updated daily', toNext: (n) => `To ${n}`, top: 'Highest level reached',
  parts: { deposits: 'Deposits', purchases: 'Purchases', team: 'Team purchases', tasks: 'Tasks' }, teamLevels: (a, b, c) => `Level 1 ${a} · Level 2 ${b} · Level 3 ${c}`,
  members: (d, t) => `${d} direct · ${t} in team`, needs: 'To level up', needScore: (v) => `${v} more star power`, needDirect: (n) => `${n} more active direct friends`, needTeam: (n) => `${n} more active team members`, needDeposit: 'Make your first deposit',
  grace: (d) => `Grace period until ${d}: your level stays`, perks: 'Your perks', perksNext: (n) => `At ${n} you get`, ladder: 'All levels', now: 'Now',
  perk: { draws: (n) => `${n} extra daily draw${n > 1 ? 's' : ''}`, prediction: (n) => `${n}% off prediction fees`, quant: (n) => `${n}% off Koala Quant fees`, badge: 'Level badge', frame: 'Avatar frame', priority_support: 'Priority support' },
  how: 'How star power works', howBody: 'Deposits and purchases add star power; purchases by friends you invited (up to three levels) count in part; active team members and finished tasks add more. Only the last 12 months count.',
  rank: 'Rankings', loadFailed: 'Could not load.', retry: 'Retry', updated: (t) => `Updated ${t}`,
  boards: { score: 'Star power', invest: 'Investing', team: 'Team', invite: 'Invites' }, week: 'This week', month: 'This month', mine: 'My rank', notRanked: 'Not ranked yet', hidden: 'You are hidden from rankings',
  hide: 'Hide me from rankings', show: 'Show me again', hideNote: 'Rankings show nickname, avatar, level and an amount range — never exact amounts.', empty: 'Nobody is ranked this period yet.', bandUnit: 'U', invites: (n) => `${n} people`,
  rankTitle: 'Rankings', rankKicker: 'Updated hourly', soon: 'Coming soon', from: 'Where it comes from',
  reqTitle: (n) => `To reach ${n}`, reqScore: (v) => `Star power of ${v}`, reqDirect: (n) => `${n} active direct friends`, reqTeam: (n) => `${n} active team members`, reqDeposit: 'A first on-chain deposit',
  perkCol: 'Perk', thisLevel: 'Now', soonNote: 'Apart from the badge, perks open soon and do not apply until then.', members2: (d, t, a) => `${d} direct · ${t} in team · ${a} active (90 days)`, toGo: (n, v) => `${v} to ${n}`,
  perkNames: { draws: 'Extra daily draws', prediction: 'Prediction fee off', quant: 'Koala Quant fee off' },
  rules: 'Rules', member: 'A-REIT member', live: 'On', soonPill: 'Soon', gifts: 'Member perks', levelStart: (v) => `Level starts at ${v}`, levelNeed: (n, v) => `${n} at ${v}`,
  gate: 'To reach it', gateFree: 'Yours on sign-up', giftsOf: (n) => `${n} perks`, noGifts: 'Level badge', reached: 'Reached',
}
export const MEMBERSHIP_COPY: Partial<Record<AppLocale, MembershipCopy>> = { 'zh-CN': zh, en }
export const membershipCopy = (locale: AppLocale) => MEMBERSHIP_COPY[locale] ?? en

/** Money band keys from the API → readable ranges ("1k-5k" → "1千–5千 U" / "1k–5k U"). */
export function bandLabel(band: string, locale: AppLocale, unit: string) {
  const zhUnits: Record<string, string> = { '0': '0', '1k': '1千', '5k': '5千', '10k': '1万', '50k': '5万', '100k': '10万', '500k': '50万', '1m': '100万' }
  const show = (v: string) => (locale === 'zh-CN' ? zhUnits[v] ?? v : v.toUpperCase().replace('K', 'k'))
  if (band.endsWith('+')) return `${show(band.slice(0, -1))}+ ${unit}`
  const [a, b] = band.split('-')
  return b ? `${show(a)}–${show(b)} ${unit}` : band
}
