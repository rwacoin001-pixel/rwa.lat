'use client'

import { useI18n } from '@/lib/i18n'

// Circle discovery and detail (2026-11-01).
const copy = {
  'zh-CN': { circles: '圈子', mine: '我的圈子', joined: '我加入的', left: '已退出', search: '搜索圈子名或 6 位 ID', searchInside: '搜索圈子', searchPosts: '搜索帖子', searchMembers: '搜索成员', noCircles: '没有找到圈子', noJoined: '还没有加入其他圈子', noResults: '没有结果', apply: '申请', pending: '已申请', enter: '进入', removed: '已被移出', latest: '最新', copied: 'ID 已复制', copyId: '复制 ID', announcement: '公告', pin: '置顶', unpin: '取消置顶', muted: '免打扰', searchable: '允许被搜到', on: '开', off: '关', silence: '禁言', unsilence: '解除禁言', silenced: '已禁言', silencedNote: '圈主已暂停你在这个圈子发言', posts: '帖子', members: '成员', compose: '发帖', retry: '重试', more: '加载更多', failed: '加载失败，请稍后再试。', unavailable: '这个圈子暂时不可用', notLive: '圈子即将开放', emptyFeed: '圈子里还没有帖子', publicSync: '同时发到社区', circleSync: '同时发到我的圈子', pickCircle: '选择圈子', back: '返回社区' },
  en: { circles: 'Circles', mine: 'My circle', joined: 'Circles I joined', left: 'Left', search: 'Search name or 6-digit ID', searchInside: 'Search circle', searchPosts: 'Search posts', searchMembers: 'Search members', noCircles: 'No circles found', noJoined: 'You have not joined other circles yet', noResults: 'No results', apply: 'Apply', pending: 'Requested', enter: 'Open', removed: 'Removed', latest: 'Latest', copied: 'ID copied', copyId: 'Copy ID', announcement: 'Announcement', pin: 'Pin', unpin: 'Unpin', muted: 'Do not disturb', searchable: 'Allow discovery', on: 'On', off: 'Off', silence: 'Silence', unsilence: 'Unsilence', silenced: 'Silenced', silencedNote: 'The owner has paused your posting in this circle', posts: 'Posts', members: 'Members', compose: 'Post', retry: 'Retry', more: 'Load more', failed: 'Could not load. Please try again.', unavailable: 'This circle is currently unavailable', notLive: 'Circles are coming soon', emptyFeed: 'No posts in this circle yet', publicSync: 'Also post to Community', circleSync: 'Also post to my circle', pickCircle: 'Choose a circle', back: 'Back to Community' },
}
export function useCircleStageCopy() {
  const { locale } = useI18n()
  return copy[locale === 'zh-CN' ? 'zh-CN' : 'en']
}
