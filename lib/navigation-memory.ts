export type ViewportPosition = { x: number; y: number; panel: number }
export function mergeDisplayPage<T extends { id: string }>(previous: T[], incoming: T[], offset: number): T[] {
  const updates = new Map(incoming.map(item => [item.id, item]))
  const retained = offset === 0 ? previous.slice(incoming.length) : previous
  if (offset === 0) return [...incoming, ...retained.filter(item => !updates.has(item.id))]
  const seen = new Set(previous.map(item => item.id))
  return [...previous.map(item => updates.get(item.id) ?? item), ...incoming.filter(item => !seen.has(item.id))]
}
/** Bounded, session-only display state. Never store order intents or credentials here. */
export class NavigationMemory {
  private entries = new Map<string, { position?: ViewportPosition; ui: Map<string, unknown> }>()
  constructor(private limit = 40) {}
  private entry(id: string) {
    let value = this.entries.get(id)
    if (!value) {
      value = { ui: new Map() }
      this.entries.set(id, value)
      if (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!)
    }
    return value
  }
  savePosition(id: string, position: ViewportPosition) { this.entry(id).position = { ...position } }
  position(id: string) { return this.entries.get(id)?.position }
  save<T>(id: string, key: string, value: T) { this.entry(id).ui.set(key, value) }
  read<T>(id: string, key: string): T | undefined { return this.entries.get(id)?.ui.get(key) as T | undefined }
  clear() { this.entries.clear() }
}
