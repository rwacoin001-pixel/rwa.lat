// Engraved rosette, as on banknotes and bank cards: a family of offset epitrochoids, computed once.
function rosette(): string[] {
  const paths: string[] = []
  const cx = 100, cy = 100
  for (let ring = 0; ring < 14; ring++) {
    const R = 46 + ring * 3.2, r = 9 + ring * 0.35, d = 24 - ring * 0.6, phase = ring * 0.11
    let path = ''
    for (let step = 0; step <= 720; step++) {
      const a = (step / 720) * Math.PI * 2
      const k = (R + r) / r
      const x = cx + (R + r) * Math.cos(a + phase) - d * Math.cos(k * a + phase)
      const y = cy + (R + r) * Math.sin(a + phase) - d * Math.sin(k * a + phase)
      path += `${step ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    }
    paths.push(path + 'Z')
  }
  return paths
}
const PATHS = rosette()

export function Guilloche({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    {PATHS.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={i % 3 ? 0.18 : 0.32} />)}
  </svg>
}
