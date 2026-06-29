# Signal — Design System

**Style:** Modern Brutalism + High-Contrast Minimalism.

Flat, raw, high-contrast. Hard ink borders, solid offset shadows (no blur), oversized
type, one lime accent per screen. No gradients, no soft elevation, no skeuomorphic
texture, no generic bottom nav.

---

## Principles

1. **One accent per screen.** Lime `#ccff00` ("signal") marks the single primary action
   or the viewer's own state. Everything else is ink-on-white.
2. **Hard edges.** 2px ink borders on every interactive/contained surface. Never 1px,
   never grey borders.
3. **Solid offset shadow, not blur.** Down-right ink block, `shadowRadius: 0`. This is
   the brutalist signature — replaces all soft elevation.
4. **Physical click.** Pressing collapses the shadow and translates the element
   down-right (4px buttons, 2px cards, 1px pills). The UI feels stamped.
5. **Type carries hierarchy.** Oversized Bricolage headlines + mono caps labels do the
   work color usually does.

---

## Color

| Token                     | Hex       | Use                                      |
|---------------------------|-----------|------------------------------------------|
| `ink`                     | `#1a1c1c` | Text, borders, shadows                   |
| `signal`                  | `#ccff00` | Single lime accent — primary action/own state |
| `canvas`                  | `#ffffff` | Card / primary surface                   |
| `surface`                 | `#f9f9f9` | App background                           |
| `surfaceContainer`        | `#eeeeee` | Raised grey fill                         |
| `surfaceContainerHigh`    | `#e8e8e8` | —                                        |
| `surfaceContainerHighest` | `#e2e2e2` | Disabled fill                            |
| `onSurfaceVariant`        | `#444933` | Muted / inactive text                    |
| `outlineVariant`          | `#c4c9ac` | Faint dividers                           |
| `error`                   | `#ba1a1a` | Error text                               |
| `errorContainer`          | `#ffdad6` | Destructive press state                  |
| `onErrorContainer`        | `#93000a` | On error container                       |

Rule: lime is rationed. If two limes appear on one screen, one is wrong.

---

## Type

| Role     | Family               | Size | Tracking | Use                            |
|----------|----------------------|------|----------|--------------------------------|
| Display  | Bricolage 800        | 48   | `-1.5`   | Oversized headlines — app voice |
| Headline | Bricolage 700        | 32   | `-0.6`   | Section heads (24 for wordmark) |
| Body     | Hanken 400 / 500     | 16   | —        | Copy                           |
| Label    | JetBrains Mono 600   | 12   | `+1.2`   | UPPERCASE timestamps, durations, labels |

- Headlines: big, tight negative tracking.
- Labels: mono, uppercase, wide tracking. All timestamps/durations/metadata are mono caps
  (`JUST NOW`, `3M AGO`, `2 REACTIONS`, `0:08`).

---

## Shape & Space

```
radius:  md 12   lg 16 (cards)   full 9999 (buttons, pills, icon buttons)
space:   unit 8   elementGap 24   containerPadding 32   sectionMargin 48
```

Card padding 24. All spacing on the 8px grid.

---

## Brutalist Offset Shadow

```js
{ shadowColor: ink, shadowOffset: { width: 4, height: 4 },
  shadowOpacity: 1, shadowRadius: 0, elevation: 8 }
```

Solid ink block, down-right, zero blur. The defining element. Applied to buttons, cards,
and active/own-state pills. On press: remove shadow + translate the element by the offset
so it visually "drops" onto the page.

---

## Components

**SignalButton** — full-width pill, lime fill, 2px ink border, offset shadow. One per
screen. Press → translate 4px down-right, shadow gone. Disabled → grey fill, no shadow.
Label is mono caps.

**Card** — `canvas` fill, 2px ink border, `lg` radius, 24 padding, offset shadow.
Tappable cards translate 2px on press with a matching 2px shadow.

**VoiceNoteCard** — Card containing: mono caps speaker label + `Xm ago` timestamp row,
audio player/waveform, then either an interactive reaction bar (feed) or static reaction
summary (`🔥×3`). Optional circular 2px-bordered `×` delete button (errorContainer on
press).

**Reaction pill** — fixed 6-emoji set `🔥 💙 🤝 😂 💀 🤯`. Each a 36px full-radius 2px
ink-bordered pill. Viewer's own reaction: lime fill + offset shadow. Tap → translate 1px.

**AppHeader** — `SIGNAL` Bricolage wordmark left, mono caps route switcher right
(`FEED NOTES ME`), active route ink + underlined, inactive muted. 2px ink bottom border.
Navigation lives in the top bar — no bottom nav.

---

## Don'ts

- No blurred / soft / multi-layer shadows.
- No grey or 1px borders on contained surfaces.
- No gradients, glass, or realistic texture (not skeuomorphic).
- No second lime accent per screen.
- No generic bottom tab bar.
- No sentence-case metadata — timestamps/durations are mono UPPERCASE.
