import { localeOptions } from './app-locales'

export const themeColors = {
  light: '#F4F1EA',
  dark: '#0A0B0D',
} as const

// Page colours of the palette A preview (styles/palette-a.css).
export const paletteAColors = {
  light: '#F5F6F8',
  dark: '#0A0C10',
} as const

const localeDirections = JSON.stringify(
  Object.fromEntries(localeOptions.map(({ code, direction }) => [code, direction])),
)

// Keep this script static and allowlist every value read from browser storage.
// It runs in <head> so the document has the right theme and locale before paint.
export const documentPreferencesBootstrap = `(() => {
  const root = document.documentElement;
  let savedTheme = null;
  let savedLocale = null;
  try {
    savedTheme = localStorage.getItem('rwa.theme');
    if (savedTheme === null) savedTheme = localStorage.getItem('rwa-app-theme');
    savedLocale = localStorage.getItem('rwa-language');
  } catch {}

  let prefersDark = false;
  try {
    prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {}

  const theme = savedTheme === 'light' || savedTheme === 'dark'
    ? savedTheme
    : prefersDark ? 'dark' : 'light';
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  // Colour preview (palette A, cool white + brand green): opt in with ?palette=a, back to normal with ?palette=off.
  // Only this device sees it; everyone else keeps the current colours.
  let palette = null;
  try {
    const asked = new URLSearchParams(location.search).get('palette');
    if (asked === 'a') localStorage.setItem('rwa.palette', 'a');
    else if (asked === 'off') localStorage.removeItem('rwa.palette');
    palette = localStorage.getItem('rwa.palette') === 'a' ? 'a' : null;
  } catch {}
  if (palette) root.dataset.palette = palette;

  const authRoute = /^\\/(login|register|verify-email|recovery)(\\/|$)/.test(location.pathname);
  const color = palette ? (theme === 'dark' ? '${paletteAColors.dark}' : '${paletteAColors.light}') : authRoute ? (theme === 'dark' ? '#070c16' : '#efe4d4') : (theme === 'dark' ? '${themeColors.dark}' : '${themeColors.light}');
  root.style.setProperty('--page-chrome-color', color);
  root.style.backgroundColor = color;
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => { meta.content = color; meta.removeAttribute('media'); });

  const directions = ${localeDirections};
  const locale = typeof savedLocale === 'string' && Object.prototype.hasOwnProperty.call(directions, savedLocale)
    ? savedLocale
    : Object.prototype.hasOwnProperty.call(directions, root.lang) ? root.lang : 'en';
  root.lang = locale;
  root.dir = directions[locale];

  // Opened as the installed app (Home Screen web app or the Android client): the launch screen in the layout shows
  // from the first frame, and a signed-out launch goes straight to sign-in instead of loading home first (home
  // requires sign-in, so it would only redirect there after its code had loaded).
  let installed = false;
  try {
    installed = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches
      || matchMedia('(display-mode: fullscreen)').matches || navigator.userAgent.includes('RwaLatAndroidTrial/');
  } catch {}
  if (installed) {
    root.dataset.launch = 'app';
    // The Android client's WebView: lighter compositing (globals.css) keeps scrolling smooth on mid-range phones.
    try { if (navigator.userAgent.includes('RwaLatAndroidTrial/')) root.dataset.shell = 'android'; } catch {}
    if (location.pathname === '/' || location.pathname === '/home' || location.pathname === '/home/') {
      let signedIn = true;
      try { signedIn = Boolean(localStorage.getItem('rwa.session')); } catch {}
      if (!signedIn) { location.replace('/login'); return; }
    }
  }

  // The home photo is a CSS background, so the browser would only find it once the home screen's code has run.
  // Start it now, for the theme that will show.
  if (location.pathname === '/home' || location.pathname === '/home/') {
    const hero = document.createElement('link');
    hero.rel = 'preload';
    hero.as = 'image';
    hero.href = palette ? (theme === 'dark' ? '/media/palette-a/hero-dark.webp' : '/media/palette-a/hero-light.webp') : theme === 'dark' ? '/media/home/hero-cool.webp' : '/media/home/hero-day-from-cool-v2.webp';
    hero.setAttribute('fetchpriority', 'high');
    document.head.appendChild(hero);
  }
})();`
