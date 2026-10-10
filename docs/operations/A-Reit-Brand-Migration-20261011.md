# A-REIT frontend branding

The user requested a new logo and replacement of the visible RWA.LAT brand
throughout the frontend, then selected the generated folded-portal logo.

## Assets and presentation

- Approved image reference: public/brand/a-reit/approved-logo-original.png.
- Production SVG assets reproduce the approved portal and A-REIT lettering
  in solid black/white with a mint panel; light and dark variants are supplied.
- The shared logo component replaces the old mark in authentication, desktop,
  startup, session unlock, pull-to-refresh and AI entry components.
- PWA, Apple and browser icons are generated from the new app-icon SVG.
- The service worker uses a new versioned cache and new brand asset URLs.
- Visible names, accessibility labels, metadata, sharing text, legal page brand
  references and supported locale copy use A-REIT; public share links use a-reit.com.

## Authentication display

- Wallet challenge display statement uses A-REIT while preserving all challenge
  fields, validation, signing and expiration behavior.
- Passkey account fallback label uses A-REIT. Set PASSKEY_RP_NAME=A-REIT with
  the domain cutover environment so browser passkey/TOTP setup shows the new name.
- Google/GitHub display names are A-REIT; Google brand verification remains a
  separate provider process after the new website and ownership proof are live.

## Compatibility

Generic RWA asset terminology and stable package, route, source, storage and
business identifiers are retained. Old domains remain accepted where migration
compatibility requires them. The working support email and verified outbound
email sender remain on rwa.lat; UI support links use a descriptive label.

Build results and actual deployment evidence are tracked in the chat's output
files. No automated tests were requested or run for this batch.
