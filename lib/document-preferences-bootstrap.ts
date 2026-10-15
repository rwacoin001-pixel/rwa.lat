import { localeOptions } from './app-locales'

export const themeColors = {
  light: '#F4F1EA',
  dark: '#0A0B0D',
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
  const authRoute = /^\\/(login|register|verify-email|recovery)(\\/|$)/.test(location.pathname);
  const color = authRoute ? (theme === 'dark' ? '#070c16' : '#efe4d4') : (theme === 'dark' ? '${themeColors.dark}' : '${themeColors.light}');
  root.style.setProperty('--page-chrome-color', color);
  root.style.backgroundColor = color;
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => { meta.content = color; meta.removeAttribute('media'); });

  const directions = ${localeDirections};
  const locale = typeof savedLocale === 'string' && Object.prototype.hasOwnProperty.call(directions, savedLocale)
    ? savedLocale
    : Object.prototype.hasOwnProperty.call(directions, root.lang) ? root.lang : 'en';
  root.lang = locale;
  root.dir = directions[locale];

  // The home photo is a CSS background, so the browser would only find it once the home screen's code has run.
  // Start it now, for the theme that will show.
  if (location.pathname === '/home' || location.pathname === '/home/') {
    const hero = document.createElement('link');
    hero.rel = 'preload';
    hero.as = 'image';
    hero.href = theme === 'dark' ? '/media/home/hero-cool.webp' : '/media/home/hero-day-from-cool-v2.webp';
    hero.setAttribute('fetchpriority', 'high');
    document.head.appendChild(hero);
  }
})();`
