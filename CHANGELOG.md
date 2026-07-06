# Changelog

All notable changes to this project are documented here.

## [Unreleased]

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
