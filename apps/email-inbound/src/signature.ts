export async function signInbound(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> {
  if (secret.length < 32) throw new Error('INBOUND_EMAIL_SECRET must contain at least 32 characters')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`))
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
  return `t=${timestamp},v1=${hex}`
}
