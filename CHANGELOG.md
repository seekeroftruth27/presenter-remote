# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- On a Bible passage, the big picture's "next" could show a different item (for
  example the prayer slide that follows in the playlist) instead of the next
  verse. "Next" now always comes from the presentation on screen; on its last
  slide it's empty.

## [v1.3.18] — 2026-10-28

### Fixed
- The Remote tab could be one slide behind the stage screen (for example on a
  chorus with two identical slides), showing the wrong "next" lyrics. It now goes
  by the current and next text ProPresenter reports for the screen itself: the big
  picture shows exactly that, and the slide number and highlight follow it.

