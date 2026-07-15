// 数据脱敏纯函数集（DB-007）：用于日志、审计导出、运营后台展示时遮蔽 PII。
// 不依赖任何外部服务，便于单元测试与复用。

/** 邮箱脱敏：保留首字符与域名，其余 local 段全 *。a***@example.com */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***'
  const [local, domain] = email.split('@')
  if (local.length <= 1) return `***@${domain}`
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 1))}@${domain}`
}

/** 手机号脱敏：保留前 3 后 4，中间 *；国际前缀（+86 等）原样保留。+86 138****8000 */
export function maskPhone(phone: string): string {
  let prefix = ''
  let rest = phone
  const m = phone.match(/^(\+\d{1,3})\s*(.*)$/)
  if (m) {
    prefix = `${m[1]} `
    rest = m[2]
  }
  const digits = rest.replace(/\D/g, '')
  if (digits.length < 7) return '***'
  return `${prefix}${digits.slice(0, 3)}****${digits.slice(-4)}`
}

/** 姓名脱敏：中文保留姓，英文保留首字母。张* / J*** Doe */
export function maskName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '***'
  // 含非 ASCII（中文等）按"姓 + *"处理
  if (/[^\x00-\x7F]/.test(trimmed)) {
    return `${trimmed[0]}*`
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    const p = parts[0]
    return p.length <= 1 ? '***' : `${p[0]}${'*'.repeat(p.length - 1)}`
  }
  const first = `${parts[0][0]}${'*'.repeat(Math.max(1, parts[0].length - 1))}`
  const last = `${parts[parts.length - 1][0]}${'*'.repeat(Math.max(1, parts[parts.length - 1].length - 1))}`
  return `${first} ${last}`
}

/** 银行卡/账号脱敏：仅显示后 4 位。************1234 */
export function maskAccount(account: string): string {
  const digits = account.replace(/\D/g, '')
  if (digits.length <= 4) return '***'
  return `*`.repeat(digits.length - 4) + digits.slice(-4)
}

/** 通用脱敏：超过 keep 长度时首尾保留各 keep/2 字符，中间 *。 */
export function maskGeneric(value: string, keep = 4): string {
  if (!value) return '***'
  if (value.length <= keep) return '*'.repeat(value.length)
  const head = Math.ceil(keep / 2)
  const tail = Math.floor(keep / 2)
  return `${value.slice(0, head)}${'*'.repeat(value.length - keep)}${value.slice(-tail)}`
}

/** 判断是否需要脱敏（简单 PII 探测，供调用方决定是否遮蔽）。 */
export function looksLikePII(value: string): boolean {
  return /@/.test(value) || /^\+?\d{7,}$/.test(value.replace(/\D/g, ''))
}
