import { notFound } from 'next/navigation'
import LoadingPreview from '@/components/dev/LoadingPreview'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <LoadingPreview />
}
