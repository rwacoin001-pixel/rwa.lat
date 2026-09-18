'use client'

import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, PendingModule } from '@/components/console/framework'

export default function PricingPage() {
  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader title="定价管理" subtitle="产品价格与估值来源" />
        <PendingModule
          title="定价操作在「运营控制」"
          subtitle="产品价格报价已具备管理能力，入口位于「运营控制」页的产品详情："
          points={[
            '价格报价：为产品添加/查看价格报价（含来源、有效期），最新报价驱动订单与估值',
            'RWA 目录行情：外部资产行情由 CMC 同步管线自动更新（无需人工定价）',
            '本页未来将提供「定价视图」的聚合页（跨产品价格一览、异常价格预警）；如需要请告知排期',
          ]}
          actions={
            <Link href="/control" className="rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110">
              前往运营控制
            </Link>
          }
        />
      </div>
    </AdminLayout>
  )
}
