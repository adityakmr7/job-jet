# Job Jet design system

One visual identity shared by the web app (`apps/web`, Tailwind v4 tokens in
`src/app/globals.css`) and the extension (`apps/extension/src/sidepanel/styles.css`,
plain CSS custom properties with the same names and values).

## Identity

- **Idea:** a "J" that takes off as an arrow, leaving an orange contrail. Speed
  and forward motion, without a literal aircraft.
- **Logo:** `apps/web/public/logo-mark.svg` (full mark), plus the inline
  `<LogoMark>` / `<Wordmark>` components in `apps/web/src/components/Logo.tsx`.
  `apps/extension/src/assets/logo-mark-small.svg` has heavier strokes and a
  single streak, for 16–32px.
- **Wordmark:** "Job**Jet**" in Geist Semibold, with "Jet" in the primary colour
  (or `#9eacff` on dark backgrounds).
- **Extension icons:** `apps/extension/public/icons/icon{16,32,48,128,512}.png`
  are rendered from the SVGs. 16/32 use the small mark; 128 has the 16px
  padding the Chrome Web Store asks for.

## Colour tokens

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#f5f6fa` | Page background (cool paper) |
| `--surface` | `#ffffff` | Cards, panels, inputs |
| `--surface-hover` / `--surface-sunken` | `#eef0f7` / `#f0f2f8` | Hover fills, nested areas |
| `--foreground` / `--ink` | `#0e1330` | Text, dark sections |
| `--muted` | `#555c78` | Secondary text (5.9:1 on white) |
| `--border` / `--border-strong` | `#e2e5ef` / `#c9cedd` | Dividers / input borders |
| `--accent` | `#3346e0` | Primary actions, links, focus (6.8:1 with white) |
| `--accent-hover` / `--accent-soft` | `#2536c4` / `#eceffe` | Hover / tinted backgrounds |
| `--flare` / `--flare-soft` | `#f2622e` / `#fff0e9` | Sparing highlight: contrail, "tailored"/"soon" moments (decorative only; use `#b8431a` for text on `--flare-soft`) |
| `--success`, `--warning`, `--danger` (+ `-soft`) | `#0b7f55`, `#a35a00`, `#c62f2f` | Status and feedback |

The app is light-only for now. Every colour goes through a token, so a dark
theme only needs a `:root` override block (plus a check on the few decorative
hard-coded gradient stops).

## Type

Geist Sans (via `next/font`) and system UI fonts in the extension.

| Role | Size / weight |
| --- | --- |
| Display (hero) | 42→60px, 600, tracking −0.035em |
| H1 (page) | 24–28px, 600 |
| H2 (section) | 30–36px on marketing pages; 15px, 600 as the card title in the app |
| Body | 14–16px, line-height 1.5–1.6 |
| Small / meta | 12–13px |
| Eyebrow | 11px, 600, uppercase, +0.06em |

## Spacing, radius, elevation

- Tailwind 4px scale. Cards use 20–24px padding; sections use 80–96px vertical rhythm on marketing pages.
- Radius: `--radius-sm` 8px, `--radius-md` 12px (inputs, list rows), `--radius-lg` 16px (cards), `--radius-xl` 24px (feature panels). Buttons and chips are pills.
- Shadows: `--shadow-card`, `--shadow-card-hover`, `--shadow-popover`, and `--shadow-glow` (primary buttons only).

## Components (`apps/web/src/components/ui`)

- `button.tsx`: `Button`, `ButtonLink` and `buttonClasses()`, with variants primary / secondary / ghost / danger / inverse and sizes sm / md / lg.
- `card.tsx`: `Card` and `CardHeader` (icon, title, description, action).
- `badge.tsx`: tones neutral / accent / success / warning / danger / flare.
- `field.tsx`: `Field` (visible label, hint, required marker), `Input`, `Textarea`, `inputClasses` and `selectClasses`.
- `feedback.tsx`: `Alert` (info / success / error / loading, with the correct live-region role), `Toast`, `EmptyState` and `Skeleton`.
- Route-level loading skeletons (`app/dashboard/**/loading.tsx`) and an error boundary (`app/dashboard/error.tsx`).

The extension side panel mirrors these as CSS classes (`.btn-primary`, `.card`,
`.chip`, `.alert-*`, `.skeleton`…). The in-page launcher
(`src/content/floating-button.ts`) is fully self-contained in a closed shadow
root with `:host { all: initial }`, so host-page styles can't reach it and it
can't affect the host page.

## Accessibility rules

- Every form control has a visible `<label>` or, for repeated compact rows, an `aria-label`. Icon-only buttons always have an `aria-label`.
- The global `:focus-visible` ring is a 2px accent outline. Nothing removes focus styles without a replacement.
- Text colours meet WCAG AA on their backgrounds. Status is never shown by colour alone (there's always a text label).
- Live feedback uses `role="status"`; errors use `role="alert"`.
- `prefers-reduced-motion` disables animations. There's a skip-to-content link on every page.
