# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.3.10] — 2026-10-17

### Fixed
- The Remote tab could stop following ProPresenter if ProPresenter kept giving
  answers that never "settled" after a song started. The app now waits for them
  for 3 seconds at most, and the slide highlight keeps following meanwhile.

### Fixed
- After double-tapping a slide on the Remote tab, the highlight could flash back
  to the previous slide before moving to the chosen one. ProPresenter can still
  report the old slide for a moment; the app now ignores that for a couple of
  seconds after a jump.

