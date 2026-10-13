'use client';

import { useMemo, useState } from 'react';

/*
 * Activity charts (hand-rolled SVG, no chart dependency). All series are counts of people, so they share
 * one y-axis. Colours are categorical slots 1–3 (blue / orange / aqua; validated: CVD ΔE ≥ 9.2). Aqua sits
 * below 3:1 contrast on the light surface, so every series is also direct-labelled at its last point and
 * the page offers a table view.
 */

export interface SeriesSpec<T> {
  key: string;
  label: string;
  color: string;
  value: (row: T) => number;
}

const W = 720;
const H = 240;
const PAD = { top: 16, right: 92, bottom: 26, left: 44 };

function niceStep(span: number, target = 3) {
  if (span <= 0) return 1;
  const raw = span / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].find((m) => m * power >= raw) ?? 10;
  return Math.max(1, unit * power);
}

const shortDay = (day: string) => `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`;

function Swatch({ color }: { color: string }) {
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />;
}

export function MultiLineChart<T extends { day: string }>({ rows, series, label }: { rows: T[]; series: SeriesSpec<T>[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const geo = useMemo(() => {
    const top = Math.max(1, ...rows.flatMap((row) => series.map((s) => s.value(row))));
    const step = niceStep(top, 3);
    const max = Math.ceil(top / step) * step;
    const plotH = H - PAD.top - PAD.bottom;
    const y = (value: number) => PAD.top + ((max - value) / max) * plotH;
    const span = W - PAD.left - PAD.right;
    const x = (i: number) => PAD.left + (rows.length <= 1 ? span / 2 : (i / (rows.length - 1)) * span);
    const ticks: number[] = [];
    for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
    // Direct labels at the right edge, nudged apart so they never overlap.
    const last = rows.length - 1;
    const labels = series
      .map((s) => ({ key: s.key, text: `${s.label} ${last >= 0 ? s.value(rows[last]) : 0}`, color: s.color, y: last >= 0 ? y(s.value(rows[last])) : y(0) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
    return { x, y, ticks, labels };
  }, [rows, series]);
  const labelEvery = Math.ceil(rows.length / 8);
  const nearest = (clientX: number, rect: DOMRect) => {
    const vx = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((vx - PAD.left) / (W - PAD.left - PAD.right)) * (rows.length - 1));
    return Math.min(rows.length - 1, Math.max(0, i));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        {series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><Swatch color={s.color} />{s.label}</span>)}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={label}
          onMouseMove={(event) => rows.length && setHover(nearest(event.clientX, event.currentTarget.getBoundingClientRect()))}
          onMouseLeave={() => setHover(null)}
        >
          {geo.ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(t)} y2={geo.y(t)} stroke={t === 0 ? 'rgba(11,11,11,0.35)' : 'rgba(11,11,11,0.07)'} />
              <text x={PAD.left - 8} y={geo.y(t) + 4} textAnchor="end" fontSize={11} fill="#52514e">{t}</text>
            </g>
          ))}
          {series.map((s) => (
            <polyline key={s.key} points={rows.map((row, i) => `${geo.x(i)},${geo.y(s.value(row))}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {geo.labels.map((l) => (
            <g key={l.key}>
              <circle cx={W - PAD.right + 8} cy={l.y} r={3} fill={l.color} />
              <text x={W - PAD.right + 15} y={l.y + 4} fontSize={11} fill="#0b0b0b">{l.text}</text>
            </g>
          ))}
          {rows.map((row, i) => i % labelEvery === 0 && (
            <text key={row.day} x={geo.x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#52514e">{shortDay(row.day)}</text>
          ))}
          {hover !== null && rows[hover] && (
            <g>
              <line x1={geo.x(hover)} x2={geo.x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="rgba(11,11,11,0.25)" strokeDasharray="3 3" />
              {series.map((s) => <circle key={s.key} cx={geo.x(hover)} cy={geo.y(s.value(rows[hover]))} r={4.5} fill={s.color} stroke="#fcfcfb" strokeWidth={2} />)}
            </g>
          )}
        </svg>
        {hover !== null && rows[hover] && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 z-10 min-w-[150px] -translate-x-1/2 rounded-xl border border-ink/[0.08] bg-white/95 px-3 py-2 text-xs text-ink shadow-glass"
            style={{ left: `clamp(80px, ${(geo.x(hover) / W) * 100}%, calc(100% - 80px))` }}
          >
            <p className="font-semibold mb-1">{rows[hover].day}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5"><Swatch color={s.color} />{s.label}</span><b className="tabular-nums">{s.value(rows[hover])}</b></p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Ranked horizontal bars for one measure; values and labels in ink, bar colour only marks magnitude. */
export function BarList({ rows, color = '#2a78d6', unit = '' }: { rows: Array<{ key: string; label: string; value: number; sub?: string }>; color?: string; unit?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">暂无数据</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.key} className="grid grid-cols-[minmax(84px,30%)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate" title={row.label}>{row.label}</span>
          <span className="h-2.5 rounded-full bg-ink/[0.05]" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: color }} />
          </span>
          <span className="tabular-nums text-right">{row.value}{unit}{row.sub && <span className="ml-1.5 text-xs text-muted-foreground">{row.sub}</span>}</span>
        </li>
      ))}
    </ul>
  );
}
