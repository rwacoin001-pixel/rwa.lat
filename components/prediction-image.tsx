'use client'

import { useState, type ReactNode } from 'react'
import { predictionImageSources } from '@/lib/prediction-image'

// `fallback` replaces the plain initial once every candidate fails (Logo passes its tinted monogram).
type Props = { src?: string | null; name: string; alt?: string; className?: string; width?: number; height?: number; fallback?: ReactNode }

/** Image with host fallback; renders the name initial once every candidate fails. */
export function PredictionImage(props: Props) {
  // Keyed by src so a new image never inherits a previous failure.
  return <PredictionImageInner key={props.src ?? ''} {...props} />
}

function PredictionImageInner({ src, name, alt = '', className, width, height, fallback }: Props) {
  const sources = predictionImageSources(src)
  const [index, setIndex] = useState(0)
  const current = sources[index]
  if (!current && fallback !== undefined) return <>{fallback}</>
  if (!current) return className ? <span className={className} style={{ display: 'grid', placeItems: 'center', width, height }}>{(name.trim()[0] ?? '·').toUpperCase()}</span> : <>{(name.trim()[0] ?? '·').toUpperCase()}</>
  return <img className={className} src={current} alt={alt} width={width} height={height} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setIndex(i => i + 1)} />
}
