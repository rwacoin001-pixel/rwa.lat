import { notFound } from 'next/navigation'
import ReferralPosterPreview from '@/components/dev/ReferralPosterPreview'
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ReferralPosterPreview />
}
