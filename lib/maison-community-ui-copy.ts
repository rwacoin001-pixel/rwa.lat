import type { AppLocale } from './i18n'

/** Chrome strings for the timeline-style community screens (feed, post, member). Content copy stays in maison-content-copy. */
export type CommunityUiCopy = {
  compose: string; close: string; share: string; reply: string; views: string; likes: string; replies: string
  topics: string; posts: string; following: string; followers: string; feed: string; noReplies: string
}

const en: CommunityUiCopy = { compose: 'New post', close: 'Close', share: 'Share', reply: 'Reply', views: 'Views', likes: 'Likes', replies: 'Replies', topics: 'Topics', posts: 'Posts', following: 'Following', followers: 'Followers', feed: 'Community timeline', noReplies: 'No replies yet' }
const zh: CommunityUiCopy = { compose: '发帖', close: '关闭', share: '分享', reply: '回复', views: '浏览', likes: '喜欢', replies: '回复', topics: '话题', posts: '帖子', following: '正在关注', followers: '关注者', feed: '社区时间线', noReplies: '还没有回复' }
const hi: CommunityUiCopy = { compose: 'नई पोस्ट', close: 'बंद करें', share: 'साझा करें', reply: 'जवाब दें', views: 'व्यू', likes: 'पसंद', replies: 'जवाब', topics: 'विषय', posts: 'पोस्ट', following: 'फ़ॉलो कर रहे हैं', followers: 'फ़ॉलोअर', feed: 'समुदाय टाइमलाइन', noReplies: 'अभी तक कोई जवाब नहीं' }
const es: CommunityUiCopy = { compose: 'Nueva publicación', close: 'Cerrar', share: 'Compartir', reply: 'Responder', views: 'Vistas', likes: 'Me gusta', replies: 'Respuestas', topics: 'Temas', posts: 'Publicaciones', following: 'Siguiendo', followers: 'Seguidores', feed: 'Cronología de la comunidad', noReplies: 'Aún no hay respuestas' }
const ar: CommunityUiCopy = { compose: 'منشور جديد', close: 'إغلاق', share: 'مشاركة', reply: 'رد', views: 'المشاهدات', likes: 'الإعجابات', replies: 'الردود', topics: 'المواضيع', posts: 'المنشورات', following: 'يتابع', followers: 'المتابعون', feed: 'الخط الزمني للمجتمع', noReplies: 'لا توجد ردود بعد' }
const fr: CommunityUiCopy = { compose: 'Nouvelle publication', close: 'Fermer', share: 'Partager', reply: 'Répondre', views: 'Vues', likes: "J'aime", replies: 'Réponses', topics: 'Sujets', posts: 'Publications', following: 'Abonnements', followers: 'Abonnés', feed: 'Fil de la communauté', noReplies: 'Aucune réponse pour le moment' }
const pt: CommunityUiCopy = { compose: 'Nova publicação', close: 'Fechar', share: 'Compartilhar', reply: 'Responder', views: 'Visualizações', likes: 'Curtidas', replies: 'Respostas', topics: 'Tópicos', posts: 'Publicações', following: 'Seguindo', followers: 'Seguidores', feed: 'Linha do tempo da comunidade', noReplies: 'Ainda não há respostas' }

export const communityUiCopy: Record<AppLocale, CommunityUiCopy> = { en, 'zh-CN': zh, hi, es, ar, fr, pt }
