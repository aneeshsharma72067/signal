# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added
- **Voice replies**: any authenticated user can now reply to a top-level note with a
  30-second voice clip. Threads are one-level deep.
  - New `ThreadScreen` (route `/thread/[id]`): parent note at top, reply list below
    in conversation order (oldest first), live updates via Supabase realtime.
  - New `ReplyRecordScreen` (route `/thread/[id]/reply`): full-screen record modal,
    same record/preview/post flow as the main RecordScreen.
  - Reply counts shown on every VoiceNoteCard (all four screens: feed, my notes,
    profile, user profile) as a tappable "▶ N REPLIES" label.
  - `'reply'` notification type: note authors receive an activity notification when
    someone replies; tapping it navigates to the thread.
  - DB migration `0016_voice_replies.sql`: `parent_note_id` FK + `reply_count`
    denormalized column on `voice_notes`, triggers for count maintenance and
    notifications, partial index for fast thread fetches.

### Fixed
- Audio notes can be replayed after finishing. The active player now stays
  mounted at the end of a playthrough (instead of unmounting and persisting the
  end offset), so tapping play seeks back to 0 and replays. The covered portion
  of the waveform stays lime while paused/finished, reflecting progress. Also
  memoized play/pause and made autoplay + position-save fire exactly once.

### Added
- Sign-up screen now leads with the voices illustration in a brutalist frame and
  an inviting "JOIN THE SIGNAL" headline, visually distinct from log in.
- Log-in screen redesigned with a lime wordmark block and "WELCOME BACK" copy so
  the two auth modes are unmistakable at a glance.
- Loading spinner shown in place of the play button while audio buffers/loads.

### Changed
- Audio players remember their paused position: pausing a note (or switching to
  another) resumes from where it stopped instead of restarting. Positions reset
  when leaving the screen. Shared across Feed, My Notes, Profile, and user
  profiles via the new `useWindowedPlayback` hook.
