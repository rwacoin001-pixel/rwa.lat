/** Header-only JPEG validator fixture. Never used for visual/model acceptance. */
export function imageFixture() {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 0, 80, 0, 120, ...Array(10).fill(0), 0xff, 0xd9])
  return { name: 'screen.jpg', mime: 'image/jpeg', size: bytes.length, text: '', method: 'image' as const, width: 120, height: 80, dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` }
}
