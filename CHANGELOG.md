# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- The Remote tab could be one slide behind the stage screen (for example on a
  chorus with two identical slides), showing the wrong "next" lyrics. It now goes
  by the current and next text ProPresenter reports for the screen itself: the big
  picture shows exactly that, and the slide number and highlight follow it.

## [v1.3.17] — 2026-10-22

### Fixed
- PREV on the first slide of the playlist's first song (or NEXT on the last
  slide of its last) could still step into the hidden Announcements section. At
  either end of the playlist they now only say so and change nothing.

