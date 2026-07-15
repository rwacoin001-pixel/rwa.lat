/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#000000',
        glass: 'rgba(12, 16, 20, 0.62)',
        'glass-strong': 'rgba(18, 23, 28, 0.76)',
        hairline: 'rgba(255, 255, 255, 0.12)',
        'glass-rim': 'rgba(218, 239, 255, 0.58)',
        text: '#F5F7F8',
        'text-secondary': '#929AA6',
        'text-faint': '#626A75',
        mint: '#2FE6BF',
        ice: '#C5E3F7',
        positive: '#2FE6BF',
        negative: '#FF627A',
        'medium-risk': '#7589FF',
        'high-risk': '#FFAD3D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      borderRadius: {
        'glass': '24px',
        'card': '16px',
        'button': '12px',
        'input': '10px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.05) inset',
        'glass-hover': '0 12px 40px rgba(0, 0, 0, 0.4), 0 2px 0 rgba(255, 255, 255, 0.08) inset',
      },
      backdropBlur: {
        'glass': '24px',
      },
      transitionDuration: {
        'fast': '120ms',
        'normal': '220ms',
        'slow': '320ms',
      },
    },
  },
  plugins: [],
};