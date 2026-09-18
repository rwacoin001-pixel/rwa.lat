'use client'

import Link from 'next/link'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { PageHeader, PendingModule } from '@/components/console/framework'

export default function AppealsPage() {
  return (
    <AdminLayout>
      <div className="space-y-5">
        <PageHeader title="申诉处理" subtitle="用户申诉受理与复核" />
        <PendingModule
          title="申诉通道建设中"
          subtitle="独立的用户申诉管理模块尚未接入后端流程。当前可用的替代路径："
          points={[
            'KYC 认证被驳回的用户复核：通过「KYC 审核」查看档案状态，复核在认证服务商（Didit）处执行',
            '一般类用户诉求（含对处理结果的异议）：通过「客服工单」受理与回复，工单已接通真实数据',
            '涉及资金操作异议：留存工单凭证，配合「账本明细」与「对账中心」核查流水',
          ]}
          actions={
            <>
              <Link href="/support" className="rounded-xl bg-mint px-4 py-2 text-sm font-medium text-white shadow-pill transition-all hover:brightness-110">
                前往客服工单
              </Link>
              <Link href="/kyc" className="rounded-xl bg-white px-4 py-2 text-sm font-medium ring-1 ring-ink/10 transition-colors hover:bg-ink/5">
                前往 KYC 审核
              </Link>
            </>
          }
        />
      </div>
    </AdminLayout>
  )
}
