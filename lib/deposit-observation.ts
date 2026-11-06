type Activity = { id: string; kind: string; state: string }
/** null means history has not loaded; an empty object means a loaded, empty history. */
export function captureDepositBaseline(activity: readonly Activity[] | undefined): Record<string, string> | null {
  return activity === undefined ? null : Object.fromEntries(activity.filter(item => item.kind === 'deposit').map(item => [item.id, item.state]))
}
export function isObservedDepositChange(baseline: Record<string, string> | null, activity: Activity): boolean {
  return baseline !== null && activity.kind === 'deposit' && baseline[activity.id] !== activity.state
}
