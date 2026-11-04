import { redirect } from 'next/navigation'

// Nothing in the platform raises approval requests (only a manual form did), so the page is retired.
export default function ApprovalsPage() {
  redirect('/today')
}
