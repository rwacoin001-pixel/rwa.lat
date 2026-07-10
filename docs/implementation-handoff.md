# RWA.LAT Implementation Handoff

Read `DESIGN.md` and `docs/design-contract.md` before changing UI.

- Keep the root and mobile canvas `#000`; remove ambient and page-level gradients.
- Primary tabs are Home, Invest, Portfolio and Wallet. AI is a separate circular dock button. Profile opens from the avatar.
- Use Inter + Space Grotesk, 20px gutters, 44px touch targets and safe-area padding.
- Match the supplied four references: portfolio globe Home, compute-led Invest, glass-dome RWA Detail and coin-led Wallet.
- Use shared procedural 3D scenes now; keep the scene container API replaceable by optimized GLB assets later.
- Glass is neutral and optical: translucent black, ice rim, inner highlight and black depth. Mint is an active/positive accent, not a background wash.
- First proof must include 390x844 and 430x932 screenshots, working navigation, RWA detail navigation, reduced motion and successful production build.
