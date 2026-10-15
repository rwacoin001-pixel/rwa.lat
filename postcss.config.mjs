/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    // Android client: system bar sizes from the app (see scripts/postcss-native-insets.cjs).
    './scripts/postcss-native-insets.cjs': {},
  },
}

export default config
