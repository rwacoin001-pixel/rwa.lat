# Regression guards

Fixes the user asked for and confirmed. Before every front-end deploy, check each line in the browser pane at phone
width (390×844, light and dark) and do not ship if one fails. When a change touches the file or DOM named in a line,
check that line first. Add a line for every new fix the user reports.

| # | Since | What must stay true | Where it lives | How to check |
|---|---|---|---|---|
| 1 | 10-28, again 11-01, 11-02 | The AI ball stays pinned bottom-right while scrolling; it never slides with the shrinking dock. On Community it is the compose key in the same box | `styles/palette-a.css` (pin rule), `components/h5/BottomDock.tsx`, `components/buddy/BuddyOrb.tsx` (morphs into the compose key) | Scroll home and Community down and up; the ball's (or key's) `getBoundingClientRect().right` never changes, also across the morph. If the ball's parent changes, update the pin selector |
| 2 | 11-01 | Community opens on 圈子 for signed-in users, also on a cold start | `components/community-screens.tsx` (`guestHot`) | Reload `/community` signed in; the pressed chip is 圈子 |
| 3 | 11-01 | Dark mode pages have no yellow glow in the top-right corner | `components/maison/maison.module.css` (`.root::before`), `styles/palette-a.css` | Dark theme, open Markets and Assets; the corner is plain #0a0c10 |
| 4 | 11-01, 11-02 | The compose key is visible in dark mode | `components/buddy/Buddy.module.css` (`.key`) | Dark theme, open Community; the key is a light disc with an ink pen |
| 5 | 11-01 | DM header: the name sits under the face, never overlapping | `components/community/dm.module.css` | Open a DM thread |
| 6 | 11-01 | Login and register are cool white (never warm paper) | `components/screens/auth-focus.module.css` | `/login` background is #fff |
| 7 | 11-01 | Welcome-back lock screen: plain white, centred short ink pill with a round arrow | `components/session-privacy-gate*` | Force the lock (see the memory note on local testing) |
| 8 | 11-01 | The offline notice can be closed and clears itself when back online; the update notice has 稍后 | `components/h5/NewVersionPrompt.tsx`, `useH5Controller.ts` | Toggle offline in devtools |
| 9 | 11-01 | Home invite card keeps the wallet-card look | `components/home/home-invite.module.css` | Home, signed in |
| 10 | 11-01 | Profile swipe follows the finger (drag left opens, mirrored in RTL) | `components/h5/H5Shell.tsx` (`useProfileSwipe`) | Drag on home |
| 11 | 11-01 | Asset cards have no photos | `components/maison/AssetsOverview.tsx` | Assets tab |
| 12 | 11-01 | The circle page has exactly one compose key (bottom right) | `components/community/CircleScreen.tsx` | Open a circle |
| 13 | 11-01 | Markets: the gap between the top tabs and the cover card stays small in the Android app (the status-bar inset is added once, by the tabs) | `components/maison/hero-card.module.css`, `TopTabs.module.css` | Grep: only TopTabs adds `safe-area-inset-top` above the card; on a phone the gap is about 12px |
| 14 | 11-01 | Text fields are one capsule with ONE 1.5px teal ring on focus; the input inside never draws its own outline | `components/community/circle-list.module.css` (`.search`), `circles.module.css` (`.field`) | Focus the circle search and the 建立圈子 name field: `input` outline is none, the capsule has the inset ring |
| 15 | 11-01 | Sheet title and the first field have a 24px gap; the save key is a short ink pill with its arrow, also when disabled | `circles.module.css` (`.nameForm`, `.save`) | Open 建立圈子; field top minus title bottom = 24 |
| 16 | 11-01 | Circle list: my circle card has the three-figure strip (成员 · 待审核 · ID), or the compact start card with three facts; no tall empty card | `components/community/CircleList.tsx`, `circle-list.module.css` | 社区 → 圈子, with and without an own circle |
| 17 | 11-02 | The ticket leaves the printer's slot: paper in front of the body, its top under the slot's upper lip; never from under the printer | `components/rewards/ticket.module.css` (`.window`, `.lip`), `TicketPrinter.tsx` | `/rewards/print`, slide to print; the paper's top edge sits at the slot line while feeding |
| 18 | 11-02 | Sign-in brand line: two lines, no letters touching between lines, at 360 / 390 / 430 in English | `components/screens/focus-title.module.css` (line-height 1.04, tracking -.035em) | `/login` in EN; the two `.line` boxes do not overlap |
| 19 | 11-02 | Sign-in welcome: cool coastal photo (day / night) racks into soft focus (3px, lower half 16px + mist); ONE paper-glass card: photo window crossfading the home photos (quant / predict / invite; night versions in dark), brand line 28px one line in 中文, 用邮箱登录或注册, bordered email and keys; no passkey key | `components/screens/AuthShell.tsx`, `LoginWindow.tsx`, `auth-focus.module.css`, `public/media/login/` | `/login` light and dark, EN and 中文, 360 and 390 |
| 20 | 11-02 | Home: while the community tabs are pinned, the AI orb is the compose key (opens Community's composer); it turns back when unpinned | `components/screens/P04-HomeMaison.tsx` (`claimComposeKey` on `feedPinned`), `components/h5/BottomDock.tsx` | Scroll home until the community tabs stick; the dock's last key reads 发帖 · 长按问 AI |
| 21 | 11-02 | Home feed shows 晒单 cards in posts (ResultCard compact) | `components/home/HomeSocialFeed.tsx`, `lib/api/community.ts` (`card`) | Home feed with a card post shows the ticket card |
| 22 | 11-02 | Below-the-fold blocks always reveal (no bottom inset; scroll/resize sweep fallback), e.g. the profile's sign-out key | `components/maison/useScrollReveal.ts` | Profile, scroll to the end: no `[data-reveal=pending]` left on screen |
| 23 | 11-02 | Sign-in code boxes and their confirm wash are visible in light and dark: the auth root pins `--m-ink/--m-bg/--pa-fill/--slot-line` to its own theme, and the code character beats the global `.screen b` colour | `components/screens/auth-focus.module.css`, `components/maison/code-slots.module.css` | `/login` → email → code step, type two digits: filled box ink with white digit (light) / light box with dark digit (dark); empty boxes outlined |

## Why fixes come back, and the rules that stop it

1. **A later change breaks an older fix's assumption** (line 1: the pin rule targeted the ball as a direct child of the dock; wrapping
   the ball for the feather silently stopped the rule from matching). Rule: before changing a shared layout piece, grep for selectors
   that depend on its DOM shape, and run the guard lines that name the file.
2. **An old branch or build overwrites newer work.** Rule: every deploy is built from `origin/main` (or the live commit plus a
   cherry-picked fix), never from a side branch; side sessions merge into main first. Check `git log origin/main..HEAD` before building.
3. **Backend:** each API release is an image built on top of the live image; the release tool refuses to switch when the live image
   is not the expected base, keeps the previous image for one-step rollback, and migrations only add tables and columns.
