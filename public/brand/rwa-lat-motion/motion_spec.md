# RWA.LAT Header Logo Motion Spec

## Brief

- Source: the existing home-header vector lockup in `components/rwa-h5.tsx`, visually backed by `public/brand/rwa-lat-logo-simple-v1.png`.
- Usage: one-time header reveal; the final state remains static and readable.
- Personality: precise, trustworthy, restrained.
- Motion preset: Trustworthy / Professional, adjusted from 700ms to 920ms so the seven-letter cascade remains legible at the compact header size.
- Final Frame Contract: circle, horizontal axis, mint node, and `RWA.LAT` wordmark must end at the exact existing geometry, color, scale, and position.

## Part inventory

| Part | SVG id | Role |
|---|---|---|
| Mark group | `brand-mark` | Primary visual anchor |
| Outer ring | `brand-ring` | Draw-on reveal |
| Horizontal axis | `brand-axis` | Draw-on follow-up |
| Mint node | `brand-node` | Final accent arrival |
| Wordmark | `brand-wordmark` | Reading-order container |
| Letters | `brand-letter-r` through `brand-letter-t` | Independent stagger actors |

The current mark is already minimal, smooth vector geometry, so no raster trace is used. The circle and axis remain primitives, preserving editable geometry and avoiding any stair-stepped trace.

## Choreography

- 0–16%: quiet anticipation hold.
- 17–58%: the complete ring fades and resolves from 92% scale; the axis draws from 29–65%.
- 40–97%: the seven letters rise and fade in, staggered in reading order.
- 56–83%: the mint node travels a short curved-looking diagonal path into its final anchor.
- 83–100%: follow-through is a clean hold with no bounce or deformation.

## Principles

- Staging: mark first, wordmark second, node as the finishing accent.
- Slow In / Slow Out: literal cubic-bezier values inside keyframes prevent accidental linear motion.
- Timing: a single 920ms shared clock keeps the header reveal compact.
- Follow Through / Overlap: ring, axis, letters, and node end on different beats.
- Solid Drawing: all final transforms resolve to identity; strokes use non-scaling behavior.
- Appeal: motion echoes the mark's circular/axial construction and avoids generic bounce.

## Tokens

```css
--p2m-duration: 920ms;
--p2m-ease-enter: cubic-bezier(0, 0, 0.2, 1);
--p2m-ease-settle: cubic-bezier(0.4, 0, 0.2, 1);
--p2m-squash: 0;
--p2m-overshoot: 1;
```

## Accessibility and interaction

- `prefers-reduced-motion: reduce` shows the complete final logo immediately.
- Hover/focus only brightens and enlarges the mint node by 8%, returning exactly to rest.
- The logo has a single accessible name (`RWA.LAT`); the decorative SVG is hidden from assistive technology in the application component.

## QA results

- Geometry: PASS. The shipped mark reuses the existing circle/path/circle primitives; no raster trace or curve fitting was necessary, so IoU is not applicable. Smoothness inspection shows clean browser-rendered arcs with no stair-step geometry.
- Motion frames: PASS at 0, 160, 420, 620, 760, and 920ms. Reading order and overlap are visible in `outputs/motion_strip.png`; no part clips the viewBox. The ring always appears as a complete silhouette, including during its entrance.
- Easing probe: PASS. The complete-ring opacity/scale entrance and axis draw use literal cubic-bezier easing rather than an accidental linear fallback.
- Final Frame Contract: PASS. Same-browser `?t=920` versus `?static=1` has 0 changed pixels, maximum channel delta 0, and mean absolute delta 0.
- Reduced motion: PASS. Ring, node, first letter, and final letter all compute to opacity 1, identity transform, and no active animation.
