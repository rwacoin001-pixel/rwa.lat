import type { AppLocale } from './i18n'

/** Pull-to-refresh announcements on the tab roots. */
export type RefreshCopy = { pull: string; release: string; refreshing: string; done: string; failed: string }

export const refreshCopy: Record<AppLocale, RefreshCopy> = {
  en: { pull: 'Pull to refresh', release: 'Release to refresh', refreshing: 'Refreshing', done: 'Updated', failed:'Could not update. Try again.' },
  'zh-CN': { pull: '下拉刷新', release: '松开刷新', refreshing: '正在刷新', done: '已更新', failed:'更新失败，请重试' },
  hi: { pull: 'रीफ़्रेश करने के लिए खींचें', release: 'रीफ़्रेश करने के लिए छोड़ें', refreshing: 'रीफ़्रेश हो रहा है', done: 'अपडेट हो गया', failed:'अपडेट नहीं हो सका। फिर कोशिश करें।' },
  es: { pull: 'Desliza para actualizar', release: 'Suelta para actualizar', refreshing: 'Actualizando', done: 'Actualizado', failed:'No se pudo actualizar. Inténtalo de nuevo.' },
  ar: { pull: 'اسحب للتحديث', release: 'أفلت للتحديث', refreshing: 'جارٍ التحديث', done: 'تم التحديث', failed:'تعذر التحديث. حاول مرة أخرى.' },
  fr: { pull: 'Tirez pour actualiser', release: 'Relâchez pour actualiser', refreshing: 'Actualisation', done: 'Mis à jour', failed:'Actualisation impossible. Réessayez.' },
  pt: { pull: 'Puxe para atualizar', release: 'Solte para atualizar', refreshing: 'Atualizando', done: 'Atualizado', failed:'Não foi possível atualizar. Tente novamente.' },
}
