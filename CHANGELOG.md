# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.3.7] — 2026-10-14

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

