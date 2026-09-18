'use client'

import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, PendingModule } from '@/components/console/framework'

export default function RegionsPage() {
  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader title="地区配置" subtitle="地区合规策略与功能可用性" />
        <PendingModule
          title="地区策略管理界面规划中"
          subtitle="地区合规策略当前由工程侧配置（代码内置策略 + 评估引擎），管理界面尚未接入。"
          points={[
            '策略引擎：合规模块内置地区政策（region policy）与产品范围评估，用户侧自动生效',
            '评估记录：每次评估结论写入「适当性评估」，可查看用户的产品范围结论与理由',
            '需求入口：如需要运营侧自助调整地区策略（新增受限地区、调整产品范围），告知后可排期开发',
          ]}
          actions={
            <Link href="/eligibility" className="rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110">
              查看适当性评估记录
            </Link>
          }
        />
      </div>
    </AdminLayout>
  )
}
