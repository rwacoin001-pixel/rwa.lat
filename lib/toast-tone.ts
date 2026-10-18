export type ToastTone = 'ok' | 'error' | 'info'

// Most callers just pass a sentence. Failure wording (all seven languages) gets the alert look; anything else is
// neutral. Success is only ever shown when the caller says so, never guessed.
const FAILURE = /失败|错误|出错|无法|不能|未能|不可用|已过期|请重试|稍后再试|error|fail|unable|could not|couldn't|invalid|denied|expired|unavailable|try again|error|fallo|no se pudo|échec|impossible|falha|não foi possível|विफल|त्रुटि|فشل|خطأ|تعذر/i

export function toastTone(message: string): ToastTone {
  return FAILURE.test(message) ? 'error' : 'info'
}
