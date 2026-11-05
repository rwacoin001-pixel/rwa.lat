'use client'

/**
 * My team as a tree (2026-11-05, user: "show the team as a tree, like React Bits' Branched Menu, in our own style;
 * rewards count three levels only"). Me at the root; a trunk runs down from my photo and each member branches off it on a
 * soft curve. Tapping a member with invitees opens their branch (one open branch per level, so the line always traces
 * the path to the person you picked — that path is inked, the rest stays hairline); the chevron opens their details.
 * Third-level members are leaves: rewards stop there, which the foot of the tree says once. Branches draw down and the
 * rows slide in one after another; reduced motion shows them at once.
 */
import { useState, type CSSProperties } from 'react'
import { ChevronRight } from 'lucide-react'
import { useQuery } from '@/lib/api/_query'
import { referralTeamTree, type ReferralMember, type ReferralTreeNode } from '@/lib/api/referral'
import { CommunityAvatar, porcelainAvatar } from '@/components/community-avatar'
import { Medallion } from '@/components/membership/Medallion'
import { useCommunityMe } from '@/lib/use-community-me'
import { fmtAtomic } from './format'
import { Skeleton } from './primitives'
import tr from './team-tree.module.css'

type T = (cn: string, en: string) => string
const DEPTH_CN = ['', '一级', '二级', '三级']

export function TeamTree({ t, directCount, onOpen }: { t: T; directCount: string | number; onOpen: (member: ReferralMember) => void }) {
  const me = useCommunityMe(false)
  return <div className={tr.tree}>
    <div className={tr.root}>
      <span className={tr.rootAvatar}>{me ? <CommunityAvatar avatarUrl={me.avatarUrl} seed={me.avatarSeed} handle={me.handle || 'me'} size={44} /> : <i />}</span>
      <span className={tr.rootText}><b>{t('我', 'Me')}</b><small>{t(`直属 ${directCount} 人 · 右侧金额是给我的奖励`, `${directCount} direct · amounts are rewards to me`)}</small></span>
    </div>
    <Branch parent={null} depth={1} t={t} onOpen={onOpen} />
    <p className={tr.note}>{t('奖励只计算三级：第三级成员邀请的人不再计入你的奖励，也不在这里显示。', 'Rewards count three levels: people invited by your third level are not counted and are not shown here.')}</p>
  </div>
}

function Branch({ parent, depth, t, onOpen }: { parent: string | null; depth: number; t: T; onOpen: (member: ReferralMember) => void }) {
  const [page, setPage] = useState(1)
  const result = useQuery(`referral:v2:tree:${parent ?? 'root'}:${page}`, () => referralTeamTree(parent, page), { staleTime: 30_000 })
  const [open, setOpen] = useState<string | null>(null)
  if (result.error && !result.data) return <p className={tr.state} role="alert">{t('没有读取成功。', 'Could not load.')} <button type="button" onClick={() => void result.refetch()}>{t('重试', 'Retry')}</button></p>
  if (!result.data) return <div className={tr.loading}><Skeleton rows={2} /></div>
  const items = result.data.items
  if (!items.length) return <p className={tr.state}>{depth === 1 ? t('分享邀请，好友注册后会出现在这里。', 'Share your invite. Friends who sign up appear here.') : t('还没有邀请别人', 'Has not invited anyone yet')}</p>
  return <ul className={tr.branch} data-depth={depth} data-open={open ? '' : undefined}>
    {items.map((node, index) => <Node key={node.memberLabel} node={node} index={index} t={t} onOpen={onOpen}
      open={open === node.memberLabel} dim={open !== null && open !== node.memberLabel}
      onToggle={() => setOpen((current) => current === node.memberLabel ? null : node.memberLabel)} />)}
    {result.data.total > page * result.data.pageSize && <li className={tr.more}><button type="button" onClick={() => setPage((p) => p + 1)}>{t('加载更多', 'Load more')}</button></li>}
  </ul>
}

function Node({ node, index, open, dim, onToggle, onOpen, t }: { node: ReferralTreeNode; index: number; open: boolean; dim: boolean; onToggle: () => void; onOpen: (member: ReferralMember) => void; t: T }) {
  const name = node.displayName || `${t('用户', 'Member')} ${node.memberLabel.slice(0, 6).toUpperCase()}`
  const canOpen = node.depth < 3 && node.childCount > 0
  const rewards = Number(node.rewardsToMeAtomic) > 0 ? fmtAtomic(node.rewardsToMeAtomic, 6, '', 2).trim() : null
  const detail = () => onOpen({ memberLabel: node.memberLabel, level: node.depth, boundAt: node.boundAt, displayName: node.displayName, avatarUrl: node.avatarUrl, memberLevel: node.memberLevel, active30d: node.active30d, teamSize: node.teamSize })
  return <li className={tr.node} data-open={open || undefined} data-dim={dim || undefined} style={{ ['--i' as string]: index } as CSSProperties}>
    <i className={tr.elbow} aria-hidden="true" />
    <div className={tr.row}>
      <button type="button" className={tr.main} aria-expanded={canOpen ? open : undefined} onClick={canOpen ? onToggle : detail}>
        <img src={node.avatarUrl || porcelainAvatar(node.memberLabel)} alt="" width={36} height={36} className={tr.avatar} />
        <span className={tr.text}>
          <span className={tr.name}><b dir="auto">{name}</b><span className={tr.lv} dir="ltr"><Medallion level={node.memberLevel} size={14} />L{node.memberLevel}</span></span>
          <small>
            <em>{t(DEPTH_CN[node.depth] ?? '', `L${node.depth}`)}</em>
            {node.teamSize ? ` · ${t(`团队 ${node.teamSize} 人`, `team ${node.teamSize}`)}` : ''}
            {' · '}<i data-on={node.active30d || undefined}>{node.active30d ? t('活跃', 'active') : t('未活跃', 'quiet')}</i>
          </small>
        </span>
        {rewards && <span className={tr.reward} dir="ltr" title={t('给我的奖励', 'Rewards to me')}><b>+{rewards}</b></span>}
        {canOpen && <span className={tr.count} aria-hidden="true">{node.childCount}</span>}
      </button>
      <button type="button" className={tr.info} aria-label={t(`${name} 的详情`, `${name} details`)} aria-haspopup="dialog" onClick={detail}><ChevronRight size={16} aria-hidden="true" /></button>
    </div>
    {open && <Branch parent={node.memberLabel} depth={node.depth + 1} t={t} onOpen={onOpen} />}
  </li>
}
