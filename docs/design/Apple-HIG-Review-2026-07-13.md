# RWA.LAT Apple HIG 设计复核

日期：2026-07-13  
依据：Apple Human Interface Guidelines 的 Design principles、Layout、Materials、Typography、Accessibility、Loading 与 Feedback。

## 已确定的修订原则

1. Liquid Glass 主要用于底部导航、顶层控制和关键操作，不在所有内容卡片上重复高亮玻璃；内容层使用克制的标准深色材质。
2. 导航必须浮于内容之上并与内容清晰分层；所有滚动页为底部 Dock/固定 CTA 预留 safe-area 和完整高度。
3. iOS 触控目标目标值 44×44pt，控件之间保留足够间距；图标与背景必须形成可辨识对比，不能同色融为一体。
4. 正文默认不低于 17px 的可读基线，辅助文字不低于平台建议的最小值；支持至少 200% 文本放大并避免固定高度裁切。
5. 加载超过瞬时响应时先显示骨架或进度，绝不留白；失败状态说明原因、影响和重试/替代路径。
6. 重要资金动作提供明确、就近、可访问的成功/失败反馈；不可逆或高风险动作在提交前再次确认。
7. `prefers-reduced-motion` 停止连续旋转、视差和强缩放；`prefers-reduced-transparency` 提供高不透明背景；状态不只靠颜色表达。
8. 国际化布局适配文本长度、RTL、Dynamic Type 和安全区，不以固定 116px 卡片承载可变四行内容。

## 本轮需修复

- 首页 AI 评分与视频层分离，避免 87 被覆盖；
- Market snapshot 与 Today's actions 增加 24px 章节间距；
- Today's actions 图标改为中性冰色容器、不同语义色图标，完成状态才使用高对比薄荷绿；
- Invest 产品卡片改为内容驱动的最小高度，收益/风险标签不再被固定高度裁切；
- 固定 CTA 与页面内容统一预留 safe-area，阿拉伯语和长按钮文案允许换行；
- Welcome 与认证页、Settings 均提供可发现的语言切换入口。

## 参考

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
- [Loading](https://developer.apple.com/design/human-interface-guidelines/loading)
- [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)

