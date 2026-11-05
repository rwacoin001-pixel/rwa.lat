'use client'

/**
 * A rounded QR (2026-11-05, user: the card's QR should be rounded): the same look as the poster's `drawRoundedQr` —
 * a light rounded plate, soft rounded modules and rounded finder eyes — drawn as SVG so it stays sharp on the card.
 * The module grid is read once from a hidden plain QR canvas (`qrGrid`). Dark modules on a light plate in both themes,
 * three modules of quiet space, so it scans like any QR.
 */
import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { qrGrid } from '@/lib/referral-poster-renderer'

export function RoundQr({ value, size = 84, className, title }: { value: string; size?: number; className?: string; title?: string }) {
  const source = useRef<HTMLCanvasElement>(null)
  const [grid, setGrid] = useState<boolean[][] | null>(null)
  useEffect(() => { if (source.current) setGrid(qrGrid(source.current)) }, [value])
  const n = grid?.length ?? 0, unit = 100 / (n + 6), pad = unit * 3
  const eye = (row: number, col: number) => (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7)
  return <span className={className} style={{ display: 'inline-block', width: size, height: size }}>
    <QRCodeCanvas ref={source} value={value} size={256} marginSize={4} level="M" bgColor="#ffffff" fgColor="#000000" style={{ display: 'none' }} />
    {grid && <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={title} style={{ display: 'block' }}>
      <rect width="100" height="100" rx="14" fill="#f7f8fa" />
      <g fill="#0b1110">
        {grid.flatMap((cells, row) => cells.map((on, col) => on && !eye(row, col)
          ? <rect key={`${row}-${col}`} x={pad + col * unit + unit * .04} y={pad + row * unit + unit * .04} width={unit * .92} height={unit * .92} rx={unit * .38} />
          : null))}
        {([[0, 0], [0, n - 7], [n - 7, 0]] as const).map(([row, col]) => {
          const x = pad + col * unit, y = pad + row * unit
          return <g key={`${row}-${col}`}>
            <path fillRule="evenodd" d={`${roundRect(x, y, unit * 7, unit * 7, unit * 2)} ${roundRect(x + unit, y + unit, unit * 5, unit * 5, unit * 1.3)}`} />
            <rect x={x + unit * 2} y={y + unit * 2} width={unit * 3} height={unit * 3} rx={unit * .9} />
          </g>
        })}
      </g>
    </svg>}
  </span>
}

const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
