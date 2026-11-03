import { redirect } from 'next/navigation'

// The old overview became Today (work queues first).
export default function DashboardPage() {
  redirect('/today')
}
