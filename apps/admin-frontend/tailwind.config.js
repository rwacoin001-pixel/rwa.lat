/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── surfaces（浅色玻璃主题）─────────────────────────────
        canvas: '#eef1fb',
        glass: 'rgba(255, 255, 255, 0.50)',
        'glass-strong': 'rgba(255, 255, 255, 0.72)',
        hairline: 'rgba(20, 24, 48, 0.08)',
        'glass-rim': 'rgba(255, 255, 255, 0.85)',
        // ── text ───────────────────────────────────────────────
        ink: '#141830',
        text: '#1a2142',
        'text-secondary': '#5d6788',
        'text-faint': '#98a0bb',
        foreground: '#1a2142',
        background: '#eef1fb',
        muted: '#e7ebf8',
        'muted-foreground': '#6b7494',
        border: '#dfe4f4',
        ring: '#5b6cf9',
        destructive: '#e5484d',
        // ── accents（FundFlow 蓝紫系）──────────────────────────
        mint: '#5b6cf9',
        'accent-2': '#8b5cf6',
        ice: '#7c9cf9',
        positive: '#16b364',
        negative: '#e5484d',
        'medium-risk': '#7589ff',
        'high-risk': '#e8a13c',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      borderRadius: {
        glass: '26px',
        card: '20px',
        button: '9999px',
        input: '12px',
      },
      boxShadow: {
        glass: '0 10px 34px rgba(64, 84, 164, 0.14), 0 1px 0 rgba(255, 255, 255, 0.75) inset',
        'glass-hover': '0 16px 44px rgba(64, 84, 164, 0.20), 0 1px 0 rgba(255, 255, 255, 0.85) inset',
        pill: '0 2px 10px rgba(20, 24, 48, 0.20)',
      },
      backdropBlur: {
        glass: '28px',
      },
      transitionDuration: {
        fast: '120ms',
        normal: '220ms',
        slow: '320ms',
      },
    },
  },
  plugins: [],
};
