import { statusBadge, type StatusDomain } from '@/lib/api/_status'
export function StatusBadge({ domain, state }: { domain: StatusDomain; state?: string | null }) {
  const badge = statusBadge(domain, state)
  return <span className="rwa-status" data-tone={badge.tone}>{badge.label}</span>
}
