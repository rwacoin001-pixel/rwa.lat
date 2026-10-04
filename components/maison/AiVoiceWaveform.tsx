'use client'
import s from './ai-composer.module.css'

// Recognition activity, not an amplitude meter: Web Speech does not expose its microphone stream.
// Opening another getUserMedia stream here interrupts the Android recognizer on some devices.
export default function AiVoiceWaveform({ active, speaking = false }: { active: boolean; speaking?: boolean }) {
  return <div className={s.waveform} aria-hidden="true" data-speaking={active && speaking || undefined}>
    <span className={s.waveActivity}>{Array.from({ length: 27 }, (_, index) => <i key={index}/>)}</span>
  </div>
}
