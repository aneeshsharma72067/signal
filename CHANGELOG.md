# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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
