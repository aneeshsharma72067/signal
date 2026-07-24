# Signal — Landing Page Style Guide

A single reference for designing and building the Signal marketing/landing site. It captures the product's voice, visual system, and feature set so the landing page feels like a natural extension of the app — not a generic SaaS template bolted onto a brutalist product.

Signal is a **voice-first social network**. People post 30-second voice notes, react with a fixed set of six emojis, follow each other, listen to a real-time global feed, and send private 1:1 voice messages. No text posts. No infinite doomscroll of essays. Just voices.

---

## 1. The Vibe (read this first)

**Modern Brutalism + High-Contrast Minimalism.**

Signal looks like a fanzine printed on a laser printer, not a soft pastel startup. It is loud, physical, and confident. The landing page should feel the same: oversized type, hard black borders, one electric-lime accent, and elements that look *stamped* onto the page.

Three words to hold in your head while designing: **RAW. LOUD. PHYSICAL.**

- **Raw** — flat surfaces, no gradients, no glass, no soft drop shadows, no rounded-everything. Ink on white.
- **Loud** — type is huge and tight. Headlines shout. Metadata is mono-caps.
- **Physical** — every interactive thing has a hard offset shadow and "drops" when pressed, like a real button. The UI feels tactile, mechanical, analog.

Anti-vibe (do NOT do): Corporate blue gradients, glassmorphism, soft neumorphism, drop-shadow blur, stock-photo hero, three accent colors, sentence-case lowercase friendliness, "AI-powered" everything.

Tone of voice in copy: **terse, declarative, a little defiant.** Short lines. Full stops. "Say it out loud." "No text. Just voices." "30 seconds. That's the whole post." Think protest poster, not onboarding wizard.

---

## 2. Color

One accent. Rationed. Everything else is ink-on-white.

| Token | Hex | Role on the landing page |
|---|---|---|
| **Ink** | `#1a1c1c` | All text, all borders, all shadows. The near-black. |
| **Signal (lime)** | `#ccff00` | The single accent. Primary CTA, highlight marks, one hero element. |
| **Canvas** | `#ffffff` | Cards, primary surfaces, most section backgrounds. |
| **Surface** | `#f9f9f9` | Page background — a hair off pure white. |
| **Surface Container** | `#eeeeee` | Raised grey fills, secondary blocks. |
| **On-Surface Variant** | `#444933` | Muted / secondary text, captions. |
| **Outline Variant** | `#c4c9ac` | Faint hairline dividers only. |
| **Error** | `#ba1a1a` | Reserve for warnings; avoid on marketing. |

**The one rule that matters:** lime is rationed. **One dominant lime moment per viewport.** If a user sees two competing lime elements on the same screen, one of them is wrong. Use lime for the primary CTA and for a single hero accent — never for decoration, never for every card.

Everything is high contrast: ink on white, or ink on lime. No mid-grey text on grey backgrounds. No tints.

---

## 3. Typography

Type carries the hierarchy that color usually would. Three families, three jobs.

| Role | Family | Web weight | Treatment |
|---|---|---|---|
| **Display** | Bricolage Grotesque | 800 ExtraBold | 48px+ (go bigger on web — 72–120px heroes). Tracking `-1.5` to `-3`. The app's voice. |
| **Headline** | Bricolage Grotesque | 700 Bold | Section heads, 32–48px. Tracking `-0.6`. |
| **Body** | Hanken Grotesk | 400 / 500 | 16–20px. Readable paragraphs and feature copy. |
| **Label / Meta** | JetBrains Mono | 600 SemiBold | 11–13px, **UPPERCASE**, wide tracking (`+1.2`). |

Rules:
- **Headlines are huge and tight.** On web, push display type far bigger than the app — this is where brutalism sings. Negative letter-spacing, lines packed tight, sometimes overflowing the viewport edge on purpose.
- **All metadata is mono caps.** Timestamps, durations, counts, section eyebrows, nav labels: `JUST NOW`, `3M AGO`, `2 REACTIONS`, `0:08`, `● LIVE BROADCAST`, `◆ DIRECT`. Never sentence case.
- **Body stays lowercase/sentence case** and calm — it's the one place the page relaxes so headlines can shout.
- Fonts are all on Google Fonts (Bricolage Grotesque, Hanken Grotesk, JetBrains Mono) — free to load on web.

