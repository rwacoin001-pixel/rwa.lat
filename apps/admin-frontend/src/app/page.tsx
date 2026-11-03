import { redirect } from 'next/navigation'

// Signed in: Today. Signed out, proxy.ts sends this to /login?next=/today first.
export default function HomePage() {
  redirect('/today')
}
