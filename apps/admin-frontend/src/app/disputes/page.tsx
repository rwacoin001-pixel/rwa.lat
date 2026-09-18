'use client'

import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, PendingModule } from '@/components/console/framework'

export default function DisputesPage() {
  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader title="争议处理" subtitle="交易与产品争议的受理、取证与裁定" />
        <PendingModule
          title="争议处理模块建设中"
          subtitle="独立的争议/仲裁流程尚未接入。当前可用路径："
          points={[
            '订单类争议：通过「订单管理」核对订单状态与成交记录，通过「客服工单」与用户沟通取证',
            '资金类争议：通过「账本明细」核查账本流水与调整单，必要时走调整单双人审批流程',
            '产品与收益争议：通过「收益管理」「结算管理」核对批次与结算记录',
          ]}
          actions={
            <>
              <Link href="/orders" className="rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110">
                订单管理
              </Link>
              <Link href="/support" className="rounded-xl bg-white px-4 py-2 text-sm font-medium ring-1 ring-ink/10 transition-colors hover:bg-ink/5">
                客服工单
              </Link>
            </>
          }
        />
      </div>
    </AdminLayout>
  )
}
