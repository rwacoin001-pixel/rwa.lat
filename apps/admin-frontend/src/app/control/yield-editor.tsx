'use client'

import { useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  bpsToPctString,
  computePreview,
  formatUsdt,
  PAYOUT_FREQUENCY_LABELS,
  PAYOUT_MODE_LABELS,
  pctToBps,
  RATE_TYPE_LABELS,
  type PayoutFrequency,
  type PayoutMode,
  type RateType,
  type YieldTerms,
  type YieldTier,
} from '@/lib/yield-terms'

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-text-faint">{hint}</p>}
    </div>
  )
}

function NumInput({
  label,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string
  suffix?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            const next = e.target.value
            if (/^\d*\.?\d*$/.test(next)) onChange(next)
          }}
          className={suffix ? 'pr-9' : undefined}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-faint">{suffix}</span>}
      </div>
    </Field>
  )
}

export function YieldEditor({ value, onChange }: { value: YieldTerms; onChange: (next: YieldTerms) => void }) {
  const terms = value
  const patch = (p: Partial<YieldTerms>) => onChange({ ...terms, ...p })
  const patchFees = (p: Partial<NonNullable<YieldTerms['fees']>>) => patch({ fees: { ...(terms.fees ?? {}), ...p } })
  const patchEr = (p: Partial<NonNullable<YieldTerms['earlyRedemption']>>) =>
    patch({ earlyRedemption: { ...(terms.earlyRedemption ?? {}), ...p } })
  const rateType: RateType = (terms.rateType as RateType) ?? 'fixed'
  const [exampleAmount, setExampleAmount] = useState('1000')
  const preview = useMemo(() => computePreview(terms, Number(exampleAmount) || 0), [terms, exampleAmount])

  const setTier = (index: number, next: Partial<YieldTier>) => {
    const tiers = [...(terms.tiers ?? [])]
    tiers[index] = { ...tiers[index], ...next }
    patch({ tiers })
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-5">
        {/* 利率类型 */}
        <Field label="利率类型">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(RATE_TYPE_LABELS) as RateType[]).map((rt) => (
              <button
                key={rt}
                type="button"
                onClick={() => patch({ rateType: rt })}
                className={cn(
                  'pill border px-3.5 py-1.5 transition-all',
                  rateType === rt
                    ? 'border-mint/40 bg-mint/12 font-semibold text-mint'
                    : 'border-ink/[0.12] bg-white/60 text-text-secondary hover:bg-white'
                )}
              >
                {RATE_TYPE_LABELS[rt]}
              </button>
            ))}
          </div>
        </Field>

        {rateType === 'fixed' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumInput
              label="年化利率"
              suffix="%"
              placeholder="6.5"
              value={bpsToPctString(terms.annualRateBps)}
              onChange={(v) => patch({ annualRateBps: pctToBps(v) })}
            />
          </div>
        )}

        {rateType === 'floating' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="基准说明">
              <Input
                value={terms.benchmark ?? ''}
                placeholder="例如：USDT 借贷市场利率"
                onChange={(e) => patch({ benchmark: e.target.value })}
              />
            </Field>
            <NumInput
              label="点差"
              suffix="%"
              placeholder="2"
              value={bpsToPctString(terms.spreadBps)}
              onChange={(v) => patch({ spreadBps: pctToBps(v) })}
            />
            <NumInput
              label="保底利率（可选）"
              suffix="%"
              value={bpsToPctString(terms.floorBps)}
              onChange={(v) => patch({ floorBps: pctToBps(v) })}
            />
            <NumInput
              label="封顶利率（可选）"
              suffix="%"
              value={bpsToPctString(terms.capBps)}
              onChange={(v) => patch({ capBps: pctToBps(v) })}
            />
          </div>
        )}

        {rateType === 'tiered' && (
          <div className="rounded-2xl border border-ink/[0.08] bg-white/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">分档利率表（金额为 USDT）</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => patch({ tiers: [...(terms.tiers ?? []), { minAmount: '', maxAmount: '', annualRateBps: 0 }] })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> 添加档位
              </Button>
            </div>
            <div className="space-y-2">
              {(terms.tiers ?? []).length === 0 && <p className="text-xs text-text-faint">还没有档位：如 0–10,000 → 5%，10,000+ → 7%。</p>}
              {(terms.tiers ?? []).map((tier, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_100px_32px] items-center gap-2">
                  <Input
                    placeholder="起（含）"
                    inputMode="decimal"
                    value={tier.minAmount}
                    onChange={(e) => setTier(index, { minAmount: e.target.value.replace(/[^\d.]/g, '') })}
                  />
                  <Input
                    placeholder="止（不含，可空）"
                    inputMode="decimal"
                    value={tier.maxAmount ?? ''}
                    onChange={(e) => setTier(index, { maxAmount: e.target.value.replace(/[^\d.]/g, '') })}
                  />
                  <div className="relative">
                    <Input
                      inputMode="decimal"
                      className="pr-7"
                      value={bpsToPctString(tier.annualRateBps)}
                      onChange={(e) => setTier(index, { annualRateBps: pctToBps(e.target.value) ?? 0 })}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-faint">%</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-negative"
                    onClick={() => patch({ tiers: (terms.tiers ?? []).filter((_, i) => i !== index) })}
                    title="删除档位"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {rateType === 'profit_share' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <NumInput
              label="投资者分成比例"
              suffix="%"
              placeholder="70"
              value={bpsToPctString(terms.investorShareBps, 0)}
              onChange={(v) => patch({ investorShareBps: pctToBps(v) })}
            />
          </div>
        )}

        {/* 期限与付息 */}
        <div className="grid gap-3 sm:grid-cols-3">
          <NumInput
            label="期限（天）"
            placeholder="90"
            value={terms.termDays != null ? String(terms.termDays) : ''}
            onChange={(v) => patch({ termDays: v ? Number(v) : undefined })}
          />
          <Field label="付息频率">
            <Select
              value={terms.payoutFrequency ?? 'monthly'}
              onValueChange={(v) => patch({ payoutFrequency: v as PayoutFrequency })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYOUT_FREQUENCY_LABELS) as PayoutFrequency[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PAYOUT_FREQUENCY_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="付息方式">
            <Select value={terms.payoutMode ?? 'interest'} onValueChange={(v) => patch({ payoutMode: v as PayoutMode })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PAYOUT_MODE_LABELS) as PayoutMode[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PAYOUT_MODE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="结算周期说明">
            <Input
              value={terms.settlementCycle ?? ''}
              placeholder="例如：T+1 到账"
              onChange={(e) => patch({ settlementCycle: e.target.value })}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2.5 text-sm">
            <input
              type="checkbox"
              checked={Boolean(terms.compounding)}
              onChange={(e) => patch({ compounding: e.target.checked })}
              className="h-4 w-4 rounded border-ink/20 accent-[#5b6cf9]"
            />
            复利计息（利息计入本金继续生息）
          </label>
        </div>

        {/* 费率 */}
        <div>
          <p className="mb-3 text-sm font-medium">费用配置</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <NumInput
              label="认购费"
              suffix="%"
              value={bpsToPctString(terms.fees?.subscriptionBps)}
              onChange={(v) => patchFees({ subscriptionBps: pctToBps(v) })}
            />
            <NumInput
              label="管理费/年"
              suffix="%"
              value={bpsToPctString(terms.fees?.managementAnnualBps)}
              onChange={(v) => patchFees({ managementAnnualBps: pctToBps(v) })}
            />
            <NumInput
              label="业绩分成"
              suffix="%"
              value={bpsToPctString(terms.fees?.performanceBps)}
              onChange={(v) => patchFees({ performanceBps: pctToBps(v) })}
            />
            <NumInput
              label="赎回费"
              suffix="%"
              value={bpsToPctString(terms.fees?.redemptionBps)}
              onChange={(v) => patchFees({ redemptionBps: pctToBps(v) })}
            />
          </div>
        </div>

        {/* 提前退出 */}
        <div className="rounded-2xl border border-ink/[0.08] bg-white/50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={Boolean(terms.earlyRedemption?.allowed)}
              onChange={(e) => patchEr({ allowed: e.target.checked })}
              className="h-4 w-4 rounded border-ink/20 accent-[#5b6cf9]"
            />
            允许提前退出
          </label>
          {terms.earlyRedemption?.allowed && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <NumInput
                label="提前退出违约金"
                suffix="%"
                value={bpsToPctString(terms.earlyRedemption?.penaltyBps)}
                onChange={(v) => patchEr({ penaltyBps: pctToBps(v) })}
              />
              <NumInput
                label="锁定期（天）"
                value={terms.earlyRedemption?.lockDays != null ? String(terms.earlyRedemption.lockDays) : ''}
                onChange={(v) => patchEr({ lockDays: v ? Number(v) : undefined })}
              />
            </div>
          )}
        </div>

        {/* 情景与备注 */}
        <div className="grid gap-3 sm:grid-cols-2">
          <NumInput
            label="最坏情景 · 年化（%）"
            suffix="%"
            placeholder="0 或负数"
            value={bpsToPctString(terms.worstCase?.annualizedBps)}
            onChange={(v) => patch({ worstCase: { label: '最坏情景', annualizedBps: pctToBps(v) ?? 0, note: terms.worstCase?.note } })}
          />
          <Field label="最坏情景说明">
            <Input
              value={terms.worstCase?.note ?? ''}
              placeholder="例如：极端情况下可能损失部分本金"
              onChange={(e) => patch({ worstCase: { label: '最坏情景', annualizedBps: terms.worstCase?.annualizedBps ?? 0, note: e.target.value } })}
            />
          </Field>
        </div>

        <Field label="补充说明">
          <textarea
            className="min-h-[84px] w-full rounded-input border border-ink/[0.14] bg-white/70 px-3 py-2 text-sm text-ink shadow-sm placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-2 focus:ring-mint"
            value={terms.notes ?? ''}
            placeholder="收益来源、结算规则补充说明…"
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>
      </div>

      {/* 投资者视角预览 */}
      <div className="h-fit space-y-3 xl:sticky xl:top-4">
        <Card className="border-mint/25 bg-gradient-to-b from-mint/[0.12] to-accent-2/[0.08]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">投资者视角预览</CardTitle>
            <CardDescription>按示例金额试算，仅供运营参考</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="示例投资金额（USDT）">
              <Input
                inputMode="decimal"
                value={exampleAmount}
                onChange={(e) => {
                  if (/^\d*\.?\d*$/.test(e.target.value)) setExampleAmount(e.target.value)
                }}
              />
            </Field>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-text-secondary">年化收益率</dt>
                <dd className="font-semibold tabular-nums">{preview.annualRatePct.toFixed(2)}%</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-text-secondary">年付息次数</dt>
                <dd className="tabular-nums">
                  {preview.periodsPerYear} 期（{PAYOUT_FREQUENCY_LABELS[(terms.payoutFrequency ?? 'at_maturity') as PayoutFrequency]}）
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-text-secondary">每期收益</dt>
                <dd className="tabular-nums">{formatUsdt(preview.perPeriodGross)} USDT</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-text-secondary">期限内收益</dt>
                <dd className="tabular-nums">{formatUsdt(preview.termInterest)} USDT</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-text-secondary">费用合计</dt>
                <dd className="tabular-nums">{formatUsdt(preview.entryFee + preview.managementFee + preview.redemptionFee)} USDT</dd>
              </div>
              <div className="flex items-center justify-between border-t border-ink/[0.08] pt-2">
                <dt className="font-medium">到期净额</dt>
                <dd className="font-semibold tabular-nums text-mint">{formatUsdt(preview.netAtMaturity)} USDT</dd>
              </div>
              {preview.worstCaseAnnualPct != null && (
                <div className="flex items-center justify-between text-negative">
                  <dt>最坏情景年化</dt>
                  <dd className="tabular-nums">{preview.worstCaseAnnualPct.toFixed(2)}%</dd>
                </div>
              )}
            </dl>
            <p className="text-[11px] leading-relaxed text-text-faint">
              提示：预计收益必须同时对外展示费用、期限、退出限制与最坏情景（与增长计划的合规要求一致）。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
