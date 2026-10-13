# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- **A new proxy could start while an old one was still running** and quietly
  get none of the traffic, so the phone kept using the old version. Now the
  second copy says the port is already in use and doesn't start.

## [v1.1.5] — 2026-10-13

### Fixed
- **Playlist changes were refused ("HTTP 404")**: adding, removing, reordering
  and changing arrangements. When saving a playlist, ProPresenter expects each
  song entry to carry the song's id where its own reading gives the entry's
  id; the app now sends it that way.

