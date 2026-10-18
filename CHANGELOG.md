# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- Double-tapping ▶ in the playlist runs the MUSIC & LYRICS macro first, then
  puts the song on screen. Clear slide runs the SPEAKING macro first, then
  clears. If a macro is missing, the rest still happens and the app says so.
- Remote tab: the song's arrangement is shown under the playlist
  ("Arrangement: …"). The text beside the live slide is larger: double size or
  more when it fits beside the picture, showing up to 6 whole lines of lyrics,
  never smaller than before.
- Slide group names are larger, the same size on the Remote tab and in the
  playlist's slide preview, which now shows them under each slide too.
- The playlist note now reads "… from a computer running ProPresenter."

### Fixed
- The Remote tab could stop following ProPresenter if ProPresenter kept giving
  answers that never "settled" after a song started. The app now waits for them
  for 3 seconds at most, and the slide highlight keeps following meanwhile.


## [v1.3.10] — 2026-10-17

### Fixed
- After double-tapping a slide on the Remote tab, the highlight could flash back
  to the previous slide before moving to the chosen one. ProPresenter can still
  report the old slide for a moment; the app now ignores that for a couple of
  seconds after a jump.

