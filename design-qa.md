# KYC digital-head design QA

- Source visual truth: `D:\360MoveData\Users\Administrator\Desktop\rwa.lat\assets\generated\screens-v1\03-kyc.png`
- Implementation screenshot: `D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\design-qa-kyc-implementation.png`
- Focused comparison: `D:\360MoveData\Users\Administrator\Desktop\rwa.lat\rwa-lat\design-qa-kyc-comparison.png`
- Viewport: 1265 x 712 browser viewport; the existing mobile app shell renders at approximately 422 px wide.
- State: KYC introduction, step 1 of 3, Simplified Chinese locale.

## Full-view comparison evidence

The implementation keeps the existing KYC layout and compares the face-verification hero against the same introduction state in the reference. The passport remains foregrounded on the left, the digital head sits behind it on the right, the white scan corners surround the head, and the horizontal mint scan beam crosses the lower face. The requested change is scoped to the digital human asset; the surrounding localized interface intentionally remains unchanged.

## Focused region comparison evidence

The focused side-by-side image normalizes the reference and implementation head regions to the same visual size. Both now show a three-quarter-view adult digital head with a rounded skull, visible ear, defined brow/eyes/nose/lips, natural jaw and chin, neck, dark teal topology, particle nodes, and aqua-white feature highlights. A focused comparison was required because the head is too small to judge anatomical fidelity from the full-page screenshot alone.

## Comparison history

1. **P1 — Pointed, front-facing mathematical mask**
   - Earlier evidence: the Canvas point cloud produced a long front-facing oval with a narrow V-shaped chin and no ear or neck.
   - Fix: replaced the procedural point cloud with a production raster asset grounded in the supplied reference, including the three-quarter pose and full anatomical mesh.
   - Post-fix evidence: `design-qa-kyc-comparison.png` shows the implemented pose and anatomy aligned with the reference.

2. **P2 — Visible rectangular image matte**
   - Earlier evidence: the first asset pass showed a dark rectangular background around the head.
   - Fix: converted the dark matte to a soft alpha channel using color and luminance separation, preserving cyan mesh detail while removing the box edge.
   - Post-fix evidence: `design-qa-kyc-implementation.png` shows the mesh integrated directly into the existing grid and background without a visible rectangle.

## Required fidelity surfaces

- **Fonts and typography:** unchanged from the existing production screen; no wrapping, weight, hierarchy, or antialiasing regression introduced.
- **Spacing and layout rhythm:** head, passport, scan corners, and scan beam retain the reference's overlap and reading order. The head fits the 188 x 230 px slot without cropping.
- **Colors and visual tokens:** cyan/teal wireframe and restrained white highlights match the reference and the existing mint scan token.
- **Image quality and asset fidelity:** the alpha WebP is 480 x 588 px (over 2x its rendered size), has no opaque matte, and preserves the target wireframe detail without a placeholder or code-drawn face.
- **Copy and content:** no KYC copy was changed. The localized introduction and step labels remain coherent.
- **Icons:** the existing passport, chip, scan-corner, and action icons remain aligned and unchanged.
- **Responsiveness and accessibility:** the asset is decorative with an empty alt value, respects the existing illustration label, and its float animation is disabled under `prefers-reduced-motion`.

## Interaction and console check

- The KYC page rendered successfully.
- The primary “开始验证” action was exercised and opened the identity-document selection step.
- No new browser errors were observed. The only warning is the existing demo-catalog fallback while the backend API is unavailable locally.

## Findings

- No actionable P0, P1, or P2 mismatch remains for the requested digital-head scope.
- P3: the generated eye and lip highlights are slightly brighter than the reference at close zoom; this is acceptable at the production render size and helps feature legibility.

## Implementation checklist

- [x] Replace the pointed point-cloud mask.
- [x] Match the three-quarter digital-human pose.
- [x] Include ear, natural jaw, rounded chin, and neck.
- [x] Preserve scan animation and reduced-motion behavior.
- [x] Remove the image matte.
- [x] Verify the primary KYC entry interaction and browser console.

final result: passed
