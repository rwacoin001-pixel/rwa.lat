export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)'
export const DESKTOP_REDIRECT_URL = 'https://www.capitaland-ascendasreit.com/'

// Runs before paint. Viewport width alone selects the external desktop destination;
// application paths, query parameters and fragments are never forwarded there.
// Narrow windows and embedded previews stay in the app. Legal pages, auth callbacks
// and internal tools remain reachable at every width.
export const desktopRedirectBootstrap = `(function(){try{
var l=location,p=l.pathname;
var excluded=['api','auth','privacy','terms','dev','design-preview','_next'];
var seg=p.split('/')[1]||'';if(excluded.indexOf(seg)>-1)return;
if(window.top!==window.self)return;
var media=window.matchMedia(${JSON.stringify(DESKTOP_MEDIA_QUERY)}),redirected=false;
var update=function(){
if(redirected||excluded.indexOf(l.pathname.split('/')[1]||'')>-1||!media.matches)return;
redirected=true;l.replace(${JSON.stringify(DESKTOP_REDIRECT_URL)});
};
update();
if(media.addEventListener)media.addEventListener('change',update);
else if(media.addListener)media.addListener(update);
}catch(e){}})();`
