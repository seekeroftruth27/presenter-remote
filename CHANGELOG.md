# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

## [v1.1.5] — 2026-10-13

### Fixed
- **Playlist changes were refused ("HTTP 404")**: adding, removing, reordering
  and changing arrangements. When saving a playlist, ProPresenter expects each
  song entry to carry the song's id where its own reading gives the entry's
  id; the app now sends it that way.

