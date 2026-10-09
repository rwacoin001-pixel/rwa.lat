import { SupportWorkspace, type TicketCategory } from '@/components/support-workspace'

/* 与后端 user-ops.dto.ts 的 category 枚举一致；未知值回到“全部” */
const CATEGORIES: TicketCategory[] = ['support', 'appeal', 'dispute', 'scam_report']

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).category
  const value = Array.isArray(raw) ? raw[0] : raw
  const category = CATEGORIES.find((item) => item === value) ?? ''
  return <SupportWorkspace initialCategory={category} />
}