---

## 4. Shape, Space, Shadow

**The brutalist signature is the offset shadow.** A solid ink block, down-and-right, **zero blur**. This replaces every soft elevation. It is the single most important visual detail — get it right and the whole page reads as Signal.

```css
/* The Signal offset shadow — web translation of the app token */
box-shadow: 4px 4px 0 #1a1c1c;   /* buttons, hero cards */
box-shadow: 2px 2px 0 #1a1c1c;   /* smaller cards, pills */
/* NEVER: box-shadow: 0 4px 12px rgba(0,0,0,.1)  ← forbidden soft shadow */
```

**Borders:** 2px solid ink on every contained/interactive surface. Never 1px. Never grey. (Hairline dividers may use `outlineVariant`.)

**Radius:**
```
12px  — small elements
16px  — cards (the default card radius)
9999  — buttons, pills, icon buttons (fully round ends)
```

**Spacing** — everything on an 8px grid:
```
8   unit
24  element gap
32  container padding
48  section margin (go larger on web: 96–160px between landing sections)
```

**The physical-click interaction** (carry this to web hover/active states):
- Default: element sits with its 4px offset shadow.
- Press / `:active`: shadow collapses to `0 0`, element translates `translate(4px, 4px)` — it "drops" onto the page.
- Optional hover: lift slightly (`translate(-1px,-1px)`, shadow to `5px 5px 0`) to invite the press.

This stamped, mechanical feel is non-negotiable — it's what makes Signal feel like Signal.

---

## 5. Core Components (and their web equivalents)

Mirror these app components on the landing page so the product screenshots and the marketing chrome share one language.

**Signal Button** — the primary CTA. Full pill, lime fill, 2px ink border, 4px offset shadow, mono-caps label (`GET SIGNAL`, `START TALKING`, `JOIN THE BROADCAST`). **One per section, max.** Press drops it 4px. Secondary actions use the same shape with a white/canvas fill instead of lime.

**Card** — canvas fill, 2px ink border, 16px radius, 24px padding, 2px offset shadow. The default container for features, testimonials, and screenshots.

**Voice Note Card** — the hero object of the whole product. A card containing: a mono-caps speaker label + `Xm ago` timestamp row, an audio waveform/player, and a reaction row. Recreate a static version on the landing page as the centerpiece visual — it instantly communicates "this is voice."

**Reaction Pill** — the fixed six-emoji set `🔥 💙 🤝 😂 💀 🤯`. Each a 36px round, 2px ink-bordered pill. The viewer's own pick gets lime fill + offset shadow. These six emojis are a brand asset — feature them prominently. "React with six. That's all you get."

**Waveform** — vertical ink bars of varying height. Use as a decorative motif / section divider. It's the visual shorthand for audio and reads beautifully in flat ink.

**Floating Tab Bar** — the app's navigation is a **detached, floating pill bar** at the bottom of the screen: rounded, 2px ink border, offset shadow, with a lime pill that slides between tabs and an icon-to-label morph on the active tab. It is *not* a generic bottom nav flush to the edge — it floats with margins on all sides. If you show app chrome in mockups, show this. (Note: the wordmark `SIGNAL` in Bricolage sits top-left with utility icons — search, messages, activity — top-right.)

---

## 6. What Signal Actually Does (feature set for the page)

Organize the landing page around these. Lead with voice; it's the whole thesis.

### Voice notes, 30 seconds, that's the post
Record up to 30 seconds. A custom waveform draws live as you speak. Custom audio engine (`expo-audio`) handles streaming, seeking, pausing. Hard 2MB cap keeps it snappy. **The pitch: no typing, no editing, no thread. Say it and send it.**

### A real-time global broadcast
Two feed scopes: **EVERYONE** (the global wall, freshest first) and **FOLLOWING** (just the voices you follow). New notes and reactions stream in live via realtime subscriptions — the feed updates while you watch. Infinite scroll via keyset pagination. **The pitch: a living room of voices, updating in real time.**

### Six reactions. That's it.
A curated, fixed emoji set: `🔥 💙 🤝 😂 💀 🤯`. One reaction per note, toggleable. Counts are denormalized server-side for speed. **The pitch: no like-farming, no 3,000 emoji picker — six honest reactions.**

