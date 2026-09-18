'use client'

import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, PendingModule } from '@/components/console/framework'

export default function ListingsPage() {
  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader title="资产目录" subtitle="对外上架产品的目录管理" />
        <PendingModule
          title="产品目录管理在「运营控制」"
          subtitle="对外产品的上架/下架/版本与披露已具备完整管理能力，入口位于「运营控制」页："
          points={[
            '产品管理：创建产品、编辑信息、状态流转（草稿 → 发布 → 停牌 → 退役）',
            '价格与披露：为产品添加价格报价、上传风险披露与条款文件',
            '分类联动：产品归属资产类别（asset class），与 RWA 目录评分体系互补',
            '本页未来将提供「目录视角」的聚合视图（产品 × 评分 × 持有人数）；如需要请告知排期',
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
