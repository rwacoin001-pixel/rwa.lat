/** What the AI mark shows: resting, listening to the user, waiting on the model, or speaking an answer. */
export type PearlState = 'idle' | 'listening' | 'thinking' | 'speaking'

/**
 * One state for the assistant's surface (pearl + composer), derived from the raw flags in a fixed priority order.
 * Every visual decision reads this value, so two indicators can never disagree (a listening bar under a thinking
 * pearl, a send button during transcription).
 *
 *   unavailable   service off or still checking             composer dimmed, pearl idle
 *   busy          waiting for an answer                     stop button, rim arc, pearl thinking
 *   transcribing  released, recogniser finishing            bar "正在识别…", pearl thinking
 *   cancelArmed   holding, slid up past the threshold       bar red "松开取消", words struck, pearl cancel tone
 *   listening     holding, engine hearing                   bar accent "松开发送，上滑取消", words live, pearl listening
 *   connecting    holding, engine not ready yet             bar outlined "正在连接麦克风…", pearl thinking
 *   voiceReady    voice mode, not holding                   bar "按住说话", pearl idle
 *   attaching     reading a file                            progress replaces send, pearl idle
 *   composing     a draft exists                            send button, pearl idle
 *   focused       keyboard up, empty draft                  suggestions hide, pearl idle
 *   idle          resting                                   suggestions show, pearl idle
 */
export type SurfaceState = 'unavailable' | 'busy' | 'transcribing' | 'cancelArmed' | 'listening' | 'connecting' | 'voiceReady' | 'attaching' | 'composing' | 'focused' | 'idle'

export type SurfaceInput = {
  available: boolean; busy: boolean; voiceMode: boolean
  voicePhase: 'idle' | 'connecting' | 'listening' | 'processing'; cancelled: boolean
  reading: boolean; hasDraft: boolean; focused: boolean
}

export function surfaceState(i: SurfaceInput): SurfaceState {
  if (!i.available) return 'unavailable'
  if (i.busy) return 'busy'
  if (i.voicePhase === 'processing') return 'transcribing'
  if (i.voicePhase === 'listening' || i.voicePhase === 'connecting') return i.cancelled ? 'cancelArmed' : i.voicePhase
  if (i.voiceMode) return 'voiceReady'
  if (i.reading) return 'attaching'
  if (i.hasDraft) return 'composing'
  return i.focused ? 'focused' : 'idle'
}

export const pearlFor = (state: SurfaceState): PearlState =>
  state === 'listening' || state === 'cancelArmed' ? 'listening'
    : state === 'busy' || state === 'transcribing' || state === 'connecting' ? 'thinking'
      : 'idle'

/** States in which the reader is holding the bar (or has just let go) and the recognised words are the subject. */
export const isVoiceActive = (state: SurfaceState) => state === 'connecting' || state === 'listening' || state === 'cancelArmed' || state === 'transcribing'

/** Suggestions are an offer for an empty, resting surface only; anything the reader starts doing removes them. */
export const showsSuggestions = (state: SurfaceState) => state === 'idle'

type BarCopy = { hold: string; preparing: string; release: string; cancel: string; transcribing: string }
export function holdLabel(state: SurfaceState, v: BarCopy) {
  return state === 'transcribing' ? v.transcribing : state === 'cancelArmed' ? v.cancel : state === 'connecting' ? v.preparing : state === 'listening' ? v.release : v.hold
}
