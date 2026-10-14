# Changelog

All notable changes to PP Remote. Add new entries under **Unreleased**; the
`release` skill (`scripts/release.py`) turns that section into the next version.

## [Unreleased]

### Changed
- **Dragging a song** is smoother and easier to follow: the held song shrinks a
  little and lifts, follows the finger, and the other songs slide out of its way
  instead of jumping.
- **Tapping a song's title** in the Playlist tab opens and closes its slide
  preview, the same as ⌄.

## [v1.3.0] — 2026-10-14

### Added
- **On-air colour** on the **Remote** tab: solid green when nothing is showing,
  a slow red fade in and out while a slide is on screen (from any tab), and
  then it reads **LIVE** instead of Remote.
- **Clear slide** also runs the **Speaking** macro.

### Changed
- **Double-tap to go live**: a slide tile on the Remote tab and ▶ on the
  Playlist tab now need a double-tap; a single tap does nothing.
- **Playlist buttons**: 🗑 is now on the left and ▶ on the right.
- **MASTER** is always the first arrangement choice, even for a song that only
  lists named arrangements.

