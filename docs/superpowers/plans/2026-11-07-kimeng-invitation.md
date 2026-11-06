# KIMENG invitation and language continuity

Goal: A single-screen branded invitation at `/invite`, with language captured from the inviter and carried into sign-up/sign-in. Keep A-REIT's current invitation design and existing signed referral attribution.

Design: Existing monochrome tiger in a slowly turning, shallow sculptural relief. Pale mineral surface or ink dark mode, generous space, crisp typography. Desktop uses an offset emblem with the invitation copy beside it; phones stack the emblem, copy and actions. No product list, performance statistics or return claims. Reuse the original SVG; no generated or downloaded images.

Copy: “看得更清楚，选择更从容。” / “See clearly. Choose thoughtfully.” The invitation context and saved code sit below the slogan. Risk line: “投资涉及风险，本金可能损失。请充分了解后独立决策。” Translate all copy into the existing seven locales. Keep the inviter private, and never imply guaranteed account binding before registration succeeds.

Implementation:
- Add regression checks for explicit link language overriding existing cookie/local storage, invalid language fallback, and safe referral redirects with query preservation.
- Update `/r/[code]`, the document bootstrap and I18nProvider to honor a valid `lang` parameter before saved language. Preserve attribution signatures and same-site redirect validation.
- Add a KIMENG-only invitation component, its localized copy and scoped CSS; the shared landing selects it by build brand. Use responsive viewport sizing, safe areas, native language selection and reduced-motion stills.
- Verify all seven locales, both themes, small phones, landscape and desktop sizes. Verify actions retain language/referral information, content stays inside the viewport, and registration routing still obeys the existing desktop access gate.
- Build from committed clean source, deploy only KIMENG frontend, then verify the actual domain and artifact build ID.
