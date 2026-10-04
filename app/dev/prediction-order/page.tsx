import { notFound } from 'next/navigation'
import PredictionOrderPreview from '@/components/dev/PredictionOrderPreview'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <PredictionOrderPreview />
}
