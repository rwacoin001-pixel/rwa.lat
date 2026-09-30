import { notFound } from 'next/navigation'
import { UiLab } from '@/components/dev/UiLab'
export default function Page() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <UiLab />
}
