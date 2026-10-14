# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Fixed
- The proxy window no longer fills with an error ("'Handler' object has no
  attribute 'path'") when something connects that isn't plain HTTP, for example
  a browser trying `https://`. It now prints one line saying the request was
  ignored. Those requests never reached ProPresenter either way.

## [v1.3.2] — 2026-10-14

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

