import { notFound } from 'next/navigation'
import HomeCardPreview from '@/components/dev/HomeCardPreview'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <HomeCardPreview />
}
