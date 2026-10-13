'use client';

import { useMemo, useState } from 'react';
import { formatAtomic } from '@/lib/money';

/*
 * Funds charts (hand-rolled SVG; no chart dependency). One y-axis per chart:
 *  - FlowsChart: daily credited deposits above the baseline, completed withdrawals below it (same unit).
 *  - BalanceChart: end-of-day user cash, a single series.
 * Series colours are the validated categorical slots 1 and 2 (blue / orange; CVD ΔE 24.7 on light).
 * Text always uses ink tokens; colour only marks identity. Hover shows exact values.
 */

export const SERIES = { deposits: '#2a78d6', withdrawals: '#eb6834' } as const;

export interface FundsDay {
  day: string;
  depositsAtomic: string;
  depositsCount: number;
  withdrawalsAtomic: string;
  withdrawalsCount: number;
  netAtomic: string;
  cashBalanceAtomic: string;
}

const W = 720;
const H = 240;
const PAD = { top: 14, right: 12, bottom: 26, left: 64 };
const usdt = (atomic: string) => Number(atomic) / 1e6;
const money = (atomic: string) => formatAtomic(atomic, 6, { group: true });

/** 1/2/2.5/5 × 10^n tick step so axis labels stay round. */
function niceStep(span: number, target = 3) {
  if (span <= 0) return 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10;
  return unit * power;
}

