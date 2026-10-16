# Art direction - demolms

**In one line:** calm and precise, like a well-set reference manual - near-monochrome, type-led, nothing
shouting for attention except the one thing you are meant to do.

**References:** Linear (chrome, restraint, density), Stripe docs (typography, hairlines), Vercel docs
(near-monochrome surfaces), a printed syllabus (structure over decoration).

**Not this:** no glassy aurora gradients, no violet SaaS purple, no rounded-everything, no drop shadows
on cards, no colour as decoration, no motion for its own sake.

## Type

- **One family: Instrument Sans** (self-hosted variable woff2, offline-safe). A grotesque with enough
  character - the `a`, `g` and `t` have real personality - that a page of it does not read like a
  framework default. System monospace for ids, code and certificates.
- Scale (root 16px, all tokens in `globals.css`):
  | role | size | line height | weight |
  | --- | --- | --- | --- |
  | display | 3rem / clamp(2.25rem, 5vw, 3.5rem) | 1.05 | 600, tracking -0.03em |
  | h1 `page-title` | 1.75rem | 1.2 | 600, tracking -0.02em |
  | h2 `section-title` | 1.125rem | 1.35 | 600 |
  | h3 | 1rem | 1.4 | 600 |
  | body | 0.9375rem (15px) | 1.65 | 400 |
  | small | 0.8125rem | 1.5 | 400 |
  | caption / kicker | 0.6875rem | 1.4 | 500, uppercase, tracking 0.08em |
- **Measure:** body copy caps at 68ch (`.prose-lms`, `.measure`). Long lines are the single most common
  reason a page reads as amateur.
- **Numerals:** tabular wherever a number is data (KPIs, tables, progress, money, scores) so nothing
  jitters when it updates.

## Colour

- **Near-monochrome.** A single cool-neutral ramp (`ink-50` -> `ink-950`) carries ~95% of the interface.
  Canvas is a half-step off white; surfaces are white; separation comes from hairlines, not shadows.
- **Primary action is ink**, not a colour: near-black on light, near-white on dark (`--color-primary`).
  This is the most reliable way to look designed rather than templated.
- **One accent: deep teal** (`brand-*`). It carries links, active states, focus rings and progress -
  meaning, not decoration. Chosen because it reads calm and institutional at 600, and because it is not
  the default SaaS violet/blue.
- **Semantic colours are muted and always paired soft/strong:** `success` (emerald), `warning` (amber),
  `danger` (red), `info` (slate blue). Each has a `-soft` background, a `-line` border and a `-strong`
  text value so a badge is legible on its own tint in both themes.
- **Dark mode is designed, not inverted:** a deep neutral canvas (#0A0C0E), raised surfaces, hairlines
  that get *lighter* not darker, ink ramp flipped, accent moved to a lighter teal for text while solid
  accent surfaces keep dark-teal + white (so contrast survives). Toggle: light / dark / system,
  remembered in `localStorage`, applied before first paint.

## Space and shape

- Base unit 4px. Spacing steps used: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- Radius groups by role, not applied blindly: surfaces 12px, controls 8px, chips/badges 6px, media 12px,
  sheets 16px, pills/avatars full.
- **Elevation is for overlays only.** Cards and panels use a hairline; menus, sheets and toasts get a
  shadow (`.shadow-pop`). If everything is raised, nothing is.

## Motion

- **Intensity: subtle.** Durations 130 / 190 / 260ms (`--motion-fast/base/slow`), one ease-out curve
  (`--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`).
- What animates: hover/active/focus states, the nav condense, the sliding nav highlight, menus and
  sheets arriving, progress bars filling, the player's resume banner, list items arriving once
  (`.animate-rise`, opacity + 4px).
- What never animates: page load, prices, headings, anything on a timer, anything the reader did not
  ask for.
- `prefers-reduced-motion: reduce` collapses all of it to instant, including smooth scrolling.

## Signature

**Generative cover art.** Every course renders its cover from its own data - a *curriculum fingerprint*:
one bar per lesson, grouped by section, with the free-preview lessons marked in the accent, a level tick,
and the section count. Deterministic (same course, same art, everywhere - catalogue, cards, hero, admin
list), drawn as inline SVG so it answers to the theme, and no image files are involved. Admin-uploaded
thumbnails still win when present.

The rest of the interface stays deliberately quiet so this is the one thing that reads as designed.
