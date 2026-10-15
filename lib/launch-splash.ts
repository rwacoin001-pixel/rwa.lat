/**
 * The installed app's launch screen: the app icon on the page colour, server-rendered so it is on screen from the
 * first frame instead of a blank surface while the app's code loads. It shows only when the head bootstrap has
 * marked the document `data-launch="app"` (Home Screen web app or the Android client), never in a browser tab.
 *
 * It leaves as soon as the first real screen has rendered, i.e. once no `[data-app-loading]` placeholder is left
 * (the entry and lazy screens all render AppLoading while their code loads), with an 8s safety stop. This replaces
 * the fixed 1.24s logo animation that used to play after the code had loaded, which on Android was a second splash
 * after the system's own.
 *
 * Geometry matches the iOS startup images in public/startup: a 112px icon centred on the full screen.
 */
export const LAUNCH_ICON_SIZE = 112

// State lives on <html> (data-launch-state: "leaving" | "gone"), never in this element: React owns the element's
// container and may recreate it during hydration, but it leaves <html> attributes alone (the theme bootstrap relies
// on the same), so a recreated splash still follows the state and cannot get stuck on screen.
export const launchSplashStyle = `#launch-splash{display:none}
html[data-launch="app"]:not([data-launch-state="gone"]) #launch-splash{display:grid;place-items:center;position:fixed;inset:0;z-index:2147483000;background:var(--page-chrome-color,#F4F1EA);transition:opacity .28s ease}
html[data-launch-state="leaving"] #launch-splash{opacity:0;pointer-events:none}
#launch-splash img{width:${LAUNCH_ICON_SIZE}px;height:${LAUNCH_ICON_SIZE}px;display:block}
@media (prefers-reduced-motion:reduce){html[data-launch="app"] #launch-splash{transition:none}}`

export const launchSplashMarkup = `<div id="launch-splash" aria-hidden="true"><img src="/icons/a-reit-v1-512.png" width="${LAUNCH_ICON_SIZE}" height="${LAUNCH_ICON_SIZE}" alt="" decoding="sync" fetchpriority="high"></div>`

export const launchSplashScript = `(() => {
  const root = document.documentElement;
  if (root.dataset.launch !== 'app') return;
  let done = false;
  let observer = null;
  const leave = () => {
    if (done) return;
    done = true;
    if (observer) observer.disconnect();
    root.dataset.launchState = 'leaving';
    setTimeout(() => { root.dataset.launchState = 'gone'; }, 320);
  };
  const check = () => { if (document.readyState !== 'loading' && !document.querySelector('[data-app-loading]')) leave(); };
  document.addEventListener('DOMContentLoaded', () => {
    check();
    if (done) return;
    observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
  });
  setTimeout(leave, 8000);
})();`
