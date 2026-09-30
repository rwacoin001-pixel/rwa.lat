import { ColorType, LineStyle, type DeepPartial, type ChartOptions } from 'lightweight-charts'
export function chartOptions(): DeepPartial<ChartOptions> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: v('--ink-3'), fontFamily: v('--font-num'), fontSize: 11, attributionLogo: true },
    grid: { vertLines: { visible: false }, horzLines: { color: v('--hairline'), style: LineStyle.Solid } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, timeVisible: false },
    crosshair: { vertLine: { color: v('--ink-3'), labelVisible: false }, horzLine: { visible: false } },
    handleScroll: false, handleScale: false, autoSize: true,
  }
}
