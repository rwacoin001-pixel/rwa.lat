import { notFound } from 'next/navigation'
import MobilePolishPreview from '@/components/dev/MobilePolishPreview'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <MobilePolishPreview />
}
