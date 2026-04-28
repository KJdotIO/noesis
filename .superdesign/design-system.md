# Noesis Design System

## Product feel
A refined reading instrument for serious SEP readers: quiet, scholarly, precise, modern. Avoid loud SaaS styling, neon AI gradients, generic purple glows, and over-carded dashboards.

## Palette
Use OKLCH-tinted warm neutrals and one restrained ink/olive accent.

- Page: `oklch(96% 0.012 82)`
- Surface: `oklch(99% 0.006 82)`
- Surface raised: `oklch(97.5% 0.009 82)`
- Text: `oklch(19% 0.018 75)`
- Muted text: `oklch(45% 0.025 75)`
- Border: `oklch(88% 0.018 82)`
- Accent: `oklch(42% 0.078 103)`
- Accent soft: `oklch(90% 0.055 103)`
- Warning: `oklch(52% 0.11 55)`
- Error: `oklch(48% 0.13 28)`
- Success: `oklch(45% 0.09 145)`

## Typography
Use a fast-loading system stack for product UI: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Keep hierarchy tight and readable. Product UI uses fixed rem sizing; marketing/web headings can use `clamp()`.

## Spacing
Use a 4pt scale: 4, 8, 12, 16, 24, 32, 48, 64, 96. Prefer `gap` over margins for internal rhythm.

## Shape and depth
- Small controls: 8-12px radius
- Major panels: 18-28px radius
- Prefer borders and tonal backgrounds over heavy shadows
- Shadows must be wide, soft, and subtle

## Interaction
Every control needs hover, focus-visible, active, disabled, loading/error/success where applicable. Touch targets should be at least 44px where practical.

## Anti-patterns
No emojis, neon glows, gradient text, pure black, pure white, generic 3-card rows, nested cards, border-left accent stripes, or decorative sparklines.
