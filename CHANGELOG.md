# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- The Playlist tab now shows each song's arrangement instead of offering a menu
  to change it. Tests on the real ProPresenter showed it can't be changed from
  outside: ProPresenter keeps each song on the arrangement picked in
  ProPresenter and quietly ignores any other, so the menu looked like it worked
  when it didn't. Pick the arrangement in ProPresenter; the playlist follows.
  Adding a song says which arrangement it came in with.
- Tapping a song's arrangement lists all its arrangements for reference
  (Master included): how many slides each has and its sections in order, with
  the current one marked. Looking at the list doesn't change anything.

## [v1.3.6] — 2026-10-14

### Fixed
- Slide pictures for songs with an arrangement such as "Default" were the
  wrong ones for some slides (the Bridge could show a verse). ProPresenter
  numbers a song's pictures in its current arrangement, and the Remote tab,
  the Live panel and the playlist preview now do the same.