### Follow the voices you like
A directed follow graph. Build a network, get a Following feed. Paginated follow/follower lists. **The pitch: curate who you hear.**

### Private voice DMs (Whispers)
1:1 voice messaging between people who mutually follow. Inverted chat log with day separators, live incoming clips, read receipts (`✓` → `✓✓`), an inbox with unread counts, and long-press-to-delete threads. **The pitch: private voice, only between you two.**

### Activity that respects your attention
A notifications feed: reactions on your notes, new followers, replies, notes from people you follow. Filterable by type, newest first, live prepends, opening it clears the badge. **The pitch: know what happened, then get back to talking.**

### Threads & replies
Voice notes have threads — reply to a note with your own voice clip. Conversations are audio all the way down.

### Safety, built in
- **Blocking** — blocked users vanish from feeds and profiles in both directions.
- **Reporting** — flag notes or users for review.
- **Rate limits** — server-side cooldowns (10s between posts, max 10 posts / 10 min) stop spam before it starts.

**The pitch: loud doesn't mean lawless.**

---

## 7. Suggested Landing Page Structure

1. **Hero** — oversized Bricolage headline ("SAY IT OUT LOUD." / "A SOCIAL NETWORK YOU LISTEN TO."), one lime `GET SIGNAL` CTA, and the Voice Note Card as the hero visual. A live waveform motif. One lime moment — the CTA (or the card's reaction pill), not both.
2. **The thesis** — "No text. 30 seconds. Just voices." Big type, minimal chrome. Show the recorder + waveform.
3. **Feature blocks** — alternating ink-bordered cards: real-time feed, six reactions, follow graph, Whispers (DMs), activity, safety. One idea per block, mono-caps eyebrow + Bricolage headline + Hanken body.
4. **The six reactions** — a dedicated moment featuring `🔥 💙 🤝 😂 💀 🤯` as oversized pills.
5. **Social proof / how it feels** — screenshots in device frames using the floating tab bar and voice cards.
6. **Final CTA** — full-bleed lime or ink section, one giant headline, one Signal Button.
7. **Footer** — mono-caps links, ink-on-white, hard top border.

---

## 8. Don'ts (hard rules)

- ❌ No blurred, soft, or multi-layer shadows. Offset ink block only.
- ❌ No 1px borders, no grey borders on contained surfaces.
- ❌ No gradients, glass, glow, or realistic texture.
- ❌ No second lime accent competing in one viewport.
- ❌ No sentence-case metadata — timestamps/durations/counts/eyebrows are mono UPPERCASE.
- ❌ No stock photography or illustration that isn't flat, ink-line, or the app's own waveform/voice-card motifs.
- ❌ No soft, friendly, hedging copy. Short. Declarative. Confident.
- ❌ Don't describe Signal as a text app, a podcast app, or an audio-clip "feature." It's a **voice-first social network.**

---

## 9. Quick Asset Recipe (drop-in CSS tokens)

```css
:root {
  --ink:    #1a1c1c;
  --signal: #ccff00;
  --canvas: #ffffff;
  --surface:#f9f9f9;
  --muted:  #444933;
  --hairline:#c4c9ac;

  --radius-sm: 12px;
  --radius-card: 16px;
  --radius-pill: 9999px;

  --shadow: 4px 4px 0 var(--ink);
  --shadow-sm: 2px 2px 0 var(--ink);
  --border: 2px solid var(--ink);
}

.btn-signal {
  background: var(--signal);
  border: var(--border);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow);
  font-family: "JetBrains Mono", monospace;
  font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px;
  transition: transform .06s ease, box-shadow .06s ease;
}
.btn-signal:active { transform: translate(4px,4px); box-shadow: 0 0 0 var(--ink); }

.card {
  background: var(--canvas);
  border: var(--border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-sm);
  padding: 24px;
}

h1, h2 { font-family: "Bricolage Grotesque", sans-serif; font-weight: 800; letter-spacing: -1.5px; }
.eyebrow, .meta { font-family: "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: 1.2px; color: var(--muted); }
body { font-family: "Hanken Grotesk", sans-serif; background: var(--surface); color: var(--ink); }
```

---

*Source of truth: `DESIGN.md`, `src/theme.ts`, `README.md`. If the app and this guide ever disagree on a token, the app's `theme.ts` wins.*
