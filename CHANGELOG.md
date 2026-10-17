# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.3.9] — 2026-10-17

### Fixed
- After double-tapping a song in the playlist, the Remote tab's slides could
  vanish ("No slides") or stay on the previous song until the song was started
  a second time. Right after a song starts, ProPresenter can briefly report the
  previous song or none of the new one's slides; the app now asks again until
  the answer is right, and reads the song once more a moment after it starts.

