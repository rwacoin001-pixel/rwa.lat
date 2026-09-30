'use client'

/**
 * /home 首屏动效 —— anime.js v4
 *
 * 为什么用 anime.js（而不是 framer-motion）：
 *   · /home 这一页本来就没用 framer-motion（它用 CSS module + 指针事件），所以不存在"两套引擎抢同一个
 *     transform"的问题 —— 这也是能在这页安全引入 anime.js 的前提。
 *   · 折线图"自绘"（stroke 逐段画出来）是 anime.js 的招牌能力，用 v4 的 svg.createDrawable + draw 属性实现。
 *   · 时间轴 + stagger 编排比在 JSX 里堆 delay 更直观。
 *
 * 两个必须守住的约束：
 *   1) 动画结束后清掉内联 transform/opacity，把控制权交还 CSS ——
 *      否则内联 transform 会压住 .productCard:hover / .quickActions button:active 这些已有的 CSS 动效。
 *   2) 尊重 prefers-reduced-motion：用户要求减少动效时整段跳过（内容直接是最终状态，不会消失）。
 */

import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { animate, createDrawable, stagger } from 'animejs'

export type HomeMotionTargets = {
  /** 区块类名（CSS module 名）——按 DOM 顺序错峰上浮 */
  blocks?: string[]
  /** SVG 折线：自绘 */
  line?: string
  /** 折线下方填充：淡入 */
  area?: string
}

/** CSS module 的类名带哈希，用属性选择器最稳 */
const asSelector = (cls: string) => `[class~="${cls}"]`

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function useHomeMotion(rootRef: RefObject<HTMLElement | null>, targets: HomeMotionTargets) {
  // 只用首次渲染的配置，避免调用方每次渲染新建对象导致 effect 反复执行
  const cfg = useRef(targets)

  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const { blocks: blockClasses = [], line: lineClass, area: areaClass } = cfg.current
    const blocks = blockClasses.flatMap((cls) =>
      Array.from(root.querySelectorAll<HTMLElement>(asSelector(cls))),
    )
    const line = lineClass ? root.querySelector<SVGGeometryElement>(asSelector(lineClass)) : null
    const area = areaClass ? root.querySelector<SVGGeometryElement>(asSelector(areaClass)) : null

    const running: Array<{ cancel?: () => void; revert?: () => void }> = []
    const handBackToCss = (els: HTMLElement[]) =>
      els.forEach((el) => {
        el.style.opacity = ''
        el.style.transform = ''
      })

    // 1) 区块错峰上浮（paint 之前先设初值，避免闪一下）
    if (blocks.length) {
      blocks.forEach((el) => {
        el.style.opacity = '0'
        el.style.transform = 'translateY(16px)'
      })
      running.push(
        animate(blocks, {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 620,
          delay: stagger(64),
          ease: 'outQuart',
          onComplete: () => handBackToCss(blocks),
        }),
      )
    }

    // 2) 折线图下方填充：先淡入
    if (area) {
      area.style.opacity = '0'
      running.push(
        animate(area, { opacity: [0, 1], duration: 900, delay: 520, ease: 'outQuad' }),
      )
    }

    // 3) 折线本身：从左到右"画"出来
    if (line) {
      running.push(
        animate(createDrawable(line), {
          draw: ['0 0', '0 1'],
          duration: 1250,
          delay: 240,
          ease: 'inOutSine',
        }),
      )
    }

    return () => {
      running.forEach((anim) => {
        try {
          anim.cancel?.()
          anim.revert?.()
        } catch {
          /* 卸载时忽略 */
        }
      })
      handBackToCss(blocks) // 任何情况下都别把内容留在透明状态
    }
  }, [rootRef])
}
