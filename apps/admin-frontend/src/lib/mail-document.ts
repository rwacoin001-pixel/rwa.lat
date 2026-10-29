/** Defense in depth: the API supplies allow-listed HTML; this document has an opaque origin. */
export function mailDocument(html: string, loadImages = false): string {
  const images = loadImages ? 'https:' : "'none'"
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${images}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><meta name="referrer" content="no-referrer"><style>body{font:14px/1.65 system-ui,sans-serif;color:#141830;overflow-wrap:anywhere;margin:12px}img{max-width:100%;height:auto}table{max-width:100%}pre{white-space:pre-wrap}</style></head><body>${html}</body></html>`
}
