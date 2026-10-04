'use client'
import { useEffect, useRef, useState } from 'react'
import type WaveSurfer from 'wavesurfer.js'
import s from './ai-composer.module.css'

/** WaveSurfer's live microphone renderer; no prerecorded/random bars and no audio upload. */
export default function AiVoiceWaveform({ active, cancelled = false }: { active: boolean; cancelled?: boolean }) {
  const container = useRef<HTMLDivElement>(null), wave = useRef<WaveSurfer | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!active || !navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined' || 'RwaNativeVoice' in window) return
    let disposed = false, owned: WaveSurfer | null = null
    setReady(false)
    void Promise.all([import('wavesurfer.js'), import('wavesurfer.js/dist/plugins/record.esm.js')]).then(async ([{ default: WaveSurfer }, { default: Record }]) => {
      if (disposed || !container.current) return
      const color = getComputedStyle(container.current).color
      const renderer = WaveSurfer.create({ container: container.current, height: 76, waveColor: color, progressColor: color, barWidth: 4, barGap: 5, barRadius: 4, barMinHeight: 4, cursorWidth: 0, interact: false, hideScrollbar: true, normalize: false })
      owned = renderer
      wave.current = renderer
      const microphone = renderer.registerPlugin(Record.create({ renderRecordedAudio: false, scrollingWaveform: true, scrollingWaveformWindow: 2.2 }))
      // startMic only monitors the device. Speech recognition owns release/send; no MediaRecorder starts.
      await microphone.startMic({ echoCancellation: true, noiseSuppression: true })
      if (disposed) { renderer.destroy(); return }
      setReady(true)
    }).catch(() => { owned?.destroy(); if (wave.current === owned) wave.current = null; if (!disposed) setReady(false) })
    return () => { disposed = true; owned?.destroy(); if (wave.current === owned) wave.current = null }
  }, [active])
  useEffect(() => { if (container.current && wave.current) { const color = getComputedStyle(container.current).color; wave.current.setOptions({ waveColor: color, progressColor: color }) } }, [cancelled])
  return <div className={s.waveform} aria-hidden="true" data-ready={ready || undefined}>
    <div className={s.waveCanvas} ref={container}/>
    {!ready && <span className={s.waveIdle}>{Array.from({ length: 27 }, (_, index) => <i key={index}/>)}</span>}
  </div>
}