function compact(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${(value / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return value.toFixed(abs > 0 && abs < 10 ? 1 : 0);
}

const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

/** Bar with 4px rounded data end and a flat end on the baseline. */
function barPath(x: number, width: number, baseline: number, end: number) {
  const height = Math.abs(end - baseline);
  if (height < 0.5) return '';
  const r = Math.min(4, width / 2, height);
  if (end < baseline) {
    return `M${x},${baseline}V${end + r}Q${x},${end} ${x + r},${end}H${x + width - r}Q${x + width},${end} ${x + width},${end + r}V${baseline}Z`;
  }
  return `M${x},${baseline}V${end - r}Q${x},${end} ${x + r},${end}H${x + width - r}Q${x + width},${end} ${x + width},${end - r}V${baseline}Z`;
}

function Tooltip({ x, children }: { x: number; children: React.ReactNode }) {
  const left = `${(x / W) * 100}%`;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-1 z-10 min-w-[168px] -translate-x-1/2 rounded-xl border border-ink/[0.08] bg-white/95 px-3 py-2 text-xs text-ink shadow-glass"
      style={{ left: `clamp(90px, ${left}, calc(100% - 90px))` }}
    >
      {children}
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
}

export function FlowsChart({ series }: { series: FundsDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    const top = Math.max(0, ...series.map((d) => usdt(d.depositsAtomic)));
    const bottom = Math.max(0, ...series.map((d) => usdt(d.withdrawalsAtomic)));
    const step = niceStep(Math.max(top, bottom, 1), 2);
    const max = Math.max(step, Math.ceil(top / step) * step);
    const min = Math.max(step, Math.ceil(bottom / step) * step);
    const plotH = H - PAD.top - PAD.bottom;
    const y = (value: number) => PAD.top + ((max - value) / (max + min)) * plotH;
    const band = (W - PAD.left - PAD.right) / Math.max(series.length, 1);
    const bar = Math.max(2, Math.min(18, band * 0.6));
    const ticks: number[] = [];
    for (let v = -min; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
    return { y, band, bar, ticks, baseline: y(0) };
  }, [series]);
  const empty = series.every((d) => d.depositsCount === 0 && d.withdrawalsCount === 0);
  const labelEvery = Math.ceil(series.length / 8);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Swatch color={SERIES.deposits} />充值入账</span>
        <span className="flex items-center gap-1.5"><Swatch color={SERIES.withdrawals} />提现完成</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="每日充值与提现金额（USDT）">
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? 'rgba(11,11,11,0.35)' : 'rgba(11,11,11,0.07)'} strokeWidth={1} />
              <text x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end" fontSize={11} fill="#52514e">{compact(Math.abs(t))}</text>
            </g>
          ))}
          {series.map((d, i) => {
            const x = PAD.left + i * geo.band + (geo.band - geo.bar) / 2;
            return (
              <g key={d.day}>
                <path d={barPath(x, geo.bar, geo.baseline, geo.y(usdt(d.depositsAtomic)))} fill={SERIES.deposits} opacity={hover === null || hover === i ? 1 : 0.45} />
                <path d={barPath(x, geo.bar, geo.baseline, geo.y(-usdt(d.withdrawalsAtomic)))} fill={SERIES.withdrawals} opacity={hover === null || hover === i ? 1 : 0.45} />
                {i % labelEvery === 0 && <text x={PAD.left + i * geo.band + geo.band / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#52514e">{shortDay(d.day)}</text>}
                <rect x={PAD.left + i * geo.band} y={PAD.top} width={geo.band} height={H - PAD.top - PAD.bottom} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              </g>
            );
          })}
          <text x={W - PAD.right} y={PAD.top + 10} textAnchor="end" fontSize={10} fill="#52514e">↑ 充值</text>
          <text x={W - PAD.right} y={H - PAD.bottom - 4} textAnchor="end" fontSize={10} fill="#52514e">↓ 提现</text>
        </svg>
        {empty && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground">所选区间暂无充值或提现</p>}
        {hover !== null && series[hover] && (
          <Tooltip x={PAD.left + hover * geo.band + geo.band / 2}>
            <p className="font-semibold mb-1">{series[hover].day}</p>
            <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5"><Swatch color={SERIES.deposits} />充值 {series[hover].depositsCount} 笔</span><b>{money(series[hover].depositsAtomic)}</b></p>
            <p className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5"><Swatch color={SERIES.withdrawals} />提现 {series[hover].withdrawalsCount} 笔</span><b>{money(series[hover].withdrawalsAtomic)}</b></p>
            <p className="flex items-center justify-between gap-3 border-t border-ink/[0.08] mt-1 pt-1 text-muted-foreground"><span>净流入</span><b className="text-ink">{money(series[hover].netAtomic)}</b></p>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function BalanceChart({ series }: { series: FundsDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    const values = series.map((d) => usdt(d.cashBalanceAtomic));
    const top = Math.max(1, ...values);
    const step = niceStep(top, 3);
    const max = Math.ceil(top / step) * step;
    const plotH = H - PAD.top - PAD.bottom;
    const y = (value: number) => PAD.top + ((max - value) / max) * plotH;
    const span = W - PAD.left - PAD.right;
    const x = (i: number) => PAD.left + (series.length <= 1 ? span / 2 : (i / (series.length - 1)) * span);
    const points = values.map((v, i) => `${x(i)},${y(v)}`);
    const ticks: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(Number(v.toFixed(6)));
    return { x, y, ticks, line: points.join(' '), area: `${x(0)},${y(0)} ${points.join(' ')} ${x(values.length - 1)},${y(0)}` };
  }, [series]);
  const labelEvery = Math.ceil(series.length / 8);
  const nearest = (clientX: number, rect: DOMRect) => {
    const vx = ((clientX - rect.left) / rect.width) * W;
    const span = W - PAD.left - PAD.right;
    const i = Math.round(((vx - PAD.left) / span) * (series.length - 1));
    return Math.min(series.length - 1, Math.max(0, i));
  };

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="用户现金余额走势（USDT）"
        onMouseMove={(event) => setHover(nearest(event.clientX, event.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setHover(null)}
      >
        {geo.ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? 'rgba(11,11,11,0.35)' : 'rgba(11,11,11,0.07)'} strokeWidth={1} />
            <text x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end" fontSize={11} fill="#52514e">{compact(t)}</text>
          </g>
        ))}
        <polygon points={geo.area} fill={SERIES.deposits} opacity={0.08} />
        <polyline points={geo.line} fill="none" stroke={SERIES.deposits} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {series.map((d, i) => i % labelEvery === 0 && (
          <text key={d.day} x={geo.x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#52514e">{shortDay(d.day)}</text>
        ))}
        {hover !== null && series[hover] && (
          <g>
            <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(11,11,11,0.25)" strokeDasharray="3 3" />
            <circle cx={geo.x(hover)} cy={geo.y(usdt(series[hover].cashBalanceAtomic))} r={4.5} fill={SERIES.deposits} stroke="#fcfcfb" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && series[hover] && (
        <Tooltip x={geo.x(hover)}>
          <p className="font-semibold mb-1">{series[hover].day}</p>
          <p className="flex items-center justify-between gap-3"><span className="text-muted-foreground">日终用户余额</span><b>{money(series[hover].cashBalanceAtomic)}</b></p>
        </Tooltip>
      )}
    </div>
  );
}

/** Same data as the charts, for screen readers, printing and exact reading. */
export function FundsTable({ series }: { series: FundsDay[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b border-ink/[0.08]">
            <th className="py-2 pr-3 font-medium">日期</th>
            <th className="py-2 pr-3 font-medium text-right">充值笔数</th>
            <th className="py-2 pr-3 font-medium text-right">充值金额</th>
            <th className="py-2 pr-3 font-medium text-right">提现笔数</th>
            <th className="py-2 pr-3 font-medium text-right">提现金额</th>
            <th className="py-2 pr-3 font-medium text-right">净流入</th>
            <th className="py-2 font-medium text-right">日终用户余额</th>
          </tr>
        </thead>
        <tbody>
          {[...series].reverse().map((d) => (
            <tr key={d.day} className="border-b border-ink/[0.05] tabular-nums">
              <td className="py-1.5 pr-3">{d.day}</td>
              <td className="py-1.5 pr-3 text-right">{d.depositsCount}</td>
              <td className="py-1.5 pr-3 text-right">{money(d.depositsAtomic)}</td>
              <td className="py-1.5 pr-3 text-right">{d.withdrawalsCount}</td>
              <td className="py-1.5 pr-3 text-right">{money(d.withdrawalsAtomic)}</td>
              <td className="py-1.5 pr-3 text-right">{money(d.netAtomic)}</td>
              <td className="py-1.5 text-right">{money(d.cashBalanceAtomic)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
