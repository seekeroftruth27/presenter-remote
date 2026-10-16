# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- "Add from library" slides the library up from the bottom of the screen; Done
  (now green) slides it back down. Library songs are on a lighter grey, wider,
  with larger text.
- Tapping a song's arrangement opens its slides, like ⌄ and the title. Above the
  slides: the arrangement in use (slide count, sections) and a note that
  arrangements are changed in ProPresenter on a computer.
- The YOUTH MUSIC macro isn't shown.
- "Master" is spelled as in ProPresenter, not "MASTER".

### Fixed
- Double-tapping ▶ in the playlist could show the song on the Remote tab and
  then lose it again, so it had to be done twice. The Remote tab now checks
  ProPresenter one request at a time, so an older answer can't undo a newer one,
  and no longer re-reads the whole playlist each time the song changes.

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

