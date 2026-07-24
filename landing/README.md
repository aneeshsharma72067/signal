# Signal — Landing Page

Static marketing site for Signal, built with **Astro** (zero client JS by default). The neo-brutalist theme is a 1:1 web port of the app's `src/theme.ts` tokens — ink-on-white, one rationed lime accent, hard 2px borders, zero-blur offset shadows, and the physical "press-drops-the-button" interaction.

## Stack

- **Astro 5** — static output, no framework runtime shipped.
- **Plain CSS** (`src/styles/tokens.css`) — design tokens ported from the app. No Tailwind; the guide is already hand-tuned CSS.
- **Google Fonts** — Bricolage Grotesque (display), Hanken Grotesk (body), JetBrains Mono (meta). Loaded in `src/layouts/Base.astro`.

## Develop

```bash
cd landing
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run preview  # serve the built site
```

## Structure

```
src/
  layouts/Base.astro        HTML shell, fonts, meta/OG tags
  styles/tokens.css         design tokens + shared classes (.btn, .card, .meta …)
  components/
    Nav.astro               sticky top nav (wordmark + CTA)
    VoiceNoteCard.astro      static recreation of the app's hero object
    Waveform.astro           ink/lime bar waveform (same shape fn as the app)
    TabBar.astro             floating pill tab bar (FEED / NOTES / ME)
    PhoneFrame.astro         device mock — renders a screenshot or a labelled placeholder
  pages/index.astro         the whole landing page + section styles
public/assets/              logo + graphics copied from the app
```

## Screenshots needed

The page is complete and ships **placeholders** where real app screenshots go. Each `<PhoneFrame>` renders a labelled dashed slot until you drop in an image. To fill one, add the PNG to `public/assets/` and pass its path as `src`:

```astro
<PhoneFrame src="/assets/feed.png" label="THE LIVE FEED" />
```

Placeholders currently in the page (`src/pages/index.astro`):

| Slot label | What to capture | Suggested filename |
|---|---|---|
| **THE LIVE FEED** | The `(tabs)/feed` screen — a scroll of voice-note cards with the floating tab bar visible, EVERYONE scope. | `public/assets/feed.png` |
| **1:1 VOICE MESSAGES** | A `messages/[id]` chat thread — voice bubbles, day separator, record control. | `public/assets/dm.png` |

Capture at phone aspect ratio (~9:19.5, e.g. 1170×2532 portrait) so they fit the frame with `object-fit: cover`. Two are the minimum; if you want more, drop extra `<PhoneFrame>`s into the feed/direct sections (record screen, profile, activity, my-notes are all good candidates — tell me and I'll wire them in).
