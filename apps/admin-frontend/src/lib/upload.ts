import { adminApi, type PresignUploadInput, type StoredObject } from './admin-api'

export function guessContentType(file: File): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.txt')) return 'text/plain'
  return 'application/octet-stream'
}

export async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type UploadPhase = 'hashing' | 'uploading' | 'verifying'

/**
 * 完整上传流程：浏览器计算 SHA-256 → 请求预签名 → 直传对象存储 → 完成校验（+基础扫描）。
 */
export async function uploadToStorage(
  file: File,
  options: {
    bucket: PresignUploadInput['bucket']
    purpose?: PresignUploadInput['purpose']
    productId?: string
    onProgress?: (phase: UploadPhase) => void
  }
): Promise<StoredObject> {
  const contentType = guessContentType(file)
  options.onProgress?.('hashing')
  const checksumSha256 = await sha256Hex(file)

  const presign = await adminApi.presignUpload({
    bucket: options.bucket,
    fileName: file.name,
    contentType,
    expectedSizeBytes: file.size,
    checksumSha256,
    purpose: options.purpose,
    productId: options.productId,
  })

  options.onProgress?.('uploading')
  const put = await fetch(presign.presignedUrl, {
    method: 'PUT',
    headers: presign.requiredHeaders,
    body: file,
  })
  if (!put.ok) {
    const text = await put.text().catch(() => '')
    throw new Error(`文件直传失败（HTTP ${put.status}）${text ? `：${text.slice(0, 200)}` : ''}`)
  }

  options.onProgress?.('verifying')
  const completed = await adminApi.completeUpload({ presignedId: presign.presignedId, sizeBytes: file.size })
  return completed
}
