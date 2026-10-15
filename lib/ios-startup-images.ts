/** iOS launch images (public/startup): one per iPhone screen size and theme, generated with the same 112px centred icon as the
 *  in-page launch screen, so iOS's image hands over to the page without a jump. Portrait only (the app is portrait).
 *  No "@" in the file names: the static asset host redirects it to %40, and iOS should not need a redirect at launch. */
const sizes: [number, number, number][] = [
  [440, 956, 3],
  [430, 932, 3],
  [428, 926, 3],
  [420, 912, 3],
  [414, 896, 3],
  [414, 896, 2],
  [414, 736, 3],
  [402, 874, 3],
  [393, 852, 3],
  [390, 844, 3],
  [375, 812, 3],
  [375, 667, 2],
]

export const iosStartupImages = sizes.flatMap(([width, height, ratio]) => (['light', 'dark'] as const).map(theme => ({
  url: `/startup/a-reit-${width}x${height}-${ratio}x-${theme}.png`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${theme})`,
})))
