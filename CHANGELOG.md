# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Added
- **On-air colour** on the **Remote** tab: solid green when nothing is showing,
  a slow red fade in and out while a slide is on screen (from any tab).
- **Clear slide** also runs the **Speaking** macro.

### Changed
- **Double-tap to go live**: a slide tile on the Remote tab and ▶ on the
  Playlist tab now need a double-tap; a single tap does nothing.
- **Playlist buttons**: 🗑 is now on the left and ▶ on the right.
- **MASTER** is always the first arrangement choice, even for a song that only
  lists named arrangements.

## [v1.2.0] — 2026-10-13

### Added
- **Slide preview**: **⌄** next to a song's ≡ shows its slides, four to a row, in
  the order of the arrangement chosen. View only.

### Changed
- **Arrangements** come from the song itself in ProPresenter: **MASTER** first,
  then the named arrangements. There's no more typing a name (**Other…** is gone).
- **Announcements** items aren't shown in the Playlist tab at all (they were
  greyed out). They stay in the playlist untouched, and moving songs keeps them
  in place.
- Opening a playlist no longer reads every other playlist (that was for guessing
  arrangement names), so it's lighter on ProPresenter.

### Fixed
- **Playlists inside folders** (e.g. an archive folder) are listed; the folder
  itself no longer shows up as if it were a playlist.

