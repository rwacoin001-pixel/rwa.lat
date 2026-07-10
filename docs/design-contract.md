# RWA.LAT Reference Design Contract

## Goal and target

Rebuild the mobile H5/PWA screens so they match the supplied Home, Invest, RWA Detail and Wallet references in hierarchy, composition and material quality. The audience is crypto-native global investors. The result is a production-oriented interactive prototype, not a static phone mockup.

## Evidence

| Evidence | Confidence | Use |
| --- | --- | --- |
| Four supplied mobile reference images | provided | Composition, density, material, navigation and 3D art direction |
| Existing H5 at localhost | observed | Current component structure and visual gaps |
| Product/development specification | provided | Product scope, USDT-only funding, networks, KYC and platform constraints |
| Portfolio replacement for Profile | user decision | Primary navigation |
| Core screens use interactive 3D | user decision | Asset and performance architecture |

## Keep / Change / Do not copy

| Reference | Keep | Change | Do not copy |
| --- | --- | --- | --- |
| Home | Black canvas, large orbital globe, portfolio-first hierarchy, four opportunity objects | Use RWA.LAT data and live WebGL scene | Device frame, exact pixels or third-party marks |
| Invest | Segmented control, one dominant compute product, three category rows | Add real navigation and product detail routing | Generated text artifacts or exact proprietary imagery |
| RWA Detail | Glass-dome asset hero, 2x2 metrics, sticky USDT CTA | Add compliant data fields and working back/bookmark controls | Claims not supported by product configuration |
| Wallet | Balance/coin composition, four actions, assets and activity | Keep USDT as the only funding asset; networks are TRON/Ethereum/Arbitrum | Implying unsupported ETH/BTC funding or trading |

## Final stance

Use a single visual stance: black precision finance with platinum-and-glass mechanical 3D objects and restrained mint energy. The interface should look designed around real objects and financial decisions, not around gradients or generic cards.

## Risks and unknowns

- Final Hunyuan GLB models are not yet available. Procedural Three.js scenes act as production-shaped placeholders and must remain replaceable.
- Product values and legal claims remain configurable content.
- Mobile GPU capability varies; every scene needs a low-power and reduced-motion path.

## Quality gate

- Root background is pure black at every route.
- Home, Invest, RWA Detail and Wallet preserve the reference composition.
- Dock has visible thickness, rim, blur and restrained glow.
- No Profile tab; Portfolio is present and profile remains available from the avatar.
- Core art is animated WebGL or a matching fallback, not a flat generic illustration.
- The 390px and 430px layouts have no overlap with safe areas or the fixed dock.
- There are no encoding artifacts, watermarks, unreadable labels or unsupported product promises.
