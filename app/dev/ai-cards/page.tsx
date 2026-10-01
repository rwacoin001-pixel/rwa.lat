import { notFound } from 'next/navigation'
import AiCardsPreview from '@/components/dev/AiCardsPreview'

export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <AiCardsPreview />
}
