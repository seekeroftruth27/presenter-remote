# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- After double-tapping a song in the playlist, the Remote tab's slides could
  vanish ("No slides") or stay on the previous song until the song was started
  a second time. Right after a song starts, ProPresenter can briefly report the
  previous song or none of the new one's slides; the app now asks again until
  the answer is right, and reads the song once more a moment after it starts.

## [v1.3.8] — 2026-10-16

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

