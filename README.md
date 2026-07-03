# SIGNAL 📟

**Signal** is a voice-centric, high-contrast social network built with **Modern Brutalism** design principles. Powered by **Expo (React Native)** and **Supabase**, Signal lets users share 30-second voice notes, react with curated emojis, follow friends, and listen to a real-time global feed.

---

## 🎨 The Brutalist Design Philosophy

Signal strictly adheres to a flat, raw, high-contrast design system. The guidelines below are defined in [DESIGN.md](file:///home/aneesh/personal/projects/signal/DESIGN.md):

*   **Rationed Accent Color**: Exactly one lime accent (`#ccff00` / `colors.signal`) is allowed per screen to indicate the primary action (e.g., `SignalButton` or own reaction status). Everything else is strict ink-on-white.
*   **Hard Inky Borders**: Surfaces use `2px` ink borders (`#1a1c1c` / `colors.ink`). Never `1px` or grey borders.
*   **Solid Offset Shadows**: No blurred shadows or soft gradients. We use a flat down-right block shadow (`shadowRadius: 0` with a `4px`/`2px`/`1px` offset depending on component size).
*   **Physical Tactility**: Tapping active elements removes the shadow and translates the component down-right by the offset, making the UI feel stamped onto the page.
*   **Oversized Typography**: Hierarchies are driven by type size and styles:
    *   **Display / Headlines**: [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque) with negative letter tracking.
    *   **Body**: [Hanken Grotesk](https://fonts.google.com/specimen/Hanken+Grotesk).
    *   **Metadata / Timestamps**: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) in `UPPERCASE` with wide letter-spacing.
*   **Top Bar Navigation**: Wordmark on the left, tab-switcher on the right (`FEED`, `NOTES`, `ME`). There is **no bottom navigation bar**.

---

## 🚀 Core Features

### 1. Voice Notes & Custom Audio Playback
*   **Recording**: Record voice notes up to 30 seconds. Features custom-built waveform visualizations during recording.
*   **Audio Engine**: Custom audio player built using `expo-audio` to handle streaming, pausing, and seeking.
*   **Size Limit**: Enforces a strict 2MB maximum audio file size on Supabase Storage.

### 2. Social Feeds & Keyset Pagination
*   **Feed Scopes**: Switch between `Everyone` (global feed of all users) and `Following` (limited to users you follow).
*   **Cursor Pagination**: Infinite scroll implemented via keyset pagination cursor tracking `created_at` timestamps.
*   **Realtime Subscriptions**: Direct integration with Supabase Realtime brings new notes and emoji reactions immediately to the screen.

### 3. Curated Reaction System
*   **Allowed Reactions**: Only 6 reaction emojis are supported (`🔥`, `💙`, `🤝`, `😂`, `💀`, `🤯`).
*   **One-Reaction Limit**: Users can togglingly react with exactly one emoji per voice note.
*   **Denormalized Counts**: To optimize feed performance, reaction counts are denormalized and managed server-side via PostgreSQL database triggers. No expensive row counting queries are executed on the feed.

### 4. Direct Follow Graph
*   Directed follower-followee relationships enable users to build their networks.
*   Follow lists feature keyset pagination and state updates.

### 5. Robust Safety & Moderation
*   **Blocking**: Block abusers. Feeds and public profiles automatically filter out blocked users in both directions (database-side exclusion helper + UI-side filtering).
*   **Content Reporting**: Flag inappropriate voice notes or users for administrative review.
*   **Rate Limits**: Server-side Postgres triggers enforce a 10-second cooldown between posts and a max limit of 10 posts per 10 minutes to prevent spam.

---

## 🛠️ Technology Stack

*   **Frontend**: 
    *   React Native & [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/)
    *   `expo-router` (File-based navigation with route protection/guards)
    *   `expo-audio` (Sound playback & recording)
    *   `expo-haptics` (Tactile button feedbacks)
    *   `react-native-reanimated` & `react-native-gesture-handler` (Micro-interactions)
*   **Backend**: 
    *   [Supabase](https://supabase.com) (Authentication, PostgreSQL Database, Realtime Subscriptions, public Storage buckets)
    *   Row-Level Security (RLS) policies for secure, user-level data protection.
    *   PostgreSQL database triggers, indexes, and custom views.

---

## 📂 Project Structure

```bash
├── app/                      # Expo Router navigation routes (gated entry layouts)
│   ├── _layout.tsx           # Application root layout with route protection guards
│   ├── index.tsx             # Entry anchor route (redirects based on auth status)
│   └── feed.tsx, my-notes.tsx, profile.tsx, username.tsx, etc.
│
├── src/
│   ├── components/           # Reusable brutalist UI elements and features
│   │   ├── ui.tsx            # Primitive typography, buttons (SignalButton), cards, and rules
│   │   ├── AppHeader.tsx     # Custom top-bar brand & route navigation layout
│   │   ├── AudioPlayer.tsx   # Custom voice playback bar and status
│   │   ├── VoiceNoteCard.tsx # Detailed card view for notes, metadata, and emojis
│   │   └── WaveformVisualizer.tsx
│   │
│   ├── context/
│   │   └── AuthContext.tsx   # Auth sessions caching, username onboard status, block lists
│   │
│   ├── hooks/                # Custom React hooks for feed, recorder, playback, follows
│   │   ├── useAudioPlayer.ts
│   │   ├── useAudioRecorder.ts
│   │   ├── useFeed.ts
│   │   └── useFollowList.ts
│   │
│   ├── lib/                  # Services and data layers
│   │   ├── supabase.ts       # Supabase Client setup
│   │   ├── social.ts         # User profiles, follow/unfollow, blocking, and reports
│   │   └── notes.ts          # Voice notes fetching, creations, reactions, and deletions
│   │
│   ├── theme.ts              # Brutalist color tokens, spacing tokens, and shadow presets
│   └── types.ts              # Database and decorated frontend models
│
└── supabase/
    └── migrations/           # Database schema migrations
```

---

## 🚀 Getting Started

### 1. Install Dependencies
Make sure you have Node.js and npm installed. Run the following command in the project root:
```bash
npm install
```

### 2. Configure Environment Variables
Create a local `.env` file at the root of the project using [.env.example](file:///home/aneesh/personal/projects/signal/.env.example) as a guide:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### 3. Initialize Supabase Database
Ensure your Supabase project is up-to-date with the database migrations. Apply all SQL files in the `supabase/migrations/` directory to your PostgreSQL instance (e.g., using the Supabase CLI or SQL editor).

### 4. Start the App
Start the Expo development server:
```bash
npx expo start
```
From the interactive terminal, you can boot the application:
*   Press `a` for Android Emulator.
*   Press `i` for iOS Simulator.
*   Press `w` for Web view.

---

## 🗄️ Database Migrations History

Signal's schema evolves via sequential SQL migration scripts found in `supabase/migrations/`:

| Migration | Name | Description |
| :--- | :--- | :--- |
| `0001` | `init` | Standard tables (`users`, `voice_notes`, `reactions`, `deliveries`), initial RLS, and voice-notes storage bucket. |
| `0002` | `global_feed` | Migrates from delivery inbox targets to a unified public global feed. Configures toggleable user-note reactions. |
| `0003` | `follows` | Directed user follow-graph and outward check logic. |
| `0004` | `follow_list_indexes` | Optimized indexes for followers/following list retrievals. |
| `0005` | `fix_reactions` | Refined constraint updates and triggers for active reactions. |
| `0006` | `denormalize_reaction_counts` | Adds Postgres trigger updates for pre-aggregating note reaction counts. |
| `0007` | `user_stats_rpc` | Database RPC for retrieving public profile totals (notes & reactions count). |
| `0008` | `realtime_feed` | Enables Postgres publication layers for realtime notes & reaction updates. |
| `0009` | `moderation` | Implements user blocking (`blocks` table, `blocked_user_ids` helper) and note reporting (`reports` table). |
| `0010` | `remove_deliveries` | Drops the dead `deliveries` table to clean database clutter. |
| `0011` | `signed_urls` | Transition to signed URL generation for secure, time-limited audio playback. |
| `0012` | `rate_limits_and_caps` | Enforces upload limits (2MB size cap, M4A format limit) and posting frequency limits (10-second cooldown, max 10 posts/10 mins). |

---

## 🤝 Rules for AI Agents & Developers

When making modifications or adding new features:
1.  **Check Expo Docs**: Read the versioned Expo SDK 54 documentation at [docs.expo.dev/versions/v54.0.0](https://docs.expo.dev/versions/v54.0.0/) before executing code (as specified in [AGENTS.md](file:///home/aneesh/personal/projects/signal/AGENTS.md)).
2.  **Respect the UI Rules**: Follow the Brutalist constraints defined in [DESIGN.md](file:///home/aneesh/personal/projects/signal/DESIGN.md). Always ensure interactive buttons translate on click and no more than one lime accent is visible on any single view.
