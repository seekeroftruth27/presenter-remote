# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- **Playlist editing is off by default.** During testing, ProPresenter's setup was
  damaged while playlists were being edited from the remote. Until that's
  understood, the proxy refuses every playlist change unless it's started with
  `--allow-playlist-edits`, and the page hides the edit controls (drag, 🗑,
  Add from library, the arrangement choice). Showing items, the slide preview,
  the Remote tab and macros all work as before. The iPhone app, which has no
  proxy, can't edit playlists at all.

### Added
- With editing allowed, the proxy records every change it sends (and every one
  it blocks) in `pp-proxy-changes.log` beside the exe.

## [v1.3.1] — 2026-10-14

### Changed
- **Dragging a song** is smoother and easier to follow: the held song shrinks a
  little and lifts, follows the finger, and the other songs slide out of its way
  instead of jumping.
- **Tapping a song's title** in the Playlist tab opens and closes its slide
  preview, the same as ⌄.

