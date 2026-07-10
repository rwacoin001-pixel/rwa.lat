# RWA.LAT Visual System

## 1. Visual Theme & Atmosphere

RWA.LAT is a precise, cinematic financial instrument: pure black space, platinum hardware, smoked glass and restrained mint energy. The interface must feel engineered rather than decorated. Every screen has one dominant object and a clear financial hierarchy. Page backgrounds are always `#000000`; depth comes from materials, borders and local light inside components, never ambient page gradients.

## 2. Color

- Canvas: `#000000`
- Glass: `rgba(12, 16, 20, .62)`
- Glass strong: `rgba(18, 23, 28, .76)`
- Hairline: `rgba(255, 255, 255, .12)`
- Glass rim: `rgba(218, 239, 255, .58)`
- Primary text: `#F5F7F8`
- Secondary text: `#929AA6`
- Faint text: `#626A75`
- Mint: `#2FE6BF`
- Ice: `#C5E3F7`
- Positive: `#2FE6BF`
- Negative: `#FF627A`
- Medium risk: `#7589FF`
- High risk: `#FFAD3D`

No page-level `linear-gradient` or `radial-gradient`. A component may use a tightly bounded specular highlight or glow when it represents glass refraction, an active control or an illuminated 3D object.

## 3. Typography

Use Inter for navigation and body text; use Space Grotesk for portfolio values, yields and financial metrics. Use tabular numbers. Headlines are sentence case, never decorative all-caps. Micro labels are limited to portfolio and compliance metadata.

## 4. Spacing & Grid

Use an 8px grid with 20px mobile gutters, 16px below 390px, and 24-32px between major sections. Touch targets are at least 44px. The H5 content width is capped at 430px. Safe-area insets are mandatory for the header and fixed dock.

## 5. Layout & Composition

The top bar is quiet and balanced: brand or page title on the left, notification and profile on the right. Home uses portfolio copy followed by a large orbital globe. Invest uses a segmented filter, one large hero product, then three strong horizontal products. Detail pages use a cinematic 3D hero, identity and metrics, then documentation. Wallet uses the balance and coin as a single hero composition. Avoid nested cards and uniform card repetition.

## 6. Components

- Liquid glass: neutral translucent fill, bright ice rim, top inner highlight, deep black shadow, 22-30px backdrop blur.
- Bottom dock: one elliptical four-item glass capsule plus a separate circular AI button.
- Primary navigation: Home, Invest, Portfolio, Wallet. Profile is opened from the top-right avatar.
- Icons: Lucide-style 1.7-1.9px monoline icons; 3D art is reserved for asset identity.
- Buttons: primary mint fill only for transactional confirmation; secondary actions use neutral glass.
- Cards: use borders and spacing first. A card exists only when content needs a shared interactive surface.

## 7. Motion & Interaction

Tap feedback is 120-160ms; component transitions 220-320ms; screen changes 320-420ms. 3D objects float subtly and respond to pointer/touch parallax. Orbital nodes move at different speeds. Reduced-motion stops continuous rotation and replaces parallax with a static poster-like composition.

## 8. Voice & Brand

Copy is concise, factual and financially literate. Use terms such as projected yield, minimum investment, settlement and risk. Avoid hype, unverifiable claims and generic AI language. RWA.LAT is written exactly with the period.

## 9. Anti-patterns

- No blue-purple or blue-green background gradients.
- No ambient blurred blobs behind the phone.
- No repeated generic glass cards with identical geometry.
- No emoji, random 3D icon packs, illegible model text or fake brand marks.
- No glow as a substitute for realistic material and hierarchy.
- No profile item in the bottom dock.
- No tiny centered copy, filler pills or pseudo-technical labels.
- No 3D image pasted into a box without spatial integration or motion.
