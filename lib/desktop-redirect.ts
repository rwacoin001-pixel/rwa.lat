// Runs in <head> before paint. On a desktop (wide, primary fine pointer with hover, not an iPad) every app route
// is replaced by /desktop, carrying the original path so shared links can be handed to a phone via QR.
// Mobile, tablets, narrow windows and the in-page phone preview (iframe) are never redirected.
// Legal pages, auth callbacks and internal tools stay reachable on desktop.
export const desktopRedirectBootstrap = `(function(){try{
var l=location,p=l.pathname;
var seg=p.split('/')[1]||'';if(['desktop','api','auth','privacy','terms','dev','design-preview','_next'].indexOf(seg)>-1)return;
if(window.top!==window.self)return;
var mq=function(q){return window.matchMedia(q).matches};
if(!mq('(min-width: 1024px) and (hover: hover) and (pointer: fine)'))return;
if(/iPad|Android|Mobi/i.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1))return;
var f=p+l.search+l.hash;
l.replace('/desktop'+(f==='/'?'':'?from='+encodeURIComponent(f)));
}catch(e){}})();`
