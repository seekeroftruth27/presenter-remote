# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.3.5] — 2026-10-14

### Fixed
- The Remote tab's slides now follow the arrangement being played (for
  example "Default" with its repeated choruses), not the song's original
  order. The highlight, the Live panel and double-tap all use that order.
- MASTER (the song's own slide order) could be "not found" after a song was
  switched to a named arrangement such as "Default". The remote now remembers
  each song's MASTER once it has seen it. When it hasn't, it asks ProPresenter
  for "no arrangement"; if ProPresenter doesn't switch, the remote says to pick
  Master once in ProPresenter.
- Slide pictures for songs with an arrangement such as "Default" were the
  wrong ones for some slides (the Bridge could show a verse). ProPresenter
  numbers a song's pictures in its current arrangement, and the Remote tab,
  the Live panel and the playlist preview now do the same.

